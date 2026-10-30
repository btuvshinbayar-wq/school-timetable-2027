/**
 * 2-р шат: aSc маягийн хуваарь бодогч.
 *
 *  1. Барих (construction): хамгийн хэцүү нэгжээс (хос цаг, дэд бүлгийн багц, нөөц хомс карт) эхэлж,
 *     зөөлөн торгууль хамгийн бага нүдэнд тавина.
 *  2. Засах (repair): байр олдохгүй нэгжид саад болж буй 1–2 нэгжийг гаргаж (ejection), түүнийг тавиад
 *     гаргасныг дараалалд буцаана. Олон дахин гаргагдсан нэгжид торгууль өсөж, тойрог эргэлтээс сэргийлнэ.
 *  3. Сайжруулах (local search): хатуу хязгаарлалтыг зөрчихгүйгээр нэгжийг зөөх, нэг ангийн хоёр нэгжийг
 *     солих, зөөлөн торгуулийг (цонх, жигд тархалт, дүрмийн жин) бууруулна.
 *
 * Хатуу: нөөцийн давхардал (constraints.ts), хаалттай цаг, 'Хатуу' хязгаар-төрлийн дүрмүүд
 * (өдрийн дээд цаг, дараалсан цаг, өдрийн тоо, нэг өдөр/дараалан орохгүй, өдөрт 1 удаа, эхний/сүүлийн цаг,
 * зөвшөөрөгдсөн цаг, байр солих завсар). 'Хатуу' цонх, доод хязгаар зэрэг нэмэхэд засагдах боломжтой
 * дүрмүүд маш өндөр жинтэй зөөлөн торгууль болно (барих явцад мухардахгүйн тулд).
 * Зөөлөн жин: Хатуу 1000, Өндөр 50, Энгийн 10.
 */
import {
  CardRelationship,
  ClassGroup,
  Classroom,
  LessonContract,
  ScheduledCard,
  SchoolSettings,
  Subject,
  Teacher,
} from '../types/timetable';
import {
  buildTimeModel,
  cardBuilding,
  classSlotCompatible,
  classesOf,
  dayProfile,
  getTimeOffStatus,
  roomCapacity,
  subgroupCategory,
  teachersOf,
  TimeModel,
  weeksOverlap,
} from './constraints';
import type { CardToPlace } from './generator';

export interface SolveOptions {
  /** Бодох дээд хугацаа (мс) */
  timeLimitMs?: number;
  /** Санамсаргүй тооны үр (ижил үр → ижил үр дүн) */
  seed?: number;
  shouldStop?: () => boolean;
}

export interface SolveResult {
  scheduledCards: ScheduledCard[];
  unplacedUnits: number;
  softCost: number;
  iterations: number;
}

const W = {
  strict: 1000,
  high: 50,
  normal: 10,
  teacherGap: 6,
  classGap: 80,
  lateStart: 30,
  sameSubjectDay: 40,
  dayBalance: 4,
  discouraged: 8,
};

const ruleWeight = (r: CardRelationship) => (r.importance === 'strict' ? W.strict : r.importance === 'high' ? W.high : W.normal);

interface Unit {
  id: string;
  cards: CardToPlace[];
  offsets: number[];
  shift: number;
  rank: number;
  ejections: number;
  failures: number;
}

interface Placed {
  sc: ScheduledCard;
  unit: string;
  start: number;
  end: number;
  shift: number;
  building?: string;
  locked: boolean;
  teachers: string[];
  classes: string[];
  subgroupName?: string;
  weekCycle: ScheduledCard['weekCycle'];
}

interface DayEval {
  hard: number;
  soft: number;
  count: number;
  gaps: number;
}

