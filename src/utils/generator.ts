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
} from './constraints';

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
  settings: SchoolSettings
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

/** Байрлуулах гэж буй картыг ScheduledCard болгоно */
function toScheduled(card: CardToPlace, day: number, period: number): ScheduledCard {
  const sc: ScheduledCard = {
    id: card.id,
    contractId: card.contractId,
    subjectId: card.subjectId,
    teacherId: card.teacherId,
    classId: card.classId,
    subgroupName: card.subgroupName,
    classroomId: card.classroomId,
    shift: card.shift,
    weekCycle: card.weekCycle,
    dayIndex: day,
    periodIndex: period,
  };
  if (card.coTeacherIds) sc.coTeacherIds = card.coTeacherIds;
  if (card.jointClassIds) sc.jointClassIds = card.jointClassIds;
  if (card.doubleHalf && card.partnerCardId) {
    sc.isDoublePart = card.doubleHalf;
    sc.linkedCardId = card.partnerCardId;
  }
  return sc;
}

// ---------------------------------------------------------------------------
// Хамаарлын (relationship) хатуу дүрмүүд — зөвхөн 'strict' ач холбогдолтойг энд шүүнэ.
// 'high' / 'normal' дүрмүүд verify-д анхааруулга болно (жинтэй тооцоо 2-р шатанд).
// ---------------------------------------------------------------------------

