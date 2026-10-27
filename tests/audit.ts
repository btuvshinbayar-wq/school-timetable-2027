/**
 * constraints.ts-ээс хамааралгүй, бие даасан хатуу хязгаарлалтын аудит.
 * Generator өөрийгөө "дүгнэхгүй" байхын тулд тусад нь, энгийнээр бичсэн.
 */
import type { ClassGroup, Classroom, LessonContract, ScheduledCard, SchoolSettings, Teacher } from '../src/types/timetable';

const toMin = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
};

export function auditHardConstraints(
  cards: ScheduledCard[],
  lessons: LessonContract[],
  classes: ClassGroup[],
  teachers: Teacher[],
  rooms: Classroom[],
  settings: SchoolSettings
) {
  const lessonById = new Map(lessons.map((l) => [l.id, l]));
  const time = (c: ScheduledCard) => {
    const b = settings.shifts.find((s) => s.shiftNumber === c.shift)!.bells[c.periodIndex];
    return [toMin(b.startTime), toMin(b.endTime)];
  };
  const sameTime = (a: ScheduledCard, b: ScheduledCard) => {
    if (a.dayIndex !== b.dayIndex) return false;
    const [s1, e1] = time(a);
    const [s2, e2] = time(b);
    return s1 < e2 && s2 < e1;
  };
  const sameWeek = (a: ScheduledCard, b: ScheduledCard) =>
    a.weekCycle === 'all' || b.weekCycle === 'all' || a.weekCycle === b.weekCycle;
  const teachersOf = (c: ScheduledCard) => [c.teacherId, ...(lessonById.get(c.contractId)?.coTeacherIds || [])];
  const classesOf = (c: ScheduledCard) => [c.classId, ...(lessonById.get(c.contractId)?.jointClassIds || [])];
  const category = (classId: string, name?: string) =>
    classes.find((c) => c.id === classId)?.subgroups?.find((s) => s.name === name)?.category ?? `x:${name}`;

  let teacherClash = 0;
  let classClash = 0;
  let roomOverCapacity = 0;
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const a = cards[i];
      const b = cards[j];
      if (!sameTime(a, b) || !sameWeek(a, b)) continue;
      if (teachersOf(a).some((t) => teachersOf(b).includes(t))) teacherClash++;
      for (const cl of classesOf(a)) {
        if (!classesOf(b).includes(cl)) continue;
        const ok =
          a.subgroupName && b.subgroupName && a.subgroupName !== b.subgroupName &&
          category(cl, a.subgroupName) === category(cl, b.subgroupName);
        if (!ok) classClash++;
      }
    }
  }
  for (const a of cards) {
    if (!a.classroomId) continue;
    const room = rooms.find((r) => r.id === a.classroomId);
    const cap = room?.isShared ? room.maxConcurrentClasses ?? 2 : 1;
    const n = cards.filter((b) => b.classroomId === a.classroomId && sameWeek(a, b) && (a === b || sameTime(a, b))).length;
    if (n > cap) roomOverCapacity++;
  }
  let teacherTimeOff = 0;
  for (const c of cards) {
    for (const t of teachersOf(c)) {
      const off = teachers.find((x) => x.id === t)?.timeOff || {};
      const st = off[`${c.shift}_${c.dayIndex}_${c.periodIndex}`] || off[`${c.dayIndex}_${c.periodIndex}`];
      if (st === 'forbidden') teacherTimeOff++;
    }
  }
  let brokenDoubles = 0;
  for (const c of cards) {
    if (c.isDoublePart !== 'first') continue;
    const p = cards.find((x) => x.id === c.linkedCardId);
    if (!p || p.dayIndex !== c.dayIndex || p.shift !== c.shift || p.periodIndex !== c.periodIndex + 1) brokenDoubles++;
  }
  return { teacherClash, classClash, roomOverCapacity, teacherTimeOff, brokenDoubles };
}

/** Чанарын үзүүлэлт (зөөлөн): бага байх тусам сайн */
export function auditQuality(
  cards: ScheduledCard[],
  lessons: LessonContract[],
  classes: ClassGroup[],
  teachers: Teacher[],
  rooms: Classroom[],
  settings: SchoolSettings
) {
  const lessonById = new Map(lessons.map((l) => [l.id, l]));
  const days = settings.daysPerWeek;
  const bell = (c: ScheduledCard) => settings.shifts.find((s) => s.shiftNumber === c.shift)!.bells[c.periodIndex];
  const buildingOf = (c: ScheduledCard) =>
    rooms.find((r) => r.id === c.classroomId)?.buildingId || classes.find((x) => x.id === c.classId)?.buildingId || '';

  let classGaps = 0;
  let sameSubjectSameDay = 0;
  let dayImbalance = 0;
  for (const cls of classes) {
    const mine = cards.filter((c) => c.classId === cls.id || lessonById.get(c.contractId)?.jointClassIds?.includes(cls.id));
    const perDay: number[] = [];
    for (let d = 0; d < days; d++) {
      const dc = mine.filter((c) => c.dayIndex === d);
      const ps = [...new Set(dc.map((c) => c.periodIndex))].sort((a, b) => a - b);
      perDay.push(ps.length);
      if (ps.length > 1) classGaps += ps[ps.length - 1] - ps[0] + 1 - ps.length;
      const units = new Map<string, number>();
      for (const c of dc) {
        if (c.isDoublePart === 'second' || c.subgroupName === '2-р дэд бүлэг') continue;
        units.set(c.subjectId, (units.get(c.subjectId) || 0) + 1);
      }
      for (const n of units.values()) if (n > 1) sameSubjectSameDay += n - 1;
    }
    dayImbalance += Math.max(...perDay) - Math.min(...perDay);
  }

  let teacherGaps = 0;
  let buildingHops = 0;
  for (const t of teachers) {
    const mine = cards.filter((c) => c.teacherId === t.id || lessonById.get(c.contractId)?.coTeacherIds?.includes(t.id));
    for (let d = 0; d < days; d++) {
      const dc = mine
        .filter((c) => c.dayIndex === d)
        .map((c) => {
          const b = bell(c);
          const [sh, sm] = b.startTime.split(':').map(Number);
          const [eh, em] = b.endTime.split(':').map(Number);
          return { s: sh * 60 + sm, e: eh * 60 + em, b: buildingOf(c) };
        })
        .sort((a, b) => a.s - b.s);
      for (let i = 1; i < dc.length; i++) {
        const gapMin = dc[i].s - dc[i - 1].e;
        if (gapMin >= 30) teacherGaps += Math.round(gapMin / 45);
        if (gapMin < 30 && dc[i].b !== dc[i - 1].b) buildingHops++;
      }
    }
  }
  return {
    classGaps,
    teacherGaps,
    sameSubjectSameDay,
    buildingHopsWithoutBreak: buildingHops,
    avgClassDayImbalance: +(dayImbalance / classes.length).toFixed(2),
  };
}
