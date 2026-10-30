import {
  Subject,
  Teacher,
  ClassGroup,
  Classroom,
  LessonContract,
  ScheduledCard,
  SchoolSettings,
  CardRelationship,
  ConflictIssue,
  GenerationStats,
  WeekCycle,
} from '../types/timetable';
import {
  ConstraintContext,
  Occupancy,
  buildTimeModel,
  classDaySlots,
  classesOf,
  countGaps,
  cardUsesClass,
  cardUsesTeacher,
  getTimeOffStatus,
  maxRun,
  pairClashes,
  roomCapacity,
  subgroupCategory,
  teacherDaySlots,
  teachersOf,
  timeOffHits,
  timesOverlap,
  weeksOverlap,
  TimeModel,
  DayItem,
  dayProfile,
  cardBuilding,
} from './constraints';
import { SolveOptions, TimetableSolver } from './solver';

export interface CardToPlace {
  id: string;
  contractId: string;
  subjectId: string;
  teacherId: string;
  coTeacherIds?: string[];
  classId: string;
  jointClassIds?: string[];
  subgroupId?: string;
  subgroupName?: string;
  classroomId?: string;
  shift: number;
  weekCycle: WeekCycle;
  isDouble: boolean;
  /** Хос цагийн аль хагас вэ */
  doubleHalf?: 'first' | 'second';
  partnerCardId?: string;
}

// ---------------------------------------------------------------------------
// Ачааллын тооцоо (feasibility)
// ---------------------------------------------------------------------------

/** А/Б-г тооцсон 7 хоногийн ачаалал: all + max(week_a, week_b) */
function weeklyLoad(list: LessonContract[]): number {
  let all = 0;
  let a = 0;
  let b = 0;
  for (const ct of list) {
    const w = ct.weekCycle || 'all';
    if (w === 'week_a') a += ct.totalPeriods;
    else if (w === 'week_b') b += ct.totalPeriods;
    else all += ct.totalPeriods;
  }
  return all + Math.max(a, b);
}

/** Ангийн бодит нүдний хэрэгцээ: бүхэл ангийн цаг + хуваалт бүрийн хамгийн их бүлгийн цаг */
export function classSlotDemand(cls: ClassGroup, classes: ClassGroup[], contracts: LessonContract[]): number {
  const mine = contracts.filter((ct) => classesOf(ct).includes(cls.id));
  const whole = mine.filter((ct) => !ct.subgroupName);
  let demand = weeklyLoad(whole);

  const byCategory = new Map<string, Map<string, LessonContract[]>>();
  for (const ct of mine) {
    if (!ct.subgroupName) continue;
    const cat = subgroupCategory(classes, cls.id, ct.subgroupName);
    if (!byCategory.has(cat)) byCategory.set(cat, new Map());
    const names = byCategory.get(cat)!;
    if (!names.has(ct.subgroupName)) names.set(ct.subgroupName, []);
    names.get(ct.subgroupName)!.push(ct);
  }
  for (const names of byCategory.values()) {
    let mx = 0;
    for (const list of names.values()) mx = Math.max(mx, weeklyLoad(list));
    demand += mx;
  }
  return demand;
}

/**
 * Feasibility test before generator run
 */
export function testTimetableFeasibility(
  subjects: Subject[],
  teachers: Teacher[],
  classes: ClassGroup[],
  classrooms: Classroom[],
  contracts: LessonContract[],
  settings: SchoolSettings,
  relationships: CardRelationship[] = []
): { passed: boolean; messages: string[] } {
  const messages: string[] = [];
  const tm = buildTimeModel(settings);
  const days = settings.daysPerWeek;

  // Анги бүр
  for (const c of classes) {
    const demand = classSlotDemand(c, classes, contracts);
    const periods = tm.periodsCount(c.shift);
    let capacity = 0;
    for (let d = 0; d < days; d++)
      for (let p = 0; p < periods; p++)
        if (getTimeOffStatus(c.timeOff, c.shift, d, p) !== 'forbidden') capacity++;

    if (demand > capacity) {
      messages.push(
        `❌ [Анги: ${c.name}] 7 хоногт ${demand} нүд шаардлагатай (дэд бүлэг, А/Б-г тооцсон) боловч ${c.shift}-р ээлжид чөлөөт цагийг хассан ${capacity} нүд л байна.`
      );
    }
  }

  // Багш бүр (хамтран заах цагийг оролцуулна)
  for (const t of teachers) {
    const mine = contracts.filter((ct) => teachersOf(ct).includes(t.id));
    if (mine.length === 0) continue;
    const demand = weeklyLoad(mine);
    const shifts = new Set<number>();
    for (const ct of mine) {
      const cls = classes.find((c) => c.id === ct.classId);
      shifts.add(cls?.shift || 1);
    }
    let capacity = 0;
    for (const sh of shifts)
      for (let d = 0; d < days; d++)
        for (let p = 0; p < tm.periodsCount(sh); p++)
          if (getTimeOffStatus(t.timeOff, sh, d, p) !== 'forbidden') capacity++;

    if (demand > capacity) {
      messages.push(
        `❌ [Багш: ${t.name}] 7 хоногт ${demand} цаг заах ёстой боловч заадаг ээлжүүддээ чөлөөт цагийг хассан ${capacity} цаг л боломжтой.`
      );
    }
  }

  // Танхим бүр, ээлж бүрээр (хуваалцах танхимын багтаамжийг тооцно)
  const classById = new Map(classes.map((c) => [c.id, c]));
  for (const room of classrooms) {
    const mine = contracts.filter((ct) => ct.classroomId === room.id);
    if (mine.length === 0) continue;
    const cap = roomCapacity(room);
    const byShift = new Map<number, LessonContract[]>();
    for (const ct of mine) {
      const sh = classById.get(ct.classId)?.shift || 1;
      if (!byShift.has(sh)) byShift.set(sh, []);
      byShift.get(sh)!.push(ct);
    }
    for (const [sh, list] of byShift) {
      const demand = weeklyLoad(list);
      let slots = 0;
      for (let d = 0; d < days; d++)
        for (let p = 0; p < tm.periodsCount(sh); p++)
          if (getTimeOffStatus(room.timeOff, sh, d, p) !== 'forbidden') slots++;
      if (demand > slots * cap) {
        messages.push(
          `❌ [Танхим: ${room.name}] ${sh}-р ээлжид 7 хоногт ${demand} цаг оноогдсон боловч ${slots} нүд × ${cap} зэрэг = ${slots * cap} л багтана.`
        );
      }
    }
  }

  // 'Хатуу' "өдөрт 1-ээс илүүгүй удаа" дүрэм: хичээлийн оролт (хос цаг = 1) ≤ багш, анги хоёулаа боломжтой өдөр
  messages.push(...checkOncePerDayFeasibility(teachers, classes, contracts, relationships, settings));
  return finishFeasibility(messages);
}