function rulesAllow(
  card: CardToPlace,
  day: number,
  period: number,
  tm: TimeModel,
  relationships: CardRelationship[],
  placed: ScheduledCard[]
): boolean {
  const periodsCount = tm.periodsCount(card.shift);
  const strict = relationships.filter((r) => r.isActive && r.importance === 'strict');
  if (strict.length === 0) return true;

  // Хос цагийн 1-р хагасыг шалгахдаа 2-р хагасын цагийг урьдчилан тооцно
  const extendsNext = card.doubleHalf === 'first';
  const inClassScope = (r: CardRelationship) =>
    !r.classIds || r.classIds.length === 0 || classesOf(card).some((c) => r.classIds.includes(c));
  const inTeacherScope = (r: CardRelationship, tId: string) =>
    !r.teacherIds || r.teacherIds.length === 0 || r.teacherIds.includes(tId);

  for (const r of strict) {
    switch (r.condition) {
      case 'cannot_same_day': {
        if (!inClassScope(r) || !r.subjectIds.includes(card.subjectId)) break;
        const others = r.subjectIds.filter((s) => s !== card.subjectId);
        if (placed.some((c) => c.classId === card.classId && c.dayIndex === day && others.includes(c.subjectId)))
          return false;
        break;
      }
      case 'cannot_consecutive': {
        if (!inClassScope(r) || !r.subjectIds.includes(card.subjectId)) break;
        const others = r.subjectIds.filter((s) => s !== card.subjectId);
        const lo = period - 1;
        const hi = extendsNext ? period + 2 : period + 1;
        if (
          placed.some(
            (c) =>
              c.classId === card.classId &&
              c.dayIndex === day &&
              (c.periodIndex === lo || c.periodIndex === hi) &&
              others.includes(c.subjectId)
          )
        )
          return false;
        break;
      }
      case 'first_or_last': {
        if (!inClassScope(r) || !r.subjectIds.includes(card.subjectId)) break;
        if (card.doubleHalf === 'second') break; // 1-р хагасаар шийдэгдэнэ
        const mode = r.firstOrLastMode || 'first_or_last';
        const isFirst = period === 0;
        const isLast = period === periodsCount - 1 || (extendsNext && period === periodsCount - 2);
        const ok = mode === 'first_only' ? isFirst : mode === 'last_only' ? isLast : isFirst || isLast;
        if (!ok) return false;
        break;
      }
      case 'allowed_periods_only': {
        if (!inClassScope(r) || !r.subjectIds.includes(card.subjectId)) break;
        if (r.allowedPeriods && r.allowedPeriods.length > 0 && !r.allowedPeriods.includes(period)) return false;
        break;
      }
      case 'daily_hours_limit': {
        const maxPerDay = r.maxPeriodsPerDay || 6;
        if (r.targetEntity === 'classes') {
          if (!inClassScope(r)) break;
          for (const cId of classesOf(card)) {
            if (r.classIds?.length && !r.classIds.includes(cId)) continue;
            if (classDaySlots(placed, cId, day, [period]).length > maxPerDay) return false;
          }
        } else {
          for (const tId of teachersOf(card)) {
            if (!inTeacherScope(r, tId)) continue;
            const slots = teacherDaySlots(tm, placed, tId, day, [{ shift: card.shift, periodIndex: period }]);
            if (slots.length > maxPerDay) return false;
          }
        }
        break;
      }
      case 'max_consecutive_periods': {
        const maxConsec = r.maxConsecutive || 3;
        if (r.targetEntity === 'classes') {
          for (const cId of classesOf(card)) {
            if (r.classIds?.length && !r.classIds.includes(cId)) continue;
            const extra = extendsNext ? [period, period + 1] : [period];
            if (maxRun(classDaySlots(placed, cId, day, extra)) > maxConsec) return false;
          }
        } else {
          for (const tId of teachersOf(card)) {
            if (!inTeacherScope(r, tId)) continue;
            const extra = [{ shift: card.shift, periodIndex: period }];
            if (extendsNext) extra.push({ shift: card.shift, periodIndex: period + 1 });
            if (maxRun(teacherDaySlots(tm, placed, tId, day, extra)) > maxConsec) return false;
          }
        }
        break;
      }
      case 'teacher_max_once_per_day': {
        if (!inTeacherScope(r, card.teacherId) || !inClassScope(r)) break;
        const sameDay = placed.filter(
          (c) =>
            c.teacherId === card.teacherId &&
            c.classId === card.classId &&
            c.dayIndex === day &&
            weeksOverlap(c.weekCycle, card.weekCycle)
        );
        if (sameDay.length === 0) break;
        // Зөвхөн өөрийн хос цагийн хамтрагчтайгаа залгаа байх нь зөвшөөрөгдөнө
        const onlyPartner =
          r.allowDoubleConsecutive !== false &&
          !!card.partnerCardId &&
          sameDay.every((c) => c.id === card.partnerCardId && Math.abs(c.periodIndex - period) === 1);
        if (!onlyPartner) return false;
        break;
      }
      case 'max_gaps_daily_weekly': {
        const maxDayGaps = r.maxGapsPerDay ?? 1;
        if (r.targetEntity === 'classes') {
          for (const cId of classesOf(card)) {
            if (r.classIds?.length && !r.classIds.includes(cId)) continue;
            const extra = extendsNext ? [period, period + 1] : [period];
            if (countGaps(classDaySlots(placed, cId, day, extra)) > maxDayGaps) return false;
          }
        } else {
          for (const tId of teachersOf(card)) {
            if (!inTeacherScope(r, tId)) continue;
            const extra = [{ shift: card.shift, periodIndex: period }];
            if (extendsNext) extra.push({ shift: card.shift, periodIndex: period + 1 });
            if (countGaps(teacherDaySlots(tm, placed, tId, day, extra)) > maxDayGaps) return false;
          }
        }
        break;
      }
      case 'teaching_days_limit': {
        const maxDays = r.maxDaysPerWeek ?? 5;
        if (r.targetEntity === 'classes') {
          for (const cId of classesOf(card)) {
            if (r.classIds?.length && !r.classIds.includes(cId)) continue;
            const days = new Set(placed.filter((c) => cardUsesClass(c, cId)).map((c) => c.dayIndex));
            if (!days.has(day) && days.size >= maxDays) return false;
          }
        } else {
          for (const tId of teachersOf(card)) {
            if (!inTeacherScope(r, tId)) continue;
            const days = new Set(placed.filter((c) => cardUsesTeacher(c, tId)).map((c) => c.dayIndex));
            if (!days.has(day) && days.size >= maxDays) return false;
          }
        }
        break;
      }
      case 'minimize_shift_crossing_gap': {
        const maxCrossGap = r.maxCrossShiftGap ?? 1;
        for (const tId of teachersOf(card)) {
          if (!inTeacherScope(r, tId)) continue;
          const dayCards = placed.filter((c) => cardUsesTeacher(c, tId) && c.dayIndex === day);
          const prevShift = dayCards.filter((c) => c.shift === card.shift - 1);
          const nextShift = dayCards.filter((c) => c.shift === card.shift + 1);
          if (prevShift.length > 0) {
            const prevPeriods = tm.periodsCount(card.shift - 1);
            const maxP = Math.max(...prevShift.map((c) => c.periodIndex));
            if (prevPeriods - 1 - maxP + period > maxCrossGap) return false;
          }
          if (nextShift.length > 0) {
            const myP = extendsNext ? period + 1 : period;
            const minP = Math.min(...nextShift.map((c) => c.periodIndex));
            if (periodsCount - 1 - myP + minP > maxCrossGap) return false;
          }
        }
        break;
      }
      default:
        break;
    }
  }
  return true;
}

