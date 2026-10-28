/**
 * Гараар засах (чирж тавих) логик.
 * Generator, verify-тэй ижил хатуу хязгаарлалтын цөмийг (constraints.ts) ашиглана.
 *
 *  - Карт ангиа хэзээ ч солихгүй (зөвхөн өдөр, цаг өөрчлөгдөнө).
 *  - Хос цагийн хоёр хагас хамт зөөгдөнө.
 *  - Түгжсэн карт зөөгдөхгүй.
 *  - Эзэлсэн нүдэнд тавихад тэнд байгаа (түгжээгүй) картуудтай байраа солих боломжтой эсэхийг шалгана.
 */
import { ClassGroup, Classroom, LessonContract, ScheduledCard, SchoolSettings, Subject, Teacher } from '../types/timetable';
import { ConstraintContext, Occupancy, PlacementViolation } from './constraints';

export interface EditContext {
  settings: SchoolSettings;
  subjects: Subject[];
  teachers: Teacher[];
  classes: ClassGroup[];
  classrooms: Classroom[];
  lessons: LessonContract[];
}

export type MoveStatus = 'ok' | 'swap' | 'bad';

export interface MoveVerdict {
  status: MoveStatus;
  reason?: string;
  /** Солигдох картууд (status === 'swap') */
  swapWith?: string[];
}

/** Карт ба хос цагийн хамтрагч */
export function cardGroup(cards: ScheduledCard[], cardId: string): ScheduledCard[] {
  const c = cards.find((x) => x.id === cardId);
  if (!c) return [];
  const partner = c.linkedCardId ? cards.find((x) => x.id === c.linkedCardId) : undefined;
  if (!partner) return [c];
  return c.isDoublePart === 'second' ? [partner, c] : [c, partner];
}

function enrich(card: ScheduledCard, lessons: Map<string, LessonContract>): ScheduledCard {
  const l = lessons.get(card.contractId);
  if (!l) return card;
  return {
    ...card,
    coTeacherIds: card.coTeacherIds ?? (l.coTeacherIds?.length ? l.coTeacherIds : undefined),
    jointClassIds: card.jointClassIds ?? (l.jointClassIds?.length ? l.jointClassIds : undefined),
  };
}

function describe(v: PlacementViolation, ctx: EditContext): string {
  const tName = (id: string) => ctx.teachers.find((t) => t.id === id)?.name || 'Багш';
  const cName = (id: string) => ctx.classes.find((c) => c.id === id)?.name || 'Анги';
  const rName = (id: string) => ctx.classrooms.find((r) => r.id === id)?.name || 'Танхим';
  if (v.kind === 'teacher') return `${tName(v.resourceId)} энэ цагт өөр хичээлтэй`;
  if (v.kind === 'class') return `${cName(v.resourceId)} энэ цагт өөр хичээлтэй`;
  if (v.kind === 'room') return `${rName(v.resourceId)} энэ цагт дүүрэн`;
  const [type, id] = v.resourceId.split(':');
  const who = type === 'teacher' ? tName(id) : type === 'class' ? cName(id) : type === 'room' ? rName(id) : 'Хичээл';
  return `${who} энэ цагт хаалттай`;
}

/** Бүлэг картыг (day, period)-д тавихад гарах байрлалууд (хос цагийн 2-р хагас +1) */
function shifted(group: ScheduledCard[], day: number, period: number): ScheduledCard[] {
  const base = group[0].periodIndex;
  return group.map((c) => ({ ...c, dayIndex: day, periodIndex: period + (c.periodIndex - base) }));
}

function buildOcc(ctx: EditContext, cards: ScheduledCard[], exclude: Set<string>, lessons: Map<string, LessonContract>) {
  const cctx: ConstraintContext = {
    settings: ctx.settings,
    teachers: ctx.teachers,
    classes: ctx.classes,
    classrooms: ctx.classrooms,
    subjects: ctx.subjects,
  };
  const occ = new Occupancy(cctx);
  for (const c of cards) if (!exclude.has(c.id)) occ.add(enrich(c, lessons));
  return occ;
}

