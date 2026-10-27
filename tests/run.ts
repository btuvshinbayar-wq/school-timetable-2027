/**
 * Хатуу хязгаарлалтын тест (1-р шат).
 * Ажиллуулах: npm test
 */
import { generateTimetable, testTimetableFeasibility, verifyTimetable } from '../src/utils/generator';
import { buildTimeModel, Occupancy, teacherDaySlots, migrateTimeOff, timeOffForShift } from '../src/utils/constraints';
import * as D from '../src/utils/defaultData';
import type {
  CardRelationship,
  ClassGroup,
  Classroom,
  LessonContract,
  ScheduledCard,
  Teacher,
} from '../src/types/timetable';
import { auditHardConstraints } from './audit';

const settings = D.getDefaultSchoolSettings();
const subjects = D.DEFAULT_SUBJECTS;

const T = (id: string, timeOff: Record<string, any> = {}): Teacher => ({
  id,
  name: id,
  shortName: id,
  color: '#000',
  timeOff,
  maxPeriodsPerDay: 6,
  maxGapsPerDay: 1,
});
const C = (id: string, shift = 1): ClassGroup => ({
  id,
  name: id,
  shortName: id,
  grade: 10,
  shift,
  color: '#000',
  timeOff: {},
  maxPeriodsPerDay: 6,
  subgroups: [...D.DEFAULT_SUBGROUPS],
});
const L = (id: string, o: Partial<LessonContract>): LessonContract => ({
  id,
  subjectId: 'sub-1',
  teacherId: 'A',
  classId: 'X',
  totalPeriods: 1,
  singleLessons: 1,
  doubleLessons: 0,
  weekCycle: 'all',
  ...o,
});

let failed = 0;
let passed = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function gen(
  lessons: LessonContract[],
  teachers: Teacher[],
  classes: ClassGroup[],
  rooms: Classroom[] = D.DEFAULT_CLASSROOMS,
  rels: CardRelationship[] = []
) {
  return generateTimetable(subjects, teachers, classes, rooms, lessons, rels, settings);
}
const slot = (c: ScheduledCard) => `${c.shift}_${c.dayIndex}_${c.periodIndex}`;
const byContract = (cards: ScheduledCard[], id: string) => cards.filter((c) => c.contractId === id);

