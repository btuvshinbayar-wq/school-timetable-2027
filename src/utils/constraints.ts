/**
 * Нэгдсэн хатуу хязгаарлалтын цөм.
 *
 * Generator, verify, (цаашид) гар засвар бүгд энэ модулийн
 * "энэ карт энэ нүдэнд орж болох уу" гэсэн нэг логикийг ашиглана.
 *
 * Гол зарчмууд:
 *  - Нүдийг (ээлж, өдөр, цаг) гэж биш бодит цагийн интервалаар (хонхны цаг) харьцуулна.
 *  - Нэг карт хэд хэдэн нөөц эзэлнэ: үндсэн + хамтран заах багш нар,
 *    үндсэн + хамтатгасан ангиуд (дэд бүлгийн хамт), танхим.
 *  - Дэд бүлэг: нэг хуваалтын (category) өөр бүлгүүд зэрэгцэж болно,
 *    өөр хуваалтынх (жишээ нь "Охид" ба "1-р дэд бүлэг") болохгүй — нэг сурагч хоёуланд нь ордог.
 *  - А/Б 7 хоног: week_a ба week_b карт нэг нүдийг хуваалцаж болно.
 *  - Хуваалцах танхим: maxConcurrentClasses хүртэл зэрэг орно.
 *  - Чөлөөт цаг: түлхүүр `${ээлж}_${өдөр}_${цаг}`; хуучин `${өдөр}_${цаг}` түлхүүр бүх ээлжид үйлчилнэ.
 */
import {
  ClassGroup,
  Classroom,
  SchoolSettings,
  Subject,
  Teacher,
  WeekCycle,
} from '../types/timetable';

export type TimeOffStatus = 'allowed' | 'forbidden' | 'discouraged';
export type TimeOffMap = Record<string, TimeOffStatus> | undefined;

/** Хатуу хязгаарлалтад хэрэгтэй картын хамгийн бага хэлбэр */
export interface CardLike {
  id: string;
  contractId?: string;
  subjectId: string;
  teacherId: string;
  coTeacherIds?: string[];
  classId: string;
  jointClassIds?: string[];
  subgroupName?: string;
  classroomId?: string;
  shift: number;
  dayIndex: number;
  periodIndex: number;
  weekCycle: WeekCycle;
}

export interface ConstraintContext {
  settings: SchoolSettings;
  teachers: Teacher[];
  classes: ClassGroup[];
  classrooms: Classroom[];
  subjects: Subject[];
}

// ---------------------------------------------------------------------------
// Цаг
// ---------------------------------------------------------------------------