/** Хатуу "өдөрт 1 удаа" дүрмийн өдрийн шалгалт (relationships өгсөн үед) */
export function checkOncePerDayFeasibility(
  teachers: Teacher[],
  classes: ClassGroup[],
  contracts: LessonContract[],
  relationships: CardRelationship[],
  settings: SchoolSettings
): string[] {
  const messages: string[] = [];
  const tm = buildTimeModel(settings);
  const rules = relationships.filter((r) => r.isActive && r.importance === 'strict' && r.condition === 'teacher_max_once_per_day');
  if (rules.length === 0) return messages;
  const tMap = new Map(teachers.map((t) => [t.id, t]));
  const cMap = new Map(classes.map((c) => [c.id, c]));
  for (const ct of contracts) {
    const rule = rules.find(
      (r) => (!r.teacherIds?.length || r.teacherIds.includes(ct.teacherId)) && (!r.classIds?.length || r.classIds.includes(ct.classId))
    );
    if (!rule) continue;
    const cls = cMap.get(ct.classId);
    const t = tMap.get(ct.teacherId);
    if (!cls) continue;
    const visits = (ct.singleLessons || 0) + (ct.doubleLessons || 0);
    let okDays = 0;
    for (let d = 0; d < settings.daysPerWeek; d++) {
      let any = false;
      for (let p = 0; p < tm.periodsCount(cls.shift); p++) {
        if (
          getTimeOffStatus(t?.timeOff, cls.shift, d, p) !== 'forbidden' &&
          getTimeOffStatus(cls.timeOff, cls.shift, d, p) !== 'forbidden'
        )
          any = true;
      }
      if (any) okDays++;
    }
    if (visits > okDays * (rule.value || 1)) {
      messages.push(
        `❌ [${cls.name} — ${t?.name || 'Багш'}] 7 хоногт ${visits} удаа орох ёстой боловч "өдөрт 1 удаа" (Хатуу) дүрмээр боломжтой өдөр ${okDays} л байна. Хос цаг нэмэх эсвэл дүрмийг 'Өндөр' болгоно уу.`
      );
    }
  }
  return messages;
}

function finishFeasibility(messages: string[]): { passed: boolean; messages: string[] } {
  const passed = messages.filter((m) => m.startsWith('❌')).length === 0;
  if (passed && messages.length === 0) {
    messages.push('✅ Хүчин чадлын шалгалт амжилттай! Бүх анги, багш нарын цаг багтаж байна.');
  }

  return { passed, messages };
}

/**
 * Expands contracts into schedulable cards
 */
export function expandContractsToCards(
  contracts: LessonContract[],
  classes: ClassGroup[],
  existingScheduled: ScheduledCard[] = []
): { cardsToPlace: CardToPlace[]; lockedCards: ScheduledCard[] } {
  const contractIds = new Set(contracts.map((c) => c.id));
  // Гэрээ нь устсан түгжсэн картыг авч үлдэхгүй
  const lockedCards = existingScheduled.filter((c) => c.isLocked && contractIds.has(c.contractId));
  const lockedCount: Record<string, number> = {};
  const lockedPairs: Record<string, number> = {};

  for (const c of lockedCards) {
    lockedCount[c.contractId] = (lockedCount[c.contractId] || 0) + 1;
    if (c.isDoublePart === 'first') lockedPairs[c.contractId] = (lockedPairs[c.contractId] || 0) + 1;
  }

  const cardsToPlace: CardToPlace[] = [];

  for (const ct of contracts) {
    const cls = classes.find((c) => c.id === ct.classId);
    const shift = cls?.shift || 1;
    let remaining = Math.max(0, ct.totalPeriods - (lockedCount[ct.id] || 0));
    let doublePairs = Math.max(0, (ct.doubleLessons || 0) - (lockedPairs[ct.id] || 0));

    const base = {
      contractId: ct.id,
      subjectId: ct.subjectId,
      teacherId: ct.teacherId,
      coTeacherIds: ct.coTeacherIds && ct.coTeacherIds.length > 0 ? [...ct.coTeacherIds] : undefined,
      classId: ct.classId,
      jointClassIds: ct.jointClassIds && ct.jointClassIds.length > 0 ? [...ct.jointClassIds] : undefined,
      subgroupId: ct.subgroupId,
      subgroupName: ct.subgroupName,
      classroomId: ct.classroomId,
      shift,
      weekCycle: (ct.weekCycle || 'all') as WeekCycle,
    };

    while (doublePairs > 0 && remaining >= 2) {
      const card1Id = `${ct.id}_dbl1_${doublePairs}`;
      const card2Id = `${ct.id}_dbl2_${doublePairs}`;
      cardsToPlace.push({ ...base, id: card1Id, isDouble: true, doubleHalf: 'first', partnerCardId: card2Id });
      cardsToPlace.push({ ...base, id: card2Id, isDouble: true, doubleHalf: 'second', partnerCardId: card1Id });
      doublePairs--;
      remaining -= 2;
    }

    let singleIdx = 1;
    while (remaining > 0) {
      cardsToPlace.push({ ...base, id: `${ct.id}_sgl_${singleIdx++}`, isDouble: false });
      remaining--;
    }
  }

  return { cardsToPlace, lockedCards };
}

/**
 * Main Timetable Generator
 *
 * 2-р шат: TimetableSolver (solver.ts) — хүндийг нь эхэлж байршуулж, гацвал саад болж буй
 * нэгжийг гаргаж засаад (ejection), дараа нь зөөх/солих замаар зөөлөн торгуулийг бууруулна.
 */
export async function generateTimetable(
  subjects: Subject[],
  teachers: Teacher[],
  classes: ClassGroup[],
  classrooms: Classroom[],
  contracts: LessonContract[],
  relationships: CardRelationship[],
  settings: SchoolSettings,
  existingCards: ScheduledCard[] = [],
  onProgress?: (progress: number, message: string) => void,
  options: SolveOptions = {}
): Promise<{
  scheduledCards: ScheduledCard[];
  stats: GenerationStats;
  conflicts: ConflictIssue[];
}> {
  const startTime = Date.now();
  const { cardsToPlace, lockedCards } = expandContractsToCards(contracts, classes, existingCards);

  onProgress?.(2, 'Картуудыг бэлтгэж, хүндийн зэргээр эрэмбэлж байна...');
  const solver = new TimetableSolver(
    settings,
    subjects,
    teachers,
    classes,
    classrooms,
    relationships,
    contracts,
    options.seed ?? 1
  );
  solver.placeLocked(lockedCards.map((c) => enrichFromContract(c, contracts)));
  solver.buildUnits(cardsToPlace);

  const timeLimitMs = options.timeLimitMs ?? defaultTimeLimitMs(cardsToPlace.length);
  const result = await solver.solve({ ...options, timeLimitMs }, onProgress);
  const resultCards = result.scheduledCards;

  onProgress?.(97, 'Зөрчил, хамаарлууд болон бүх дүрмүүдийг шалгаж байна...');
  const conflicts = verifyTimetable(resultCards, subjects, teachers, classes, classrooms, settings, relationships, contracts);

  const hardConflicts = conflicts.filter((c) => c.severity === 'error').length;
  const softConflicts = conflicts.filter((c) => c.severity === 'warning').length;

  onProgress?.(100, 'Амжилттай дууслаа!');

  const generationTimeMs = Date.now() - startTime;
  const totalCardsCount = cardsToPlace.length + lockedCards.length;
  const placedPercentage = totalCardsCount > 0 ? (resultCards.length / totalCardsCount) * 100 : 100;
  // Үнэлгээ: байршсан хувь − хатуу зөрчил (20 тус бүр) − зөөлөн сануулгын нягтрал (картад ногдох, дээд тал нь 40)
  const softDensity = totalCardsCount > 0 ? softConflicts / totalCardsCount : 0;
  const fitnessScore = Math.max(0, Math.round(placedPercentage - hardConflicts * 20 - Math.min(40, softDensity * 50)));

  return {
    scheduledCards: resultCards,
    stats: {
      totalCards: totalCardsCount,
      placedCards: resultCards.length,
      unplacedCards: totalCardsCount - resultCards.length,
      hardConflicts,
      softConflicts,
      generationTimeMs,
      fitnessScore,
    },
    conflicts,
  };
}

