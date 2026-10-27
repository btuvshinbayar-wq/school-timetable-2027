import {
  Subject,
  Teacher,
  ClassGroup,
  Classroom,
  LessonContract,
  SchoolSettings,
  BellPeriod,
  Building,
  ShiftConfig,
  CardRelationship,
  SubgroupDefinition,
  ManagerProfile,
} from '../types/timetable';

export const DEFAULT_MANAGERS: ManagerProfile[] = [
  {
    id: 'mgr-1',
    name: 'Б. Энхмаа',
    title: '1-р менежер (Бага анги 1-5)',
    color: '#0284c7',
    assignedGrades: [1, 2, 3, 4, 5],
    assignedShift: 1,
    notes: '1-5-р ангийн багш нарын цаг хуваарилалт хариуцна',
  },
  {
    id: 'mgr-2',
    name: 'Д. Бат-Эрдэнэ',
    title: '2-р менежер (Дунд анги 6-9)',
    color: '#059669',
    assignedGrades: [6, 7, 8, 9],
    assignedShift: 2,
    notes: '6-9-р ангийн багш нарын цаг хуваарилалт хариуцна',
  },
  {
    id: 'mgr-3',
    name: 'С. Оюунбилэг',
    title: '3-р менежер (Ахлах анги & Нэгтгэл)',
    color: '#7c3aed',
    assignedGrades: [10, 11, 12],
    assignedShift: 1,
    notes: '10-12-р анги болон сургуулийн ерөнхий нэгтгэл хариуцна',
  },
];

export function calculateShiftBells(
  startTime: string,
  periodsCount: number,
  lessonDuration: number = 40,
  defaultBreak: number = 5,
  bigBreak: number = 10,
  bigBreakAfter: number = 3
): BellPeriod[] {
  const bells: BellPeriod[] = [];
  const [startH, startM] = startTime.split(':').map(Number);
  let currentMinutes = (startH || 8) * 60 + (startM || 0);

  for (let i = 1; i <= periodsCount; i++) {
    const periodStartH = Math.floor(currentMinutes / 60);
    const periodStartM = currentMinutes % 60;
    const startStr = `${String(periodStartH).padStart(2, '0')}:${String(periodStartM).padStart(2, '0')}`;

    currentMinutes += lessonDuration;
    const periodEndH = Math.floor(currentMinutes / 60);
    const periodEndM = currentMinutes % 60;
    const endStr = `${String(periodEndH).padStart(2, '0')}:${String(periodEndM).padStart(2, '0')}`;

    const isBig = i === bigBreakAfter;
    const breakTime = isBig ? bigBreak : defaultBreak;

    bells.push({
      periodIndex: i,
      name: `${i}-р цаг`,
      startTime: startStr,
      endTime: endStr,
      isBigBreakAfter: isBig,
      breakDurationMinutes: breakTime,
    });

    currentMinutes += breakTime;
  }

  return bells;
}

export const DEFAULT_BUILDINGS: Building[] = [
  { id: 'bld-1', name: '1-р байр (Төв хичээлийн байр)', shortName: '1-р байр', color: '#2563eb' },
  { id: 'bld-2', name: '2-р байр (Бага сургуулийн байр)', shortName: '2-р байр', color: '#16a34a' },
];

export function getDefaultShifts(): ShiftConfig[] {
  return [
    {
      shiftNumber: 1,
      name: '1-р ээлж (Өглөө)',
      startTime: '08:00',
      periodsCount: 6,
      lessonDurationMinutes: 40,
      defaultBreakMinutes: 5,
      bigBreakMinutes: 10,
      bigBreakAfterPeriod: 3,
      bells: calculateShiftBells('08:00', 6, 40, 5, 10, 3),
    },
    {
      shiftNumber: 2,
      name: '2-р ээлж (Өдөр)',
      startTime: '13:15',
      periodsCount: 6,
      lessonDurationMinutes: 40,
      defaultBreakMinutes: 5,
      bigBreakMinutes: 10,
      bigBreakAfterPeriod: 3,
      bells: calculateShiftBells('13:15', 6, 40, 5, 10, 3),
    },
    {
      shiftNumber: 3,
      name: '3-р ээлж (Орой)',
      startTime: '18:15',
      periodsCount: 4,
      lessonDurationMinutes: 40,
      defaultBreakMinutes: 5,
      bigBreakMinutes: 10,
      bigBreakAfterPeriod: 2,
      bells: calculateShiftBells('18:15', 4, 40, 5, 10, 2),
    },
  ];
}