/**
 * Main Timetable Generator
 *
 * 1-р шат: бүх хатуу хязгаарлалт нэгдсэн цөмөөр (constraints.ts) шалгагдана.
 * Байршуулах арга (greedy) нь 2-р шатанд буцаалттай хайлтаар солигдоно.
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
  onProgress?: (progress: number, message: string) => void
): Promise<{
  scheduledCards: ScheduledCard[];
  stats: GenerationStats;
  conflicts: ConflictIssue[];
}> {
  const startTime = Date.now();
  const { cardsToPlace, lockedCards } = expandContractsToCards(contracts, classes, existingCards);

  const ctx: ConstraintContext = { settings, teachers, classes, classrooms, subjects };
  const occ = new Occupancy(ctx);
  const tm = occ.tm;

  const resultCards: ScheduledCard[] = [];
  for (const c of lockedCards) {
    const enriched = enrichFromContract(c, contracts);
    resultCards.push(enriched);
    occ.add(enriched);
  }

  /** Бүлэг картыг (багц, хос) тухайн өдөр түр байрлуулж үзнэ. Амжилттай бол байрлуулсан картуудыг буцаана. */
  const tryPlaceGroup = (items: { card: CardToPlace; period: number }[], day: number): ScheduledCard[] | null => {
    const added: ScheduledCard[] = [];
    let ok = true;
    for (const { card, period } of items) {
      if (period < 0 || period >= tm.periodsCount(card.shift)) {
        ok = false;
        break;
      }
      const sc = toScheduled(card, day, period);
      if (!occ.canPlace(sc) || !rulesAllow(card, day, period, tm, relationships, resultCards)) {
        ok = false;
        break;
      }
      occ.add(sc);
      resultCards.push(sc);
      added.push(sc);
    }
    if (!ok) {
      for (const sc of added) {
        occ.remove(sc);
        resultCards.splice(resultCards.indexOf(sc), 1);
      }
      return null;
    }
    return added;
  };

  const rollback = (added: ScheduledCard[]) => {
    for (const sc of added) {
      occ.remove(sc);
      resultCards.splice(resultCards.indexOf(sc), 1);
    }
  };

  /** Боломжит бүх нүдийг туршаад хамгийн бага торгуультайд байрлуулна */
  const placeBest = (
    shift: number,
    lastStartOffset: number,
    build: (period: number) => { card: CardToPlace; period: number }[],
    penaltyOf: (day: number, period: number) => number
  ): boolean => {
    let best: { day: number; period: number; penalty: number } | null = null;
    const periods = tm.periodsCount(shift);
    for (let day = 0; day < settings.daysPerWeek; day++) {
      for (let period = 0; period < periods - lastStartOffset; period++) {
        const added = tryPlaceGroup(build(period), day);
        if (!added) continue;
        rollback(added);
        const penalty = penaltyOf(day, period);
        if (!best || penalty < best.penalty) best = { day, period, penalty };
      }
    }
    if (!best) return false;
    return tryPlaceGroup(build(best.period), best.day) !== null;
  };

  // А/Б: эсрэг 7 хоногийн карттай нүдийг хуваалцахыг илүүд үзнэ
  const abBonus = (card: CardToPlace, day: number, period: number) => {
    if (card.weekCycle === 'all') return 0;
    const opposite = card.weekCycle === 'week_a' ? 'week_b' : 'week_a';
    return resultCards.some(
      (rc) =>
        rc.weekCycle === opposite &&
        rc.dayIndex === day &&
        rc.periodIndex === period &&
        classesOf(rc).some((c) => classesOf(card).includes(c))
    )
      ? -60
      : 0;
  };

  // --- Дэд бүлгийн зэрэгцээ багцууд ---
  const crossSubgroupRules = relationships.filter(
    (r) =>
      r.isActive &&
      r.condition === 'different_subjects_subgroups_simultaneous' &&
      r.parallelPairs &&
      r.parallelPairs.length >= 2
  );
  const sameSubgroupRules = relationships.filter(
    (r) => r.isActive && r.condition === 'same_subject_subgroups_simultaneous'
  );

  const parallelBundles: CardToPlace[][] = [];
  const processedCardIds = new Set<string>();
  // Хос цагийн хагасууд багцад орохгүй (хос шинжээ алдахгүйн тулд)
  const bundleable = (c: CardToPlace) => !processedCardIds.has(c.id) && !c.isDouble;

  for (const rule of crossSubgroupRules) {
    const targetClasses =
      rule.classIds && rule.classIds.length > 0 ? classes.filter((c) => rule.classIds.includes(c.id)) : classes;
    for (const cls of targetClasses) {
      const pair1 = rule.parallelPairs![0];
      const pair2 = rule.parallelPairs![1];
      const cards1 = cardsToPlace.filter(
        (c) =>
          bundleable(c) &&
          c.classId === cls.id &&
          c.subjectId === pair1.subjectId &&
          (!pair1.subgroupName || c.subgroupName === pair1.subgroupName)
      );
      const cards2 = cardsToPlace.filter(
        (c) =>
          bundleable(c) &&
          c.classId === cls.id &&
          c.subjectId === pair2.subjectId &&
          (!pair2.subgroupName || c.subgroupName === pair2.subgroupName)
      );
      const minLen = Math.min(cards1.length, cards2.length);
      for (let i = 0; i < minLen; i++) {
        parallelBundles.push([cards1[i], cards2[i]]);
        processedCardIds.add(cards1[i].id);
        processedCardIds.add(cards2[i].id);
      }
    }
  }

  for (const cls of classes) {
    for (const sub of subjects) {
      const isRuleActive =
        sameSubgroupRules.length === 0 ||
        sameSubgroupRules.some(
          (r) =>
            (!r.classIds || r.classIds.length === 0 || r.classIds.includes(cls.id)) &&
            (!r.subjectIds || r.subjectIds.length === 0 || r.subjectIds.includes(sub.id))
        );
      if (!isRuleActive) continue;

      const subCards = cardsToPlace.filter(
        (c) => bundleable(c) && c.classId === cls.id && c.subjectId === sub.id && Boolean(c.subgroupName)
      );
      if (subCards.length < 2) continue;

      // Зөвхөн нэг хуваалтын бүлгүүдийг багцална
      const byCategory = new Map<string, Map<string, CardToPlace[]>>();
      for (const c of subCards) {
        const cat = subgroupCategory(classes, cls.id, c.subgroupName!);
        if (!byCategory.has(cat)) byCategory.set(cat, new Map());
        const m = byCategory.get(cat)!;
        if (!m.has(c.subgroupName!)) m.set(c.subgroupName!, []);
        m.get(c.subgroupName!)!.push(c);
      }
      for (const groupMap of byCategory.values()) {
        const groups = Array.from(groupMap.keys());
        if (groups.length < 2) continue;
        const minCount = Math.min(...groups.map((g) => groupMap.get(g)!.length));
        for (let i = 0; i < minCount; i++) {
          const bundle = groups.map((g) => groupMap.get(g)![i]);
          bundle.forEach((c) => processedCardIds.add(c.id));
          parallelBundles.push(bundle);
        }
      }
    }
  }

  // --- Хос ба дан картууд ---
  const doublePairs: { card1: CardToPlace; card2: CardToPlace }[] = [];
  const singleCards: CardToPlace[] = [];
  for (const card of cardsToPlace) {
    if (processedCardIds.has(card.id)) continue;
    if (card.doubleHalf === 'first' && card.partnerCardId) {
      const partner = cardsToPlace.find((c) => c.id === card.partnerCardId && !processedCardIds.has(c.id));
      if (partner) {
        doublePairs.push({ card1: card, card2: partner });
        processedCardIds.add(card.id);
        processedCardIds.add(partner.id);
        continue;
      }
    }
    if (card.doubleHalf === 'second') continue; // хамтрагчтайгаа хамт байрлана
    singleCards.push(card);
  }
  // Хамтрагчгүй үлдсэн 2-р хагасууд
  for (const card of cardsToPlace) {
    if (!processedCardIds.has(card.id) && card.doubleHalf === 'second' && !doublePairs.some((p) => p.card2.id === card.id)) {
      singleCards.push({ ...card, isDouble: false, doubleHalf: undefined, partnerCardId: undefined });
    }
  }

  // --- 1. Багцууд ---
  onProgress?.(10, 'Зэрэгцээ дэд бүлгүүдийн хичээлүүдийг ижил цагт хуваарилж байна...');
  for (const bundle of parallelBundles) {
    const ok = placeBest(
      bundle[0].shift,
      0,
      (period) => bundle.map((card) => ({ card, period })),
      (_day, period) => Math.abs(period - 2.5) * 5
    );
    // Зэрэгцүүлэх боломжгүй бол (жишээ нь нэг багш хоёр бүлгийг заадаг) тус тусад нь байршуулна;
    // зэрэгцээгүй нь verify-д дүрмийн зөрчил болж харагдана.
    if (!ok) singleCards.push(...bundle);
  }

  // --- 2. Хос цагууд ---
  onProgress?.(35, 'Хос цагийн хичээлүүдийг байршуулж байна...');
  for (const { card1, card2 } of doublePairs) {
    placeBest(
      card1.shift,
      1,
      (period) => [
        { card: card1, period },
        { card: card2, period: period + 1 },
      ],
      (day, period) => period * 2 + abBonus(card1, day, period)
    );
  }

  // --- 3. Дан цагууд ---
  onProgress?.(65, 'Дан хичээлүүдийг хуваарилж байна...');
  for (const card of singleCards) {
    placeBest(
      card.shift,
      0,
      (period) => [{ card, period }],
      (day, period) => {
        let penalty = 0;
        if (
          resultCards.some(
            (rc) => rc.classId === card.classId && rc.subjectId === card.subjectId && rc.dayIndex === day
          )
        )
          penalty += 100;
        const sub = subjects.find((s) => s.id === card.subjectId);
        if (sub?.shortName === 'Мат' && period <= 2) penalty -= 20;
        penalty += abBonus(card, day, period);
        return penalty;
      }
    );
  }

  onProgress?.(90, 'Зөрчил, хамаарлууд болон бүх дүрмүүдийг шалгаж байна...');
  const conflicts = verifyTimetable(
    resultCards,
    subjects,
    teachers,
    classes,
    classrooms,
    settings,
    relationships,
    contracts
  );

  const hardConflicts = conflicts.filter((c) => c.severity === 'error').length;
  const softConflicts = conflicts.filter((c) => c.severity === 'warning').length;

  onProgress?.(100, 'Амжилттай дууслаа!');

  const generationTimeMs = Date.now() - startTime;
  const totalCardsCount = cardsToPlace.length + lockedCards.length;
  const placedPercentage = totalCardsCount > 0 ? (resultCards.length / totalCardsCount) * 100 : 100;
  const fitnessScore = Math.max(0, Math.round(placedPercentage - hardConflicts * 20 - softConflicts * 2));

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