/** Картын тооноос хамаарсан анхдагч хугацаа: жижиг сургууль ~5 сек, 3600 карт ~60 сек */
export function defaultTimeLimitMs(cards: number): number {
  return Math.round(Math.min(120000, Math.max(5000, cards * 16)));
}

/** Хуучин хадгалсан картад хамтран заах багш, хамтатгасан ангийг гэрээнээс нөхнө */
function enrichFromContract(card: ScheduledCard, contracts?: LessonContract[]): ScheduledCard {
  if (!contracts) return card;
  return enrichCard(card, contracts.find((l) => l.id === card.contractId));
}

function enrichCard(card: ScheduledCard, ct?: LessonContract): ScheduledCard {
  if (!ct) return card;
  if ((card.coTeacherIds || !ct.coTeacherIds?.length) && (card.jointClassIds || !ct.jointClassIds?.length)) return card;
  const out = { ...card };
  if (!out.coTeacherIds && ct.coTeacherIds && ct.coTeacherIds.length > 0) out.coTeacherIds = [...ct.coTeacherIds];
  if (!out.jointClassIds && ct.jointClassIds && ct.jointClassIds.length > 0) out.jointClassIds = [...ct.jointClassIds];
  return out;
}

function slotLabel(settings: SchoolSettings, day: number, period: number, shift?: number): string {
  const dayName = settings.dayNames[day] || `${day + 1}-р өдөр`;
  return `${dayName} гарагийн ${period + 1}-р цагт${shift ? ` (${shift}-р ээлж)` : ''}`;
}

/**
 * Verification Engine
 */