export function getDefaultSchoolSettings(): SchoolSettings {
  const shifts = getDefaultShifts();
  return {
    schoolName: 'Ерөнхий Боловсролын Сургууль',
    academicYear: '2026-2027',
    daysPerWeek: 5,
    dayNames: ['Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан'],
    shiftsCount: 2, // 2 shifts standard in Mongolian schools
    shifts,
    buildings: DEFAULT_BUILDINGS,
    enableWeekAB: true,
    defaultBreakMinutes: 5,
    lunchBreakMinutes: 10,
    periodsPerDay: shifts[0]?.periodsCount || 6,
    bells: shifts[0]?.bells || [],
  };
}

export const DEFAULT_SUBJECTS: Subject[] = [
  { id: 'sub-1', name: 'Математик', shortName: 'Мат', color: '#2563eb', timeOff: {}, distributionRule: 'ideal' },
  { id: 'sub-2', name: 'Монгол хэл', shortName: 'МХ', color: '#dc2626', timeOff: {}, distributionRule: 'ideal' },
  { id: 'sub-3', name: 'Уран зохиол', shortName: 'УЗ', color: '#ea580c', timeOff: {}, distributionRule: 'ideal' },
  { id: 'sub-4', name: 'Англи хэл', shortName: 'Анг', color: '#7c3aed', timeOff: {}, distributionRule: 'ideal' },
  { id: 'sub-5', name: 'Физик', shortName: 'Физ', color: '#0284c7', timeOff: {}, distributionRule: 'ideal' },
  { id: 'sub-6', name: 'Хими', shortName: 'Хим', color: '#059669', timeOff: {}, distributionRule: 'ideal' },
  { id: 'sub-7', name: 'Биологи', shortName: 'Био', color: '#16a34a', timeOff: {}, distributionRule: 'ideal' },
  { id: 'sub-8', name: 'Түүх', shortName: 'Түүх', color: '#d97706', timeOff: {}, distributionRule: 'ideal' },
  { id: 'sub-9', name: 'Нийгэм судлал', shortName: 'Нийг', color: '#9333ea', timeOff: {}, distributionRule: 'ideal' },
  { id: 'sub-10', name: 'Мэдээлэл зүй', shortName: 'Мэд', color: '#0891b2', timeOff: {}, distributionRule: 'ideal' },
  { id: 'sub-11', name: 'Биеийн тамир', shortName: 'БТ', color: '#4f46e5', timeOff: {}, distributionRule: 'ideal' },
  { id: 'sub-12', name: 'Дүрслэх урлаг', shortName: 'ДУ', color: '#ca8a04', timeOff: {}, distributionRule: 'ideal' },
  { id: 'sub-13', name: 'Дизайн технологи', shortName: 'ДТ', color: '#db2777', timeOff: {}, distributionRule: 'ideal' },
];

export const DEFAULT_TEACHERS: Teacher[] = [
  { id: 't-1', name: 'Б. Бат-Эрдэнэ', shortName: 'Бат-Эрдэнэ', managerId: 'mgr-3', color: '#3b82f6', maxPeriodsPerDay: 5, maxGapsPerDay: 1, preferredShifts: [1, 2], primaryBuildingId: 'bld-1', timeOff: {} },
  { id: 't-2', name: 'Д. Цэцэгмаа', shortName: 'Цэцэгмаа', managerId: 'mgr-3', color: '#ec4899', maxPeriodsPerDay: 5, maxGapsPerDay: 1, preferredShifts: [1], primaryBuildingId: 'bld-1', timeOff: {} },
  { id: 't-3', name: 'Г. Мөнхбат', shortName: 'Мөнхбат', managerId: 'mgr-3', color: '#10b981', maxPeriodsPerDay: 5, maxGapsPerDay: 1, preferredShifts: [1, 2], primaryBuildingId: 'bld-1', timeOff: {} },
  { id: 't-4', name: 'О. Сарангэрэл', shortName: 'Сарангэрэл', managerId: 'mgr-1', color: '#8b5cf6', maxPeriodsPerDay: 5, maxGapsPerDay: 1, preferredShifts: [1, 2], primaryBuildingId: 'bld-2', timeOff: {} },
  { id: 't-5', name: 'Н. Төмөр', shortName: 'Төмөр', managerId: 'mgr-1', color: '#06b6d4', maxPeriodsPerDay: 5, maxGapsPerDay: 1, preferredShifts: [1, 2], primaryBuildingId: 'bld-1', timeOff: {} },
  { id: 't-6', name: 'Ч. Баярмаа', shortName: 'Баярмаа', managerId: 'mgr-2', color: '#f59e0b', maxPeriodsPerDay: 5, maxGapsPerDay: 1, preferredShifts: [2], primaryBuildingId: 'bld-2', timeOff: {} },
  { id: 't-7', name: 'С. Отгонбаяр', shortName: 'Отгонбаяр', managerId: 'mgr-2', color: '#ef4444', maxPeriodsPerDay: 5, maxGapsPerDay: 1, preferredShifts: [1], primaryBuildingId: 'bld-1', timeOff: {} },
  { id: 't-8', name: 'П. Энхжаргал', shortName: 'Энхжаргал', managerId: 'mgr-2', color: '#6366f1', maxPeriodsPerDay: 5, maxGapsPerDay: 1, preferredShifts: [2], primaryBuildingId: 'bld-2', timeOff: {} },
];

