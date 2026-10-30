/**
 * Орлон заалт: өвчтэй, чөлөөтэй багшийн хичээлийг тухайн өдөрт зохицуулах хөдөлгүүр.
 *
 * Менежерүүдийн гараар хийдэг зохицуулалтыг сонголт болгон гаргаж, жигнэж эрэмбэлнэ:
 *   1. Хамтран заах багшгүй орох / хамтран заагч дангаараа орох
 *   2. Ангийн өөр цагийн хичээлтэй солих — багш өөр цагт ирж өөрөө заана (хагас өдрийн чөлөө)
 *   3. Дэд бүлгийг нөгөө бүлэгтэй нийлүүлэх — нэг багш бүх ангид орно
 *   4. Ижил хичээл заадаг сул багш орлох
 *   5. Ангийн өдрийн өмнө/ард сул цаг руу шилжүүлэх
 *   6. Эхний/сүүлийн хичээл бол анги хожуу ирэх / эрт тарах
 *   7. Сүүлийн (эхний) хичээлийг энэ цаг руу татаж, анги эрт тарах (хожуу ирэх)
 *   8. Зэрэгцээ ангийн ижил хичээлтэй нийлүүлж 2 анги хамт орох
 *   9. Өөр хичээлийн сул багш орлох (хянах)
 *  10. Хичээл орохгүй (бие даан хичээллэх)
 *
 * Суурь хуваарь өөрчлөгдөхгүй: өдөр бүрийн төлөвлөгөө (SubstitutionDay) суурь картууд дээр давхарлагдана.
 */
import {
  ClassGroup,
  Classroom,
  LessonContract,
  ScheduledCard,
  SchoolSettings,
  Subject,
  SubstitutionAction,
  SubstitutionDay,
  SubstitutionKind,
  Teacher,
  TeacherAbsence,
  WeekCycle,
} from '../types/timetable';
import {
  buildTimeModel,
  cardBuilding,
  classSlotCompatible,
  classesOf,
  ConstraintContext,
  getTimeOffStatus,
  idlePeriodsBetween,
  Occupancy,
  teachersOf,
  TimeModel,
  weeksOverlap,
} from './constraints';

export interface SubContext {
  settings: SchoolSettings;
  subjects: Subject[];
  teachers: Teacher[];
  classes: ClassGroup[];
  classrooms: Classroom[];
  lessons: LessonContract[];
  /** Суурь хуваарийн бүх карт */
  cards: ScheduledCard[];
  /** Бусад өдрийн төлөвлөгөө (ачааллын тэнцвэрт) */
  history?: SubstitutionDay[];
}

export interface EffectiveCard extends ScheduledCard {
  /** Энэ картад нөлөөлсөн зохицуулалт */
  subKind?: SubstitutionKind;
  /** Орлуулахаас өмнөх багш */
  originalTeacherId?: string;
  /** Шилжихээс өмнөх цаг */
  originalPeriod?: number;
  /** Энэ картад нийлсэн анги/дэд бүлгийн тайлбар */
  mergedNote?: string;
}

export interface SubOption {
  kind: SubstitutionKind;
  teacherId?: string;
  hostCardId?: string;
  hostTeacherId?: string;
  otherCardId?: string;
  toPeriod?: number;
  /** Бага байх тусам сайн */
  cost: number;
  /** Менежерт харагдах товч нэр */
  label: string;
  /** Яагаад энэ сонголт вэ (жагсаалт) */
  reasons: string[];
}

export const REASON_LABEL: Record<TeacherAbsence['reason'], string> = {
  sick: 'Өвчтэй',
  leave: 'Чөлөөтэй',
  training: 'Сургалтад',
  trip: 'Томилолттой',
  other: 'Бусад',
};

export const KIND_LABEL: Record<SubstitutionKind, string> = {
  substitute: 'Орлон заана',
  drop_coteacher: 'Хамтран заагчгүй',
  merge_subgroups: 'Дэд бүлэг нийлүүлэх',
  merge_classes: '2 анги нийлүүлэх',
  swap: 'Цаг солих',
  move: 'Цаг шилжүүлэх',
  pull: 'Хичээл татах',
  cancel: 'Хичээл орохгүй',
};

// ---------------------------------------------------------------------------
// Огноо
// ---------------------------------------------------------------------------

const DAY_MS = 864e5;
const utcDays = (date: string) => Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
const mondayOf = (days: number) => days - ((new Date(days * DAY_MS).getUTCDay() + 6) % 7);

/** YYYY-MM-DD → 0 = Даваа … Хичээлгүй өдөр бол null */
export function dayIndexOfDate(date: string, daysPerWeek: number): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const idx = (new Date(utcDays(date) * DAY_MS).getUTCDay() + 6) % 7;
  return idx < daysPerWeek ? idx : null;
}