export function verifyTimetable(
  rawCards: ScheduledCard[],
  subjects: Subject[],
  teachers: Teacher[],
  classes: ClassGroup[],
  classrooms: Classroom[],
  settings: SchoolSettings,
  relationships: CardRelationship[] = [],
  lessons?: LessonContract[]
): ConflictIssue[] {
  const issues: ConflictIssue[] = [];
  const lessonById = lessons ? new Map(lessons.map((l) => [l.id, l])) : null;
  const cards = lessonById ? rawCards.map((c) => enrichCard(c, lessonById.get(c.contractId))) : rawCards;
  const tm = buildTimeModel(settings);
  const ctx: ConstraintContext = { settings, teachers, classes, classrooms, subjects };
  const teacherName = (id: string) => teachers.find((t) => t.id === id)?.name || 'Багш';
  const className = (id: string) => classes.find((c) => c.id === id)?.name || 'Анги';

  // 1. Нөөцийн давхардал (багш, хамтран заах багш, анги, хамтатгасан анги, дэд бүлгийн хуваалт)
  const seen = new Set<string>();
  const byDay = new Map<number, ScheduledCard[]>();
  for (const c of cards) {
    if (!byDay.has(c.dayIndex)) byDay.set(c.dayIndex, []);
    byDay.get(c.dayIndex)!.push(c);
  }
  const startOf = (c: ScheduledCard) => tm.interval(c.shift, c.periodIndex).start;
  const endOf = (c: ScheduledCard) => tm.interval(c.shift, c.periodIndex).end;
  for (const dayCardsRaw of byDay.values()) {
    // Эхлэх цагаар эрэмбэлж, зөвхөн цаг нь давхцаж болох хосыг шалгана (sweep line)
    const dayCards = [...dayCardsRaw].sort((x, y) => startOf(x) - startOf(y));
    for (let i = 0; i < dayCards.length; i++) {
      const aEnd = endOf(dayCards[i]);
      for (let j = i + 1; j < dayCards.length && startOf(dayCards[j]) < aEnd; j++) {
        const a = dayCards[i];
        const b = dayCards[j];
        if (!weeksOverlap(a.weekCycle, b.weekCycle) || !timesOverlap(tm, a, b)) continue;
        for (const clash of pairClashes(classes, a, b)) {
          const key = `${clash.kind}_${clash.resourceId}_${a.dayIndex}_${tm.globalIndex(a.shift, a.periodIndex)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          if (clash.kind === 'teacher') {
            issues.push({
              id: `clash_t_${key}`,
              type: 'clash_teacher',
              severity: 'error',
              title: 'Багшийн цагийн давхардал',
              description: `${teacherName(clash.resourceId)} ${slotLabel(settings, a.dayIndex, a.periodIndex, a.shift)} ${className(a.classId)} ба ${className(b.classId)}-д зэрэг орохоор байна.`,
              dayIndex: a.dayIndex,
              periodIndex: a.periodIndex,
              shift: a.shift,
              entityType: 'teacher',
              entityId: clash.resourceId,
              cardIds: [a.id, b.id],
            });
          } else {
            const sa = a.subgroupName ? ` [${a.subgroupName}]` : '';
            const sb = b.subgroupName ? ` [${b.subgroupName}]` : '';
            issues.push({
              id: `clash_c_${key}`,
              type: 'clash_class',
              severity: 'error',
              title: 'Ангийн хичээлийн давхардал',
              description: `${className(clash.resourceId)} ${slotLabel(settings, a.dayIndex, a.periodIndex)} давхардсан хичээлтэй байна${
                sa || sb ? ` (${sa.trim() || 'бүхэл анги'} ба ${sb.trim() || 'бүхэл анги'} — сурагчид давхцана)` : ''
              }.`,
              dayIndex: a.dayIndex,
              periodIndex: a.periodIndex,
              shift: a.shift,
              entityType: 'class',
              entityId: clash.resourceId,
              cardIds: [a.id, b.id],
            });
          }
        }
      }
    }

    // Танхимын багтаамж
    const roomCards = new Map<string, ScheduledCard[]>();
    for (const c of dayCards) {
      if (!c.classroomId) continue;
      if (!roomCards.has(c.classroomId)) roomCards.set(c.classroomId, []);
      roomCards.get(c.classroomId)!.push(c);
    }
    for (const a of dayCards) {
      if (!a.classroomId) continue;
      const room = classrooms.find((r) => r.id === a.classroomId);
      const same = roomCards.get(a.classroomId)!.filter(
        (b) =>
          b.classroomId === a.classroomId && weeksOverlap(a.weekCycle, b.weekCycle) && (b === a || timesOverlap(tm, a, b))
      );
      const cap = roomCapacity(room);
      if (same.length > cap) {
        const key = `room_${a.classroomId}_${a.dayIndex}_${tm.globalIndex(a.shift, a.periodIndex)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        issues.push({
          id: `clash_r_${key}`,
          type: 'clash_room',
          severity: 'error',
          title: 'Танхимын давхардал',
          description: `${room?.name || 'Танхим'} ${slotLabel(settings, a.dayIndex, a.periodIndex, a.shift)} ${same.length} хичээлтэй (багтаамж: ${cap}).`,
          dayIndex: a.dayIndex,
          periodIndex: a.periodIndex,
          shift: a.shift,
          entityType: 'room',
          entityId: a.classroomId,
          cardIds: same.map((c) => c.id),
        });
      }
    }
  }

  // 2. Чөлөөт цаг
  const entityName = (type: string, id: string) =>
    type === 'teacher'
      ? teacherName(id)
      : type === 'class'
        ? className(id)
        : type === 'room'
          ? classrooms.find((r) => r.id === id)?.name || 'Танхим'
          : subjects.find((s) => s.id === id)?.name || 'Хичээл';
  const entityLabel: Record<string, string> = { teacher: 'багш', class: 'анги', room: 'танхим', subject: 'хичээл' };
  for (const c of cards) {
    for (const h of timeOffHits(ctx, c)) {
      issues.push({
        id: `timeoff_${h.entityType}_${h.entityId}_${c.id}`,
        type: 'time_off_violation',
        severity: h.status === 'forbidden' ? 'error' : 'warning',
        title: h.status === 'forbidden' ? 'Хаалттай цагт хичээл тавигдсан' : 'Хүсээгүй цагт хичээл тавигдсан',
        description: `${entityName(h.entityType, h.entityId)} (${entityLabel[h.entityType]}) ${slotLabel(settings, c.dayIndex, c.periodIndex, c.shift)} ${
          h.status === 'forbidden' ? 'хаалттай' : 'хүсээгүй'
        } байхад хичээл тавигдсан байна.`,
        dayIndex: c.dayIndex,
        periodIndex: c.periodIndex,
        shift: c.shift,
        entityType: h.entityType === 'subject' ? undefined : h.entityType,
        entityId: h.entityId,
        cardIds: [c.id],
      });
    }
  }

  // Багш, анги бүрийн өдрийн жагсаалт (дүрмийн шалгалтыг хурдан хийхэд)
  const roomById = new Map(classrooms.map((r) => [r.id, r]));
  const classById = new Map(classes.map((c) => [c.id, c]));
  const teacherDayItems = new Map<string, DayItem[]>();
  const classDayMap = new Map<string, ScheduledCard[]>();
  for (const c of cards) {
    const iv = tm.interval(c.shift, c.periodIndex);
    const item: DayItem = { start: iv.start, end: iv.end, shift: c.shift, building: cardBuilding(c, roomById, classById) };
    for (const t of teachersOf(c)) {
      const key = `${t}|${c.dayIndex}`;
      if (!teacherDayItems.has(key)) teacherDayItems.set(key, []);
      teacherDayItems.get(key)!.push(item);
    }
    for (const cl of classesOf(c)) {
      const key = `${cl}|${c.dayIndex}`;
      if (!classDayMap.has(key)) classDayMap.set(key, []);
      classDayMap.get(key)!.push(c);
    }
  }
  const cardsByClass = new Map<string, ScheduledCard[]>();
  for (const c of cards) {
    if (!cardsByClass.has(c.classId)) cardsByClass.set(c.classId, []);
    cardsByClass.get(c.classId)!.push(c);
  }
  const subgroupCardsByClassSubject = new Map<string, ScheduledCard[]>();
  for (const c of cards) {
    if (!c.subgroupName) continue;
    const key = `${c.classId}|${c.subjectId}`;
    if (!subgroupCardsByClassSubject.has(key)) subgroupCardsByClassSubject.set(key, []);
    subgroupCardsByClassSubject.get(key)!.push(c);
  }
  const tProfile = (tId: string, d: number, buffer = 1) => dayProfile(teacherDayItems.get(`${tId}|${d}`) || [], buffer);
  const classDayCards = (cId: string, d: number) => classDayMap.get(`${cId}|${d}`) || [];

  // 3. Байршаагүй цаг
  if (lessons) {
    const placedByContract = new Map<string, number>();
    for (const c of cards) placedByContract.set(c.contractId, (placedByContract.get(c.contractId) || 0) + 1);
    for (const l of lessons) {
      const missing = l.totalPeriods - (placedByContract.get(l.id) || 0);
      if (missing > 0) {
        const sub = subjects.find((s) => s.id === l.subjectId);
        issues.push({
          id: `unplaced_${l.id}`,
          type: 'unplaced',
          severity: 'warning',
          title: 'Байршаагүй цаг',
          description: `${className(l.classId)}${l.subgroupName ? ` [${l.subgroupName}]` : ''} — ${sub?.name || 'Хичээл'} (${teacherName(l.teacherId)}): ${missing} цаг хуваарьт ороогүй байна.`,
          entityType: 'class',
          entityId: l.classId,
        });
      }
    }
  }

  // 3. Rule 1: 2 хичээл нэг өдөрт орохгүй (cannot_same_day)
  for (const r of relationships) {
    if (!r.isActive || r.condition !== 'cannot_same_day' || r.subjectIds.length < 2) continue;
    const targetClasses =
      r.classIds && r.classIds.length > 0
        ? classes.filter((c) => r.classIds.includes(c.id))
        : classes;

    for (const cls of targetClasses) {
      for (let d = 0; d < settings.daysPerWeek; d++) {
        const dayCards = classDayCards(cls.id, d).filter((c) => c.classId === cls.id);
        const presentSubjects = Array.from(
          new Set(
            dayCards.map((c) => c.subjectId).filter((sId) => r.subjectIds.includes(sId))
          )
        );

        if (presentSubjects.length >= 2) {
          const names = presentSubjects
            .map((sId) => subjects.find((s) => s.id === sId)?.name || sId)
            .join(', ');
          const dayName = settings.dayNames[d] || `${d + 1}-р өдөр`;
          issues.push({
            id: `rule_same_day_${cls.id}_${d}`,
            type: 'custom_constraint',
            severity: r.importance === 'strict' ? 'error' : 'warning',
            title: '2 хичээл нэг өдөрт орсон байна',
            description: `${cls.name} ангид ${dayName} гарагт ${names} хичээлүүд нэг өдөр зэрэг тавигдсан байна. (Дүрэм: 2 хичээл нэг өдөрт орохгүй)`,
            dayIndex: d,
            entityType: 'class',
            entityId: cls.id,
          });
        }
      }
    }
  }

  // 4. Rule 2: 2 хичээл дараалласан цагт орохгүй (cannot_consecutive)
  for (const r of relationships) {
    if (!r.isActive || r.condition !== 'cannot_consecutive' || r.subjectIds.length < 2) continue;
    const targetClasses =
      r.classIds && r.classIds.length > 0
        ? classes.filter((c) => r.classIds.includes(c.id))
        : classes;

    for (const cls of targetClasses) {
      for (let d = 0; d < settings.daysPerWeek; d++) {
        const dayCards = classDayCards(cls.id, d).filter((c) => c.classId === cls.id);
        for (const c1 of dayCards) {
          if (!r.subjectIds.includes(c1.subjectId)) continue;
          const otherSubjects = r.subjectIds.filter((sId) => sId !== c1.subjectId);

          const consecutiveCard = dayCards.find(
            (c2) =>
              c2.periodIndex === c1.periodIndex + 1 && otherSubjects.includes(c2.subjectId)
          );

          if (consecutiveCard) {
            const s1Name = subjects.find((s) => s.id === c1.subjectId)?.name || c1.subjectId;
            const s2Name =
              subjects.find((s) => s.id === consecutiveCard.subjectId)?.name ||
              consecutiveCard.subjectId;
            const dayName = settings.dayNames[d] || `${d + 1}-р өдөр`;

            issues.push({
              id: `rule_consec_${cls.id}_${d}_${c1.periodIndex}`,
              type: 'custom_constraint',
              severity: r.importance === 'strict' ? 'error' : 'warning',
              title: '2 хичээл дараалласан цагт орсон байна',
              description: `${cls.name} ангид ${dayName} гарагийн ${c1.periodIndex + 1} ба ${
                c1.periodIndex + 2
              }-р цагт ${s1Name} ба ${s2Name} дараалан тавигдсан байна. (Дүрэм: 2 хичээл дараалласан цагт орохгүй)`,
              dayIndex: d,
              periodIndex: c1.periodIndex,
              entityType: 'class',
              entityId: cls.id,
            });
          }
        }
      }
    }
  }

  // 5. Rule 3: Сонгосон хичээл эхний юм уу сүүлийн цагт орох (first_or_last)
  for (const r of relationships) {
    if (!r.isActive || r.condition !== 'first_or_last') continue;
    const targetClasses =
      r.classIds && r.classIds.length > 0
        ? classes.filter((c) => r.classIds.includes(c.id))
        : classes;

    for (const cls of targetClasses) {
      const shiftConf =
        settings.shifts.find((s) => s.shiftNumber === cls.shift) || settings.shifts[0];
      const periodsCount = shiftConf?.periodsCount || 6;

      const matchCards = (cardsByClass.get(cls.id) || []).filter(
        // Хос цагийн 2-р хагас 1-р хагасаараа шийдэгдэнэ
        (c) => r.subjectIds.includes(c.subjectId) && c.isDoublePart !== 'second'
      );

      for (const card of matchCards) {
        const mode = r.firstOrLastMode || 'first_or_last';
        const isFirst = card.periodIndex === 0;
        const isLast =
          card.periodIndex === periodsCount - 1 ||
          (card.isDoublePart === 'first' && card.periodIndex === periodsCount - 2);

        const isOk = mode === 'first_only' ? isFirst : mode === 'last_only' ? isLast : (isFirst || isLast);

        if (!isOk) {
          const sub = subjects.find((s) => s.id === card.subjectId);
          const dayName = settings.dayNames[card.dayIndex] || `${card.dayIndex + 1}-р өдөр`;
          const modeLabel =
            mode === 'first_only'
              ? 'Зөвхөн 1-р цагт'
              : mode === 'last_only'
              ? 'Зөвхөн сүүлчийн цагт'
              : '1-р эсвэл сүүлчийн цагт';

          issues.push({
            id: `rule_first_last_${card.id}`,
            type: 'custom_constraint',
            severity: r.importance === 'strict' ? 'error' : 'warning',
            title: 'Эхний эсвэл сүүлчийн цагт ороогүй байна',
            description: `${cls.name} ангийн ${sub?.name || 'Хичээл'} ${dayName} гарагийн ${
              card.periodIndex + 1
            }-р цагт тавигдсан байна. (Дүрэм: ${modeLabel} орох)`,
            dayIndex: card.dayIndex,
            periodIndex: card.periodIndex,
            entityType: 'class',
            entityId: cls.id,
          });
        }
      }
    }
  }

  // 6. Rule 4: Сонгосон хичээл зөвхөн боломжтой цаг дээр хуваарилах (allowed_periods_only)
  for (const r of relationships) {
    if (
      !r.isActive ||
      r.condition !== 'allowed_periods_only' ||
      !r.allowedPeriods ||
      r.allowedPeriods.length === 0
    )
      continue;

    const targetClasses =
      r.classIds && r.classIds.length > 0
        ? classes.filter((c) => r.classIds.includes(c.id))
        : classes;

    for (const cls of targetClasses) {
      const matchCards = (cardsByClass.get(cls.id) || []).filter((c) => r.subjectIds.includes(c.subjectId));

      for (const card of matchCards) {
        if (!r.allowedPeriods.includes(card.periodIndex)) {
          const sub = subjects.find((s) => s.id === card.subjectId);
          const dayName = settings.dayNames[card.dayIndex] || `${card.dayIndex + 1}-р өдөр`;
          const allowedNames = r.allowedPeriods.map((p) => p + 1).join(', ');

          issues.push({
            id: `rule_allowed_p_${card.id}`,
            type: 'custom_constraint',
            severity: r.importance === 'strict' ? 'error' : 'warning',
            title: 'Хичээл зөвшөөрөгдөөгүй цагт тавигдсан байна',
            description: `${cls.name} ангийн ${sub?.name || 'Хичээл'} ${dayName} гарагийн ${
              card.periodIndex + 1
            }-р цагт орсон байна. (Зөвшөөрөгдөх цагууд: ${allowedNames}-р цаг)`,
            dayIndex: card.dayIndex,
            periodIndex: card.periodIndex,
            entityType: 'class',
            entityId: cls.id,
          });
        }
      }
    }
  }

  // 7. Rule 5: Өдөрт заах цагийн хамгийн их/бага хязгаар (daily_hours_limit) — давхардалгүй нүдээр тоолно
  for (const r of relationships) {
    if (!r.isActive || r.condition !== 'daily_hours_limit') continue;
    const minP = r.minPeriodsPerDay ?? 2;
    const maxP = r.maxPeriodsPerDay ?? 5;
    const sev = r.importance === 'strict' ? 'error' : 'warning';

    if (r.targetEntity === 'classes') {
      const targetClasses =
        r.classIds && r.classIds.length > 0 ? classes.filter((c) => r.classIds.includes(c.id)) : classes;
      for (const cls of targetClasses) {
        for (let d = 0; d < settings.daysPerWeek; d++) {
          const count = classDaySlots(classDayCards(cls.id, d), cls.id, d).length;
          if (count > maxP || (count > 0 && count < minP)) {
            const dayName = settings.dayNames[d] || `${d + 1}-р өдөр`;
            issues.push({
              id: `rule_daily_hrs_c_${r.id}_${cls.id}_${d}`,
              type: 'custom_constraint',
              severity: sev,
              title: 'Ангийн өдрийн цагийн хязгаар зөрчигдсөн',
              description: `${cls.name} анги ${dayName} гарагт нийт ${count} цаг орж байна. (Зөвшөөрөгдөх: ${minP}-${maxP} цаг)`,
              dayIndex: d,
              entityType: 'class',
              entityId: cls.id,
            });
          }
        }
      }
    } else {
      const targetTeachers =
        r.teacherIds && r.teacherIds.length > 0 ? teachers.filter((t) => r.teacherIds!.includes(t.id)) : teachers;
      for (const t of targetTeachers) {
        for (let d = 0; d < settings.daysPerWeek; d++) {
          const count = tProfile(t.id, d).count;
          if (count > maxP || (count > 0 && count < minP)) {
            const dayName = settings.dayNames[d] || `${d + 1}-р өдөр`;
            issues.push({
              id: `rule_daily_hrs_t_${r.id}_${t.id}_${d}`,
              type: 'custom_constraint',
              severity: sev,
              title: 'Багшийн өдөрт заах цагийн хязгаар зөрчигдсөн',
              description: `${t.name} багш ${dayName} гарагт нийт ${count} цаг орж байна. (Зөвшөөрөгдөх: ${minP}-${maxP} цаг)`,
              dayIndex: d,
              entityType: 'teacher',
              entityId: t.id,
            });
          }
        }
      }
    }
  }

  // 8. Rule 6: Дараалласан цагийн хамгийн их хязгаар (max_consecutive_periods) — багшийнхыг бодит цагийн шугамаар
  for (const r of relationships) {
    if (!r.isActive || r.condition !== 'max_consecutive_periods') continue;
    const maxConsec = r.maxConsecutive ?? 3;
    const sev = r.importance === 'strict' ? 'error' : 'warning';

    if (r.targetEntity === 'classes') {
      const targetClasses =
        r.classIds && r.classIds.length > 0 ? classes.filter((c) => r.classIds.includes(c.id)) : classes;
      for (const cls of targetClasses) {
        for (let d = 0; d < settings.daysPerWeek; d++) {
          const run = maxRun(classDaySlots(classDayCards(cls.id, d), cls.id, d));
          if (run > maxConsec) {
            const dayName = settings.dayNames[d] || `${d + 1}-р өдөр`;
            issues.push({
              id: `rule_consec_c_${r.id}_${cls.id}_${d}`,
              type: 'custom_constraint',
              severity: sev,
              title: 'Ангийн дараалласан цагийн хязгаар хэтэрсэн',
              description: `${cls.name} анги ${dayName} гарагт завсаргүй ${run} цаг дараалан хичээлтэй байна. (Дээд хязгаар: ${maxConsec} цаг)`,
              dayIndex: d,
              entityType: 'class',
              entityId: cls.id,
            });
          }
        }
      }
    } else {
      const targetTeachers =
        r.teacherIds && r.teacherIds.length > 0 ? teachers.filter((t) => r.teacherIds!.includes(t.id)) : teachers;
      for (const t of targetTeachers) {
        for (let d = 0; d < settings.daysPerWeek; d++) {
          const run = tProfile(t.id, d).maxRun;
          if (run > maxConsec) {
            const dayName = settings.dayNames[d] || `${d + 1}-р өдөр`;
            issues.push({
              id: `rule_consec_t_${r.id}_${t.id}_${d}`,
              type: 'custom_constraint',
              severity: sev,
              title: 'Багшийн дараалласан цагийн хязгаар хэтэрсэн',
              description: `${t.name} багш ${dayName} гарагт завсаргүй ${run} цаг дараалан хичээлтэй байна. (Дээд хязгаар: ${maxConsec} цаг)`,
              dayIndex: d,
              entityType: 'teacher',
              entityId: t.id,
            });
          }
        }
      }
    }
  }

  // 9. Rule 7: 1 багш 1 анги бүлэгт өдөрт 1-с илүүгүй удаа орох (teacher_max_once_per_day)
  const teacherDailyRules = relationships.filter((r) => r.isActive && r.condition === 'teacher_max_once_per_day');
  if (teacherDailyRules.length > 0) {
    const groups = new Map<string, { teacherId: string; classId: string; dayIndex: number; cards: ScheduledCard[] }>();
    for (const card of cards) {
      const key = JSON.stringify([card.teacherId, card.classId, card.dayIndex]);
      if (!groups.has(key))
        groups.set(key, { teacherId: card.teacherId, classId: card.classId, dayIndex: card.dayIndex, cards: [] });
      groups.get(key)!.cards.push(card);
    }

    for (const g of groups.values()) {
      const matchingRule = teacherDailyRules.find(
        (r) =>
          (!r.teacherIds || r.teacherIds.length === 0 || r.teacherIds.includes(g.teacherId)) &&
          (!r.classIds || r.classIds.length === 0 || r.classIds.includes(g.classId))
      );
      if (!matchingRule) continue;

      // Хос цагийн 2-р хагас, А/Б-ийн ээлжилсэн карт нэг оролт гэж тоологдоно
      const sorted = [...g.cards].sort((a, b) => a.periodIndex - b.periodIndex);
      let visitCount = 0;
      const countedPeriods = new Set<number>();
      for (const c of sorted) {
        if (countedPeriods.has(c.periodIndex)) continue;
        countedPeriods.add(c.periodIndex);
        const isContinuation =
          matchingRule.allowDoubleConsecutive !== false &&
          c.isDoublePart === 'second' &&
          sorted.some((p) => p.id === c.linkedCardId && p.periodIndex === c.periodIndex - 1);
        if (!isContinuation) visitCount++;
      }

      const maxAllowed = matchingRule.value || 1;
      if (visitCount > maxAllowed) {
        const dayName = settings.dayNames[g.dayIndex] || `${g.dayIndex + 1}-р өдөр`;
        issues.push({
          id: `rule_t_daily_${matchingRule.id}_${g.teacherId}_${g.classId}_${g.dayIndex}`,
          type: 'custom_constraint',
          severity: matchingRule.importance === 'strict' ? 'error' : 'warning',
          title: 'Багшийн өдрийн оролтын хязгаарлалт хэтэрсэн',
          description: `${teacherName(g.teacherId)} ${className(g.classId)}-д ${dayName} гарагт ${visitCount} удаа (зөвшөөрөгдөх: ${maxAllowed} удаа) хичээл орохоор байна. (Дүрэм: Өдөрт 1-с илүүгүй удаа орох)`,
          dayIndex: g.dayIndex,
          entityType: 'teacher',
          entityId: g.teacherId,
        });
      }
    }
  }

  // 10. Rule 8: 1 ангийн 1 хичээлийн дэд бүлгүүд ижил цагт хичээллэх (same_subject_subgroups_simultaneous)
  const sameSubgroupRules = relationships.filter(
    (r) => r.isActive && r.condition === 'same_subject_subgroups_simultaneous'
  );

  for (const rule of sameSubgroupRules) {
    const targetClasses =
      rule.classIds && rule.classIds.length > 0
        ? classes.filter((c) => rule.classIds.includes(c.id))
        : classes;

    for (const cls of targetClasses) {
      const targetSubjects =
        rule.subjectIds && rule.subjectIds.length > 0
          ? subjects.filter((s) => rule.subjectIds.includes(s.id))
          : subjects;

      for (const sub of targetSubjects) {
        const classSubCards = subgroupCardsByClassSubject.get(`${cls.id}|${sub.id}`) || [];

        if (classSubCards.length > 1) {
          const distinctSubgroups = Array.from(new Set(classSubCards.map((c) => c.subgroupName!)));
          if (distinctSubgroups.length > 1) {
            const timeSlots = new Set(classSubCards.map((c) => `${c.dayIndex}_${c.periodIndex}`));
            for (const slotKey of timeSlots) {
              const [dStr, pStr] = slotKey.split('_');
              const d = Number(dStr);
              const p = Number(pStr);
              const cardsInSlot = classSubCards.filter(
                (c) => c.dayIndex === d && c.periodIndex === p
              );
              const subgroupsInSlot = new Set(cardsInSlot.map((c) => c.subgroupName));

              if (subgroupsInSlot.size < distinctSubgroups.length) {
                const missing = distinctSubgroups.filter((s) => !subgroupsInSlot.has(s));
                const dayName = settings.dayNames[d] || `${d + 1}-р өдөр`;
                issues.push({
                  id: `rule_subgroup_sync_${cls.id}_${sub.id}_${slotKey}`,
                  type: 'custom_constraint',
                  severity: rule.importance === 'strict' ? 'error' : 'warning',
                  title: 'Ижил хичээлийн дэд бүлгүүд зэрэгцэн ороогүй байна',
                  description: `${cls.name} ангийн ${sub.name} хичээл ${dayName} гарагийн ${
                    p + 1
                  }-р цагт бүх дэд бүлгээр зэрэгцэн ижил цагт хичээллээгүй байна (Үлдсэн: ${missing.join(', ')}).`,
                  dayIndex: d,
                  periodIndex: p,
                  entityType: 'class',
                  entityId: cls.id,
                });
              }
            }
          }
        }
      }
    }
  }

  // 11. Rule 9: 2 өөр хичээлийн дэд бүлгүүд зэрэгцэн ижил цагт хичээллэх (different_subjects_subgroups_simultaneous)
  const crossSubgroupRules = relationships.filter(
    (r) =>
      r.isActive &&
      r.condition === 'different_subjects_subgroups_simultaneous' &&
      r.parallelPairs &&
      r.parallelPairs.length >= 2
  );

  for (const rule of crossSubgroupRules) {
    const targetClasses =
      rule.classIds && rule.classIds.length > 0
        ? classes.filter((c) => rule.classIds.includes(c.id))
        : classes;

    for (const cls of targetClasses) {
      const pair1 = rule.parallelPairs![0];
      const pair2 = rule.parallelPairs![1];

      const cards1 = cards.filter(
        (c) =>
          c.classId === cls.id &&
          c.subjectId === pair1.subjectId &&
          (!pair1.subgroupName || c.subgroupName === pair1.subgroupName)
      );
      const cards2 = cards.filter(
        (c) =>
          c.classId === cls.id &&
          c.subjectId === pair2.subjectId &&
          (!pair2.subgroupName || c.subgroupName === pair2.subgroupName)
      );

      const sub1 = subjects.find((s) => s.id === pair1.subjectId);
      const sub2 = subjects.find((s) => s.id === pair2.subjectId);

      for (const c1 of cards1) {
        const matchingCard2 = cards2.find(
          (c2) => c2.dayIndex === c1.dayIndex && c2.periodIndex === c1.periodIndex
        );
        if (!matchingCard2) {
          const dayName = settings.dayNames[c1.dayIndex] || `${c1.dayIndex + 1}-р өдөр`;
          issues.push({
            id: `rule_cross_sub_missing_${cls.id}_${c1.id}`,
            type: 'custom_constraint',
            severity: rule.importance === 'strict' ? 'error' : 'warning',
            title: 'Зэрэгцээ дэд бүлгийн зөрүү',
            description: `${cls.name} ангийн ${sub1?.name || 'Хичээл 1'} (${
              pair1.subgroupName || '1-р бүлэг'
            }) хичээл ${dayName} гарагийн ${c1.periodIndex + 1}-р цагт ${sub2?.name || 'Хичээл 2'} (${
              pair2.subgroupName || '2-р бүлэг'
            })-тойгоо зэрэгцэн ороогүй байна.`,
            dayIndex: c1.dayIndex,
            periodIndex: c1.periodIndex,
            entityType: 'class',
            entityId: cls.id,
          });
        }
      }
    }
  }

  // 12. Rule 10: Өдрийн болон 7 хоногийн цонхтой цагийн дээд хязгаар (max_gaps_daily_weekly)
  for (const r of relationships) {
    if (!r.isActive || r.condition !== 'max_gaps_daily_weekly') continue;
    const maxDayGaps = r.maxGapsPerDay ?? 1;
    const maxWeekGaps = r.maxGapsPerWeek ?? 3;
    const sev = r.importance === 'strict' ? 'error' : 'warning';
    const isClasses = r.targetEntity === 'classes';

    const targets: { id: string; name: string }[] = isClasses
      ? (r.classIds && r.classIds.length > 0 ? classes.filter((c) => r.classIds.includes(c.id)) : classes)
      : r.teacherIds && r.teacherIds.length > 0
        ? teachers.filter((t) => r.teacherIds!.includes(t.id))
        : teachers;

    for (const ent of targets) {
      let weeklyGaps = 0;
      for (let d = 0; d < settings.daysPerWeek; d++) {
        const dailyGaps = isClasses
          ? countGaps(classDaySlots(classDayCards(ent.id, d), ent.id, d))
          : tProfile(ent.id, d).gaps;
        weeklyGaps += dailyGaps;
        if (dailyGaps > maxDayGaps) {
          const dayName = settings.dayNames[d] || `${d + 1}-р өдөр`;
          issues.push({
            id: `rule_gaps_day_${isClasses ? 'c' : 't'}_${r.id}_${ent.id}_${d}`,
            type: 'gap_excess',
            severity: sev,
            title: isClasses ? 'Ангийн өдрийн цонх хэтэрсэн' : 'Багшийн өдрийн цонх хэтэрсэн',
            description: `${ent.name} ${isClasses ? 'анги' : 'багш'} ${dayName} гарагт нийт ${dailyGaps} цонхтой байна. (Дээд хязгаар: ${maxDayGaps} цонх)`,
            dayIndex: d,
            entityType: isClasses ? 'class' : 'teacher',
            entityId: ent.id,
          });
        }
      }
      if (weeklyGaps > maxWeekGaps) {
        issues.push({
          id: `rule_gaps_week_${isClasses ? 'c' : 't'}_${r.id}_${ent.id}`,
          type: 'gap_excess',
          severity: sev,
          title: isClasses ? 'Ангийн 7 хоногийн нийт цонх хэтэрсэн' : 'Багшийн 7 хоногийн нийт цонх хэтэрсэн',
          description: `${ent.name} ${isClasses ? 'анги' : 'багш'} 7 хоногт нийт ${weeklyGaps} цонхтой байна. (Дээд хязгаар: ${maxWeekGaps} цонх)`,
          entityType: isClasses ? 'class' : 'teacher',
          entityId: ent.id,
        });
      }
    }
  }

  // 13. Rule 11: 7 хоногт хичээл заах өдрийн дээд /доод хязгаар (teaching_days_limit)
  for (const r of relationships) {
    if (!r.isActive || r.condition !== 'teaching_days_limit') continue;
    const minDays = r.minDaysPerWeek ?? 3;
    const maxDays = r.maxDaysPerWeek ?? 5;
    const sev = r.importance === 'strict' ? 'error' : 'warning';
    const isClasses = r.targetEntity === 'classes';

    const targets: { id: string; name: string }[] = isClasses
      ? (r.classIds && r.classIds.length > 0 ? classes.filter((c) => r.classIds.includes(c.id)) : classes)
      : r.teacherIds && r.teacherIds.length > 0
        ? teachers.filter((t) => r.teacherIds!.includes(t.id))
        : teachers;

    for (const ent of targets) {
      const distinctDays = new Set(
        Array.from({ length: settings.daysPerWeek }, (_, d) => d).filter((d) =>
          isClasses ? classDayCards(ent.id, d).length > 0 : (teacherDayItems.get(`${ent.id}|${d}`)?.length || 0) > 0
        )
      );
      if (distinctDays.size > 0 && (distinctDays.size < minDays || distinctDays.size > maxDays)) {
        issues.push({
          id: `rule_days_limit_${isClasses ? 'c' : 't'}_${r.id}_${ent.id}`,
          type: 'custom_constraint',
          severity: sev,
          title: isClasses
            ? 'Ангийн 7 хоногт хичээллэх өдрийн тоо зөрчигдсөн'
            : 'Багшийн 7 хоногт хичээл заах өдрийн тоо зөрчигдсөн',
          description: `${ent.name} ${isClasses ? 'анги 7 хоногт' : 'багш 7 хоногт'} ${distinctDays.size} өдөр хичээлтэй байна. (Зөвшөөрөгдөх: ${minDays} - ${maxDays} өдөр)`,
          entityType: isClasses ? 'class' : 'teacher',
          entityId: ent.id,
        });
      }
    }
  }

  // 14. Rule 12: Ээлж дамжих цонх (minimize_shift_crossing_gap) — бодит цагаар
  for (const r of relationships) {
    if (!r.isActive || r.condition !== 'minimize_shift_crossing_gap') continue;
    const maxCrossGap = r.maxCrossShiftGap ?? 1;
    const targetTeachers =
      r.teacherIds && r.teacherIds.length > 0 ? teachers.filter((t) => r.teacherIds!.includes(t.id)) : teachers;
    for (const t of targetTeachers) {
      for (let d = 0; d < settings.daysPerWeek; d++) {
        const worst = Math.max(0, ...tProfile(t.id, d).crossShiftGaps);
        if (worst > maxCrossGap) {
          const dayName = settings.dayNames[d] || `${d + 1}-р өдөр`;
          issues.push({
            id: `rule_shift_cross_t_${r.id}_${t.id}_${d}`,
            type: 'shift_mismatch',
            severity: r.importance === 'strict' ? 'error' : 'warning',
            title: 'Ээлж хоорондын дамжих цонх хэт урт байна',
            description: `${t.name} багш ${dayName} гарагт ээлж солигдохдоо ${worst} цагийн завсартай байна. (Дээд хязгаар: ${maxCrossGap} цаг)`,
            dayIndex: d,
            entityType: 'teacher',
            entityId: t.id,
          });
        }
      }
    }
  }

  // 15. Байр солих завсар (building_transfer_buffer)
  for (const r of relationships) {
    if (!r.isActive || r.condition !== 'building_transfer_buffer') continue;
    const buffer = r.value ?? 1;
    const targetTeachers =
      r.teacherIds && r.teacherIds.length > 0 ? teachers.filter((t) => r.teacherIds!.includes(t.id)) : teachers;
    for (const t of targetTeachers) {
      for (let d = 0; d < settings.daysPerWeek; d++) {
        const hops = tProfile(t.id, d, buffer).buildingHops;
        if (hops > 0) {
          const dayName = settings.dayNames[d] || `${d + 1}-р өдөр`;
          issues.push({
            id: `rule_building_${r.id}_${t.id}_${d}`,
            type: 'building_clash',
            severity: r.importance === 'strict' ? 'error' : 'warning',
            title: 'Байр солихдоо завсаргүй',
            description: `${t.name} багш ${dayName} гарагт ${hops} удаа өөр байр руу завсаргүй шилжиж байна. (Шаардлага: ${buffer} цагийн завсар)`,
            dayIndex: d,
            entityType: 'teacher',
            entityId: t.id,
          });
        }
      }
    }
  }

  // 16. 7 хоногт жигд тархах (ideal_distribution): нэг хичээл нэг өдөр 2+ удаа (хос цаг, дэд бүлгийн зэрэгцээ, А/Б-г нэг гэж)
  for (const r of relationships) {
    if (!r.isActive || r.condition !== 'ideal_distribution') continue;
    const targetClasses = r.classIds && r.classIds.length > 0 ? classes.filter((c) => r.classIds.includes(c.id)) : classes;
    for (const cls of targetClasses) {
      for (let d = 0; d < settings.daysPerWeek; d++) {
        const dc = classDayCards(cls.id, d);
        const bySubject = new Map<string, { a: Set<number>; b: Set<number> }>();
        for (const c of dc) {
          if (r.subjectIds?.length && !r.subjectIds.includes(c.subjectId)) continue;
          if (c.isDoublePart === 'second') continue;
          if (!bySubject.has(c.subjectId)) bySubject.set(c.subjectId, { a: new Set(), b: new Set() });
          const e = bySubject.get(c.subjectId)!;
          if (c.weekCycle !== 'week_b') e.a.add(c.periodIndex);
          if (c.weekCycle !== 'week_a') e.b.add(c.periodIndex);
        }
        for (const [sid, e] of bySubject) {
          const n = Math.max(e.a.size, e.b.size);
          if (n > 1) {
            const dayName = settings.dayNames[d] || `${d + 1}-р өдөр`;
            issues.push({
              id: `rule_ideal_${r.id}_${cls.id}_${d}_${sid}`,
              type: 'custom_constraint',
              severity: r.importance === 'strict' ? 'error' : 'warning',
              title: 'Хичээл 7 хоногт жигд тархаагүй',
              description: `${cls.name} ангид ${dayName} гарагт ${subjects.find((s) => s.id === sid)?.name || 'хичээл'} ${n} удаа орж байна.`,
              dayIndex: d,
              entityType: 'class',
              entityId: cls.id,
            });
          }
        }
      }
    }
  }

  return issues;
}