const ZERO: DayEval = { hard: 0, soft: 0, count: 0, gaps: 0 };

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class TimetableSolver {
  private tm: TimeModel;
  private days: number;
  private rand: () => number;
  private roomMap: Map<string, Classroom>;
  private classMap: Map<string, ClassGroup>;
  private teacherMap: Map<string, Teacher>;
  private subjectMap: Map<string, Subject>;

  // Дүрмүүд (урьдчилан ангилсан)
  private teacherDayRules = new Map<string, CardRelationship[]>();
  private teacherWeekRules = new Map<string, CardRelationship[]>();
  private classDayRules = new Map<string, CardRelationship[]>();
  private classWeekRules = new Map<string, CardRelationship[]>();
  private cardRules: CardRelationship[] = [];
  private idealRules: CardRelationship[] = [];
  private classTarget = new Map<string, number>();

  // Эзэмшил
  private occ = new Map<string, Placed[]>();
  private overlapSlots = new Map<string, [number, number][]>();
  private entityDay = new Map<string, Placed[]>();
  private dayCache = new Map<string, DayEval>();
  private weekCache = new Map<string, DayEval>();
  private unitPlaced = new Map<string, Placed[]>();
  private unitPos = new Map<string, { day: number; period: number }>();
  private units: Unit[] = [];
  private unitById = new Map<string, Unit>();
  private softTotal = 0;
  private cardCostTotal = 0;
  iterations = 0;

  constructor(
    private settings: SchoolSettings,
    private subjects: Subject[],
    private teachers: Teacher[],
    private classes: ClassGroup[],
    private classrooms: Classroom[],
    private relationships: CardRelationship[],
    private lessons: LessonContract[],
    seed = 1
  ) {
    this.tm = buildTimeModel(settings);
    this.days = settings.daysPerWeek;
    this.rand = mulberry32(seed);
    this.roomMap = new Map(classrooms.map((r) => [r.id, r]));
    this.classMap = new Map(classes.map((c) => [c.id, c]));
    this.teacherMap = new Map(teachers.map((t) => [t.id, t]));
    this.subjectMap = new Map(subjects.map((s) => [s.id, s]));
    this.prepareSlots();
    this.prepareRules();
  }

  // -------------------------------------------------------------------------
  // Бэлтгэл
  // -------------------------------------------------------------------------

  private prepareSlots() {
    const shifts = this.settings.shifts.length > 0 ? this.settings.shifts.map((s) => s.shiftNumber) : [1];
    const all: [number, number][] = [];
    for (const sh of shifts) for (let p = 0; p < this.tm.periodsCount(sh); p++) all.push([sh, p]);
    for (const [sh, p] of all) {
      const a = this.tm.interval(sh, p);
      const list: [number, number][] = [];
      for (const [sh2, p2] of all) {
        if (sh2 === sh) {
          if (p2 === p) list.push([sh2, p2]);
          continue;
        }
        const b = this.tm.interval(sh2, p2);
        if (a.start < b.end && b.start < a.end) list.push([sh2, p2]);
      }
      this.overlapSlots.set(`${sh}|${p}`, list);
    }
  }

  private prepareRules() {
    const active = this.relationships.filter((r) => r.isActive);
    const teacherScoped = (r: CardRelationship, t: string) => !r.teacherIds || r.teacherIds.length === 0 || r.teacherIds.includes(t);
    const classScoped = (r: CardRelationship, c: string) => !r.classIds || r.classIds.length === 0 || r.classIds.includes(c);
    const push = (m: Map<string, CardRelationship[]>, k: string, r: CardRelationship) => {
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    };
    for (const r of active) {
      const toClasses = r.targetEntity === 'classes';
      switch (r.condition) {
        case 'daily_hours_limit':
        case 'max_consecutive_periods':
        case 'max_gaps_daily_weekly':
          if (toClasses) {
            for (const c of this.classes) if (classScoped(r, c.id)) push(this.classDayRules, c.id, r);
          } else {
            for (const t of this.teachers) if (teacherScoped(r, t.id)) push(this.teacherDayRules, t.id, r);
          }
          if (r.condition === 'max_gaps_daily_weekly') {
            if (toClasses) for (const c of this.classes) { if (classScoped(r, c.id)) push(this.classWeekRules, c.id, r); }
            else for (const t of this.teachers) if (teacherScoped(r, t.id)) push(this.teacherWeekRules, t.id, r);
          }
          break;
        case 'teaching_days_limit':
          if (toClasses) for (const c of this.classes) { if (classScoped(r, c.id)) push(this.classWeekRules, c.id, r); }
          else for (const t of this.teachers) if (teacherScoped(r, t.id)) push(this.teacherWeekRules, t.id, r);
          break;
        case 'minimize_shift_crossing_gap':
        case 'building_transfer_buffer':
          for (const t of this.teachers) if (teacherScoped(r, t.id)) push(this.teacherDayRules, t.id, r);
          break;
        case 'cannot_same_day':
        case 'cannot_consecutive':
        case 'teacher_max_once_per_day':
          for (const c of this.classes) if (classScoped(r, c.id)) push(this.classDayRules, c.id, r);
          break;
        case 'first_or_last':
        case 'allowed_periods_only':
          this.cardRules.push(r);
          break;
        case 'ideal_distribution':
          this.idealRules.push(r);
          break;
        default:
          break;
      }
    }

    // Ангийн өдрийн зорилтот ачаалал
    const load = new Map<string, number>();
    for (const l of this.lessons) {
      for (const c of classesOf(l)) {
        const w = l.weekCycle === 'week_b' ? 0 : l.subgroupName === '2-р дэд бүлэг' ? 0 : l.totalPeriods;
        load.set(c, (load.get(c) || 0) + w);
      }
    }
    for (const c of this.classes) this.classTarget.set(c.id, (load.get(c.id) || 0) / this.days);
  }

  /** Нэгж үүсгэх: хос цаг (2 карт), дэд бүлгийн багц, дан карт */
  buildUnits(cards: CardToPlace[]) {
    const processed = new Set<string>();
    const units: Unit[] = [];
    const bundleable = (c: CardToPlace) => !processed.has(c.id) && !c.isDouble;
    const distinctResources = (group: CardToPlace[]) => {
      const ts = group.flatMap((c) => teachersOf(c));
      return new Set(ts).size === ts.length;
    };
    const addUnit = (id: string, list: CardToPlace[], offsets: number[]) => {
      list.forEach((c) => processed.add(c.id));
      units.push({ id, cards: list, offsets, shift: list[0].shift, rank: 0, ejections: 0, failures: 0 });
    };

    // a) 2 өөр хичээлийн дэд бүлгийн зэрэгцээ дүрэм
    for (const rule of this.relationships.filter(
      (r) => r.isActive && r.condition === 'different_subjects_subgroups_simultaneous' && (r.parallelPairs?.length || 0) >= 2
    )) {
      const targetClasses = rule.classIds?.length ? this.classes.filter((c) => rule.classIds.includes(c.id)) : this.classes;
      const [p1, p2] = rule.parallelPairs!;
      for (const cls of targetClasses) {
        const c1 = cards.filter((c) => bundleable(c) && c.classId === cls.id && c.subjectId === p1.subjectId && (!p1.subgroupName || c.subgroupName === p1.subgroupName));
        const c2 = cards.filter((c) => bundleable(c) && c.classId === cls.id && c.subjectId === p2.subjectId && (!p2.subgroupName || c.subgroupName === p2.subgroupName));
        for (let i = 0; i < Math.min(c1.length, c2.length); i++) {
          if (distinctResources([c1[i], c2[i]])) addUnit(`b_${c1[i].id}`, [c1[i], c2[i]], [0, 0]);
        }
      }
    }

    // b) Нэг хичээлийн дэд бүлгүүд (нэг хуваалтынх) зэрэг
    const sameRules = this.relationships.filter((r) => r.isActive && r.condition === 'same_subject_subgroups_simultaneous');
    const groups = new Map<string, Map<string, CardToPlace[]>>();
    for (const c of cards) {
      if (!bundleable(c) || !c.subgroupName) continue;
      const ruleOn =
        sameRules.length === 0 ||
        sameRules.some(
          (r) => (!r.classIds?.length || r.classIds.includes(c.classId)) && (!r.subjectIds?.length || r.subjectIds.includes(c.subjectId))
        );
      if (!ruleOn) continue;
      const key = `${c.classId}|${c.subjectId}|${c.weekCycle}|${subgroupCategory(this.classes, c.classId, c.subgroupName)}`;
      if (!groups.has(key)) groups.set(key, new Map());
      const m = groups.get(key)!;
      if (!m.has(c.subgroupName)) m.set(c.subgroupName, []);
      m.get(c.subgroupName)!.push(c);
    }
    for (const m of groups.values()) {
      const names = Array.from(m.keys());
      if (names.length < 2) continue;
      const n = Math.min(...names.map((x) => m.get(x)!.length));
      for (let i = 0; i < n; i++) {
        const list = names.map((x) => m.get(x)![i]);
        if (distinctResources(list)) addUnit(`b_${list[0].id}`, list, list.map(() => 0));
      }
    }

    // c) Хос цаг, дан
    const byId = new Map(cards.map((c) => [c.id, c]));
    for (const c of cards) {
      if (processed.has(c.id)) continue;
      if (c.doubleHalf === 'first' && c.partnerCardId && byId.has(c.partnerCardId) && !processed.has(c.partnerCardId)) {
        addUnit(`d_${c.id}`, [c, byId.get(c.partnerCardId)!], [0, 1]);
      }
    }
    for (const c of cards) {
      if (processed.has(c.id)) continue;
      const single = c.doubleHalf ? { ...c, isDouble: false, doubleHalf: undefined, partnerCardId: undefined } : c;
      addUnit(`s_${c.id}`, [single], [0]);
    }

    // Хүндийн зэрэг: боломжит нүд цөөн, багш ачаалал ихтэй, олон карттай нэгж эхэнд
    const teacherLoad = new Map<string, number>();
    for (const c of cards) for (const t of teachersOf(c)) teacherLoad.set(t, (teacherLoad.get(t) || 0) + 1);
    const scored = units.map((u) => {
      let domain = 0;
      for (let d = 0; d < this.days; d++)
        for (let p = 0; p < this.tm.periodsCount(u.shift); p++) if (this.staticOk(u, d, p)) domain++;
      const load = Math.max(...u.cards.flatMap((c) => teachersOf(c).map((t) => teacherLoad.get(t) || 0)));
      const room = u.cards.some((c) => c.classroomId) ? 6 : 0;
      return { u, key: domain * 4 - load - room - u.cards.length * 8 - (u.offsets.length > 1 && u.offsets[1] === 1 ? 10 : 0) };
    });
    scored.sort((a, b) => a.key - b.key);
    scored.forEach((s, i) => (s.u.rank = i));
    this.units = scored.map((s) => s.u);
    this.unitById = new Map(this.units.map((u) => [u.id, u]));
  }

  // -------------------------------------------------------------------------
  // Эзэмшил
  // -------------------------------------------------------------------------

  private makePlaced(card: CardToPlace | ScheduledCard, day: number, period: number, unit: string, locked: boolean): Placed {
    const isSched = (card as ScheduledCard).dayIndex !== undefined;
    const sc: ScheduledCard = isSched
      ? { ...(card as ScheduledCard) }
      : {
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
    if (!isSched) {
      const c = card as CardToPlace;
      if (c.coTeacherIds?.length) sc.coTeacherIds = c.coTeacherIds;
      if (c.jointClassIds?.length) sc.jointClassIds = c.jointClassIds;
      if (c.doubleHalf && c.partnerCardId) {
        sc.isDoublePart = c.doubleHalf;
        sc.linkedCardId = c.partnerCardId;
      }
    }
    const iv = this.tm.interval(sc.shift, period);
    return {
      sc,
      unit,
      start: iv.start,
      end: iv.end,
      shift: sc.shift,
      building: cardBuilding(sc, this.roomMap, this.classMap),
      locked,
      teachers: teachersOf(sc),
      classes: classesOf(sc),
      subgroupName: sc.subgroupName,
      weekCycle: sc.weekCycle,
    };
  }

  private occKeys(p: Placed): string[] {
    const keys: string[] = [];
    const base = `|${p.sc.dayIndex}|${p.shift}|${p.sc.periodIndex}`;
    for (const t of p.teachers) keys.push(`t:${t}${base}`);
    for (const c of p.classes) keys.push(`c:${c}${base}`);
    if (p.sc.classroomId) keys.push(`r:${p.sc.classroomId}${base}`);
    return keys;
  }

  private entityKeys(p: Placed): string[] {
    const d = p.sc.dayIndex;
    return [...p.teachers.map((t) => `t|${t}|${d}`), ...p.classes.map((c) => `c|${c}|${d}`)];
  }

  private insert(p: Placed) {
    for (const k of this.occKeys(p)) {
      const l = this.occ.get(k);
      if (l) l.push(p);
      else this.occ.set(k, [p]);
    }
    for (const k of this.entityKeys(p)) {
      const l = this.entityDay.get(k);
      if (l) l.push(p);
      else this.entityDay.set(k, [p]);
    }
  }

  private extract(p: Placed) {
    for (const k of this.occKeys(p)) {
      const l = this.occ.get(k);
      if (l) l.splice(l.indexOf(p), 1);
    }
    for (const k of this.entityKeys(p)) {
      const l = this.entityDay.get(k);
      if (l) l.splice(l.indexOf(p), 1);
    }
  }

  /** Тухайн картын бодит цагтай давхцах нөөцийн жагсаалтын түлхүүрүүд */
  private overlapping(prefix: string, day: number, shift: number, period: number): Placed[] {
    const out: Placed[] = [];
    for (const [sh, p] of this.overlapSlots.get(`${shift}|${period}`) || []) {
      const l = this.occ.get(`${prefix}|${day}|${sh}|${p}`);
      if (l) for (const x of l) out.push(x);
    }
    return out;
  }

  /** Нөөцийн зөрчилтэй (давхцсан) картууд. null = байрлуулах боломжгүй (жишээ нь түгжсэн карттай давхцсан) */
  private resourceBlockers(p: Placed, collect: Set<Placed> | null): boolean {
    const day = p.sc.dayIndex;
    const sh = p.shift;
    const per = p.sc.periodIndex;
    let clash = false;
    const hit = (o: Placed) => {
      clash = true;
      if (collect) collect.add(o);
    };
    for (const t of p.teachers) for (const o of this.overlapping(`t:${t}`, day, sh, per)) if (weeksOverlap(o.weekCycle, p.weekCycle)) hit(o);
    for (const c of p.classes)
      for (const o of this.overlapping(`c:${c}`, day, sh, per)) {
        if (!weeksOverlap(o.weekCycle, p.weekCycle)) continue;
        if (!classSlotCompatible(this.classes, c, o.sc, p.sc)) hit(o);
      }
    if (p.sc.classroomId) {
      const inRoom = this.overlapping(`r:${p.sc.classroomId}`, day, sh, per).filter((o) => weeksOverlap(o.weekCycle, p.weekCycle));
      const cap = roomCapacity(this.roomMap.get(p.sc.classroomId));
      if (inRoom.length + 1 > cap) {
        // Багтаамжаас хэтэрсэн тоогоор хамгийн бага ачаалалтай (түгжээгүй) картуудыг гаргана
        const over = inRoom.length + 1 - cap;
        const free = inRoom.filter((o) => !o.locked);
        if (free.length < over) {
          clash = true;
          if (collect) inRoom.filter((o) => o.locked).forEach((o) => collect.add(o));
        } else for (let i = 0; i < over; i++) hit(free[i]);
      }
    }
    return clash;
  }

  // -------------------------------------------------------------------------
  // Үнэлгээ
  // -------------------------------------------------------------------------

  /** Нүдэнд статик (бусад картаас үл хамаарах) шалгалт: цагийн хүрээ, хаалттай цаг, картын дүрэм */
  private staticOk(u: Unit, day: number, period: number): boolean {
    const n = this.tm.periodsCount(u.shift);
    for (let i = 0; i < u.cards.length; i++) {
      const c = u.cards[i];
      const p = period + u.offsets[i];
      if (p < 0 || p >= n) return false;
      if (!this.cardStaticOk(c, day, p, n)) return false;
    }
    return true;
  }

  private cardStaticOk(c: CardToPlace, day: number, p: number, n: number): boolean {
    for (const t of teachersOf(c)) if (getTimeOffStatus(this.teacherMap.get(t)?.timeOff, c.shift, day, p) === 'forbidden') return false;
    for (const cl of classesOf(c)) if (getTimeOffStatus(this.classMap.get(cl)?.timeOff, c.shift, day, p) === 'forbidden') return false;
    if (getTimeOffStatus(this.subjectMap.get(c.subjectId)?.timeOff, c.shift, day, p) === 'forbidden') return false;
    if (c.classroomId && getTimeOffStatus(this.roomMap.get(c.classroomId)?.timeOff, c.shift, day, p) === 'forbidden') return false;
    for (const r of this.cardRules) {
      if (r.importance !== 'strict') continue;
      if (this.cardRuleViolated(r, c, p, n)) return false;
    }
    return true;
  }

  private cardRuleViolated(r: CardRelationship, c: CardToPlace, p: number, n: number): boolean {
    if (!r.subjectIds.includes(c.subjectId)) return false;
    if (r.classIds?.length && !classesOf(c).some((x) => r.classIds.includes(x))) return false;
    if (r.condition === 'allowed_periods_only') {
      return !!r.allowedPeriods?.length && !r.allowedPeriods.includes(p);
    }
    if (r.condition === 'first_or_last') {
      if (c.doubleHalf === 'second') return false;
      const mode = r.firstOrLastMode || 'first_or_last';
      const isFirst = p === 0;
      const isLast = p === n - 1 || (c.doubleHalf === 'first' && p === n - 2);
      return !(mode === 'first_only' ? isFirst : mode === 'last_only' ? isLast : isFirst || isLast);
    }
    return false;
  }

  /** Картын өөрийн зөөлөн торгууль (хүсээгүй цаг, хатуу бус картын дүрэм) */
  private cardCost(c: ScheduledCard): number {
    let cost = 0;
    const { shift, dayIndex: d, periodIndex: p } = c;
    for (const t of teachersOf(c)) if (getTimeOffStatus(this.teacherMap.get(t)?.timeOff, shift, d, p) === 'discouraged') cost += W.discouraged;
    for (const cl of classesOf(c)) if (getTimeOffStatus(this.classMap.get(cl)?.timeOff, shift, d, p) === 'discouraged') cost += W.discouraged;
    if (getTimeOffStatus(this.subjectMap.get(c.subjectId)?.timeOff, shift, d, p) === 'discouraged') cost += W.discouraged;
    const n = this.tm.periodsCount(shift);
    const asCard = { ...c, doubleHalf: c.isDoublePart } as unknown as CardToPlace;
    for (const r of this.cardRules) {
      if (r.importance === 'strict') continue;
      if (this.cardRuleViolated(r, asCard, p, n)) cost += ruleWeight(r);
    }
    return cost;
  }

  private evalTeacherDay(tid: string, list: Placed[], acc?: Record<string, number>): DayEval {
    if (list.length === 0) return ZERO;
    const rules = this.teacherDayRules.get(tid) || [];
    const buffer = rules.find((r) => r.condition === 'building_transfer_buffer')?.value ?? 1;
    const prof = dayProfile(
      list.map((p) => ({ start: p.start, end: p.end, shift: p.shift, building: p.building })),
      buffer
    );
    let hard = 0;
    let soft = prof.gaps * W.teacherGap;
    const tag = (name: string, before: number) => {
      if (acc) acc[name] = (acc[name] || 0) + soft - before;
    };
    tag('teacher_gap', 0);
    for (const r of rules) {
      const before = soft;
      const w = ruleWeight(r);
      const strict = r.importance === 'strict';
      switch (r.condition) {
        case 'daily_hours_limit': {
          const over = prof.count - (r.maxPeriodsPerDay ?? 5);
          if (over > 0) {
            if (strict) hard += over;
            else soft += over * w;
          }
          const min = r.minPeriodsPerDay ?? 0;
          if (prof.count > 0 && prof.count < min) soft += (min - prof.count) * w;
          break;
        }
        case 'max_consecutive_periods': {
          const over = prof.maxRun - (r.maxConsecutive ?? 3);
          if (over > 0) {
            if (strict) hard += over;
            else soft += over * w;
          }
          break;
        }
        case 'max_gaps_daily_weekly': {
          const over = prof.gaps - (r.maxGapsPerDay ?? 1);
          if (over > 0) soft += over * w;
          break;
        }
        case 'minimize_shift_crossing_gap': {
          for (const g of prof.crossShiftGaps) if (g > (r.maxCrossShiftGap ?? 1)) soft += (g - (r.maxCrossShiftGap ?? 1)) * w;
          break;
        }
        case 'building_transfer_buffer': {
          if (prof.buildingHops > 0) {
            if (strict) hard += prof.buildingHops;
            else soft += prof.buildingHops * w;
          }
          break;
        }
      }
      tag(`t:${r.condition}`, before);
    }
    return { hard, soft, count: prof.count, gaps: prof.gaps };
  }

  private evalClassDay(cid: string, list: Placed[], acc?: Record<string, number>): DayEval {
    if (list.length === 0) return ZERO;
    const periods = Array.from(new Set(list.map((p) => p.sc.periodIndex))).sort((a, b) => a - b);
    const count = periods.length;
    const gaps = periods[count - 1] - periods[0] + 1 - count;
    let run = 1;
    let maxRun = 1;
    for (let i = 1; i < count; i++) {
      run = periods[i] === periods[i - 1] + 1 ? run + 1 : 1;
      if (run > maxRun) maxRun = run;
    }
    let hard = 0;
    let soft = gaps * W.classGap + periods[0] * W.lateStart;
    if (acc) {
      acc.class_gap = (acc.class_gap || 0) + gaps * W.classGap;
      acc.late_start = (acc.late_start || 0) + periods[0] * W.lateStart;
    }
    const target = this.classTarget.get(cid) || 0;
    soft += (count - target) * (count - target) * W.dayBalance;
    if (acc) acc.day_balance = (acc.day_balance || 0) + (count - target) * (count - target) * W.dayBalance;
    const subjBefore = soft;

    // Нэг хичээл нэг өдөр олон удаа (хос цаг, дэд бүлгийн зэрэгцээ, А/Б-г нэг гэж тооцно)
    const visits = (pred: (p: Placed) => boolean) => {
      const a = new Set<string>();
      const b = new Set<string>();
      for (const p of list) {
        if (!pred(p)) continue;
        if (p.weekCycle !== 'week_b') a.add(p.unit);
        if (p.weekCycle !== 'week_a') b.add(p.unit);
      }
      return Math.max(a.size, b.size);
    };
    const subjectsHere = Array.from(new Set(list.map((p) => p.sc.subjectId)));
    for (const s of subjectsHere) {
      if (this.subjectMap.get(s)?.distributionRule === 'any') continue;
      const v = visits((p) => p.sc.subjectId === s);
      if (v > 1) {
        let w = W.sameSubjectDay;
        for (const r of this.idealRules)
          if ((!r.subjectIds?.length || r.subjectIds.includes(s)) && (!r.classIds?.length || r.classIds.includes(cid))) w += ruleWeight(r);
        soft += (v - 1) * w;
      }
    }

    if (acc) acc.same_subject_day = (acc.same_subject_day || 0) + soft - subjBefore;
    for (const r of this.classDayRules.get(cid) || []) {
      const w = ruleWeight(r);
      const strict = r.importance === 'strict';
      const rb = soft;
      const add = (n: number, monotonic: boolean) => {
        if (n <= 0) return;
        if (strict && monotonic) hard += n;
        else soft += n * w;
      };
      switch (r.condition) {
        case 'daily_hours_limit':
          add(count - (r.maxPeriodsPerDay ?? 5), true);
          if (count < (r.minPeriodsPerDay ?? 0)) soft += ((r.minPeriodsPerDay ?? 0) - count) * w;
          break;
        case 'max_consecutive_periods':
          add(maxRun - (r.maxConsecutive ?? 3), true);
          break;
        case 'max_gaps_daily_weekly':
          add(gaps - (r.maxGapsPerDay ?? 1), false);
          break;
        case 'cannot_same_day': {
          const present = r.subjectIds.filter((s) => subjectsHere.includes(s));
          add(present.length - 1, true);
          break;
        }
        case 'cannot_consecutive': {
          let n = 0;
          for (const a of list) {
            if (!r.subjectIds.includes(a.sc.subjectId)) continue;
            for (const b of list) {
              if (b.sc.periodIndex === a.sc.periodIndex + 1 && b.sc.subjectId !== a.sc.subjectId && r.subjectIds.includes(b.sc.subjectId)) n++;
            }
          }
          add(n, true);
          break;
        }
        case 'teacher_max_once_per_day': {
          const tids = Array.from(new Set(list.map((p) => p.sc.teacherId)));
          for (const t of tids) {
            if (r.teacherIds?.length && !r.teacherIds.includes(t)) continue;
            const v = visits((p) => p.sc.teacherId === t && p.sc.classId === cid);
            add(v - (r.value || 1), true);
          }
          break;
        }
      }
      if (acc) acc[`c:${r.condition}`] = (acc[`c:${r.condition}`] || 0) + soft - rb;
    }
    return { hard, soft, count, gaps };
  }

  private evalDayKey(key: string, list: Placed[]): DayEval {
    const [kind, id] = key.split('|');
    return kind === 't' ? this.evalTeacherDay(id, list) : this.evalClassDay(id, list);
  }

  private dayEval(key: string): DayEval {
    let v = this.dayCache.get(key);
    if (!v) {
      v = this.evalDayKey(key, this.entityDay.get(key) || []);
      this.dayCache.set(key, v);
    }
    return v;
  }

  private evalWeek(kind: 't' | 'c', id: string, override?: Map<string, DayEval>): DayEval {
    const rules = (kind === 't' ? this.teacherWeekRules : this.classWeekRules).get(id);
    if (!rules || rules.length === 0) return ZERO;
    let days = 0;
    let gaps = 0;
    for (let d = 0; d < this.days; d++) {
      const key = `${kind}|${id}|${d}`;
      const e = override?.get(key) || this.dayEval(key);
      if (e.count > 0) days++;
      gaps += e.gaps;
    }
    let hard = 0;
    let soft = 0;
    for (const r of rules) {
      const w = ruleWeight(r);
      if (r.condition === 'teaching_days_limit') {
        const over = days - (r.maxDaysPerWeek ?? 5);
        if (over > 0) {
          if (r.importance === 'strict') hard += over;
          else soft += over * w;
        }
        const min = r.minDaysPerWeek ?? 0;
        if (days > 0 && days < min) soft += (min - days) * w;
      } else if (r.condition === 'max_gaps_daily_weekly') {
        const over = gaps - (r.maxGapsPerWeek ?? 3);
        if (over > 0) soft += over * w;
      }
    }
    return { hard, soft, count: days, gaps };
  }

  private weekEval(kind: 't' | 'c', id: string): DayEval {
    const k = `${kind}|${id}`;
    let v = this.weekCache.get(k);
    if (!v) {
      v = this.evalWeek(kind, id);
      this.weekCache.set(k, v);
    }
    return v;
  }

  /**
   * Нэгжийг (day, period)-д нэмэхэд хатуу хязгаар зөрчигдөх эсэх, зөөлөн торгуулийн өөрчлөлт.
   * Нөөцийн давхардлыг энд шалгахгүй (дуудагч өмнө нь шалгасан байх ёстой).
   */
  private evaluateAdd(items: Placed[]): { ok: boolean; delta: number } {
    const byKey = new Map<string, Placed[]>();
    for (const p of items)
      for (const k of this.entityKeys(p)) {
        if (!byKey.has(k)) byKey.set(k, []);
        byKey.get(k)!.push(p);
      }
    let delta = 0;
    const overrides = new Map<string, DayEval>();
    for (const [k, extra] of byKey) {
      const cur = this.dayEval(k);
      const next = this.evalDayKey(k, (this.entityDay.get(k) || []).concat(extra));
      if (next.hard > cur.hard) return { ok: false, delta: 0 };
      delta += next.soft - cur.soft;
      overrides.set(k, next);
    }
    const weekIds = new Set<string>();
    for (const k of byKey.keys()) {
      const [kind, id] = k.split('|');
      weekIds.add(`${kind}|${id}`);
    }
    for (const w of weekIds) {
      const [kind, id] = w.split('|') as ['t' | 'c', string];
      const rules = (kind === 't' ? this.teacherWeekRules : this.classWeekRules).get(id);
      if (!rules || rules.length === 0) continue;
      const cur = this.weekEval(kind, id);
      const next = this.evalWeek(kind, id, overrides);
      if (next.hard > cur.hard) return { ok: false, delta: 0 };
      delta += next.soft - cur.soft;
    }
    for (const p of items) delta += this.cardCost(p.sc);
    return { ok: true, delta };
  }

  private refreshKeys(items: Placed[]) {
    const keys = new Set<string>();
    for (const p of items) for (const k of this.entityKeys(p)) keys.add(k);
    const weeks = new Set<string>();
    for (const k of keys) {
      const old = this.dayCache.get(k) || this.evalDayKey(k, []);
      const next = this.evalDayKey(k, this.entityDay.get(k) || []);
      this.dayCache.set(k, next);
      this.softTotal += next.soft - old.soft;
      const [kind, id] = k.split('|');
      weeks.add(`${kind}|${id}`);
    }
    for (const w of weeks) {
      const [kind, id] = w.split('|') as ['t' | 'c', string];
      const old = this.weekCache.get(w) || ZERO;
      const next = this.evalWeek(kind, id);
      this.weekCache.set(w, next);
      this.softTotal += next.soft - old.soft;
    }
  }

  // -------------------------------------------------------------------------
  // Нэгж байрлуулах / авах
  // -------------------------------------------------------------------------

  private itemsFor(u: Unit, day: number, period: number): Placed[] {
    return u.cards.map((c, i) => this.makePlaced(c, day, period + u.offsets[i], u.id, false));
  }

  /** Нөөцийн давхардалгүй + хатуу дүрэм зөрчихгүй бол торгуулийн өөрчлөлтийг буцаана, үгүй бол null */
  private tryUnit(u: Unit, day: number, period: number): { delta: number; items: Placed[] } | null {
    if (!this.staticOk(u, day, period)) return null;
    const items = this.itemsFor(u, day, period);
    // Нэгжийн доторх картуудыг дараалан нэмж шалгана (жишээ нь нэг танхимд 2 бүлэг)
    const inserted: Placed[] = [];
    let ok = true;
    for (const p of items) {
      if (this.resourceBlockers(p, null)) {
        ok = false;
        break;
      }
      this.insert(p);
      inserted.push(p);
    }
    for (const p of inserted) this.extract(p);
    if (!ok) return null;
    const ev = this.evaluateAdd(items);
    if (!ev.ok) return null;
    return { delta: ev.delta, items };
  }

  private commit(u: Unit, day: number, period: number, items: Placed[]) {
    for (const p of items) this.insert(p);
    this.unitPlaced.set(u.id, items);
    this.unitPos.set(u.id, { day, period });
    for (const p of items) this.cardCostTotal += this.cardCost(p.sc);
    this.refreshKeys(items);
  }

  private unplace(uid: string) {
    const items = this.unitPlaced.get(uid);
    if (!items) return;
    for (const p of items) this.extract(p);
    for (const p of items) this.cardCostTotal -= this.cardCost(p.sc);
    this.unitPlaced.delete(uid);
    this.unitPos.delete(uid);
    this.refreshKeys(items);
  }

  placeLocked(cards: ScheduledCard[]) {
    for (const c of cards) {
      const p = this.makePlaced(c, c.dayIndex, c.periodIndex, `locked:${c.id}`, true);
      this.insert(p);
      this.unitPlaced.set(p.unit, [p]);
      this.cardCostTotal += this.cardCost(p.sc);
      this.refreshKeys([p]);
    }
  }

  get cost() {
    return this.softTotal + this.cardCostTotal;
  }

  // -------------------------------------------------------------------------
  // Барих + засах
  // -------------------------------------------------------------------------

  private bestSlot(u: Unit): { day: number; period: number; delta: number; items: Placed[] } | null {
    let best: { day: number; period: number; delta: number; items: Placed[] } | null = null;
    const n = this.tm.periodsCount(u.shift);
    for (let d = 0; d < this.days; d++) {
      for (let p = 0; p < n; p++) {
        const r = this.tryUnit(u, d, p);
        if (!r) continue;
        const score = r.delta + this.rand() * 0.5;
        if (!best || score < best.delta) best = { day: d, period: p, delta: score, items: r.items };
      }
    }
    return best;
  }

  /** Саад болж буй нэгжүүдийг гаргаад байрлуулах. Амжилттай бол гаргасан нэгжүүдийн жагсаалт. */
  private repair(u: Unit): string[] | null {
    const n = this.tm.periodsCount(u.shift);
    type Cand = { day: number; period: number; blockers: string[]; score: number };
    const cands: Cand[] = [];
    for (let d = 0; d < this.days; d++) {
      for (let p = 0; p < n; p++) {
        if (!this.staticOk(u, d, p)) continue;
        const items = this.itemsFor(u, d, p);
        const coll = new Set<Placed>();
        for (const it of items) this.resourceBlockers(it, coll);
        if (Array.from(coll).some((x) => x.locked)) continue;
        const blockers = Array.from(new Set(Array.from(coll).map((x) => x.unit)));
        if (blockers.length > 3) continue;
        let score = 0;
        for (const b of blockers) {
          const bu = this.unitById.get(b)!;
          score += 10 + bu.ejections * 3 + bu.cards.length * 2;
        }
        cands.push({ day: d, period: p, blockers, score: score + this.rand() * 4 });
      }
    }
    cands.sort((a, b) => a.score - b.score);
    for (const c of cands.slice(0, 8)) {
      const saved = c.blockers.map((b) => ({ id: b, pos: this.unitPos.get(b)!, items: this.unitPlaced.get(b)! }));
      for (const b of c.blockers) this.unplace(b);
      const r = this.tryUnit(u, c.day, c.period);
      if (r) {
        this.commit(u, c.day, c.period, r.items);
        for (const b of c.blockers) this.unitById.get(b)!.ejections++;
        return c.blockers;
      }
      // буцаах
      for (const s of saved) {
        const bu = this.unitById.get(s.id)!;
        this.commit(bu, s.pos.day, s.pos.period, this.itemsFor(bu, s.pos.day, s.pos.period));
      }
    }
    return null;
  }

  /** Зөөлөн торгуультай өдрүүдийн түлхүүр (торгуулиар жинлэсэн) */
  private hotKeys(): { key: string; w: number }[] {
    const out: { key: string; w: number }[] = [];
    for (const [k, v] of this.dayCache) if (v.soft > 0 && (this.entityDay.get(k)?.length || 0) > 0) out.push({ key: k, w: v.soft });
    return out;
  }

  private pickHotUnit(keys: { key: string; w: number }[]): Unit | null {
    if (keys.length === 0) return null;
    // Хэд хэдэн санамсаргүй түлхүүрээс хамгийн их торгуультайг сонгоно (tournament)
    let best: { key: string; w: number } | null = null;
    for (let i = 0; i < 3; i++) {
      const c = keys[Math.floor(this.rand() * keys.length)];
      if (!best || c.w > best.w) best = c;
    }
    const list = (this.entityDay.get(best!.key) || []).filter((p) => !p.locked);
    if (list.length === 0) return null;
    return this.unitById.get(list[Math.floor(this.rand() * list.length)].unit) || null;
  }

  /** Торгуулийн задаргаа (оношилгоо, тайлан) */
  costBreakdown(): Record<string, number> {
    const acc: Record<string, number> = {};
    for (const [k, list] of this.entityDay) {
      if (list.length === 0) continue;
      const [kind, id] = k.split('|');
      if (kind === 't') this.evalTeacherDay(id, list, acc);
      else this.evalClassDay(id, list, acc);
    }
    for (const [k, v] of this.weekCache) acc[`week:${k[0]}`] = (acc[`week:${k[0]}`] || 0) + v.soft;
    acc.card = this.cardCostTotal;
    return acc;
  }

  snapshot(): Map<string, { day: number; period: number }> {
    return new Map(this.unitPos);
  }

  restore(snap: Map<string, { day: number; period: number }>) {
    for (const uid of Array.from(this.unitPos.keys())) this.unplace(uid);
    for (const [uid, pos] of snap) {
      const u = this.unitById.get(uid)!;
      this.commit(u, pos.day, pos.period, this.itemsFor(u, pos.day, pos.period));
    }
  }

  async solve(
    opts: SolveOptions,
    onProgress?: (pct: number, msg: string) => void
  ): Promise<SolveResult> {
    const start = Date.now();
    const limit = Math.max(1000, opts.timeLimitMs ?? 30000);
    const constructEnd = start + limit * 0.65;
    const deadline = start + limit;
    const stop = () => !!opts.shouldStop?.();
    let lastYield = Date.now();
    const maybeYield = async () => {
      if (Date.now() - lastYield > 40) {
        await new Promise((r) => setTimeout(r, 0));
        lastYield = Date.now();
      }
    };

    const total = this.units.length;
    const unassigned = new Set(this.units.map((u) => u.id));
    let best = { unassigned: Infinity, cost: Infinity, snap: this.snapshot() };
    let lastSnap = 0;
    // Хамгийн сайн төлөвийг хадгална (зөвхөн торгууль сайжирсан бол 200мс тутамд, байршсан тоо өссөн бол шууд)
    const recordBest = (force = false) => {
      const ua = unassigned.size;
      const c = this.cost;
      const better = ua < best.unassigned || (ua === best.unassigned && c < best.cost - 1e-6);
      if (!better) return;
      if (force || ua < best.unassigned || Date.now() - lastSnap > 200) {
        best = { unassigned: ua, cost: c, snap: this.snapshot() };
        lastSnap = Date.now();
      }
    };
    const pickNext = (): Unit | null => {
      let pick: Unit | null = null;
      for (const id of unassigned) {
        const u = this.unitById.get(id)!;
        if (u.failures > 6) continue;
        const key = u.rank - u.ejections * 5;
        if (!pick || key < pick.rank - pick.ejections * 5) pick = u;
      }
      return pick;
    };

    // --- 1. Барих + засах ---
    let sinceImprove = 0;
    let lastReport = 0;
    while (Date.now() < constructEnd && !stop()) {
      const u = pickNext();
      if (!u) break;
      this.iterations++;
      const slot = this.bestSlot(u);
      if (slot) {
        this.commit(u, slot.day, slot.period, slot.items);
        unassigned.delete(u.id);
      } else {
        const ejected = this.repair(u);
        if (ejected) {
          unassigned.delete(u.id);
          for (const b of ejected) unassigned.add(b);
        } else u.failures++;
      }
      const before = best.unassigned;
      recordBest();
      sinceImprove = best.unassigned < before ? 0 : sinceImprove + 1;
      if (sinceImprove > total * 6) break;
      if (Date.now() - lastReport > 250) {
        lastReport = Date.now();
        const placed = total - unassigned.size;
        onProgress?.(
          5 + Math.round((60 * placed) / Math.max(1, total)),
          `Байршуулж байна: ${placed}/${total} нэгж (хамгийн сайн: ${total - best.unassigned}), торгууль ${Math.round(this.cost)}`
        );
      }
      await maybeYield();
    }
    recordBest(true);
    this.restore(best.snap);
    for (const u of this.units) if (this.unitPos.has(u.id)) unassigned.delete(u.id);
    else unassigned.add(u.id);

    // --- 2. Сайжруулах ---
    const placedUnits = () => this.units.filter((u) => this.unitPos.has(u.id));
    let pool = placedUnits();
    const T0 = 12;
    let moves = 0;
    let accepted = 0;
    let bestSeenCost = this.cost;
    let lastGain = 0;
    let hotKeys = this.hotKeys();
    const improveStart = Date.now();
    const unitsByClass = new Map<string, Unit[]>();
    for (const u of this.units) {
      const k = u.cards[0].classId;
      if (!unitsByClass.has(k)) unitsByClass.set(k, []);
      unitsByClass.get(k)!.push(u);
    }

    while (Date.now() < deadline && !stop() && pool.length > 0) {
      moves++;
      this.iterations++;
      const frac = (Date.now() - improveStart) / Math.max(1, deadline - improveStart);
      const T = T0 * (1 - frac) + 0.05;

      // Хааяа байршаагүй нэгжийг дахин оролдоно
      if (unassigned.size > 0 && moves % 50 === 0) {
        for (const id of Array.from(unassigned)) {
          const u = this.unitById.get(id)!;
          const s = this.bestSlot(u);
          if (s) {
            this.commit(u, s.day, s.period, s.items);
            unassigned.delete(id);
            pool.push(u);
          } else {
            const ej = this.repair(u);
            if (ej && ej.length === 1) {
              // зөвхөн 1 нэгжийг гаргасан бол түүнийг шууд дахин байршуулахыг оролдоно
              const bu = this.unitById.get(ej[0])!;
              const s2 = this.bestSlot(bu);
              if (s2) {
                this.commit(bu, s2.day, s2.period, s2.items);
                unassigned.delete(id);
                pool.push(u);
              } else {
                // буцаана
                this.unplace(u.id);
                const bs = this.bestSlot(bu);
                if (bs) this.commit(bu, bs.day, bs.period, bs.items);
              }
            } else if (ej) {
              // олныг гаргасан бол буцаахгүй, тэдгээрийг дахин байршуулна
              unassigned.delete(id);
              pool.push(u);
              for (const b of ej) {
                const bu = this.unitById.get(b)!;
                const s3 = this.bestSlot(bu);
                if (s3) this.commit(bu, s3.day, s3.period, s3.items);
                else unassigned.add(b);
              }
              pool = placedUnits();
            }
          }
        }
        recordBest();
      }

      // Удаан хугацаанд сайжрахгүй бол эрт дуусгана
      if (this.cost < bestSeenCost - 1e-6) {
        bestSeenCost = this.cost;
        lastGain = moves;
      } else if (moves - lastGain > Math.max(4000, pool.length * 40) && unassigned.size === 0) break;
      if (bestSeenCost <= 1e-6 && unassigned.size === 0) break;

      // Зарим тохиолдолд торгууль ихтэй багш/ангийн өдрөөс нэгж сонгож хайлтыг чиглүүлнэ
      let u = pool[Math.floor(this.rand() * pool.length)];
      if (this.rand() < 0.3) {
        const hot = this.pickHotUnit(hotKeys);
        if (hot) u = hot;
      }
      if (moves % 2000 === 1) hotKeys = this.hotKeys();
      const pos = this.unitPos.get(u.id);
      if (!pos) {
        pool = placedUnits();
        continue;
      }

      if (this.rand() < 0.35) {
        // Солих: нэг ангийн ижил хэлбэрийн өөр нэгжтэй
        const peers = (unitsByClass.get(u.cards[0].classId) || []).filter(
          (x) => x !== u && this.unitPos.has(x.id) && x.offsets.join() === u.offsets.join()
        );
        if (peers.length === 0) continue;
        const v = peers[Math.floor(this.rand() * peers.length)];
        const pv = this.unitPos.get(v.id)!;
        if (pv.day === pos.day && pv.period === pos.period) continue;
        const before = this.cost;
        this.unplace(u.id);
        this.unplace(v.id);
        const a = this.tryUnit(u, pv.day, pv.period);
        let ok = false;
        if (a) {
          this.commit(u, pv.day, pv.period, a.items);
          const b = this.tryUnit(v, pos.day, pos.period);
          if (b) {
            this.commit(v, pos.day, pos.period, b.items);
            const d = this.cost - before;
            if (d < 0 || this.rand() < Math.exp(-d / T)) ok = true;
            else this.unplace(v.id);
          }
          if (!ok) this.unplace(u.id);
        }
        if (!ok) {
          this.commit(u, pos.day, pos.period, this.itemsFor(u, pos.day, pos.period));
          this.commit(v, pv.day, pv.period, this.itemsFor(v, pv.day, pv.period));
        } else accepted++;
      } else {
        // Зөөх: хамгийн сайн (эсвэл санамсаргүй сайжруулалт) нүд рүү
        const before = this.cost;
        this.unplace(u.id);
        const base = this.cost;
        const back = this.tryUnit(u, pos.day, pos.period);
        const origDelta = back ? back.delta : Infinity;
        const n = this.tm.periodsCount(u.shift);
        let choice: { day: number; period: number; delta: number; items: Placed[] } | null = null;
        const slots = this.days * n;
        const startIdx = Math.floor(this.rand() * slots);
        const scan = Math.min(slots, 24);
        for (let k = 0; k < scan; k++) {
          const idx = (startIdx + k * 7) % slots;
          const d = Math.floor(idx / n);
          const p = idx % n;
          if (d === pos.day && p === pos.period) continue;
          const r = this.tryUnit(u, d, p);
          if (!r) continue;
          if (!choice || r.delta < choice.delta) choice = { day: d, period: p, delta: r.delta, items: r.items };
        }
        if (choice) {
          const diff = choice.delta - origDelta;
          if (diff < 0 || this.rand() < Math.exp(-diff / T)) {
            this.commit(u, choice.day, choice.period, choice.items);
            accepted++;
          } else this.commit(u, pos.day, pos.period, back!.items);
        } else if (back) this.commit(u, pos.day, pos.period, back.items);
        void before;
        void base;
      }
      recordBest();

      if (Date.now() - lastReport > 250) {
        lastReport = Date.now();
        onProgress?.(
          65 + Math.round(30 * frac),
          `Сайжруулж байна: торгууль ${Math.round(this.cost)} (хамгийн сайн ${Math.round(best.cost)}), байршаагүй ${unassigned.size}`
        );
      }
      await maybeYield();
    }

    recordBest(true);
    if (typeof process !== 'undefined' && (process as any).env?.SOLVER_DEBUG) {
      this.restore(best.snap);
      console.log(`[solver] moves=${moves} accepted=${accepted} improveMs=${Date.now() - improveStart} best=${Math.round(best.cost)} unassigned=${best.unassigned}`);
      console.log('[solver] breakdown', Object.fromEntries(Object.entries(this.costBreakdown()).map(([k, v]) => [k, Math.round(v)])));
    }
    this.restore(best.snap);
    const cards: ScheduledCard[] = [];
    for (const items of this.unitPlaced.values()) for (const p of items) cards.push(p.sc);
    return {
      scheduledCards: cards,
      unplacedUnits: this.units.filter((u) => !this.unitPos.has(u.id)).length,
      softCost: this.cost,
      iterations: this.iterations,
    };
  }
}