async function main() {
  console.log('\nА. Өөр хуваалтын дэд бүлгүүд зэрэг орохгүй');
  {
    const r = await gen(
      [
        L('eng1', { subjectId: 'sub-4', teacherId: 'A', subgroupName: '1-р дэд бүлэг' }),
        L('pe_g', { subjectId: 'sub-11', teacherId: 'B', subgroupName: 'Охид' }),
      ],
      [T('A'), T('B')],
      [C('X')]
    );
    const [a] = byContract(r.scheduledCards, 'eng1');
    const [b] = byContract(r.scheduledCards, 'pe_g');
    check('хоёулаа байршсан', !!a && !!b);
    check('өөр цагт', !!a && !!b && slot(a) !== slot(b), `${a && slot(a)} / ${b && slot(b)}`);
  }

  console.log('\nА2. Нэг хуваалтын бүлгүүд (Охид/Хөвгүүд) зэрэгцэж болно');
  {
    const r = await gen(
      [
        L('pe_g', { subjectId: 'sub-11', teacherId: 'A', subgroupName: 'Охид' }),
        L('pe_b', { subjectId: 'sub-11', teacherId: 'B', subgroupName: 'Хөвгүүд' }),
      ],
      [T('A'), T('B')],
      [C('X')]
    );
    const [a] = byContract(r.scheduledCards, 'pe_g');
    const [b] = byContract(r.scheduledCards, 'pe_b');
    check('ижил цагт зэрэгцсэн', !!a && !!b && slot(a) === slot(b));
  }

  console.log('\nБ. Хамтатгасан анги ба хамтран заах багш');
  {
    const lessons = [
      L('lec', { teacherId: 'A', classId: 'X', jointClassIds: ['Y'], coTeacherIds: ['B'] }),
      L('y1', { teacherId: 'C', classId: 'Y' }),
      L('b1', { teacherId: 'B', classId: 'Z' }),
    ];
    const r = await gen(lessons, [T('A'), T('B'), T('C')], [C('X'), C('Y'), C('Z')]);
    const [lec] = byContract(r.scheduledCards, 'lec');
    const [y1] = byContract(r.scheduledCards, 'y1');
    const [b1] = byContract(r.scheduledCards, 'b1');
    check('бүгд байршсан', !!lec && !!y1 && !!b1);
    check('Y анги лекцтэй зэрэг өөр хичээлгүй', slot(lec) !== slot(y1));
    check('хамтран заах багш B зэрэг өөр ангид ороогүй', slot(lec) !== slot(b1));
    check('картад хамтатгал хадгалагдсан', !!lec.jointClassIds?.includes('Y') && !!lec.coTeacherIds?.includes('B'));
  }

  console.log('\nВ. Ээлжтэй чөлөөт цаг');
  {
    // Зөвхөн 2-р ээлжийн Даваа 1-р цаг хаалттай
    const r = await gen(
      [L('m1', { teacherId: 'A', classId: 'X' }), L('m2', { teacherId: 'A', classId: 'Q' })],
      [T('A', { '2_0_0': 'forbidden' })],
      [C('X', 1), C('Q', 2)]
    );
    const [m1] = byContract(r.scheduledCards, 'm1');
    const [m2] = byContract(r.scheduledCards, 'm2');
    check('1-р ээлжид Даваа 1-р цаг ашиглагдсан', m1 && m1.dayIndex === 0 && m1.periodIndex === 0, m1 && slot(m1));
    check('2-р ээлжид Даваа 1-р цаг ашиглагдаагүй', m2 && !(m2.dayIndex === 0 && m2.periodIndex === 0), m2 && slot(m2));

    const legacy = migrateTimeOff({ '0_0': 'forbidden' }, [1, 2]);
    check('хуучин түлхүүр бүх ээлжид шилжсэн', legacy['1_0_0'] === 'forbidden' && legacy['2_0_0'] === 'forbidden');
    const moved = timeOffForShift({ '1_2_3': 'forbidden' }, 2);
    check('1-р ээлжийн ангиас 2-р ээлжийн ангид хуулахад шилжсэн', moved['2_2_3'] === 'forbidden');
  }

  console.log('\nГ. А/Б 7 хоног нэг нүдийг хуваалцана');
  {
    const r = await gen(
      [
        L('art', { subjectId: 'sub-12', teacherId: 'A', weekCycle: 'week_a' }),
        L('tech', { subjectId: 'sub-13', teacherId: 'B', weekCycle: 'week_b' }),
      ],
      [T('A'), T('B')],
      [C('X')]
    );
    const [a] = byContract(r.scheduledCards, 'art');
    const [b] = byContract(r.scheduledCards, 'tech');
    check('ижил нүдэнд', !!a && !!b && slot(a) === slot(b));
    check('verify алдаагүй', r.conflicts.filter((c) => c.severity === 'error').length === 0);
  }

  console.log('\nД. Нэг багш хоёр дэд бүлгийг заавал багцлагдсан ч давхардахгүй');
  {
    const r = await gen(
      [
        L('g1', { subjectId: 'sub-4', teacherId: 'A', subgroupName: '1-р дэд бүлэг', totalPeriods: 3, singleLessons: 3 }),
        L('g2', { subjectId: 'sub-4', teacherId: 'A', subgroupName: '2-р дэд бүлэг', totalPeriods: 3, singleLessons: 3 }),
      ],
      [T('A')],
      [C('X')]
    );
    check('6 цаг байршсан', r.scheduledCards.length === 6, `${r.scheduledCards.length}`);
    check('багшийн давхардалгүй', new Set(r.scheduledCards.map(slot)).size === r.scheduledCards.length);
  }

  console.log('\nЕ. Ачааллын шалгалт дэд бүлэг, А/Б-г тооцно');
  {
    const ls: LessonContract[] = [];
    for (let i = 0; i < 13; i++) ls.push(L(`w${i}`, { teacherId: `t${i}`, totalPeriods: 2, singleLessons: 2 }));
    ls.push(L('g1', { teacherId: 'u1', subgroupName: '1-р дэд бүлэг', totalPeriods: 3, singleLessons: 3 }));
    ls.push(L('g2', { teacherId: 'u2', subgroupName: '2-р дэд бүлэг', totalPeriods: 3, singleLessons: 3 }));
    ls.push(L('a', { teacherId: 'u3', weekCycle: 'week_a' }));
    ls.push(L('b', { teacherId: 'u4', weekCycle: 'week_b' }));
    const f = testTimetableFeasibility(subjects, [], [C('X')], [], ls, settings);
    check('30 нүд ≤ 30 → давна', f.passed, f.messages.join(' '));
    ls.push(L('extra', { teacherId: 'u5' }));
    const f2 = testTimetableFeasibility(subjects, [], [C('X')], [], ls, settings);
    check('31 нүд > 30 → унана', !f2.passed);
  }

  console.log('\nЖ. Verify: танхимын багтаамж, чөлөөт цаг, байршаагүй цаг, ээлж холилгүй багшийн цонх');
  {
    const gym: Classroom = { id: 'gym', name: 'Заал', shortName: 'Заал', buildingId: 'b', capacity: 60, isShared: true, maxConcurrentClasses: 2, color: '#000', timeOff: {} };
    const room: Classroom = { id: 'r1', name: '101', shortName: '101', buildingId: 'b', capacity: 30, isShared: false, color: '#000', timeOff: {} };
    const card = (id: string, o: Partial<ScheduledCard>): ScheduledCard => ({
      id, contractId: id, subjectId: 'sub-11', teacherId: id, classId: id, shift: 1, dayIndex: 0, periodIndex: 0, weekCycle: 'all', ...o,
    });
    const classes = ['p', 'q', 's', 'u', 'v'].map((x) => C(x));
    const teachers = ['p', 'q', 's', 'u', 'v'].map((x) => T(x));
    teachers[4].timeOff = { '1_0_0': 'forbidden' };
    const cards = [
      card('p', { classroomId: 'gym' }),
      card('q', { classroomId: 'gym' }),
      card('s', { classroomId: 'gym' }),
      card('u', { classroomId: 'r1' }),
      card('v', { classroomId: 'r1' }),
    ];
    const lessons = [L('p', { teacherId: 'p', classId: 'p', totalPeriods: 2 })];
    const issues = verifyTimetable(cards, subjects, teachers, classes, [gym, room], settings, [], lessons);
    check('хуваалцах заал 3 > 2 илэрсэн', issues.some((i) => i.type === 'clash_room' && i.entityId === 'gym'));
    check('энгийн танхим 2 > 1 илэрсэн', issues.some((i) => i.type === 'clash_room' && i.entityId === 'r1'));
    check('чөлөөт цагийн зөрчил илэрсэн', issues.some((i) => i.type === 'time_off_violation' && i.entityId === 'v'));
    check('байршаагүй цаг илэрсэн', issues.some((i) => i.type === 'unplaced'));

    const tm = buildTimeModel(settings);
    const twoShift = [card('a1', { teacherId: 'A', shift: 1, periodIndex: 2 }), card('a2', { teacherId: 'A', shift: 2, periodIndex: 2 })];
    check('1 ба 2-р ээлжийн 3-р цаг хоёр өөр цаг гэж тоологдсон', teacherDaySlots(tm, twoShift, 'A', 0).length === 2);

    const occ = new Occupancy({ settings, teachers: [T('A')], classes: [C('X'), C('Q', 2)], classrooms: [], subjects });
    occ.add(card('x1', { teacherId: 'A', classId: 'X', shift: 1, periodIndex: 0 }));
    check('өөр ээлжийн ижил дугаартай цаг багшид давхцахгүй', occ.canPlace(card('q1', { teacherId: 'A', classId: 'Q', shift: 2, periodIndex: 0 })));
  }

  console.log('\nЗ. 24 анги, 2 ээлж, анхдагч дүрэм — нийт хатуу шалгалт');
  {
    const { lessons, teachers, classes, rooms } = buildSyntheticSchool();
    const rels = D.DEFAULT_RELATIONSHIPS.map((r) => ({ ...r, classIds: r.id === 'rel-cross-subgroups' ? [] : r.classIds }));
    const t0 = Date.now();
    const r = await generateTimetable(subjects, teachers, classes, rooms, lessons, rels, settings);
    const ms = Date.now() - t0;
    const audit = auditHardConstraints(r.scheduledCards, lessons, classes, teachers, rooms, settings);
    const total = lessons.reduce((s, l) => s + l.totalPeriods, 0);
    console.log(`    байршсан ${r.scheduledCards.length}/${total}, ${ms} мс, бие даасан аудит: ${JSON.stringify(audit)}`);
    check('бие даасан аудитаар хатуу зөрчил 0', Object.values(audit).every((v) => v === 0));
    const errs = r.conflicts.filter((c) => c.severity === 'error');
    check('verify-ийн алдаа 0', errs.length === 0, errs.slice(0, 3).map((e) => e.description).join(' | '));
  }

  console.log(`\n${passed} амжилттай, ${failed} амжилтгүй`);
  if (failed > 0) process.exit(1);
}