/** Хуучин хадгалсан картад хамтран заах багш, хамтатгасан ангийг гэрээнээс нөхнө */
function enrichFromContract(card: ScheduledCard, contracts?: LessonContract[]): ScheduledCard {
  if (!contracts) return card;
  const ct = contracts.find((l) => l.id === card.contractId);
  if (!ct) return card;
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
  const cards = lessons ? rawCards.map((c) => enrichFromContract(c, lessons)) : rawCards;
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
  for (const dayCards of byDay.values()) {
    for (let i = 0; i < dayCards.length; i++) {
      for (let j = i + 1; j < dayCards.length; j++) {
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
    for (const a of dayCards) {
      if (!a.classroomId) continue;
      const room = classrooms.find((r) => r.id === a.classroomId);
      const same = dayCards.filter(
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
        const dayCards = cards.filter((c) => c.classId === cls.id && c.dayIndex === d);
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
        const dayCards = cards.filter((c) => c.classId === cls.id && c.dayIndex === d);
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

      const matchCards = cards.filter(
        // Хос цагийн 2-р хагас 1-р хагасаараа шийдэгдэнэ
        (c) => c.classId === cls.id && r.subjectIds.includes(c.subjectId) && c.isDoublePart !== 'second'
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
      const matchCards = cards.filter(
        (c) => c.classId === cls.id && r.subjectIds.includes(c.subjectId)
      );

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
          const count = classDaySlots(cards, cls.id, d).length;
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
          const count = teacherDaySlots(tm, cards, t.id, d).length;
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
          const run = maxRun(classDaySlots(cards, cls.id, d));
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
          const run = maxRun(teacherDaySlots(tm, cards, t.id, d));
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
        const classSubCards = cards.filter(
          (c) => c.classId === cls.id && c.subjectId === sub.id && Boolean(c.subgroupName)
        );

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
        const slots = isClasses ? classDaySlots(cards, ent.id, d) : teacherDaySlots(tm, cards, ent.id, d);
        const dailyGaps = countGaps(slots);
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
        cards.filter((c) => (isClasses ? cardUsesClass(c, ent.id) : cardUsesTeacher(c, ent.id))).map((c) => c.dayIndex)
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

  // 14. Rule 12: 2 буюу 3 ээлжинд хичээл заадаг бол аль болох 2 ээлжийг дамжих цонх бага байлгах (minimize_shift_crossing_gap)
  for (const r of relationships) {
    if (!r.isActive || r.condition !== 'minimize_shift_crossing_gap') continue;
    const maxCrossGap = r.maxCrossShiftGap ?? 1;

    const targetTeachers =
      r.teacherIds && r.teacherIds.length > 0
        ? teachers.filter((t) => r.teacherIds!.includes(t.id))
        : teachers;

    for (const t of targetTeachers) {
      for (let d = 0; d < settings.daysPerWeek; d++) {
        const dayCards = cards.filter((c) => c.teacherId === t.id && c.dayIndex === d);
        const shift1Cards = dayCards.filter((c) => c.shift === 1);
        const shift2Cards = dayCards.filter((c) => c.shift === 2);
        const shift3Cards = dayCards.filter((c) => c.shift === 3);

        // Check Shift 1 -> Shift 2
        if (shift1Cards.length > 0 && shift2Cards.length > 0) {
          const maxP1 = Math.max(...shift1Cards.map((c) => c.periodIndex));
          const minP2 = Math.min(...shift2Cards.map((c) => c.periodIndex));
          const s1Config = settings.shifts.find((s) => s.shiftNumber === 1);
          const s1Periods = s1Config?.periodsCount || 6;
          const crossGap = (s1Periods - 1 - maxP1) + minP2;

          if (crossGap > maxCrossGap) {
            const dayName = settings.dayNames[d] || `${d + 1}-р өдөр`;
            issues.push({
              id: `rule_shift_cross_t_${t.id}_${d}_1_2`,
              type: 'shift_mismatch',
              severity: r.importance === 'strict' ? 'error' : 'warning',
              title: 'Ээлж хоорондын дамжих цонх хэт урт байна',
              description: `${t.name} багш ${dayName} гарагт 1 ба 2-р ээлж хооронд ${crossGap} цагийн хэт урт завсартай байна. (Дээд хязгаар: ${maxCrossGap} цаг)`,
              dayIndex: d,
              entityType: 'teacher',
              entityId: t.id,
            });
          }
        }

        // Check Shift 2 -> Shift 3
        if (shift2Cards.length > 0 && shift3Cards.length > 0) {
          const maxP2 = Math.max(...shift2Cards.map((c) => c.periodIndex));
          const minP3 = Math.min(...shift3Cards.map((c) => c.periodIndex));
          const s2Config = settings.shifts.find((s) => s.shiftNumber === 2);
          const s2Periods = s2Config?.periodsCount || 6;
          const crossGap = (s2Periods - 1 - maxP2) + minP3;

          if (crossGap > maxCrossGap) {
            const dayName = settings.dayNames[d] || `${d + 1}-р өдөр`;
            issues.push({
              id: `rule_shift_cross_t_${t.id}_${d}_2_3`,
              type: 'shift_mismatch',
              severity: r.importance === 'strict' ? 'error' : 'warning',
              title: 'Ээлж хоорондын дамжих цонх хэт урт байна',
              description: `${t.name} багш ${dayName} гарагт 2 ба 3-р ээлж хооронд ${crossGap} цагийн хэт урт завсартай байна. (Дээд хязгаар: ${maxCrossGap} цаг)`,
              dayIndex: d,
              entityType: 'teacher',
              entityId: t.id,
            });
          }
        }
      }
    }
  }

  return issues;
}