/**
 * Картыг (day, period) руу зөөж болох эсэх.
 * ok — шууд тавина; swap — тэнд байгаа картуудтай байраа солино; bad — боломжгүй (шалтгаантай).
 */
export function evaluateMove(
  ctx: EditContext,
  cards: ScheduledCard[],
  cardId: string,
  day: number,
  period: number
): MoveVerdict {
  const lessons = new Map(ctx.lessons.map((l) => [l.id, l]));
  const group = cardGroup(cards, cardId);
  if (group.length === 0) return { status: 'bad', reason: 'Карт олдсонгүй' };
  if (group.some((c) => c.isLocked)) return { status: 'bad', reason: 'Карт түгжээтэй — эхлээд түгжээг авна уу' };
  const first = group[0];
  const shiftConf = ctx.settings.shifts.find((s) => s.shiftNumber === first.shift) || ctx.settings.shifts[0];
  const n = shiftConf?.periodsCount || 6;
  const target = shifted(group, day, period - (cardId === first.id ? 0 : group.findIndex((c) => c.id === cardId)));
  if (target.some((c) => c.periodIndex < 0 || c.periodIndex >= n))
    return { status: 'bad', reason: group.length > 1 ? 'Хос цаг энэ байрлалд багтахгүй' : 'Ээлжийн цагийн хүрээнээс гадуур' };
  if (target[0].dayIndex === first.dayIndex && target[0].periodIndex === first.periodIndex) return { status: 'bad', reason: 'Ижил байрлал' };

  const groupIds = new Set(group.map((c) => c.id));
  const occ = buildOcc(ctx, cards, groupIds, lessons);
  const blockers = new Set<string>();
  let hardReason: string | undefined;
  // Хос цагийн хагасууд бие биенээ харахгүйн тулд дараалан нэмж шалгана
  const added: ScheduledCard[] = [];
  for (const t of target) {
    const e = enrich(t, lessons);
    for (const v of occ.violations(e)) {
      if (v.kind === 'time_off') hardReason = hardReason || describe(v, ctx);
      else {
        v.otherCardIds.forEach((id) => blockers.add(id));
        if (v.otherCardIds.length === 0) hardReason = hardReason || describe(v, ctx);
      }
    }
    occ.add(e);
    added.push(e);
  }
  if (hardReason) return { status: 'bad', reason: hardReason };
  if (blockers.size === 0) return { status: 'ok' };

  // Солих: саад болж буй картууд (тэдгээрийн хос хамтрагчтай нь) эх байрлалд багтах эсэх
  const blockerGroups = new Map<string, ScheduledCard[]>();
  for (const id of blockers) {
    const g = cardGroup(cards, id);
    if (g.some((c) => c.isLocked)) return { status: 'bad', reason: 'Энэ цагт түгжсэн хичээл байна' };
    blockerGroups.set(g[0].id, g);
  }
  const others = Array.from(blockerGroups.values()).flat();
  const otherIds = new Set(others.map((c) => c.id));
  for (const c of others) if (c.classId !== first.classId) {
    const v = describeBlocker(ctx, c);
    return { status: 'bad', reason: v };
  }
  const occ2 = buildOcc(ctx, cards, new Set([...groupIds, ...otherIds]), lessons);
  for (const t of target) occ2.add(enrich(t, lessons));
  for (const g of blockerGroups.values()) {
    const moved = shifted(g, first.dayIndex, first.periodIndex + (g[0].periodIndex - target[0].periodIndex));
    for (const m of moved) {
      if (m.periodIndex < 0 || m.periodIndex >= n) return { status: 'bad', reason: 'Солих хичээл эх байрлалд багтахгүй' };
      const e = enrich(m, lessons);
      const vs = occ2.violations(e);
      if (vs.length > 0) return { status: 'bad', reason: `Солих боломжгүй: ${describe(vs[0], ctx)}` };
      occ2.add(e);
    }
  }
  return { status: 'swap', swapWith: Array.from(otherIds) };
}

