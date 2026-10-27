/**
 * Хүндрүүлсэн стресс өгөгдөл: 120 бүлэг, 3 ээлж, 3 хичээлийн байр.
 *
 *  - 1-р ээлж 08:00 (6 цаг): 9–12-р анги (40 бүлэг). 11–12 → 1-р байр, 9–10 → 2-р байр
 *  - 2-р ээлж 12:50 (6 цаг): 5–8-р анги (40 бүлэг). 7–8 → 1-р байр, 5–6 → 2-р байр
 *  - 3-р ээлж 14:20 (5 цаг): 1–4-р анги (40 бүлэг), 3-р байр.
 *    3-р ээлж 2-р ээлжтэй цагийн хувьд ДАВХЦАНА — хоёр ээлжид заадаг багшид бодит цагийн шалгалт хэрэгтэй.
 *  - Ахлах, дунд ангийн багш нар 1 ба 2-р ээлж, 1 ба 2-р байрыг дамжин заана.
 *  - Бага ангийн хөгжим, биеийн тамир, англи хэлний багш нар 2 ба 3-р ээлжийг дамжина.
 *  - Англи хэл, мэдээлэл зүй 2 дэд бүлэгтэй; биеийн тамир заалд хос цагаар;
 *    дүрслэх урлаг / технологи А/Б 7 хоногоор ээлжилнэ; 11–12-р ангид 2 бүлгийг хамтатгасан
 *    сонгон хичээл (хамтран заах багштай); 15% багш чөлөөт цагтай; ~5% багш 7 хоногт 4 өдөр ажиллана.
 *  - Анги бүр 7 хоногт: ахлах 29/30, дунд 28/30, бага 22/25 нүд.
 */