export const DEFAULT_CLASSROOMS: Classroom[] = [
  // 1-р байр
  { id: 'r-1', name: '101 Математик', shortName: '101', buildingId: 'bld-1', capacity: 36, isShared: false, maxConcurrentClasses: 1, color: '#93c5fd', timeOff: {} },
  { id: 'r-2', name: '102 Монгол хэл', shortName: '102', buildingId: 'bld-1', capacity: 36, isShared: false, maxConcurrentClasses: 1, color: '#fca5a5', timeOff: {} },
  { id: 'r-3', name: '201 Физик лаб', shortName: '201', buildingId: 'bld-1', capacity: 32, isShared: false, maxConcurrentClasses: 1, color: '#7dd3fc', timeOff: {} },
  { id: 'r-4', name: '202 Хими лаб', shortName: '202', buildingId: 'bld-1', capacity: 32, isShared: false, maxConcurrentClasses: 1, color: '#6ee7b7', timeOff: {} },
  { id: 'r-5', name: 'Спорт заал 1', shortName: 'Заал 1', buildingId: 'bld-1', capacity: 60, isShared: true, maxConcurrentClasses: 2, color: '#a5b4fc', timeOff: {} },
  { id: 'r-art', name: 'Урлагийн их танхим', shortName: 'Урлагийн заал', buildingId: 'bld-1', capacity: 120, isShared: true, maxConcurrentClasses: 4, color: '#ec4899', timeOff: {} },
  // 2-р байр
  { id: 'r-6', name: 'Бага 201', shortName: 'Б-201', buildingId: 'bld-2', capacity: 32, isShared: false, maxConcurrentClasses: 1, color: '#86efac', timeOff: {} },
  { id: 'r-7', name: 'Бага 202', shortName: 'Б-202', buildingId: 'bld-2', capacity: 32, isShared: false, maxConcurrentClasses: 1, color: '#c4b5fd', timeOff: {} },
  { id: 'r-8', name: 'Компьютерын лаб 2', shortName: 'Комп 2', buildingId: 'bld-2', capacity: 30, isShared: false, maxConcurrentClasses: 1, color: '#67e8f9', timeOff: {} },
];

export const DEFAULT_SUBGROUPS: SubgroupDefinition[] = [
  { id: 'sg-girls', name: 'Охид', category: 'gender' },
  { id: 'sg-boys', name: 'Хөвгүүд', category: 'gender' },
  { id: 'sg-1', name: '1-р дэд бүлэг', category: 'division' },
  { id: 'sg-2', name: '2-р дэд бүлэг', category: 'division' },
];