/** 24 анги (ээлж бүрт 12), анги бүр 7 хоногт 29 цаг, Англи хэл 2 дэд бүлэг, БТ хос цаг заалд, А/Б урлаг/технологи */
function buildSyntheticSchool() {
  const hours: Record<string, number> = {
    'sub-1': 5, 'sub-2': 4, 'sub-3': 2, 'sub-4': 3, 'sub-5': 2, 'sub-6': 2, 'sub-7': 2,
    'sub-8': 2, 'sub-9': 1, 'sub-10': 2, 'sub-11': 2, 'sub-12': 1, 'sub-13': 1,
  };
  const classes: ClassGroup[] = [];
  for (let i = 0; i < 24; i++) classes.push({ ...C(`C${i}`, i < 12 ? 1 : 2), name: `Анги ${i}` });
  const teachers: Teacher[] = [];
  const lessons: LessonContract[] = [];
  const rooms: Classroom[] = [
    { id: 'gym', name: 'Заал', shortName: 'Заал', buildingId: 'bld-1', capacity: 60, isShared: true, maxConcurrentClasses: 2, color: '#ccc', timeOff: {} },
  ];
  let tid = 0;
  const newTeacher = () => {
    const t = T(`T${tid}`);
    if (tid % 7 === 0) t.timeOff = { '1_0_0': 'forbidden', '1_0_1': 'forbidden', '2_0_0': 'forbidden', '2_0_1': 'forbidden' };
    tid++;
    teachers.push(t);
    return t;
  };
  for (const s of subjects) {
    const per = hours[s.id];
    const perTeacher = Math.max(1, Math.floor(22 / per));
    for (let k = 0; k < classes.length; k += perTeacher) {
      const t = newTeacher();
      const t2 = s.id === 'sub-4' ? newTeacher() : t;
      for (const cls of classes.slice(k, k + perTeacher)) {
        const id = () => `L${lessons.length}`;
        if (s.id === 'sub-4') {
          lessons.push(L(id(), { subjectId: s.id, teacherId: t.id, classId: cls.id, subgroupName: '1-р дэд бүлэг', totalPeriods: per, singleLessons: per }));
          lessons.push(L(id(), { subjectId: s.id, teacherId: t2.id, classId: cls.id, subgroupName: '2-р дэд бүлэг', totalPeriods: per, singleLessons: per }));
        } else if (s.id === 'sub-11') {
          lessons.push(L(id(), { subjectId: s.id, teacherId: t.id, classId: cls.id, classroomId: 'gym', totalPeriods: 2, singleLessons: 0, doubleLessons: 1 }));
        } else if (s.id === 'sub-12' || s.id === 'sub-13') {
          lessons.push(L(id(), { subjectId: s.id, teacherId: t.id, classId: cls.id, weekCycle: s.id === 'sub-12' ? 'week_a' : 'week_b' }));
        } else if (s.id === 'sub-1') {
          lessons.push(L(id(), { subjectId: s.id, teacherId: t.id, classId: cls.id, totalPeriods: 5, singleLessons: 3, doubleLessons: 1 }));
        } else {
          lessons.push(L(id(), { subjectId: s.id, teacherId: t.id, classId: cls.id, totalPeriods: per, singleLessons: per }));
        }
      }
    }
  }
  return { lessons, teachers, classes, rooms };
}

main();