function parseHHMM(s: string | undefined): number | null {
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export interface TimeModel {
  /** Хонхны интервал (минут) */
  interval(shift: number, period: number): { start: number; end: number };
  /** Өдрийн бүх ээлжийн цагийг эхлэх цагаар эрэмбэлсэн дугаар (багшийн цонх, дараалал бодоход) */
  globalIndex(shift: number, period: number): number;
  periodsCount(shift: number): number;
}

export function buildTimeModel(settings: SchoolSettings): TimeModel {
  const shifts = settings.shifts && settings.shifts.length > 0 ? settings.shifts : [];
  const cache = new Map<string, { start: number; end: number }>();

  const shiftConf = (shift: number) => shifts.find((s) => s.shiftNumber === shift) || shifts[0];

  const interval = (shift: number, period: number) => {
    const key = `${shift}_${period}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const conf = shiftConf(shift);
    const bell = conf?.bells?.[period];
    let start = parseHHMM(bell?.startTime);
    let end = parseHHMM(bell?.endTime);
    if (start === null || end === null) {
      // Хонх тохируулаагүй бол ээлжийн эхлэх цагаас тооцоолно
      const base = parseHHMM(conf?.startTime) ?? (shift - 1) * 300 + 480;
      const dur = conf?.lessonDurationMinutes || 40;
      const brk = conf?.defaultBreakMinutes ?? 5;
      start = base + period * (dur + brk);
      end = start + dur;
    }
    const v = { start, end };
    cache.set(key, v);
    return v;
  };

  const periodsCount = (shift: number) => shiftConf(shift)?.periodsCount || 6;

  // Өдрийн нэгдсэн цагийн шугам
  const starts = new Set<number>();
  const shiftNums = shifts.length > 0 ? shifts.map((s) => s.shiftNumber) : [1];
  for (const sh of shiftNums) {
    for (let p = 0; p < periodsCount(sh); p++) starts.add(interval(sh, p).start);
  }
  const ordered = Array.from(starts).sort((a, b) => a - b);
  const rank = new Map(ordered.map((s, i) => [s, i]));

  const globalIndex = (shift: number, period: number) => {
    const r = rank.get(interval(shift, period).start);
    return r === undefined ? (shift - 1) * 100 + period : r;
  };

  return { interval, globalIndex, periodsCount };
}

export function weeksOverlap(a: WeekCycle | undefined, b: WeekCycle | undefined): boolean {
  const wa = a || 'all';
  const wb = b || 'all';
  if (wa === 'all' || wb === 'all') return true;
  return wa === wb;
}

export function timesOverlap(tm: TimeModel, a: CardLike, b: CardLike): boolean {
  if (a.dayIndex !== b.dayIndex) return false;
  if (a.shift === b.shift) return a.periodIndex === b.periodIndex;
  const ia = tm.interval(a.shift, a.periodIndex);
  const ib = tm.interval(b.shift, b.periodIndex);
  return ia.start < ib.end && ib.start < ia.end;
}

// ---------------------------------------------------------------------------
// Нөөц
// ---------------------------------------------------------------------------

export function teachersOf(card: Pick<CardLike, 'teacherId' | 'coTeacherIds'>): string[] {
  const out = [card.teacherId];
  for (const t of card.coTeacherIds || []) if (t && !out.includes(t)) out.push(t);
  return out;
}

export function classesOf(card: Pick<CardLike, 'classId' | 'jointClassIds'>): string[] {
  const out = [card.classId];
  for (const c of card.jointClassIds || []) if (c && !out.includes(c)) out.push(c);
  return out;
}

/** Дэд бүлгийн хуваалт (gender / division / custom). Ангид бүртгэлгүй нэр бол нэр өөрөө хуваалт болно. */
const classIndexCache = new WeakMap<ClassGroup[], Map<string, ClassGroup>>();
function classIndex(classes: ClassGroup[]): Map<string, ClassGroup> {
  let m = classIndexCache.get(classes);
  if (!m) {
    m = new Map(classes.map((c) => [c.id, c]));
    classIndexCache.set(classes, m);
  }
  return m;
}

export function subgroupCategory(classes: ClassGroup[], classId: string, name: string): string {
  const cls = classIndex(classes).get(classId);
  const sg = cls?.subgroups?.find((s) => s.name.trim() === name.trim());
  if (!sg) return `__custom:${name.trim()}`;
  return sg.category || 'custom';
}

/** Нэг ангийн хоёр карт зэрэг орж болох уу (дэд бүлгийн логик) */
export function classSlotCompatible(
  classes: ClassGroup[],
  classId: string,
  a: Pick<CardLike, 'subgroupName'>,
  b: Pick<CardLike, 'subgroupName'>
): boolean {
  const sa = a.subgroupName?.trim();
  const sb = b.subgroupName?.trim();
  if (!sa || !sb) return false; // бүхэл анги
  if (sa === sb) return false; // ижил дэд бүлэг
  return subgroupCategory(classes, classId, sa) === subgroupCategory(classes, classId, sb);
}

export function roomCapacity(room: Classroom | undefined): number {
  if (!room) return 1;
  if (!room.isShared) return 1;
  return Math.max(1, room.maxConcurrentClasses ?? 2);
}

// ---------------------------------------------------------------------------
// Чөлөөт цаг
// ---------------------------------------------------------------------------

export function timeOffKey(shift: number, day: number, period: number): string {
  return `${shift}_${day}_${period}`;
}

export function getTimeOffStatus(map: TimeOffMap, shift: number, day: number, period: number): TimeOffStatus {
  if (!map) return 'allowed';
  return map[timeOffKey(shift, day, period)] || map[`${day}_${period}`] || 'allowed';
}

/** Хуучин `${өдөр}_${цаг}` түлхүүрийг өгсөн ээлжүүдэд шилжүүлнэ (шинэ түлхүүр байвал түүнийг хадгална). */
export function migrateTimeOff(
  map: TimeOffMap,
  shiftNumbers: number[]
): Record<string, TimeOffStatus> {
  const out: Record<string, TimeOffStatus> = {};
  if (!map) return out;
  for (const [k, v] of Object.entries(map)) {
    if (k.split('_').length === 3) out[k] = v;
  }
  for (const [k, v] of Object.entries(map)) {
    const parts = k.split('_');
    if (parts.length !== 2) continue;
    for (const sh of shiftNumbers) {
      const nk = `${sh}_${parts[0]}_${parts[1]}`;
      if (!(nk in out)) out[nk] = v;
    }
  }
  return out;
}

export function hasLegacyTimeOff(map: TimeOffMap): boolean {
  return !!map && Object.keys(map).some((k) => k.split('_').length === 2);
}

export interface TimeOffHit {
  entityType: 'teacher' | 'class' | 'subject' | 'room';
  entityId: string;
  status: TimeOffStatus;
}

/** Картад хамаарах бүх нөөцийн чөлөөт цагийг шалгана */
export function timeOffHits(ctx: ConstraintContext, card: CardLike): TimeOffHit[] {
  const hits: TimeOffHit[] = [];
  const { shift, dayIndex: d, periodIndex: p } = card;
  for (const tId of teachersOf(card)) {
    const t = ctx.teachers.find((x) => x.id === tId);
    const st = getTimeOffStatus(t?.timeOff, shift, d, p);
    if (st !== 'allowed') hits.push({ entityType: 'teacher', entityId: tId, status: st });
  }
  for (const cId of classesOf(card)) {
    const c = ctx.classes.find((x) => x.id === cId);
    const st = getTimeOffStatus(c?.timeOff, shift, d, p);
    if (st !== 'allowed') hits.push({ entityType: 'class', entityId: cId, status: st });
  }
  const sub = ctx.subjects.find((s) => s.id === card.subjectId);
  const ss = getTimeOffStatus(sub?.timeOff, shift, d, p);
  if (ss !== 'allowed') hits.push({ entityType: 'subject', entityId: card.subjectId, status: ss });
  if (card.classroomId) {
    const r = ctx.classrooms.find((x) => x.id === card.classroomId);
    const rs = getTimeOffStatus(r?.timeOff, shift, d, p);
    if (rs !== 'allowed') hits.push({ entityType: 'room', entityId: card.classroomId, status: rs });
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Хоёр картын хоорондын хатуу зөрчил
// ---------------------------------------------------------------------------

export interface PairClash {
  kind: 'teacher' | 'class';
  resourceId: string;
}

/** Хоёр карт цаг, 7 хоногийн хувьд давхцаж байгаа гэж үзээд нөөцийн зөрчлийг буцаана (танхимыг тусад нь). */
export function pairClashes(classes: ClassGroup[], a: CardLike, b: CardLike): PairClash[] {
  const out: PairClash[] = [];
  const ta = teachersOf(a);
  for (const t of teachersOf(b)) if (ta.includes(t)) out.push({ kind: 'teacher', resourceId: t });
  const ca = classesOf(a);
  for (const c of classesOf(b)) {
    if (ca.includes(c) && !classSlotCompatible(classes, c, a, b)) out.push({ kind: 'class', resourceId: c });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Эзэмшлийн бүртгэл (generator ба гар засварт)
// ---------------------------------------------------------------------------

export interface PlacementViolation {
  kind: 'teacher' | 'class' | 'room' | 'time_off';
  resourceId: string;
  otherCardIds: string[];
}

export class Occupancy {
  readonly tm: TimeModel;
  private byDay = new Map<number, Map<string, CardLike>>();
  private roomById: Map<string, Classroom>;

  constructor(private ctx: ConstraintContext) {
    this.tm = buildTimeModel(ctx.settings);
    this.roomById = new Map(ctx.classrooms.map((r) => [r.id, r]));
  }

  add(card: CardLike) {
    if (!this.byDay.has(card.dayIndex)) this.byDay.set(card.dayIndex, new Map());
    this.byDay.get(card.dayIndex)!.set(card.id, card);
  }

  remove(card: CardLike) {
    this.byDay.get(card.dayIndex)?.delete(card.id);
  }

  /** Тухайн картын бодит цагтай давхцах (7 хоногийн хувьд ч) байршсан картууд */
  overlapping(card: CardLike): CardLike[] {
    const day = this.byDay.get(card.dayIndex);
    if (!day) return [];
    const out: CardLike[] = [];
    for (const other of day.values()) {
      if (other.id === card.id) continue;
      if (!weeksOverlap(card.weekCycle, other.weekCycle)) continue;
      if (!timesOverlap(this.tm, card, other)) continue;
      out.push(other);
    }
    return out;
  }

  /** Хатуу зөрчлүүд. Хоосон бол байрлуулж болно. */
  violations(card: CardLike, opts: { checkTimeOff?: boolean } = {}): PlacementViolation[] {
    const out: PlacementViolation[] = [];
    const others = this.overlapping(card);

    const push = (kind: PlacementViolation['kind'], resourceId: string, otherId?: string) => {
      const ex = out.find((v) => v.kind === kind && v.resourceId === resourceId);
      if (ex) {
        if (otherId && !ex.otherCardIds.includes(otherId)) ex.otherCardIds.push(otherId);
      } else out.push({ kind, resourceId, otherCardIds: otherId ? [otherId] : [] });
    };

    for (const o of others) {
      for (const c of pairClashes(this.ctx.classes, card, o)) push(c.kind, c.resourceId, o.id);
    }

    if (card.classroomId) {
      const room = this.roomById.get(card.classroomId);
      const inRoom = others.filter((o) => o.classroomId === card.classroomId);
      if (inRoom.length + 1 > roomCapacity(room)) {
        for (const o of inRoom) push('room', card.classroomId, o.id);
      }
    }

    if (opts.checkTimeOff !== false) {
      for (const h of timeOffHits(this.ctx, card)) {
        if (h.status === 'forbidden') push('time_off', `${h.entityType}:${h.entityId}`);
      }
    }
    return out;
  }

  canPlace(card: CardLike): boolean {
    return this.violations(card).length === 0;
  }
}

/** Картыг өгсөн нөөц эзэмшиж байгаа эсэх (багш: хамтран заах багшийг оролцуулна) */
export function cardUsesTeacher(card: CardLike, teacherId: string): boolean {
  return card.teacherId === teacherId || !!card.coTeacherIds?.includes(teacherId);
}

export function cardUsesClass(card: CardLike, classId: string): boolean {
  return card.classId === classId || !!card.jointClassIds?.includes(classId);
}

/**
 * Багшийн тухайн өдрийн эзэлсэн цагуудыг нэгдсэн цагийн шугам дээр (ээлж холилгүй, А/Б давхардуулалгүй)
 */
export function teacherDaySlots(
  tm: TimeModel,
  cards: CardLike[],
  teacherId: string,
  day: number,
  extra: { shift: number; periodIndex: number }[] = []
): number[] {
  const set = new Set<number>();
  for (const c of cards) {
    if (c.dayIndex === day && cardUsesTeacher(c, teacherId)) set.add(tm.globalIndex(c.shift, c.periodIndex));
  }
  for (const e of extra) set.add(tm.globalIndex(e.shift, e.periodIndex));
  return Array.from(set).sort((a, b) => a - b);
}

/** Ангийн тухайн өдрийн эзэлсэн цагууд (А/Б, дэд бүлгийг нэг нүд гэж тоолно) */
export function classDaySlots(
  cards: CardLike[],
  classId: string,
  day: number,
  extra: number[] = []
): number[] {
  const set = new Set<number>(extra);
  for (const c of cards) if (c.dayIndex === day && cardUsesClass(c, classId)) set.add(c.periodIndex);
  return Array.from(set).sort((a, b) => a - b);
}

export function countGaps(sorted: number[]): number {
  if (sorted.length < 2) return 0;
  return sorted[sorted.length - 1] - sorted[0] + 1 - sorted.length;
}

export function maxRun(sorted: number[]): number {
  let best = 0;
  let run = 0;
  let prev = -999;
  for (const p of sorted) {
    run = p === prev + 1 ? run + 1 : 1;
    if (run > best) best = run;
    prev = p;
  }
  return best;
}

/**
 * Чөлөөт цагийн матрицыг тодорхой ээлжийн ангид тохируулна (хуулахад).
 * Эх матриц тухайн ээлжийн түлхүүртэй бол түүнийг, зөвхөн өөр нэг ээлжийнх бол
 * (жишээ нь 1-р ээлжийн ангиас 2-р ээлжийн ангид хуулах) цагийн байрлалаар нь шилжүүлнэ.
 */
export function timeOffForShift(map: TimeOffMap, targetShift: number): Record<string, TimeOffStatus> {
  const migrated = migrateTimeOff(map, [targetShift]);
  const entries = Object.entries(migrated);
  const own = entries.filter(([k]) => k.startsWith(`${targetShift}_`));
  if (own.length > 0) return Object.fromEntries(own);
  const shiftsInMap = new Set(entries.map(([k]) => k.split('_')[0]));
  if (shiftsInMap.size === 1) {
    return Object.fromEntries(entries.map(([k, v]) => [`${targetShift}_${k.split('_').slice(1).join('_')}`, v]));
  }
  return {};
}

// ---------------------------------------------------------------------------
// Багшийн өдрийн бодит цагийн дүр зураг (ээлж давхцах үед ч зөв)
// ---------------------------------------------------------------------------

export interface DayItem {
  start: number;
  end: number;
  shift: number;
  building?: string;
}

export interface DayProfile {
  /** Давхардалгүй заасан цаг */
  count: number;
  /** Нийт цонх (сул цаг) */
  gaps: number;
  /** Хамгийн урт завсаргүй дараалал */
  maxRun: number;
  /** Ээлж солигдох бүрийн хоорондын сул цаг */
  crossShiftGaps: number[];
  /** Байр солихдоо завсар хүрэлцээгүй тоо */
  buildingHops: number;
}

/** Хоёр хичээлийн хоорондох сул цагийн тоо (5–15 минутын завсарлага = 0) */
export function idlePeriodsBetween(prevEnd: number, nextStart: number): number {
  const gap = nextStart - prevEnd;
  return gap <= 20 ? 0 : Math.max(1, Math.round((gap - 15) / 45));
}

export function dayProfile(items: DayItem[], buildingBuffer = 1): DayProfile {
  const sorted = [...items].sort((a, b) => a.start - b.start);
  const uniq: DayItem[] = [];
  for (const it of sorted) {
    const last = uniq[uniq.length - 1];
    if (last && last.start === it.start) continue; // А/Б эсвэл дэд бүлэг — нэг цаг
    uniq.push(it);
  }
  let gaps = 0;
  let run = uniq.length > 0 ? 1 : 0;
  let maxRunV = run;
  const crossShiftGaps: number[] = [];
  let buildingHops = 0;
  for (let i = 1; i < uniq.length; i++) {
    const idle = idlePeriodsBetween(uniq[i - 1].end, uniq[i].start);
    gaps += idle;
    run = idle === 0 ? run + 1 : 1;
    if (run > maxRunV) maxRunV = run;
    if (uniq[i].shift !== uniq[i - 1].shift) crossShiftGaps.push(idle);
    const b1 = uniq[i - 1].building;
    const b2 = uniq[i].building;
    if (b1 && b2 && b1 !== b2 && idle < buildingBuffer) buildingHops++;
  }
  return { count: uniq.length, gaps, maxRun: maxRunV, crossShiftGaps, buildingHops };
}

/** Картын байр: танхимын байр, үгүй бол ангийн байр */
export function cardBuilding(
  card: Pick<CardLike, 'classroomId' | 'classId'>,
  rooms: Map<string, Classroom>,
  classes: Map<string, ClassGroup>
): string | undefined {
  if (card.classroomId) {
    const r = rooms.get(card.classroomId);
    if (r?.buildingId) return r.buildingId;
  }
  return classes.get(card.classId)?.buildingId;
}