export const DEFAULT_CLASSES: ClassGroup[] = [
  // 1-р ээлж (Өглөөний ээлж - Ахлах ангиуд, 1-р байр)
  { id: 'c-1', name: '10А', shortName: '10А', grade: 10, shift: 1, buildingId: 'bld-1', classTeacherId: 't-1', homeClassroomId: 'r-1', color: '#38bdf8', maxPeriodsPerDay: 6, timeOff: {}, subgroups: [...DEFAULT_SUBGROUPS] },
  { id: 'c-2', name: '10Б', shortName: '10Б', grade: 10, shift: 1, buildingId: 'bld-1', classTeacherId: 't-3', homeClassroomId: 'r-2', color: '#4ade80', maxPeriodsPerDay: 6, timeOff: {}, subgroups: [...DEFAULT_SUBGROUPS] },
  { id: 'c-3', name: '11А', shortName: '11А', grade: 11, shift: 1, buildingId: 'bld-1', classTeacherId: 't-5', homeClassroomId: 'r-3', color: '#fb923c', maxPeriodsPerDay: 6, timeOff: {}, subgroups: [...DEFAULT_SUBGROUPS] },
  { id: 'c-4', name: '12А', shortName: '12А', grade: 12, shift: 1, buildingId: 'bld-1', classTeacherId: 't-7', homeClassroomId: 'r-4', color: '#f472b6', maxPeriodsPerDay: 6, timeOff: {}, subgroups: [...DEFAULT_SUBGROUPS] },

  // 2-р ээлж (Өдрийн ээлж - Дунд ангиуд, 2-р байр)
  { id: 'c-5', name: '8А', shortName: '8А', grade: 8, shift: 2, buildingId: 'bld-2', classTeacherId: 't-4', homeClassroomId: 'r-6', color: '#a78bfa', maxPeriodsPerDay: 6, timeOff: {}, subgroups: [...DEFAULT_SUBGROUPS] },
  { id: 'c-6', name: '9А', shortName: '9А', grade: 9, shift: 2, buildingId: 'bld-2', classTeacherId: 't-6', homeClassroomId: 'r-7', color: '#34d399', maxPeriodsPerDay: 6, timeOff: {}, subgroups: [...DEFAULT_SUBGROUPS] },
];

export const DEFAULT_LESSONS: LessonContract[] = [
  // 10А (1-р ээлж)
  { id: 'l-1', subjectId: 'sub-1', teacherId: 't-1', classId: 'c-1', totalPeriods: 4, singleLessons: 2, doubleLessons: 1, classroomId: 'r-1', weekCycle: 'all' },
  { id: 'l-2', subjectId: 'sub-2', teacherId: 't-2', classId: 'c-1', totalPeriods: 3, singleLessons: 3, doubleLessons: 0, classroomId: 'r-2', weekCycle: 'all' },
  { id: 'l-3', subjectId: 'sub-4', teacherId: 't-4', classId: 'c-1', totalPeriods: 3, singleLessons: 3, doubleLessons: 0, weekCycle: 'all' },
  { id: 'l-4', subjectId: 'sub-5', teacherId: 't-3', classId: 'c-1', totalPeriods: 2, singleLessons: 2, doubleLessons: 0, classroomId: 'r-3', weekCycle: 'all' },
  { id: 'l-5', subjectId: 'sub-6', teacherId: 't-5', classId: 'c-1', totalPeriods: 2, singleLessons: 2, doubleLessons: 0, classroomId: 'r-4', weekCycle: 'all' },
  { id: 'l-6', subjectId: 'sub-11', teacherId: 't-7', classId: 'c-1', totalPeriods: 2, singleLessons: 2, doubleLessons: 0, classroomId: 'r-5', weekCycle: 'all' },
  // 10А А/Б 7 хоногийн сэлгэх хичээл (Week A: Дүрслэх урлаг, Week B: Дизайн технологи)
  { id: 'l-7', subjectId: 'sub-12', teacherId: 't-8', classId: 'c-1', totalPeriods: 1, singleLessons: 1, doubleLessons: 0, weekCycle: 'week_a' },
  { id: 'l-8', subjectId: 'sub-13', teacherId: 't-8', classId: 'c-1', totalPeriods: 1, singleLessons: 1, doubleLessons: 0, weekCycle: 'week_b' },

  // 10Б (1-р ээлж)
  { id: 'l-9', subjectId: 'sub-1', teacherId: 't-3', classId: 'c-2', totalPeriods: 4, singleLessons: 2, doubleLessons: 1, classroomId: 'r-1', weekCycle: 'all' },
  { id: 'l-10', subjectId: 'sub-2', teacherId: 't-2', classId: 'c-2', totalPeriods: 3, singleLessons: 3, doubleLessons: 0, classroomId: 'r-2', weekCycle: 'all' },
  { id: 'l-11', subjectId: 'sub-4', teacherId: 't-4', classId: 'c-2', totalPeriods: 3, singleLessons: 3, doubleLessons: 0, weekCycle: 'all' },
  { id: 'l-12', subjectId: 'sub-5', teacherId: 't-1', classId: 'c-2', totalPeriods: 2, singleLessons: 2, doubleLessons: 0, classroomId: 'r-3', weekCycle: 'all' },
  { id: 'l-13', subjectId: 'sub-11', teacherId: 't-7', classId: 'c-2', totalPeriods: 2, singleLessons: 2, doubleLessons: 0, classroomId: 'r-5', weekCycle: 'all' },

  // 8А (2-р ээлж)
  { id: 'l-14', subjectId: 'sub-1', teacherId: 't-1', classId: 'c-5', totalPeriods: 4, singleLessons: 2, doubleLessons: 1, classroomId: 'r-6', weekCycle: 'all' },
  { id: 'l-15', subjectId: 'sub-2', teacherId: 't-6', classId: 'c-5', totalPeriods: 4, singleLessons: 2, doubleLessons: 1, classroomId: 'r-7', weekCycle: 'all' },
  { id: 'l-16', subjectId: 'sub-4', teacherId: 't-4', classId: 'c-5', totalPeriods: 3, singleLessons: 3, doubleLessons: 0, weekCycle: 'all' },
  { id: 'l-17', subjectId: 'sub-7', teacherId: 't-5', classId: 'c-5', totalPeriods: 2, singleLessons: 2, doubleLessons: 0, weekCycle: 'all' },

  // 9А (2-р ээлж)
  { id: 'l-18', subjectId: 'sub-1', teacherId: 't-3', classId: 'c-6', totalPeriods: 4, singleLessons: 2, doubleLessons: 1, classroomId: 'r-6', weekCycle: 'all' },
  { id: 'l-19', subjectId: 'sub-2', teacherId: 't-6', classId: 'c-6', totalPeriods: 3, singleLessons: 3, doubleLessons: 0, classroomId: 'r-7', weekCycle: 'all' },
  { id: 'l-20', subjectId: 'sub-5', teacherId: 't-1', classId: 'c-6', totalPeriods: 3, singleLessons: 1, doubleLessons: 1, weekCycle: 'all' },
  { id: 'l-21', subjectId: 'sub-8', teacherId: 't-7', classId: 'c-6', totalPeriods: 2, singleLessons: 2, doubleLessons: 0, weekCycle: 'all' },
];