function isoWeek(days: number): number {
  const d = new Date(days * DAY_MS);
  const thursday = days - ((d.getUTCDay() + 6) % 7) + 3;
  const jan4 = utcDays(`${new Date(thursday * DAY_MS).getUTCFullYear()}-01-04`);
  return 1 + Math.round((mondayOf(thursday) - mondayOf(jan4)) / 7);
}

/** Огноо аль 7 хоногт (А/Б) хамаарах */
export function weekCycleOfDate(date: string, settings: SchoolSettings): WeekCycle | undefined {
  if (!settings.enableWeekAB) return undefined;
  const days = utcDays(date);
  if (settings.weekAReferenceDate && /^\d{4}-\d{2}-\d{2}$/.test(settings.weekAReferenceDate)) {
    const diff = Math.round((mondayOf(days) - mondayOf(utcDays(settings.weekAReferenceDate))) / 7);
    return ((diff % 2) + 2) % 2 === 0 ? 'week_a' : 'week_b';
  }
  return isoWeek(days) % 2 === 1 ? 'week_a' : 'week_b';
}

/** Огнооны ISO 7 хоногийн Даваа (тэнцвэрийн тооцоонд) */
export function weekKey(date: string): number {
  return mondayOf(utcDays(date));
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Хичээлийн өдөр биш бол дараагийн хичээлийн өдөр */
export function nextSchoolDay(date: string, daysPerWeek: number): string {
  let days = utcDays(date);
  for (let i = 0; i < 7; i++) {
    const iso = new Date(days * DAY_MS).toISOString().slice(0, 10);
    if (dayIndexOfDate(iso, daysPerWeek) !== null) return iso;
    days++;
  }
  return date;
}

// ---------------------------------------------------------------------------
// Өдрийн картууд, чөлөө
// ---------------------------------------------------------------------------

/** Тухайн өдрийн (7 хоногийн А/Б-г тооцсон) суурь картууд, гэрээнээс хамтран заагч/хамтатгалыг нөхсөн */
export function baseDayCards(ctx: SubContext, dayIndex: number, week?: WeekCycle): ScheduledCard[] {
  const lessons = new Map(ctx.lessons.map((l) => [l.id, l]));
  return ctx.cards
    .filter((c) => c.dayIndex === dayIndex && (!week || !c.weekCycle || c.weekCycle === 'all' || c.weekCycle === week))
    .map((c) => {
      const l = lessons.get(c.contractId);
      if (!l) return c;
      return {
        ...c,
        coTeacherIds: c.coTeacherIds ?? (l.coTeacherIds?.length ? [...l.coTeacherIds] : undefined),
        jointClassIds: c.jointClassIds ?? (l.jointClassIds?.length ? [...l.jointClassIds] : undefined),
      };
    });
}

export function isAbsentAt(absences: TeacherAbsence[], teacherId: string, shift: number, period: number): boolean {
  for (const a of absences) {
    if (a.teacherId !== teacherId) continue;
    if (a.allDay) return true;
    if (a.slots?.includes(`${shift}_${period}`)) return true;
  }
  return false;
}

export function absentTeachersOf(absences: TeacherAbsence[], card: ScheduledCard): string[] {
  return teachersOf(card).filter((t) => isAbsentAt(absences, t, card.shift, card.periodIndex));
}

/** Чөлөөтэй багшийн улмаас зохицуулах шаардлагатай картууд (цагийн дарааллаар) */
export function affectedCards(dayCards: ScheduledCard[], absences: TeacherAbsence[]): ScheduledCard[] {
  return dayCards
    .filter((c) => absentTeachersOf(absences, c).length > 0)
    .sort((a, b) => a.shift - b.shift || a.periodIndex - b.periodIndex || a.classId.localeCompare(b.classId));
}

// ---------------------------------------------------------------------------
// Төлөвлөгөөг суурь картууд дээр хэрэгжүүлэх
// ---------------------------------------------------------------------------

export function applyActions(dayCards: ScheduledCard[], actions: SubstitutionAction[]): EffectiveCard[] {
  const map = new Map<string, EffectiveCard>(dayCards.map((c) => [c.id, { ...c }]));
  for (const a of actions) {
    const card = map.get(a.cardId);
    if (!card) continue;
    switch (a.kind) {
      case 'substitute': {
        if (!a.teacherId) break;
        card.originalTeacherId = card.originalTeacherId ?? card.teacherId;
        card.coTeacherIds = card.coTeacherIds?.filter((t) => t !== a.teacherId);
        card.teacherId = a.teacherId;
        card.subKind = 'substitute';
        break;
      }
      case 'drop_coteacher': {
        card.coTeacherIds = card.coTeacherIds?.filter((t) => t !== a.teacherId);
        card.subKind = 'drop_coteacher';
        break;
      }
      case 'merge_subgroups': {
        const host = a.hostCardId ? map.get(a.hostCardId) : undefined;
        map.delete(card.id);
        if (host) {
          host.subgroupName = [host.subgroupName, card.subgroupName].filter(Boolean).join(' + ') || undefined;
          host.subKind = host.subKind ?? 'merge_subgroups';
          host.mergedNote = `${card.subgroupName || ''} нийлсэн`.trim();
        }
        break;
      }
      case 'merge_classes': {
        const host = a.hostCardId ? map.get(a.hostCardId) : undefined;
        map.delete(card.id);
        if (host) {
          const joint = new Set([...(host.jointClassIds || []), ...classesOf(card)]);
          joint.delete(host.classId);
          host.jointClassIds = Array.from(joint);
          host.subKind = host.subKind ?? 'merge_classes';
          host.mergedNote = 'анги нийлсэн';
        }
        break;
      }
      case 'swap': {
        const other = a.otherCardId ? map.get(a.otherCardId) : undefined;
        if (!other || a.toPeriod === undefined) break;
        const p = card.periodIndex;
        card.originalPeriod = p;
        other.originalPeriod = other.periodIndex;
        card.periodIndex = a.toPeriod;
        other.periodIndex = p;
        card.subKind = 'swap';
        other.subKind = 'swap';
        break;
      }
      case 'move': {
        if (a.toPeriod === undefined) break;
        card.originalPeriod = card.periodIndex;
        card.periodIndex = a.toPeriod;
        card.subKind = 'move';
        break;
      }
      case 'pull': {
        const other = a.otherCardId ? map.get(a.otherCardId) : undefined;
        if (other) {
          other.originalPeriod = other.periodIndex;
          other.periodIndex = card.periodIndex;
          other.subKind = 'pull';
        }
        map.delete(card.id);
        break;
      }
      case 'cancel':
        map.delete(card.id);
        break;
    }
  }
  return Array.from(map.values());
}

/** Зохицуулалтад оролцсон бүх картын ID */
function touchedIds(actions: SubstitutionAction[]): Set<string> {
  const s = new Set<string>();
  for (const a of actions) {
    s.add(a.cardId);
    if (a.hostCardId) s.add(a.hostCardId);
    if (a.otherCardId) s.add(a.otherCardId);
  }
  return s;
}

// ---------------------------------------------------------------------------
// Сонголт гаргах
// ---------------------------------------------------------------------------

interface Busy {
  start: number;
  end: number;
  week: WeekCycle;
  cardId: string;
  shift: number;
  building?: string;
}

class DayState {
  tm: TimeModel;
  busy = new Map<string, Busy[]>();
  constructor(
    private ctx: SubContext,
    public cards: EffectiveCard[]
  ) {
    this.tm = buildTimeModel(ctx.settings);
    const rooms = new Map(ctx.classrooms.map((r) => [r.id, r]));
    const classes = new Map(ctx.classes.map((c) => [c.id, c]));
    for (const c of cards) {
      const iv = this.tm.interval(c.shift, c.periodIndex);
      const b: Busy = { start: iv.start, end: iv.end, week: c.weekCycle || 'all', cardId: c.id, shift: c.shift, building: cardBuilding(c, rooms, classes) };
      for (const t of teachersOf(c)) {
        const l = this.busy.get(t);
        if (l) l.push(b);
        else this.busy.set(t, [b]);
      }
    }
  }

  teacherFree(t: string, shift: number, period: number, week: WeekCycle, ignore: Set<string>): boolean {
    const iv = this.tm.interval(shift, period);
    for (const b of this.busy.get(t) || []) {
      if (ignore.has(b.cardId)) continue;
      if (!weeksOverlap(b.week, week)) continue;
      if (b.start < iv.end && iv.start < b.end) return false;
    }
    return true;
  }

  teacherDay(t: string): Busy[] {
    return [...(this.busy.get(t) || [])].sort((a, b) => a.start - b.start);
  }

  occupancy(exclude: Set<string>): Occupancy {
    const cctx: ConstraintContext = {
      settings: this.ctx.settings,
      teachers: this.ctx.teachers,
      classes: this.ctx.classes,
      classrooms: this.ctx.classrooms,
      subjects: this.ctx.subjects,
    };
    const occ = new Occupancy(cctx);
    for (const c of this.cards) if (!exclude.has(c.id)) occ.add(c);
    return occ;
  }
}

/** Багш бүрийн тухайн 7 хоног болон өдрийн орлон заалтын тоо */
function substitutionLoad(ctx: SubContext, day: SubstitutionDay, actions: SubstitutionAction[]) {
  const week = new Map<string, number>();
  const today = new Map<string, number>();
  const wk = weekKey(day.date);
  for (const h of ctx.history || []) {
    if (h.date === day.date || weekKey(h.date) !== wk) continue;
    for (const a of h.actions) if (a.kind === 'substitute' && a.teacherId) week.set(a.teacherId, (week.get(a.teacherId) || 0) + 1);
  }
  for (const a of actions) {
    if (a.kind === 'substitute' && a.teacherId) {
      week.set(a.teacherId, (week.get(a.teacherId) || 0) + 1);
      today.set(a.teacherId, (today.get(a.teacherId) || 0) + 1);
    }
  }
  return { week, today };
}

interface Indexes {
  subjectTeachers: Map<string, Set<string>>;
  classTeachers: Map<string, Set<string>>;
  teacherShifts: Map<string, Set<number>>;
}

function buildIndexes(ctx: SubContext): Indexes {
  const subjectTeachers = new Map<string, Set<string>>();
  const classTeachers = new Map<string, Set<string>>();
  const teacherShifts = new Map<string, Set<number>>();
  const shiftOf = new Map(ctx.classes.map((c) => [c.id, c.shift || 1]));
  const add = (m: Map<string, Set<any>>, k: string, v: any) => {
    if (!m.has(k)) m.set(k, new Set());
    m.get(k)!.add(v);
  };
  for (const l of ctx.lessons) {
    for (const t of teachersOf(l)) {
      add(subjectTeachers, l.subjectId, t);
      for (const c of classesOf(l)) add(classTeachers, c, t);
      add(teacherShifts, t, shiftOf.get(l.classId) || 1);
    }
  }
  return { subjectTeachers, classTeachers, teacherShifts };
}

const dayMaxFor = (t: Teacher | undefined) => Math.max(1, t?.maxPeriodsPerDay || 6);

/**
 * Нэг картын бүх боломжит зохицуулалтыг (бусад зохицуулалтыг хэрэгжүүлсэн төлөв дээр) эрэмбэлж гаргана.
 */
export function optionsForCard(
  ctx: SubContext,
  day: SubstitutionDay,
  dayCards: ScheduledCard[],
  actions: SubstitutionAction[],
  cardId: string,
  idx: Indexes = buildIndexes(ctx)
): SubOption[] {
  const others = actions.filter((a) => a.cardId !== cardId);
  const effective = applyActions(dayCards, others);
  const target = effective.find((c) => c.id === cardId);
  if (!target) return [];
  const state = new DayState(ctx, effective);
  const absences = day.absences;
  const absent = absentTeachersOf(absences, target);
  const present = (t: string, shift: number, period: number) => !isAbsentAt(absences, t, shift, period);
  const touched = touchedIds(others);
  const affectedIds = new Set(affectedCards(dayCards, absences).map((c) => c.id));
  const teacherMap = new Map(ctx.teachers.map((t) => [t.id, t]));
  const classMap = new Map(ctx.classes.map((c) => [c.id, c]));
  const subjectName = (id: string) => ctx.subjects.find((s) => s.id === id)?.name || 'хичээл';
  const tName = (id?: string) => (id && teacherMap.get(id)?.name) || 'багш';
  const cName = (id: string) => classMap.get(id)?.name || 'анги';
  const n = state.tm.periodsCount(target.shift);
  const p = target.periodIndex;
  const week = target.weekCycle || 'all';
  const self = new Set([target.id]);
  const options: SubOption[] = [];
  const partner = target.linkedCardId ? dayCards.find((c) => c.id === target.linkedCardId) : undefined;
  const partnerAction = partner ? others.find((a) => a.cardId === partner.id) : undefined;

  const mainAbsent = absent.includes(target.teacherId);
  const coPresent = (target.coTeacherIds || []).filter((t) => !absent.includes(t));

  // 1. Хамтран заах багштай холбоотой
  if (!mainAbsent) {
    for (const t of absent)
      options.push({
        kind: 'drop_coteacher',
        teacherId: t,
        cost: 2,
        label: `${tName(target.teacherId)} дангаараа орно`,
        reasons: [`Хамтран заах ${tName(t)} байхгүй`],
      });
  } else if (coPresent.length > 0) {
    options.push({
      kind: 'substitute',
      teacherId: coPresent[0],
      cost: 4,
      label: `Хамтран заагч ${tName(coPresent[0])} дангаараа орно`,
      reasons: ['Аль хэдийн энэ хичээлд ордог'],
    });
  }

  // 2. Ангийн өөр цагийн хичээлтэй солих (чөлөөтэй багш тэр цагт ирж заана)
  const targetClasses = classesOf(target);
  for (const o of effective) {
    if (o.id === target.id || touched.has(o.id) || affectedIds.has(o.id)) continue;
    if (o.classId !== target.classId || o.shift !== target.shift || o.periodIndex === p) continue;
    if ((o.jointClassIds || []).join() !== (target.jointClassIds || []).join()) continue;
    const q = o.periodIndex;
    if (!teachersOf(target).every((t) => present(t, target.shift, q))) continue;
    if (!teachersOf(o).every((t) => present(t, o.shift, p))) continue;
    const occ = state.occupancy(new Set([target.id, o.id]));
    const t2 = { ...target, periodIndex: q };
    const o2 = { ...o, periodIndex: p };
    if (occ.violations(t2).length > 0) continue;
    occ.add(t2);
    if (occ.violations(o2).length > 0) continue;
    const dbl = target.linkedCardId || o.linkedCardId;
    options.push({
      kind: 'swap',
      otherCardId: o.id,
      toPeriod: q,
      cost: 6 + (dbl ? 8 : 0) + Math.abs(q - p) * 0.5,
      label: `${subjectName(o.subjectId)}-тэй солих: ${tName(target.teacherId)} ${q + 1}-р цагт заана`,
      reasons: [
        `${tName(target.teacherId)} ${q + 1}-р цагт байгаа`,
        `${subjectName(o.subjectId)} (${tName(o.teacherId)}) ${p + 1}-р цаг руу`,
        ...(dbl ? ['Хос цаг салж болзошгүй'] : []),
      ],
    });
  }

  // 3. Дэд бүлгийг нөгөө бүлэгтэй нийлүүлэх
  if (target.subgroupName) {
    for (const h of effective) {
      if (h.id === target.id || touched.has(h.id) || !h.subgroupName) continue;
      if (h.classId !== target.classId || h.shift !== target.shift || h.periodIndex !== p) continue;
      if (!weeksOverlap(h.weekCycle, target.weekCycle)) continue;
      if (!classSlotCompatible(ctx.classes, target.classId, h, target)) continue;
      if (!teachersOf(h).every((t) => present(t, h.shift, p))) continue;
      const same = h.subjectId === target.subjectId;
      options.push({
        kind: 'merge_subgroups',
        hostCardId: h.id,
        hostTeacherId: h.teacherId,
        cost: same ? 8 : 18,
        label: `${h.subgroupName}-тэй нийлж ${tName(h.teacherId)} бүх ангид ${subjectName(h.subjectId)} заана`,
        reasons: [same ? 'Ижил хичээл, нэмэлт багш шаардлагагүй' : 'Нэмэлт багш шаардлагагүй'],
      });
    }
  }

  // 4, 9. Сул багш орлох
  const load = substitutionLoad(ctx, day, others);
  const sameSubject = idx.subjectTeachers.get(target.subjectId) || new Set<string>();
  const knowsClass = new Set<string>();
  for (const c of targetClasses) for (const t of idx.classTeachers.get(c) || []) knowsClass.add(t);
  const iv = state.tm.interval(target.shift, p);
  const rooms = new Map(ctx.classrooms.map((r) => [r.id, r]));
  const myBuilding = cardBuilding(target, rooms, classMap);
  const subs: SubOption[] = [];
  for (const t of ctx.teachers) {
    if (teachersOf(target).includes(t.id)) continue;
    if (!present(t.id, target.shift, p)) continue;
    if (isAbsentAt(absences, t.id, target.shift, p)) continue;
    const off = getTimeOffStatus(t.timeOff, target.shift, day.dayIndex, p);
    if (off === 'forbidden') continue;
    if (!state.teacherFree(t.id, target.shift, p, week, self)) continue;
    const myDay = state.teacherDay(t.id).filter((b) => b.cardId !== target.id);
    const uniq = new Set(myDay.map((b) => b.start));
    if (uniq.size + 1 > dayMaxFor(t)) continue;

    const reasons: string[] = [];
    const isSame = sameSubject.has(t.id);
    let cost = isSame ? 10 : 30;
    if (isSame) reasons.push('Ижил хичээл заадаг');
    if (knowsClass.has(t.id)) {
      cost -= 4;
      reasons.push('Энэ ангид ордог');
    }
    if (myDay.length === 0) {
      cost += 14;
      reasons.push('Энэ өдөр хичээлгүй — ирэх шаардлагатай');
    } else {
      const before = [...myDay].reverse().find((b) => b.end <= iv.start);
      const after = myDay.find((b) => b.start >= iv.end);
      const gapBefore = before ? idlePeriodsBetween(before.end, iv.start) : null;
      const gapAfter = after ? idlePeriodsBetween(iv.end, after.start) : null;
      if (before && after) {
        cost -= 5;
        reasons.push('Цонхоо нөхнө');
      } else {
        const g = gapBefore ?? gapAfter ?? 0;
        if (g === 0) {
          cost -= 3;
          reasons.push('Хичээлийнхээ залгаа');
        } else {
          cost += 2 * g;
          reasons.push(`${g} цаг хүлээнэ`);
        }
      }
      const adjacent = [before, after].filter((b) => b && idlePeriodsBetween(Math.min(b.end, iv.end), Math.max(b.start, iv.start)) === 0);
      if (myBuilding && adjacent.some((b) => b!.building && b!.building !== myBuilding)) {
        cost += 8;
        reasons.push('Залгаа цагт өөр байранд');
      }
    }
    if (!(idx.teacherShifts.get(t.id) || new Set()).has(target.shift)) {
      cost += 4;
      reasons.push(`${target.shift}-р ээлжид ордоггүй`);
    }
    if (off === 'discouraged') {
      cost += 6;
      reasons.push('Хүсээгүй цаг');
    }
    const w = load.week.get(t.id) || 0;
    const d = load.today.get(t.id) || 0;
    if (w > 0) {
      cost += 3 * w;
      reasons.push(`Энэ 7 хоногт ${w} удаа орлосон`);
    }
    if (d > 0) cost += 5 * d;
    if (partnerAction?.kind === 'substitute' && partnerAction.teacherId === t.id) {
      cost -= 8;
      reasons.unshift('Хос цагийн нөгөө хагасыг орлож буй');
    }
    subs.push({
      kind: 'substitute',
      teacherId: t.id,
      cost,
      label: `${t.name} орлон заана${isSame ? '' : ' (хянах)'}`,
      reasons,
    });
  }
  subs.sort((a, b) => a.cost - b.cost);
  options.push(...subs.slice(0, 10));

  const grade = classMap.get(target.classId)?.grade;

  // Ангийн тухайн өдрийн бусад цагууд (энэ картыг тооцохгүй)
  const classPeriods = (cid: string) =>
    effective.filter((c) => c.id !== target.id && classesOf(c).includes(cid) && c.shift === target.shift).map((c) => c.periodIndex);
  const othersAtP = effective.some(
    (c) => c.id !== target.id && c.periodIndex === p && c.shift === target.shift && classesOf(c).some((x) => targetClasses.includes(x))
  );
  const allPeriods = targetClasses.flatMap(classPeriods);
  const minP = allPeriods.length ? Math.min(...allPeriods) : p;
  const maxP = allPeriods.length ? Math.max(...allPeriods) : p;

  // 5. Ангийн өдрийн өмнө/ард сул цаг руу шилжүүлэх (чөлөөтэй багш тэр цагт байгаа бол)
  for (const q of [maxP + 1, minP - 1]) {
    if (q < 0 || q >= n || q === p || othersAtP) continue;
    if (allPeriods.includes(q)) continue;
    if (!teachersOf(target).every((t) => present(t, target.shift, q))) continue;
    const occ = state.occupancy(self);
    if (occ.violations({ ...target, periodIndex: q }).length > 0) continue;
    // p цаг ангийн өдрийн дунд байвал цонх үүснэ
    const makesGap = p > minP && p < maxP;
    options.push({
      kind: 'move',
      toPeriod: q,
      cost: 12 + (makesGap ? 20 : 0),
      label: `${q + 1}-р цаг руу шилжүүлж ${tName(target.teacherId)} өөрөө заана`,
      reasons: [q > maxP ? 'Ангийн хичээл 1 цаг сунана' : 'Анги 1 цаг эрт ирнэ', ...(makesGap ? ['Ангид цонх үүснэ'] : [])],
    });
  }

  // Бага ангийн хүүхдийг гэнэт эрт тараах/хожуу ирүүлэхээс зайлсхийнэ
  const young = (grade ?? 99) <= 5;
  const youngCost = young ? 20 : 0;
  const youngReason = young ? ['Бага анги — эцэг эхэд мэдэгдэх шаардлагатай'] : [];

  // 6. Эхний/сүүлийн хичээл → анги хожуу ирнэ / эрт тарна
  if (!othersAtP && (p < minP || p > maxP || allPeriods.length === 0)) {
    options.push({
      kind: 'cancel',
      cost: 16 + youngCost,
      label: p > maxP || allPeriods.length === 0 ? 'Анги 1 цаг эрт тарна' : 'Анги 1 цаг хожуу ирнэ',
      reasons: ['Өдрийн захын хичээл — цонх үүсэхгүй', ...youngReason],
    });
  } else if (othersAtP && target.subgroupName) {
    options.push({
      kind: 'cancel',
      cost: 28,
      label: `${target.subgroupName} энэ цагт чөлөөтэй`,
      reasons: ['Нөгөө бүлэг хичээллэнэ'],
    });
  }

  // 7. Сүүлийн/эхний хичээлийг энэ цаг руу татах
  if (!othersAtP && p > minP && p < maxP) {
    for (const [edge, label, cost] of [
      [maxP, 'эрт тарна', 20],
      [minP, 'хожуу ирнэ', 23],
    ] as [number, string, number][]) {
      const atEdge = effective.filter(
        (c) => c.id !== target.id && c.shift === target.shift && c.periodIndex === edge && classesOf(c).some((x) => targetClasses.includes(x))
      );
      if (atEdge.length !== 1) continue;
      const o = atEdge[0];
      if (touched.has(o.id) || affectedIds.has(o.id) || o.linkedCardId) continue;
      if (classesOf(o).join() !== targetClasses.join()) continue;
      if (!teachersOf(o).every((t) => present(t, o.shift, p))) continue;
      const occ = state.occupancy(new Set([target.id, o.id]));
      if (occ.violations({ ...o, periodIndex: p }).length > 0) continue;
      options.push({
        kind: 'pull',
        otherCardId: o.id,
        cost: cost + youngCost,
        label: `${edge + 1}-р цагийн ${subjectName(o.subjectId)}-ийг ${p + 1}-р цаг руу татаж анги ${label}`,
        reasons: [`${tName(o.teacherId)} ${p + 1}-р цагт сул`],
      });
    }
  }

  // 8. Зэрэгцээ ангийн ижил хичээлтэй нийлүүлэх
  for (const h of effective) {
    if (h.id === target.id || touched.has(h.id) || affectedIds.has(h.id)) continue;
    if (h.subjectId !== target.subjectId || classesOf(h).some((c) => targetClasses.includes(c))) continue;
    if ((h.subgroupName || '') !== (target.subgroupName || '')) continue;
    if (classMap.get(h.classId)?.grade !== grade) continue;
    if (!weeksOverlap(h.weekCycle, target.weekCycle)) continue;
    const hiv = state.tm.interval(h.shift, h.periodIndex);
    if (!(hiv.start < iv.end && iv.start < hiv.end)) continue;
    if (!teachersOf(h).every((t) => present(t, h.shift, h.periodIndex))) continue;
    if ((h.jointClassIds || []).length > 0) continue;
    options.push({
      kind: 'merge_classes',
      hostCardId: h.id,
      hostTeacherId: h.teacherId,
      cost: 24,
      label: `${cName(h.classId)}-тай нийлж ${tName(h.teacherId)} 2 ангид хамт заана`,
      reasons: ['Ижил хичээл, ижил цаг', 'Танхимын багтаамжийг шалгана уу'],
    });
  }

  // 10. Хичээл орохгүй
  options.push({
    kind: 'cancel',
    cost: 90,
    label: 'Хичээл орохгүй — бие даан хичээллэнэ',
    reasons: ['Өөр шийдэл олдохгүй үед'],
  });

  // Давхардсан "cancel" -ыг нэгтгэнэ
  const seen = new Set<string>();
  return options
    .sort((a, b) => a.cost - b.cost)
    .filter((o) => {
      const k = `${o.kind}|${o.teacherId || ''}|${o.hostCardId || ''}|${o.otherCardId || ''}|${o.toPeriod ?? ''}`;
      if (o.kind === 'cancel' && seen.has('cancel')) return false;
      if (o.kind === 'cancel') seen.add('cancel');
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

export function actionFromOption(card: ScheduledCard, o: SubOption, manual = false): SubstitutionAction {
  return {
    id: `sub_${card.id}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    cardId: card.id,
    kind: o.kind,
    teacherId: o.teacherId,
    hostCardId: o.hostCardId,
    hostTeacherId: o.hostTeacherId,
    otherCardId: o.otherCardId,
    toPeriod: o.toPeriod,
    manual,
    snapshot: {
      classId: card.classId,
      subjectId: card.subjectId,
      teacherId: card.teacherId,
      shift: card.shift,
      periodIndex: card.periodIndex,
      subgroupName: card.subgroupName,
    },
  };
}

/** Зохицуулалт одоогийн суурь хуваарьтай таарах эсэх */
export function isActionStale(a: SubstitutionAction, dayCards: ScheduledCard[], absences: TeacherAbsence[]): boolean {
  const c = dayCards.find((x) => x.id === a.cardId);
  if (!c) return true;
  if (c.periodIndex !== a.snapshot.periodIndex || c.teacherId !== a.snapshot.teacherId || c.classId !== a.snapshot.classId) return true;
  if (absentTeachersOf(absences, c).length === 0) return true;
  for (const id of [a.hostCardId, a.otherCardId]) if (id && !dayCards.some((x) => x.id === id)) return true;
  return false;
}

/**
 * Автомат зохицуулалт: менежерийн гараар сонгосныг хадгалж, бусдыг хамгийн бага торгуультайгаар сонгоно.
 * Хамгийн цөөн сайн сонголттой картаас эхэлнэ (хомс нөөцийг эхэлж хуваарилна).
 */
export function autoPlan(ctx: SubContext, day: SubstitutionDay): SubstitutionAction[] {
  const dayCards = baseDayCards(ctx, day.dayIndex, day.weekCycle);
  const affected = affectedCards(dayCards, day.absences);
  const affectedIdSet = new Set(affected.map((c) => c.id));
  const idx = buildIndexes(ctx);
  const actions: SubstitutionAction[] = day.actions.filter(
    (a) => a.manual && affectedIdSet.has(a.cardId) && !isActionStale(a, dayCards, day.absences)
  );
  const done = new Set(actions.map((a) => a.cardId));
  let remaining = affected.filter((c) => !done.has(c.id));

  const scarcity = new Map<string, number>();
  for (const c of remaining) {
    const opts = optionsForCard(ctx, day, dayCards, actions, c.id, idx);
    scarcity.set(c.id, opts.filter((o) => o.cost < 40).length * 100 - (opts[0]?.cost ?? 0));
  }
  remaining = remaining.sort((a, b) => (scarcity.get(a.id) ?? 0) - (scarcity.get(b.id) ?? 0));

  for (const c of remaining) {
    // Өмнөх сонголтоор энэ карт аль хэдийн нөлөөлөлд орсон бол (хост, солигдсон) алгасна
    if (touchedIds(actions).has(c.id)) continue;
    const opts = optionsForCard(ctx, day, dayCards, actions, c.id, idx);
    if (opts.length === 0) continue;
    actions.push(actionFromOption(c, opts[0], false));
  }
  return actions;
}

export interface PlanIssue {
  cardId?: string;
  message: string;
}

/** Төлөвлөгөөний бие даасан шалгалт: давхардал, чөлөөтэй багш хичээл заах, шийдэгдээгүй карт */
export function validatePlan(ctx: SubContext, day: SubstitutionDay): { effective: EffectiveCard[]; issues: PlanIssue[]; unresolved: ScheduledCard[] } {
  const dayCards = baseDayCards(ctx, day.dayIndex, day.weekCycle);
  const effective = applyActions(dayCards, day.actions);
  const issues: PlanIssue[] = [];
  const teacherMap = new Map(ctx.teachers.map((t) => [t.id, t]));
  for (const c of effective) {
    for (const t of teachersOf(c))
      if (isAbsentAt(day.absences, t, c.shift, c.periodIndex))
        issues.push({ cardId: c.id, message: `${teacherMap.get(t)?.name || 'Багш'} чөлөөтэй байхад ${c.periodIndex + 1}-р цагт хичээлтэй` });
  }
  const cctx: ConstraintContext = { settings: ctx.settings, teachers: ctx.teachers, classes: ctx.classes, classrooms: ctx.classrooms, subjects: ctx.subjects };
  const occ = new Occupancy(cctx);
  for (const c of effective) {
    for (const v of occ.violations(c, { checkTimeOff: false })) {
      const who = v.kind === 'teacher' ? teacherMap.get(v.resourceId)?.name : v.kind === 'class' ? ctx.classes.find((x) => x.id === v.resourceId)?.name : ctx.classrooms.find((x) => x.id === v.resourceId)?.name;
      issues.push({ cardId: c.id, message: `${who || 'Нөөц'} ${c.periodIndex + 1}-р цагт давхардсан` });
    }
    occ.add(c);
  }
  const handled = new Set(day.actions.map((a) => a.cardId));
  const unresolved = affectedCards(dayCards, day.absences).filter((c) => !handled.has(c.id));
  for (const a of day.actions) if (isActionStale(a, dayCards, day.absences)) issues.push({ cardId: a.cardId, message: 'Суурь хуваарь өөрчлөгдсөн — дахин зохицуулна уу' });
  return { effective, issues, unresolved };
}

// ---------------------------------------------------------------------------
// Тайлан
// ---------------------------------------------------------------------------

export interface SubReportRow {
  teacherId: string;
  absentPeriods: number;
  absentDays: number;
  substitutedPeriods: number;
  mergedHosted: number;
  ownMoved: number;
}

/** Хугацааны орлон заалтын тайлан (цалин, ачааллын тооцоонд) */
export function substitutionReport(days: SubstitutionDay[], from: string, to: string): { rows: SubReportRow[]; cancelled: number; total: number } {
  const rows = new Map<string, SubReportRow>();
  const row = (t: string) => {
    if (!rows.has(t)) rows.set(t, { teacherId: t, absentPeriods: 0, absentDays: 0, substitutedPeriods: 0, mergedHosted: 0, ownMoved: 0 });
    return rows.get(t)!;
  };
  let cancelled = 0;
  let total = 0;
  for (const d of days) {
    if (d.date < from || d.date > to) continue;
    const absentToday = new Set<string>();
    for (const a of d.actions) {
      total++;
      const r = row(a.snapshot.teacherId);
      r.absentPeriods++;
      absentToday.add(a.snapshot.teacherId);
      if (a.kind === 'substitute' && a.teacherId) row(a.teacherId).substitutedPeriods++;
      if ((a.kind === 'merge_subgroups' || a.kind === 'merge_classes') && a.hostTeacherId) row(a.hostTeacherId).mergedHosted++;
      if (a.kind === 'swap' || a.kind === 'move') r.ownMoved++;
      if (a.kind === 'cancel' || a.kind === 'pull') cancelled++;
    }
    for (const t of absentToday) row(t).absentDays++;
  }
  return { rows: Array.from(rows.values()), cancelled, total };
}
