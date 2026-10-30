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
import { applyMove, evaluateMove } from '../src/utils/manualEdit';
import { ensureIntegrity } from '../src/utils/integrity';
import { mergeExcelImport } from '../src/utils/excelIO';
import { autoPlan, optionsForCard, validatePlan, baseDayCards, dayIndexOfDate, weekCycleOfDate, affectedCards } from '../src/utils/substitution';
import { buildStressSchool } from './stressSchool';

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
    // Ангиудад зөвхөн Даваагийн 1, 2-р цагийг үлдээж, багшийн хаалттай цаг аль ээлжид үйлчлэхийг шалгана
    const onlyMonday = (shift: number) => {
      const off: Record<string, any> = {};
      for (let d = 0; d < 5; d++) for (let p = 0; p < 6; p++) if (!(d === 0 && p <= 1)) off[`${shift}_${d}_${p}`] = 'forbidden';
      return off;
    };
    const X = { ...C('X', 1), timeOff: onlyMonday(1) };
    const Q = { ...C('Q', 2), timeOff: onlyMonday(2) };
    const r = await gen(
      [L('m1', { teacherId: 'A', classId: 'X' }), L('m2', { teacherId: 'A', classId: 'Q' }), L('x2', { teacherId: 'B', classId: 'X' })],
      [T('A', { '2_0_0': 'forbidden' }), T('B', { '1_0_0': 'forbidden' })],
      [X, Q]
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

  console.log('\nИ. "Зогсоох" дарвал одоог хүртэлх хамгийн сайн хуваарийг шууд буцаана');
  {
    const { lessons, teachers, classes, rooms } = buildSyntheticSchool();
    const t0 = Date.now();
    const r = await generateTimetable(subjects, teachers, classes, rooms, lessons, [], settings, [], undefined, {
      timeLimitMs: 60000,
      shouldStop: () => Date.now() - t0 > 1500,
    });
    const ms = Date.now() - t0;
    check('3 сек дотор буцсан', ms < 3000, `${ms} мс`);
    check('буцсан хуваарьт хатуу зөрчилгүй', Object.values(auditHardConstraints(r.scheduledCards, lessons, classes, teachers, rooms, settings)).every((v) => v === 0));
  }

  console.log('\nК. Гараар зөөх: зөв шалгалт, хос цаг, солих, түгжээ');
  {
    const card = (id: string, o: Partial<ScheduledCard>): ScheduledCard => ({
      id, contractId: id, subjectId: 'sub-1', teacherId: 'A', classId: 'X', shift: 1, dayIndex: 0, periodIndex: 0, weekCycle: 'all', ...o,
    });
    const cards: ScheduledCard[] = [
      card('x1', { teacherId: 'A', classId: 'X', periodIndex: 0 }),
      card('x2', { teacherId: 'B', classId: 'X', periodIndex: 1 }),
      card('d1', { teacherId: 'C', classId: 'X', periodIndex: 2, isDoublePart: 'first', linkedCardId: 'd2' }),
      card('d2', { teacherId: 'C', classId: 'X', periodIndex: 3, isDoublePart: 'second', linkedCardId: 'd1' }),
      card('y1', { teacherId: 'A', classId: 'Y', dayIndex: 1, periodIndex: 0 }),
      card('lk', { teacherId: 'D', classId: 'X', dayIndex: 2, periodIndex: 0, isLocked: true }),
    ];
    const ctx = { settings, subjects, teachers: ['A', 'B', 'C', 'D'].map((t) => T(t)), classes: [C('X'), C('Y')], classrooms: [], lessons: [] };
    check('багш завгүй цаг → боломжгүй', evaluateMove(ctx, cards, 'x1', 1, 0).status === 'bad');
    check('сул цаг → болно', evaluateMove(ctx, cards, 'x1', 3, 0).status === 'ok');
    const sw = evaluateMove(ctx, cards, 'x1', 0, 1);
    check('нэг ангийн эзэлсэн нүд → солих', sw.status === 'swap' && !!sw.swapWith?.includes('x2'));
    const after = applyMove(cards, 'x1', 0, 1, sw);
    check('солилт хийгдсэн', after.find((c) => c.id === 'x1')!.periodIndex === 1 && after.find((c) => c.id === 'x2')!.periodIndex === 0);
    const dv = evaluateMove(ctx, cards, 'd2', 4, 3);
    const moved = applyMove(cards, 'd2', 4, 3, dv);
    const md1 = moved.find((c) => c.id === 'd1')!;
    const md2 = moved.find((c) => c.id === 'd2')!;
    check('хос цагийн хоёр хагас хамт зөөгдсөн', dv.status === 'ok' && md1.dayIndex === 4 && md1.periodIndex === 2 && md2.periodIndex === 3);
    check('хос цаг ээлжийн төгсгөлд багтахгүй', evaluateMove(ctx, cards, 'd1', 4, 5).status === 'bad');
    check('түгжсэн карт зөөгдөхгүй', evaluateMove(ctx, cards, 'lk', 3, 3).status === 'bad');
    check('анги хэзээ ч солигдохгүй', applyMove(cards, 'x1', 3, 0, { status: 'ok' }).every((c, i) => c.classId === cards[i].classId));
  }

  console.log('\nЛ. Устгахад холбоотой өгөгдөл цэвэрлэгдэнэ');
  {
    const lessons = [L('l1', { teacherId: 'A', classId: 'X' }), L('l2', { teacherId: 'B', classId: 'X', coTeacherIds: ['A'] })];
    const cards: ScheduledCard[] = [
      { id: 'c1', contractId: 'l1', subjectId: 'sub-1', teacherId: 'A', classId: 'X', shift: 1, dayIndex: 0, periodIndex: 0, weekCycle: 'all' },
      { id: 'c2', contractId: 'l2', subjectId: 'sub-1', teacherId: 'B', classId: 'X', shift: 1, dayIndex: 0, periodIndex: 1, weekCycle: 'all' },
    ];
    const proj: any = { subjects, teachers: [T('B')], classes: [C('X')], classrooms: [], lessons, scheduledCards: cards, settings };
    const { project, report } = ensureIntegrity(proj);
    check('устгасан багшийн гэрээ, карт арилсан', report.removedLessons === 1 && report.removedCards === 1);
    check('хамтран заах багшийн холбоос цэвэрлэгдсэн', project.lessons[0].coTeacherIds!.length === 0);
  }

  console.log('\nМ. Excel импорт нэрээр нэгтгэнэ');
  {
    const current = {
      subjects: [{ id: 'sub-1', name: 'Математик', shortName: 'Мат', color: '#000', timeOff: {} }],
      teachers: [T('t1')].map((t) => ({ ...t, name: 'Б. Бат' })),
      classrooms: [],
      classes: [{ ...C('c1'), name: '10А' }],
      lessons: [L('old', { subjectId: 'sub-1', teacherId: 't1', classId: 'c1', totalPeriods: 3, singleLessons: 3 })],
      buildings: [{ id: 'bld-1', name: '1-р байр', shortName: '1-р байр' }],
    };
    const merged = mergeExcelImport(current as any, {
      sheets: ['x'],
      subjects: [{ name: 'математик', shortName: 'МАТ' }, { name: 'Физик' }],
      teachers: [{ name: 'Б. Бат' }],
      classrooms: [],
      classes: [{ name: '10А', shift: 1 }, { name: '10Б', shift: 1 }],
      lessons: [
        { row: 2, className: '10А', subjectName: 'Математик', teacherName: 'Б. Бат', total: 5, doubles: 1 },
        { row: 3, className: '10Б', subjectName: 'Физик', teacherName: 'Б. Бат', total: 2, doubles: 0 },
        { row: 4, className: '10В', subjectName: 'Физик', teacherName: 'Б. Бат', total: 2, doubles: 0 },
      ],
    });
    check('таарсан хичээл ID-гаа хадгалсан', merged.subjects.find((x) => x.id === 'sub-1')?.shortName === 'МАТ' && merged.subjects.length === 2);
    check('одоо байгаа гэрээ шинэчлэгдсэн (ID хэвээр)', merged.lessons.find((l) => l.id === 'old')?.totalPeriods === 5);
    check('шинэ гэрээ нэмэгдсэн', merged.lessons.length === 2);
    check('олдохгүй анги мэдэгдэгдсэн', merged.messages.some((m) => m.includes('10В')));
  }

  console.log('\nН. Орлон заалт');
  {
    const card = (id: string, o: Partial<ScheduledCard>): ScheduledCard => ({
      id, contractId: id, subjectId: 'sub-4', teacherId: 'A', classId: 'X', shift: 1, dayIndex: 0, periodIndex: 0, weekCycle: 'all', ...o,
    });
    const teachersN = ['A', 'B', 'C', 'D', 'E', 'F'].map((t) => T(t));
    const lessonsN = [
      L('eng', { subjectId: 'sub-4', teacherId: 'A', classId: 'X' }),
      L('eng2', { subjectId: 'sub-4', teacherId: 'E', classId: 'Y' }),
      L('math', { subjectId: 'sub-1', teacherId: 'C', classId: 'X' }),
      L('ph', { subjectId: 'sub-5', teacherId: 'D', classId: 'X' }),
      L('art', { subjectId: 'sub-12', teacherId: 'F', classId: 'Y' }),
    ];
    const mk = (cards: ScheduledCard[], absences: any[]) => {
      const ctxN = { settings, subjects, teachers: teachersN, classes: [C('X'), C('Y')], classrooms: [], lessons: lessonsN, cards };
      const day: any = { date: '2026-10-26', dayIndex: 0, absences, actions: [], updatedAt: '' };
      return { ctxN, day, dayCards: baseDayCards(ctxN, 0, undefined) };
    };

    // 1. Дэд бүлэг нийлүүлэх нь орлох багшаас түрүүлнэ
    {
      const cards = [
        card('g1', { teacherId: 'A', subgroupName: '1-р дэд бүлэг', periodIndex: 2 }),
        card('g2', { teacherId: 'B', subgroupName: '2-р дэд бүлэг', periodIndex: 2 }),
        card('m0', { subjectId: 'sub-1', teacherId: 'C', periodIndex: 0 }),
        card('p5', { subjectId: 'sub-5', teacherId: 'D', periodIndex: 5 }),
        card('y2', { subjectId: 'sub-12', teacherId: 'F', classId: 'Y', periodIndex: 0 }),
      ];
      const { ctxN, day, dayCards } = mk(cards, [{ id: 'a', teacherId: 'A', reason: 'sick', allDay: true }]);
      const opts = optionsForCard(ctxN, day, dayCards, [], 'g1');
      check('дэд бүлэг нийлүүлэх эхэнд', opts[0]?.kind === 'merge_subgroups' && opts[0].hostCardId === 'g2', opts[0]?.label);
      check('ижил хичээлийн сул багш (E) санал болгосон', opts.some((o) => o.kind === 'substitute' && o.teacherId === 'E'));
      const eIdx = opts.findIndex((o) => o.kind === 'substitute' && o.teacherId === 'E');
      const fIdx = opts.findIndex((o) => o.kind === 'substitute' && o.teacherId === 'F');
      check('ижил хичээлийн багш өөр хичээлийнхээс түрүүнд', eIdx >= 0 && (fIdx < 0 || eIdx < fIdx));
      day.actions = autoPlan(ctxN, day);
      const v = validatePlan(ctxN, day);
      check('нийлүүлсний дараа B бүх ангид, зөрчилгүй', v.issues.length === 0 && v.effective.some((c) => c.id === 'g2' && c.subgroupName?.includes('+')));
    }

    // 2. Хагас өдрийн чөлөө → ангийн өөр цагтай солих (багш өөрөө заана)
    {
      const cards = [
        card('e0', { teacherId: 'A', periodIndex: 0 }),
        card('m3', { subjectId: 'sub-1', teacherId: 'C', periodIndex: 3 }),
        card('p1', { subjectId: 'sub-5', teacherId: 'D', periodIndex: 1 }),
        card('p2', { subjectId: 'sub-5', teacherId: 'D', periodIndex: 2, classId: 'Y' }),
        card('e_busy', { teacherId: 'E', classId: 'Y', periodIndex: 0 }),
        card('f_busy', { subjectId: 'sub-12', teacherId: 'F', classId: 'Y', periodIndex: 3 }),
      ];
      // B бусад цагт завгүй байлгах
      const extra = [0, 1, 2, 3, 4, 5].map((p) => card(`b${p}`, { subjectId: 'sub-12', teacherId: 'B', classId: `Z${p}`, periodIndex: p }));
      const { ctxN, day, dayCards } = mk([...cards, ...extra], [{ id: 'a', teacherId: 'A', reason: 'leave', allDay: false, slots: ['1_0', '1_1'] }]);
      ctxN.classes.push(...[0, 1, 2, 3, 4, 5].map((p) => C(`Z${p}`)));
      const opts = optionsForCard(ctxN, day, baseDayCards(ctxN, 0, undefined), [], 'e0');
      check('хагас өдрийн чөлөөнд солих эхэнд', opts[0]?.kind === 'swap' && opts[0].toPeriod === 3, opts[0]?.label);
      day.actions = autoPlan(ctxN, day);
      const v = validatePlan(ctxN, day);
      check('солисны дараа зөрчилгүй', v.issues.length === 0, v.issues.map((i) => i.message).join(';'));
      void dayCards;
    }

    // 3. Захын хичээл → анги эрт тарна (сул багш байхгүй үед)
    {
      const cards = [
        card('m0', { subjectId: 'sub-1', teacherId: 'C', periodIndex: 0 }),
        card('p1', { subjectId: 'sub-5', teacherId: 'D', periodIndex: 1 }),
        card('e2', { teacherId: 'A', periodIndex: 2 }),
      ];
      const busy = ['B', 'E', 'F'].map((t, i) => card(`x${i}`, { subjectId: 'sub-12', teacherId: t, classId: `Z${i}`, periodIndex: 2 }));
      const { ctxN, day } = mk([...cards, ...busy], [{ id: 'a', teacherId: 'A', reason: 'sick', allDay: true }]);
      ctxN.classes.push(C('Z0'), C('Z1'), C('Z2'));
      day.actions = autoPlan(ctxN, day);
      check('сүүлийн цаг → анги эрт тарна', day.actions[0]?.kind === 'cancel', day.actions[0]?.kind);
    }

    // 4. Хамтран заах багш чөлөөтэй → үндсэн багш дангаараа
    {
      const cards = [card('co', { teacherId: 'A', coTeacherIds: ['B'], periodIndex: 1 })];
      const { ctxN, day, dayCards } = mk(cards, [{ id: 'b', teacherId: 'B', reason: 'training', allDay: true }]);
      const opts = optionsForCard(ctxN, day, dayCards, [], 'co');
      check('хамтран заагч байхгүй → дангаараа', opts[0]?.kind === 'drop_coteacher');
    }

    // 5. Огноо
    check('2026-10-26 = Даваа', dayIndexOfDate('2026-10-26', 5) === 0 && dayIndexOfDate('2026-10-31', 5) === null);
    const abS = { ...settings, enableWeekAB: true, weekAReferenceDate: '2026-09-07' };
    check('А/Б 7 хоног лавлах огноогоор', weekCycleOfDate('2026-09-09', abS) === 'week_a' && weekCycleOfDate('2026-09-16', abS) === 'week_b');

    // 6. Том сургууль: 8 багш өвчтэй, нэг нь хагас өдөр — бүгд шийдэгдэж, хатуу зөрчилгүй
    {
      const s = buildStressSchool();
      const solved = await generateTimetable(s.subjects, s.teachers, s.classes, s.rooms, s.lessons, s.relationships, s.settings, [], undefined, { timeLimitMs: 6000 });
      const ctxS = { settings: s.settings, subjects: s.subjects, teachers: s.teachers, classes: s.classes, classrooms: s.rooms, lessons: s.lessons, cards: solved.scheduledCards };
      const names = ['Мат-3', 'Анг-60', 'Анг-63', 'Физ-70', 'Мэд-110', 'БТ-120', 'МХ-30', 'Анги даасан 2Б'];
      const absences: any[] = names
        .map((n, i) => ({ id: `a${i}`, teacherId: s.teachers.find((t) => t.name === n)?.id, reason: 'sick', allDay: i !== 0 }))
        .filter((a) => a.teacherId);
      absences[0].slots = ['1_0', '1_1', '1_2', '2_0', '2_1', '2_2'];
      const date = '2026-10-28';
      const dayS: any = { date, dayIndex: dayIndexOfDate(date, 5), weekCycle: weekCycleOfDate(date, s.settings), absences, actions: [], updatedAt: '' };
      const t0 = Date.now();
      dayS.actions = autoPlan(ctxS, dayS);
      const ms = Date.now() - t0;
      const v = validatePlan(ctxS, dayS);
      const aff = affectedCards(baseDayCards(ctxS, dayS.dayIndex, dayS.weekCycle), absences);
      const kinds: Record<string, number> = {};
      for (const a of dayS.actions) kinds[a.kind] = (kinds[a.kind] || 0) + 1;
      console.log(`    ${aff.length} хичээл, ${ms} мс, ${JSON.stringify(kinds)}`);
      check('бүх хичээл шийдэгдсэн', v.unresolved.length === 0 && dayS.actions.length === aff.length);
      const audit = auditHardConstraints(v.effective, s.lessons, s.classes, s.teachers, s.rooms, s.settings);
      check('бие даасан аудитаар хатуу зөрчилгүй', v.issues.length === 0 && Object.values(audit).every((x) => x === 0), JSON.stringify(audit) + v.issues.slice(0, 2).map((i) => i.message).join(';'));
      check('3 секундээс хурдан', ms < 3000, `${ms}`);
    }
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