export const DEFAULT_RELATIONSHIPS: CardRelationship[] = [
  {
    id: 'rel-cannot-same-day',
    name: '2 хичээл нэг өдөрт орохгүй',
    condition: 'cannot_same_day',
    subjectIds: ['sub-5', 'sub-6'], // Физик ба Хими
    classIds: [],
    importance: 'strict',
    isActive: true,
    note: 'Сонгосон 2 хичээл нэг ангид нэг өдөр хамт орж болохгүй',
  },
  {
    id: 'rel-cannot-consecutive',
    name: '2 хичээл дараалласан цагт орохгүй',
    condition: 'cannot_consecutive',
    subjectIds: ['sub-1', 'sub-5'], // Математик ба Физик
    classIds: [],
    importance: 'strict',
    isActive: true,
    note: 'Хүнд хичээлүүд нэг өдөр залгаа дараалж орохыг хориглоно',
  },
  {
    id: 'rel-first-or-last',
    name: 'Сонгосон хичээл эхний юм уу сүүлийн цагт орох',
    condition: 'first_or_last',
    firstOrLastMode: 'first_or_last',
    subjectIds: ['sub-11'], // Биеийн тамир
    classIds: [],
    importance: 'high',
    isActive: true,
    note: 'Биеийн тамир зэрэг хичээлүүд өдрийн 1-р цаг эсвэл сүүлчийн цагт хуваарилагдана',
  },
  {
    id: 'rel-allowed-periods',
    name: 'Сонгосон хичээл зөвхөн боломжтой цаг дээр хуваарьлах',
    condition: 'allowed_periods_only',
    subjectIds: ['sub-1'], // Математик
    allowedPeriods: [0, 1, 2], // 1, 2, 3-р цаг
    classIds: [],
    importance: 'high',
    isActive: true,
    note: 'Сонгосон хичээл зөвхөн өглөөний 1, 2, 3-р цагуудад тавигдана',
  },
  {
    id: 'rel-daily-hours',
    name: 'Өдөрт заах цагийн хамгийн их/ бага хязгаар',
    condition: 'daily_hours_limit',
    minPeriodsPerDay: 2,
    maxPeriodsPerDay: 5,
    targetEntity: 'teachers',
    subjectIds: [],
    classIds: [],
    teacherIds: [],
    importance: 'high',
    isActive: true,
    note: 'Багш өдөрт хамгийн багадаа 2 цаг, ихдээ 5 цаг хичээл заана',
  },
  {
    id: 'rel-max-consecutive',
    name: 'Дараалласан цагийн хамгийн их хязгаар',
    condition: 'max_consecutive_periods',
    maxConsecutive: 3,
    targetEntity: 'teachers',
    subjectIds: [],
    classIds: [],
    teacherIds: [],
    importance: 'high',
    isActive: true,
    note: 'Багш завсаргүй залгаа хамгийн ихдээ 3 цаг хичээл заана',
  },
  {
    id: 'rel-teacher-daily',
    name: '1 багш 1 анги бүлэгт өдөрт 1-с илүүгүй удаа орох',
    condition: 'teacher_max_once_per_day',
    subjectIds: [],
    classIds: [],
    teacherIds: [],
    allowDoubleConsecutive: true,
    importance: 'strict',
    isActive: true,
    note: 'Багш тухайн ангид өдөрт хамгийн ихдээ 1 удаа хичээл орно (Хос цаг залгаж орохыг зөвшөөрнө)',
  },
  {
    id: 'rel-same-subgroups',
    name: '1 ангийн 1 хичээлийн дэд бүлгүүд ижил цагт хичээллэх',
    condition: 'same_subject_subgroups_simultaneous',
    subjectIds: ['sub-4', 'sub-10'], // Англи хэл, Мэдээлэл зүй
    classIds: [],
    importance: 'strict',
    isActive: true,
    note: 'Нэг хичээлийн дэд бүлгүүд нэгэн зэрэг ижил өдөр, ижил цагт хичээллэх',
  },
  {
    id: 'rel-cross-subgroups',
    name: '2 өөр хичээлийн дэд бүлгүүд зэрэгцэн хичээл орох',
    condition: 'different_subjects_subgroups_simultaneous',
    subjectIds: ['sub-13', 'sub-10'],
    classIds: ['c-1'],
    parallelPairs: [
      { subjectId: 'sub-13', subgroupName: 'Хөвгүүд' },
      { subjectId: 'sub-10', subgroupName: 'Охид' },
    ],
    importance: 'strict',
    isActive: true,
    note: '10А ангийн Хөвгүүдийн Дизайн технологи ба Охидын Мэдээлэл зүй ижил цагт зэрэгцэн орно',
  },
  {
    id: 'rel-max-gaps',
    name: 'Өдрийн болон 7 хоногийн цонхтой цагийн дээд хязгаар',
    condition: 'max_gaps_daily_weekly',
    maxGapsPerDay: 1,
    maxGapsPerWeek: 3,
    targetEntity: 'teachers',
    subjectIds: [],
    classIds: [],
    teacherIds: [],
    importance: 'high',
    isActive: true,
    note: 'Багш нарын өдрийн цонх дээд тал нь 1 цаг, 7 хоногт нийт 3-аас хэтрэхгүй байна',
  },
  {
    id: 'rel-teaching-days',
    name: '7 хоногт хичээл заах өдрийн дээд / доод хязгаар',
    condition: 'teaching_days_limit',
    minDaysPerWeek: 3,
    maxDaysPerWeek: 5,
    targetEntity: 'teachers',
    subjectIds: [],
    classIds: [],
    teacherIds: [],
    importance: 'high',
    isActive: true,
    note: 'Багш 7 хоногт хамгийн багадаа 3 өдөр, ихдээ 5 өдөр хичээл заана',
  },
  {
    id: 'rel-shift-crossing',
    name: '2 буюу 3 ээлж дамжих цонхыг бага байлгах',
    condition: 'minimize_shift_crossing_gap',
    maxCrossShiftGap: 1,
    targetEntity: 'teachers',
    subjectIds: [],
    classIds: [],
    teacherIds: [],
    importance: 'high',
    isActive: true,
    note: '2 буюу 3 ээлжинд хичээл заадаг багш нарын ээлж хоорондын шилжих цонхыг бага байлгах (дээд тал нь 1 цаг)',
  },
];