import type {
  CardRelationship,
  ClassGroup,
  Classroom,
  LessonContract,
  SchoolSettings,
  Subject,
  Teacher,
} from '../src/types/timetable';
import { calculateShiftBells, DEFAULT_RELATIONSHIPS, DEFAULT_SUBGROUPS } from '../src/utils/defaultData';

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildStressSchool(seed = 2027) {
  const rand = rng(seed);

  const settings: SchoolSettings = {
    schoolName: 'Стресс тест сургууль',
    academicYear: '2026-2027',
    daysPerWeek: 5,
    dayNames: ['Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан'],
    shiftsCount: 3,
    shifts: [
      { shiftNumber: 1, name: '1-р ээлж', startTime: '08:00', periodsCount: 6, lessonDurationMinutes: 40, defaultBreakMinutes: 5, bigBreakMinutes: 10, bigBreakAfterPeriod: 3, bells: calculateShiftBells('08:00', 6, 40, 5, 10, 3) },
      { shiftNumber: 2, name: '2-р ээлж', startTime: '12:50', periodsCount: 6, lessonDurationMinutes: 40, defaultBreakMinutes: 5, bigBreakMinutes: 10, bigBreakAfterPeriod: 3, bells: calculateShiftBells('12:50', 6, 40, 5, 10, 3) },
      { shiftNumber: 3, name: '3-р ээлж', startTime: '14:20', periodsCount: 5, lessonDurationMinutes: 40, defaultBreakMinutes: 5, bigBreakMinutes: 10, bigBreakAfterPeriod: 2, bells: calculateShiftBells('14:20', 5, 40, 5, 10, 2) },
    ],
    buildings: [
      { id: 'bld-1', name: '1-р байр', shortName: '1-р байр', color: '#2563eb' },
      { id: 'bld-2', name: '2-р байр', shortName: '2-р байр', color: '#16a34a' },
      { id: 'bld-3', name: '3-р байр (бага)', shortName: '3-р байр', color: '#ca8a04' },
    ],
    enableWeekAB: true,
    defaultBreakMinutes: 5,
    lunchBreakMinutes: 10,
    periodsPerDay: 6,
    bells: calculateShiftBells('08:00', 6, 40, 5, 10, 3),
  };

  const S = (id: string, name: string, shortName: string): Subject => ({ id, name, shortName, color: '#888', timeOff: {}, distributionRule: 'ideal' });
  const subjects: Subject[] = [
    S('math', 'Математик', 'Мат'), S('mon', 'Монгол хэл', 'МХ'), S('lit', 'Уран зохиол', 'УЗ'),
    S('eng', 'Англи хэл', 'Анг'), S('phy', 'Физик', 'Физ'), S('chem', 'Хими', 'Хим'),
    S('bio', 'Биологи', 'Био'), S('hist', 'Түүх', 'Түүх'), S('soc', 'Нийгэм', 'Нийг'),
    S('geo', 'Газарзүй', 'Газ'), S('it', 'Мэдээлэл зүй', 'Мэд'), S('pe', 'Биеийн тамир', 'БТ'),
    S('art', 'Дүрслэх урлаг', 'ДУ'), S('tech', 'Технологи', 'Тех'), S('music', 'Хөгжим', 'Хөг'),
    S('nat', 'Байгаль орчин', 'БО'), S('elec', 'Сонгон хичээл', 'Сонг'), S('ethic', 'Хүмүүжил', 'Хүм'),
  ];

  // --- Ангиуд ---
  const letters = 'АБВГДЕЖЗИК';
  const classes: ClassGroup[] = [];
  for (let grade = 1; grade <= 12; grade++) {
    const shift = grade >= 9 ? 1 : grade >= 5 ? 2 : 3;
    const buildingId = grade <= 4 ? 'bld-3' : grade === 11 || grade === 12 || grade === 7 || grade === 8 ? 'bld-1' : 'bld-2';
    for (let k = 0; k < 10; k++) {
      classes.push({
        id: `c${grade}${letters[k]}`,
        name: `${grade}${letters[k]}`,
        shortName: `${grade}${letters[k]}`,
        grade,
        shift,
        buildingId,
        color: '#888',
        timeOff: {},
        maxPeriodsPerDay: shift === 3 ? 5 : 6,
        subgroups: [...DEFAULT_SUBGROUPS],
      });
    }
  }

  // --- Танхимууд ---
  const room = (id: string, name: string, buildingId: string, isShared: boolean, cap = 1): Classroom => ({
    id, name, shortName: name, buildingId, capacity: 36, isShared, maxConcurrentClasses: cap, color: '#ccc', timeOff: {},
  });
  const rooms: Classroom[] = [
    room('gym1', 'Заал-1', 'bld-1', true, 2),
    room('gym2', 'Заал-2', 'bld-2', true, 2),
    room('hall3', 'Заал-3', 'bld-3', true, 4),
    room('lab1a', 'Комп-1А', 'bld-1', false),
    room('lab1b', 'Комп-1Б', 'bld-1', false),
    room('lab2a', 'Комп-2А', 'bld-2', false),
    room('lab2b', 'Комп-2Б', 'bld-2', false),
    room('chem1', 'Хими лаб-1', 'bld-1', false),
    room('chem2', 'Хими лаб-2', 'bld-2', false),
  ];
  const gymOf = (c: ClassGroup) => (c.buildingId === 'bld-1' ? 'gym1' : c.buildingId === 'bld-2' ? 'gym2' : 'hall3');
  const labOf = (c: ClassGroup, i: number) =>
    c.buildingId === 'bld-1' ? (i % 2 ? 'lab1b' : 'lab1a') : i % 2 ? 'lab2b' : 'lab2a';
  // Хими лаб-д 1 ангид 1 цаг (40 анги / 30 нүд хэтрэхгүй байхаар)
  const chemLabOf = (c: ClassGroup) => (c.buildingId === 'bld-1' ? 'chem1' : 'chem2');

  // --- Сургалтын төлөвлөгөө ---
  type Item = { sub: string; h: number; dbl?: number; groups?: boolean; room?: (c: ClassGroup, i: number) => string | undefined; week?: 'week_a' | 'week_b' };
  const senior: Item[] = [
    { sub: 'math', h: 5, dbl: 1 }, { sub: 'mon', h: 3 }, { sub: 'lit', h: 2 }, { sub: 'eng', h: 3, groups: true },
    { sub: 'phy', h: 2 }, { sub: 'chem', h: 2 }, { sub: 'bio', h: 2 }, { sub: 'hist', h: 2 }, { sub: 'soc', h: 1 },
    { sub: 'geo', h: 1 }, { sub: 'it', h: 2, groups: true, room: (c, i) => labOf(c, i) }, { sub: 'pe', h: 2, dbl: 1, room: (c) => gymOf(c) },
    { sub: 'art', h: 1, week: 'week_a' }, { sub: 'tech', h: 1, week: 'week_b' },
  ]; // 29 нүд (+11–12-р ангид сонгон 1 = 30)
  const middle: Item[] = [
    { sub: 'math', h: 5, dbl: 1 }, { sub: 'mon', h: 4 }, { sub: 'lit', h: 2 }, { sub: 'eng', h: 3, groups: true },
    { sub: 'phy', h: 2 }, { sub: 'chem', h: 1, room: (c) => chemLabOf(c) }, { sub: 'bio', h: 2 }, { sub: 'hist', h: 2 },
    { sub: 'soc', h: 1 }, { sub: 'geo', h: 1 }, { sub: 'it', h: 1, groups: true, room: (c, i) => labOf(c, i) },
    { sub: 'pe', h: 2, dbl: 1, room: (c) => gymOf(c) }, { sub: 'music', h: 1 },
    { sub: 'art', h: 1, week: 'week_a' }, { sub: 'tech', h: 1, week: 'week_b' },
  ]; // 28 нүд
  const primaryClassTeacher: Item[] = [
    { sub: 'mon', h: 7 }, { sub: 'math', h: 5 }, { sub: 'nat', h: 2 }, { sub: 'art', h: 1 }, { sub: 'tech', h: 1 },
  ]; // 16 (+1–2-р ангид хүмүүжил 2)
  const primarySpecial: Item[] = [{ sub: 'music', h: 2 }, { sub: 'pe', h: 2, room: (c) => gymOf(c) }];

  // --- Багш нар: хичээл бүрт ~20 цагтай багш, ангиудыг ээлж холин хуваарилна ---
  const teachers: Teacher[] = [];
  let tCounter = 0;
  const newTeacher = (subject: string): Teacher => {
    const t: Teacher = {
      id: `t${++tCounter}`,
      name: `${subjects.find((s) => s.id === subject)?.shortName}-${tCounter}`,
      shortName: `${subject}${tCounter}`,
      color: '#999',
      timeOff: {},
      maxPeriodsPerDay: 6,
      maxGapsPerDay: 2,
    };
    // 15% багш тодорхой цагт боломжгүй, ~5% нь 7 хоногт 4 өдөр ажиллана
    const r = rand();
    if (r < 0.15) {
      const d = Math.floor(rand() * 5);
      for (const sh of [1, 2, 3]) for (const p of [0, 1]) t.timeOff[`${sh}_${d}_${p}`] = 'forbidden';
    } else if (r < 0.2) {
      // 7 хоногт 4 өдөр ажилладаг багш
      const d1 = Math.floor(rand() * 5);
      for (const sh of [1, 2, 3]) for (let p = 0; p < 6; p++) t.timeOff[`${sh}_${d1}_${p}`] = 'forbidden';
    }
    teachers.push(t);
    return t;
  };

  const lessons: LessonContract[] = [];
  let lid = 0;
  const addLesson = (o: Omit<LessonContract, 'id' | 'singleLessons' | 'doubleLessons' | 'weekCycle'> & { dbl?: number; weekCycle?: any }) => {
    const dbl = o.dbl || 0;
    const { dbl: _d, ...rest } = o as any;
    lessons.push({ ...rest, id: `L${++lid}`, doubleLessons: dbl, singleLessons: o.totalPeriods - 2 * dbl, weekCycle: o.weekCycle || 'all' });
  };

  // Ахлах + дунд: хичээлээр бүлэглэн багш оноох (1 ба 2-р ээлжийн ангиудыг ээлжлэн)
  const sm = classes.filter((c) => c.grade >= 5);
  const interleaved: ClassGroup[] = [];
  const s1 = sm.filter((c) => c.shift === 1);
  const s2 = sm.filter((c) => c.shift === 2);
  for (let i = 0; i < Math.max(s1.length, s2.length); i++) {
    if (s1[i]) interleaved.push(s1[i]);
    if (s2[i]) interleaved.push(s2[i]);
  }
  const subjectsSM = Array.from(new Set([...senior, ...middle].map((x) => x.sub)));
  for (const sub of subjectsSM) {
    // хичээл бүрийн "ажлын нэгж": (анги, бүлэг, цаг)
    const units: { cls: ClassGroup; item: Item; group?: string; idx: number }[] = [];
    // Дэд бүлгүүдийг өөр багш заахаар: эхлээд бүх ангийн 1-р бүлэг, дараа нь 2-р бүлэг
    for (const group of [undefined, '1-р дэд бүлэг', '2-р дэд бүлэг']) {
      interleaved.forEach((cls, idx) => {
        const plan = cls.grade >= 9 ? senior : middle;
        const item = plan.find((x) => x.sub === sub);
        if (!item || !!item.groups !== !!group) return;
        units.push({ cls, item, group, idx });
      });
    }
    let t = newTeacher(sub);
    let load = 0;
    const target = 20 + Math.floor(rand() * 4);
    for (const u of units) {
      if (load + u.item.h > target && load > 0) {
        t = newTeacher(sub);
        load = 0;
      }
      addLesson({
        subjectId: sub,
        teacherId: t.id,
        classId: u.cls.id,
        subgroupName: u.group,
        totalPeriods: u.item.h,
        dbl: u.item.dbl,
        // Компьютерын лабд зөвхөн 1-р бүлэг (лаб тус бүрт ээлжинд 10 анги), 2-р бүлэг энгийн өрөөнд
        classroomId: u.item.sub === 'it' && u.group === '2-р дэд бүлэг' ? undefined : u.item.room?.(u.cls, u.cls.name.charCodeAt(u.cls.name.length - 1)),
        weekCycle: u.item.week,
      });
      load += u.item.h;
    }
  }

  // 11–12-р анги: 2 бүлгийг хамтатгасан сонгон хичээл (хамтран заах багштай)
  const electiveClasses = classes.filter((c) => c.grade >= 11);
  let elecT = newTeacher('elec');
  let elecCo = newTeacher('elec');
  let elecLoad = 0;
  for (let i = 0; i < electiveClasses.length; i += 2) {
    if (elecLoad >= 6) {
      elecT = newTeacher('elec');
      elecCo = newTeacher('elec');
      elecLoad = 0;
    }
    addLesson({
      subjectId: 'elec',
      teacherId: elecT.id,
      coTeacherIds: [elecCo.id],
      classId: electiveClasses[i].id,
      jointClassIds: [electiveClasses[i + 1].id],
      totalPeriods: 1,
    });
    elecLoad++;
  }

  // Бага анги: анги даасан багш + мэргэжлийн багш (хөгжим, БТ нь 2 ба 3-р ээлжийг дамжина)
  const primary = classes.filter((c) => c.grade <= 4);
  for (const cls of primary) {
    const t = newTeacher('mon');
    t.name = `Анги даасан ${cls.name}`;
    for (const it of primaryClassTeacher) addLesson({ subjectId: it.sub, teacherId: t.id, classId: cls.id, totalPeriods: it.h });
    if (cls.grade <= 2) addLesson({ subjectId: 'ethic', teacherId: t.id, classId: cls.id, totalPeriods: 2 });
  }
  for (const it of primarySpecial) {
    // 2-р ээлжийн хөгжмийн багш нар бага ангид ч заана
    const existing = it.sub === 'music' ? teachers.filter((t) => t.shortName.startsWith('music')) : [];
    const pool = [...existing];
    const loadOf = new Map<string, number>(pool.map((t) => [t.id, lessons.filter((l) => l.teacherId === t.id).reduce((s, l) => s + l.totalPeriods, 0)]));
    for (const cls of primary) {
      let t = pool.find((x) => (loadOf.get(x.id) || 0) + it.h <= 22);
      if (!t) {
        t = newTeacher(it.sub);
        pool.push(t);
        loadOf.set(t.id, 0);
      }
      addLesson({ subjectId: it.sub, teacherId: t.id, classId: cls.id, totalPeriods: it.h, classroomId: it.room?.(cls, 0) });
      loadOf.set(t.id, (loadOf.get(t.id) || 0) + it.h);
    }
  }
  // 3–4-р анги: англи хэл 2 дэд бүлэгтэй — дунд ангийн англи хэлний багш нар (2 ба 3-р ээлж давхцана)
  const engPool = teachers.filter((t) => t.shortName.startsWith('eng'));
  const engLoad = new Map(engPool.map((t) => [t.id, lessons.filter((l) => l.teacherId === t.id).reduce((s, l) => s + l.totalPeriods, 0)]));
  for (const cls of primary.filter((c) => c.grade >= 3)) {
    const used: string[] = [];
    for (const g of ['1-р дэд бүлэг', '2-р дэд бүлэг']) {
      // хоёр бүлэг зэрэгцэх ёстой тул өөр өөр багш
      let t = engPool.find((x) => !used.includes(x.id) && (engLoad.get(x.id) || 0) + 2 <= 24);
      if (!t) {
        t = newTeacher('eng');
        engPool.push(t);
        engLoad.set(t.id, 0);
      }
      used.push(t.id);
      addLesson({ subjectId: 'eng', teacherId: t.id, classId: cls.id, subgroupName: g, totalPeriods: 2 });
      engLoad.set(t.id, (engLoad.get(t.id) || 0) + 2);
    }
  }

  // Хагас цагийн багшийн ачаалал багтахгүй бол нэг өдрийн хязгаарыг л үлдээнэ (өгөгдөл боломжтой байх ёстой)
  const shiftPeriods = (sh: number) => settings.shifts.find((x) => x.shiftNumber === sh)!.periodsCount;
  for (const t of teachers) {
    const mine = lessons.filter((l) => l.teacherId === t.id || l.coTeacherIds?.includes(t.id));
    const demand = mine.reduce((s, l) => s + (l.weekCycle === 'week_b' ? 0 : l.totalPeriods), 0);
    const shifts = new Set(mine.map((l) => classes.find((c) => c.id === l.classId)!.shift));
    let cap = 0;
    for (const sh of shifts) for (let d = 0; d < 5; d++) for (let p = 0; p < shiftPeriods(sh); p++) if (t.timeOff[`${sh}_${d}_${p}`] !== 'forbidden') cap++;
    if (demand > cap - 3) {
      const days = new Set(Object.keys(t.timeOff).map((k) => k.split('_')[1]));
      const keep = Array.from(days)[0];
      for (const k of Object.keys(t.timeOff)) if (k.split('_')[1] !== keep || Number(k.split('_')[2]) > 1) delete t.timeOff[k];
    }
  }

  // --- Дүрмүүд: анхдагч + байр солих завсар ---
  const primaryClassTeacherIds = teachers.filter((t) => t.name.startsWith('Анги даасан')).map((t) => t.id);
  const subjectTeacherIds = teachers.filter((t) => !primaryClassTeacherIds.includes(t.id)).map((t) => t.id);
  const relationships: CardRelationship[] = DEFAULT_RELATIONSHIPS.map((r) => {
    const x: CardRelationship = { ...r };
    if (r.condition === 'cannot_same_day') x.subjectIds = ['phy', 'chem'];
    if (r.condition === 'cannot_consecutive') x.subjectIds = ['math', 'phy'];
    if (r.condition === 'first_or_last') x.subjectIds = ['pe'];
    if (r.condition === 'allowed_periods_only') x.subjectIds = ['math'];
    if (r.condition === 'same_subject_subgroups_simultaneous') x.subjectIds = ['eng', 'it'];
    if (r.condition === 'different_subjects_subgroups_simultaneous') x.isActive = false;
    // Анги даасан багш өдөрт тухайн ангид олон удаа ордог тул энэ дүрэм мэргэжлийн багш нарт л үйлчилнэ
    if (r.condition === 'teacher_max_once_per_day') x.teacherIds = subjectTeacherIds;
    if (r.condition === 'daily_hours_limit' || r.condition === 'max_consecutive_periods') x.teacherIds = subjectTeacherIds;
    return x;
  });
  relationships.push({
    id: 'rel-building-buffer',
    name: 'Байр солигдох завсар',
    condition: 'building_transfer_buffer',
    subjectIds: [],
    classIds: [],
    teacherIds: [],
    value: 1,
    importance: 'high',
    isActive: true,
  });
  relationships.push({
    id: 'rel-ideal',
    name: '7 хоногт жигд тархах',
    condition: 'ideal_distribution',
    subjectIds: [],
    classIds: [],
    importance: 'normal',
    isActive: true,
  });

  return { settings, subjects, teachers, classes, rooms, lessons, relationships };
}