function describeBlocker(ctx: EditContext, c: ScheduledCard): string {
  const cls = ctx.classes.find((x) => x.id === c.classId)?.name || 'өөр анги';
  const t = ctx.teachers.find((x) => x.id === c.teacherId)?.name || 'багш';
  return `Энэ цагт ${t} ${cls}-д хичээлтэй`;
}

/** Зөөлтийг хэрэгжүүлнэ (evaluateMove-аар зөвшөөрөгдсөн гэж үзнэ) */
export function applyMove(cards: ScheduledCard[], cardId: string, day: number, period: number, verdict: MoveVerdict): ScheduledCard[] {
  const group = cardGroup(cards, cardId);
  if (group.length === 0) return cards;
  const first = group[0];
  const offset = group.findIndex((c) => c.id === cardId);
  const target = shifted(group, day, period - offset);
  const pos = new Map(target.map((c) => [c.id, c]));
  if (verdict.status === 'swap' && verdict.swapWith) {
    const others = new Map<string, ScheduledCard[]>();
    for (const id of verdict.swapWith) {
      const g = cardGroup(cards, id);
      others.set(g[0].id, g);
    }
    for (const g of others.values()) {
      for (const m of shifted(g, first.dayIndex, first.periodIndex + (g[0].periodIndex - target[0].periodIndex))) pos.set(m.id, m);
    }
  }
  return cards.map((c) => {
    const p = pos.get(c.id);
    return p ? { ...c, dayIndex: p.dayIndex, periodIndex: p.periodIndex } : c;
  });
}

/** Тавиураас шинэ карт тавих: гэрээний хос цаг үлдсэн бол хос хэлбэрээр тавина */
export function newCardsFromContract(
  contract: LessonContract,
  cls: ClassGroup | undefined,
  placedCards: ScheduledCard[],
  day: number,
  period: number
): ScheduledCard[] {
  const placed = placedCards.filter((c) => c.contractId === contract.id);
  const placedPairs = placed.filter((c) => c.isDoublePart === 'first').length;
  const remaining = contract.totalPeriods - placed.length;
  const wantDouble = (contract.doubleLessons || 0) > placedPairs && remaining >= 2;
  const stamp = Date.now().toString(36);
  const base: ScheduledCard = {
    id: `${contract.id}_m_${stamp}`,
    contractId: contract.id,
    subjectId: contract.subjectId,
    teacherId: contract.teacherId,
    coTeacherIds: contract.coTeacherIds?.length ? [...contract.coTeacherIds] : undefined,
    classId: contract.classId,
    jointClassIds: contract.jointClassIds?.length ? [...contract.jointClassIds] : undefined,
    subgroupName: contract.subgroupName,
    classroomId: contract.classroomId,
    shift: cls?.shift || 1,
    weekCycle: contract.weekCycle || 'all',
    dayIndex: day,
    periodIndex: period,
  };
  if (!wantDouble) return [base];
  const a = { ...base, id: `${base.id}_1`, isDoublePart: 'first' as const, linkedCardId: `${base.id}_2` };
  const b = { ...base, id: `${base.id}_2`, periodIndex: period + 1, isDoublePart: 'second' as const, linkedCardId: `${base.id}_1` };
  return [a, b];
}

/** Шинэ карт(ууд)-ыг тавьж болох эсэх */
export function evaluateNew(ctx: EditContext, cards: ScheduledCard[], newCards: ScheduledCard[]): MoveVerdict {
  const lessons = new Map(ctx.lessons.map((l) => [l.id, l]));
  const shiftConf = ctx.settings.shifts.find((s) => s.shiftNumber === newCards[0].shift) || ctx.settings.shifts[0];
  const n = shiftConf?.periodsCount || 6;
  if (newCards.some((c) => c.periodIndex < 0 || c.periodIndex >= n)) return { status: 'bad', reason: 'Ээлжийн цагийн хүрээнээс гадуур' };
  const occ = buildOcc(ctx, cards, new Set(), lessons);
  for (const c of newCards) {
    const e = enrich(c, lessons);
    const vs = occ.violations(e);
    if (vs.length > 0) return { status: 'bad', reason: describe(vs[0], ctx) };
    occ.add(e);
  }
  return { status: 'ok' };
}
