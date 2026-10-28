import * as XLSX from 'xlsx';
import {
  Subject,
  Teacher,
  ClassGroup,
  Classroom,
  LessonContract,
  ScheduledCard,
  SchoolSettings,
} from '../types/timetable';

/**
 * Exports generated Timetable to a formatted Excel file
 */
export function exportTimetableToExcel(
  scheduledCards: ScheduledCard[],
  subjects: Subject[],
  teachers: Teacher[],
  classes: ClassGroup[],
  classrooms: Classroom[],
  settings: SchoolSettings
) {
  const wb = XLSX.utils.book_new();

  // Helper maps
  const subMap = new Map(subjects.map((s) => [s.id, s.name]));
  const teachMap = new Map(teachers.map((t) => [t.id, t.name]));
  const roomMap = new Map(classrooms.map((r) => [r.id, r.name]));

  // Sheet 1: Анги бүрээр (Per Class Schedules)
  for (const cls of classes) {
    const sheetData: (string | number)[][] = [];

    // Header title
    sheetData.push([`${settings.schoolName} - ${settings.academicYear}`]);
    sheetData.push([`Анги: ${cls.name} (${cls.grade}-р анги)`]);
    sheetData.push([]);

    // Table header row: Цаг | Эхлэх - Дуусах | Даваа | Мягмар | ...
    const headerRow = ['Цаг', 'Хугацаа', ...settings.dayNames];
    sheetData.push(headerRow);

    // Period rows
    for (let p = 0; p < settings.periodsPerDay; p++) {
      const bell = settings.bells[p] || {
        startTime: `0${8 + p}:00`,
        endTime: `0${8 + p}:40`,
      };
      const row: (string | number)[] = [
        `${p + 1}-р цаг`,
        `${bell.startTime} - ${bell.endTime}`,
      ];

      for (let d = 0; d < settings.daysPerWeek; d++) {
        const card = scheduledCards.find(
          (c) => c.classId === cls.id && c.dayIndex === d && c.periodIndex === p
        );

        if (card) {
          const sName = subMap.get(card.subjectId) || 'Хичээл';
          const tName = teachMap.get(card.teacherId) || 'Багш';
          const rName = card.classroomId ? ` (${roomMap.get(card.classroomId) || ''})` : '';
          row.push(`${sName}\n[${tName}]${rName}`);
        } else {
          row.push('');
        }
      }
      sheetData.push(row);

      // Insert lunch break notice if applicable
      if (bell.isLunchBreakAfter) {
        sheetData.push(['---', 'ИХ ЗАВСАРЛАГА / ХООЛ', ...settings.dayNames.map(() => '----------------')]);
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Set column widths
    ws['!cols'] = [
      { wch: 10 },
      { wch: 15 },
      ...settings.dayNames.map(() => ({ wch: 25 })),
    ];

    const safeSheetName = cls.name.replace(/[:\\/?*[\]]/g, '_').substring(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
  }

  // Sheet 2: Багш нарын нэгдсэн хуваарь (Teacher Master Grid)
  const teacherMasterData: (string | number)[][] = [];
  teacherMasterData.push([`${settings.schoolName} - Багш нарын хичээлийн хуваарь`]);
  teacherMasterData.push([]);

  const tHeader = [
    'Багшийн нэр',
    'Гараг',
    ...(settings.bells || []).map((b) => `${b.periodIndex}-р цаг (${b.startTime})`),
  ];
  teacherMasterData.push(tHeader);

  for (const t of teachers) {
    for (let d = 0; d < settings.daysPerWeek; d++) {
      const row: (string | number)[] = [d === 0 ? t.name : '', settings.dayNames[d]];

      for (let p = 0; p < (settings.periodsPerDay || 6); p++) {
        const card = scheduledCards.find(
          (c) => c.teacherId === t.id && c.dayIndex === d && c.periodIndex === p
        );
        if (card) {
          const cls = classes.find((c) => c.id === card.classId)?.name || '';
          const sub = subMap.get(card.subjectId) || '';
          row.push(`${cls} (${sub})`);
        } else {
          row.push('');
        }
      }
      teacherMasterData.push(row);
    }
  }

  const wsTeachers = XLSX.utils.aoa_to_sheet(teacherMasterData);
  wsTeachers['!cols'] = [{ wch: 20 }, { wch: 10 }, ...(settings.bells || []).map(() => ({ wch: 18 }))];
  XLSX.utils.book_append_sheet(wb, wsTeachers, 'Багш нар');

  // Trigger download
  const filename = `Hicheeliin_Huvaar_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * Downloads a pre-structured blank template for school data entry
 */
export function downloadExcelTemplate() {
  const wb = XLSX.utils.book_new();

  // 1. Subjects sheet
  const subjectsData = [
    ['Хичээлийн нэр', 'Товчлол', 'Өнгөний код', 'Тархалтын дүрэм'],
    ['Математик', 'Мат', '#2563eb', 'ideal'],
    ['Монгол хэл', 'МХ', '#dc2626', 'ideal'],
    ['Англи хэл', 'Анг', '#7c3aed', 'ideal'],
    ['Физик', 'Физ', '#0284c7', 'ideal'],
    ['Хими', 'Хим', '#059669', 'ideal'],
    ['Биологи', 'Био', '#16a34a', 'ideal'],
    ['Биеийн тамир', 'БТ', '#4f46e5', 'ideal'],
  ];
  const wsSub = XLSX.utils.aoa_to_sheet(subjectsData);
  wsSub['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, wsSub, 'Хичээл');

  // 2. Teachers sheet
  const teachersData = [
    ['Багшийн овог нэр', 'Товч нэр', 'Өдөрт орох дээд цаг', 'Цонх цагийн хязгаар'],
    ['Б. Бат-Эрдэнэ', 'Бат-Эрдэнэ', 5, 1],
    ['Д. Цэцэгмаа', 'Цэцэгмаа', 5, 1],
    ['Г. Мөнхбат', 'Мөнхбат', 5, 1],
    ['О. Сарангэрэл', 'Сарангэрэл', 5, 1],
  ];
  const wsTeach = XLSX.utils.aoa_to_sheet(teachersData);
  wsTeach['!cols'] = [{ wch: 22 }, { wch: 15 }, { wch: 20 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsTeach, 'Багш нар');

  // 3. Classrooms sheet
  const roomsData = [
    ['Танхимын нэр', 'Дугаар', 'Суудлын тоо', 'Хуваалцах боломжтой (тийм/үгүй)'],
    ['101 Математик', '101', 36, 'үгүй'],
    ['201 Физикийн лаборатори', '201', 32, 'үгүй'],
    ['Спорт заал', 'Заал', 60, 'тийм'],
  ];
  const wsRooms = XLSX.utils.aoa_to_sheet(roomsData);
  wsRooms['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 15 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsRooms, 'Анги танхим');

  // 4. Classes sheet
  const classesData = [
    ['Ангийн нэр', 'Товч нэр', 'Хэддүгээр анги', 'Ээлж', 'Байр', 'Өдөрт орох дээд цаг'],
    ['10А', '10А', 10, 1, '1-р байр', 6],
    ['10Б', '10Б', 10, 1, '1-р байр', 6],
    ['6А', '6А', 6, 2, '2-р байр', 6],
  ];
  const wsClasses = XLSX.utils.aoa_to_sheet(classesData);
  wsClasses['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 8 }, { wch: 14 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsClasses, 'Анги бүлэг');

  // 5. Lessons contract sheet
  const lessonsData = [
    ['Анги', 'Хичээл', 'Багш', '7 хоногийн нийт цаг', 'Хос цагийн тоо', 'Дан цагийн тоо', 'Танхим', 'Дэд бүлэг', '7 хоног (бүх/А/Б)'],
    ['10А', 'Математик', 'Б. Бат-Эрдэнэ', 4, 1, 2, '101', '', 'бүх'],
    ['10А', 'Монгол хэл', 'Д. Цэцэгмаа', 3, 0, 3, '', '', 'бүх'],
    ['10А', 'Англи хэл', 'О. Сарангэрэл', 3, 0, 3, '', '1-р дэд бүлэг', 'бүх'],
    ['10Б', 'Математик', 'Г. Мөнхбат', 4, 1, 2, '101', '', 'бүх'],
  ];
  const wsLessons = XLSX.utils.aoa_to_sheet(lessonsData);
  wsLessons['!cols'] = [{ wch: 10 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsLessons, 'Хичээлийн багц');

  XLSX.writeFile(wb, 'School_Timetable_Template_Mongolia.xlsx');
}

/** Excel-ээс уншсан түүхий мөрүүд (нэрээр холбогдоно) */
export interface ExcelImportRaw {
  subjects: { name: string; shortName?: string; color?: string }[];
  teachers: { name: string; shortName?: string; maxPeriodsPerDay?: number; maxGapsPerDay?: number }[];
  classrooms: { name: string; shortName?: string; capacity?: number; isShared?: boolean; building?: string }[];
  classes: { name: string; shortName?: string; grade?: number; shift?: number; maxPeriodsPerDay?: number; building?: string }[];
  lessons: {
    row: number;
    className: string;
    subjectName: string;
    teacherName: string;
    total: number;
    doubles: number;
    singles?: number;
    room?: string;
    subgroup?: string;
    week?: string;
  }[];
  sheets: string[];
}

const str = (v: any) => (v === undefined || v === null ? '' : String(v).trim());
const num = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const pick = (r: any, keys: string[]) => {
  for (const k of keys) if (r[k] !== undefined && str(r[k]) !== '') return r[k];
  return undefined;
};

/**
 * Excel файлыг уншина. Хуудсыг нэрээр нь (яг таарсныг эхэлж) олно.
 */
export async function importExcelFile(file: File): Promise<ExcelImportRaw> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
  const find = (exact: string[], contains: string[]) =>
    wb.SheetNames.find((n) => exact.includes(n.trim())) ||
    wb.SheetNames.find((n) => contains.some((c) => n.toLowerCase().includes(c.toLowerCase())));
  const rows = (name?: string): any[] => (name ? XLSX.utils.sheet_to_json(wb.Sheets[name]) : []);

  const lessonSheet = find(['Хичээлийн багц', 'Хичээлийн төлөвлөгөө', 'Lessons'], ['багц', 'төлөвлөгөө', 'lesson']);
  const subjectSheet = find(['Хичээл', 'Subjects'], ['subject']) || wb.SheetNames.find((n) => n.includes('Хичээл') && n !== lessonSheet);
  const teacherSheet = find(['Багш нар', 'Багш', 'Teachers'], ['багш', 'teacher']);
  const roomSheet = find(['Анги танхим', 'Танхим', 'Classrooms', 'Rooms'], ['танхим', 'room']);
  const classSheet = find(['Анги бүлэг', 'Ангиуд', 'Classes'], ['бүлэг', 'class']);

  return {
    sheets: [subjectSheet, teacherSheet, roomSheet, classSheet, lessonSheet].filter(Boolean) as string[],
    subjects: rows(subjectSheet)
      .map((r) => ({
        name: str(pick(r, ['Хичээлийн нэр', 'Name', 'name'])),
        shortName: str(pick(r, ['Товчлол', 'Short', 'short'])) || undefined,
        color: str(pick(r, ['Өнгөний код', 'Color'])) || undefined,
      }))
      .filter((x) => x.name),
    teachers: rows(teacherSheet)
      .map((r) => ({
        name: str(pick(r, ['Багшийн овог нэр', 'Name', 'name'])),
        shortName: str(pick(r, ['Товч нэр', 'Short', 'short'])) || undefined,
        maxPeriodsPerDay: num(pick(r, ['Өдөрт орох дээд цаг'])),
        maxGapsPerDay: num(pick(r, ['Цонх цагийн хязгаар'])),
      }))
      .filter((x) => x.name),
    classrooms: rows(roomSheet)
      .map((r) => {
        const shared = str(pick(r, ['Хуваалцах боломжтой (тийм/үгүй)', 'Shared'])).toLowerCase();
        return {
          name: str(pick(r, ['Танхимын нэр', 'Name', 'name'])),
          shortName: str(pick(r, ['Дугаар', 'Short'])) || undefined,
          capacity: num(pick(r, ['Суудлын тоо', 'Capacity'])),
          isShared: shared ? /тийм|true|yes/.test(shared) : undefined,
          building: str(pick(r, ['Байр', 'Building'])) || undefined,
        };
      })
      .filter((x) => x.name),
    classes: rows(classSheet)
      .map((r) => ({
        name: str(pick(r, ['Ангийн нэр', 'Name', 'name'])),
        shortName: str(pick(r, ['Товч нэр', 'Short'])) || undefined,
        grade: num(pick(r, ['Хэддүгээр анги', 'Grade'])),
        shift: num(pick(r, ['Ээлж', 'Shift'])),
        maxPeriodsPerDay: num(pick(r, ['Өдөрт орох дээд цаг'])),
        building: str(pick(r, ['Байр', 'Building'])) || undefined,
      }))
      .filter((x) => x.name),
    lessons: rows(lessonSheet)
      .map((r, i) => ({
        row: i + 2,
        className: str(pick(r, ['Анги', 'Class'])),
        subjectName: str(pick(r, ['Хичээл', 'Subject'])),
        teacherName: str(pick(r, ['Багш', 'Teacher'])),
        total: num(pick(r, ['7 хоногийн нийт цаг', 'Нийт цаг', 'Total'])) || 0,
        doubles: num(pick(r, ['Хос цагийн тоо', 'Doubles'])) || 0,
        singles: num(pick(r, ['Дан цагийн тоо', 'Singles'])),
        room: str(pick(r, ['Танхим', 'Room'])) || undefined,
        subgroup: str(pick(r, ['Дэд бүлэг', 'Subgroup'])) || undefined,
        week: str(pick(r, ['7 хоног (бүх/А/Б)', '7 хоног', 'Week'])) || undefined,
      }))
      .filter((x) => x.className || x.subjectName || x.teacherName),
  };
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

/**
 * Импортолсон мөрүүдийг одоогийн өгөгдөлтэй НЭРЭЭР нэгтгэнэ (upsert):
 * таарсан нь ID-гаа хадгалж шинэчлэгдэнэ, шинэ нь нэмэгдэнэ — өмнөх хичээлийн гэрээ, хуваарь эвдрэхгүй.
 */
export function mergeExcelImport(
  current: {
    subjects: Subject[];
    teachers: Teacher[];
    classrooms: Classroom[];
    classes: ClassGroup[];
    lessons: LessonContract[];
    buildings: { id: string; name: string; shortName: string }[];
  },
  raw: ExcelImportRaw
): {
  subjects: Subject[];
  teachers: Teacher[];
  classrooms: Classroom[];
  classes: ClassGroup[];
  lessons: LessonContract[];
  messages: string[];
} {
  const messages: string[] = [];
  const findBuilding = (name?: string) => {
    if (!name) return undefined;
    return current.buildings.find((b) => norm(b.name) === norm(name) || norm(b.shortName) === norm(name))?.id;
  };

  const upsert = <T extends { id: string; name: string }>(
    list: T[],
    incoming: any[],
    label: string,
    make: (x: any) => T,
    update: (old: T, x: any) => T
  ): T[] => {
    const out = [...list];
    let added = 0;
    let updated = 0;
    for (const x of incoming) {
      const idx = out.findIndex((o) => norm(o.name) === norm(x.name));
      if (idx >= 0) {
        out[idx] = update(out[idx], x);
        updated++;
      } else {
        out.push(make(x));
        added++;
      }
    }
    if (incoming.length > 0) messages.push(`✅ ${label}: ${added} шинэ, ${updated} шинэчлэгдсэн.`);
    return out;
  };

  const subjects = upsert(
    current.subjects,
    raw.subjects,
    'Хичээл',
    (x) => ({ id: newId('sub'), name: x.name, shortName: x.shortName || x.name.slice(0, 4), color: x.color || '#857d70', timeOff: {}, distributionRule: 'ideal' as const }),
    (o, x) => ({ ...o, shortName: x.shortName || o.shortName, color: x.color || o.color })
  );
  const teachers = upsert(
    current.teachers,
    raw.teachers,
    'Багш',
    (x) => ({ id: newId('t'), name: x.name, shortName: x.shortName || x.name.split(' ').pop() || x.name, color: '#6b8c5a', timeOff: {}, maxPeriodsPerDay: x.maxPeriodsPerDay || 5, maxGapsPerDay: x.maxGapsPerDay ?? 1 }),
    (o, x) => ({ ...o, shortName: x.shortName || o.shortName, maxPeriodsPerDay: x.maxPeriodsPerDay ?? o.maxPeriodsPerDay, maxGapsPerDay: x.maxGapsPerDay ?? o.maxGapsPerDay })
  );
  const classrooms = upsert(
    current.classrooms,
    raw.classrooms,
    'Танхим',
    (x) => ({ id: newId('r'), name: x.name, shortName: x.shortName || x.name, buildingId: findBuilding(x.building) || current.buildings[0]?.id || 'bld-1', capacity: x.capacity || 36, isShared: !!x.isShared, maxConcurrentClasses: x.isShared ? 2 : 1, color: '#93b8a8', timeOff: {} }),
    (o, x) => ({ ...o, shortName: x.shortName || o.shortName, capacity: x.capacity ?? o.capacity, isShared: x.isShared ?? o.isShared, buildingId: findBuilding(x.building) || o.buildingId })
  );
  const classes = upsert(
    current.classes,
    raw.classes,
    'Анги',
    (x) => {
      const grade = x.grade || parseInt(x.name) || 10;
      return { id: newId('c'), name: x.name, shortName: x.shortName || x.name, grade, shift: x.shift || 1, buildingId: findBuilding(x.building) || current.buildings[0]?.id, color: '#c4a2be', timeOff: {}, maxPeriodsPerDay: x.maxPeriodsPerDay || 6, subgroups: [] };
    },
    (o, x) => ({ ...o, shortName: x.shortName || o.shortName, grade: x.grade ?? o.grade, shift: x.shift ?? o.shift, maxPeriodsPerDay: x.maxPeriodsPerDay ?? o.maxPeriodsPerDay, buildingId: findBuilding(x.building) || o.buildingId })
  );

  // Хичээлийн гэрээ: анги + хичээл + багш (+ дэд бүлэг)-ээр нэгтгэнэ
  const lessons = [...current.lessons];
  let lAdded = 0;
  let lUpdated = 0;
  const problems: string[] = [];
  const byName = <T extends { name: string; shortName?: string }>(list: T[], name: string) =>
    list.find((x) => norm(x.name) === norm(name)) || list.find((x) => x.shortName && norm(x.shortName) === norm(name));
  for (const r of raw.lessons) {
    const cls = byName(classes, r.className);
    const sub = byName(subjects, r.subjectName);
    const t = byName(teachers, r.teacherName);
    if (!cls || !sub || !t) {
      const miss = [!cls && `анги "${r.className}"`, !sub && `хичээл "${r.subjectName}"`, !t && `багш "${r.teacherName}"`].filter(Boolean).join(', ');
      problems.push(`${r.row}-р мөр: ${miss} олдсонгүй`);
      continue;
    }
    const doubles = Math.max(0, Math.floor(r.doubles));
    const total = r.total > 0 ? r.total : (r.singles || 0) + doubles * 2;
    if (total <= 0 || doubles * 2 > total) {
      problems.push(`${r.row}-р мөр: цагийн тоо буруу (нийт ${total}, хос ${doubles})`);
      continue;
    }
    const room = r.room ? classrooms.find((x) => norm(x.name) === norm(r.room!) || norm(x.shortName) === norm(r.room!)) : undefined;
    const w = (r.week || '').toLowerCase();
    const weekCycle = w.startsWith('а') || w === 'a' ? 'week_a' : w.startsWith('б') || w === 'b' ? 'week_b' : 'all';
    const subgroupName = r.subgroup || undefined;
    const idx = lessons.findIndex(
      (l) => l.classId === cls.id && l.subjectId === sub.id && l.teacherId === t.id && (l.subgroupName || '') === (subgroupName || '') && (l.weekCycle || 'all') === weekCycle
    );
    const data = {
      subjectId: sub.id,
      teacherId: t.id,
      classId: cls.id,
      subgroupName,
      totalPeriods: total,
      doubleLessons: doubles,
      singleLessons: total - doubles * 2,
      classroomId: room?.id,
      weekCycle: weekCycle as LessonContract['weekCycle'],
    };
    if (idx >= 0) {
      lessons[idx] = { ...lessons[idx], ...data, classroomId: data.classroomId ?? lessons[idx].classroomId };
      lUpdated++;
    } else {
      lessons.push({ id: newId('l'), ...data });
      lAdded++;
    }
  }
  if (raw.lessons.length > 0) messages.push(`✅ Хичээлийн төлөвлөгөө: ${lAdded} шинэ, ${lUpdated} шинэчлэгдсэн.`);
  if (problems.length > 0) {
    messages.push(`⚠️ ${problems.length} мөрийг алгаслаа:`);
    messages.push(...problems.slice(0, 20).map((p) => `   ${p}`));
    if (problems.length > 20) messages.push(`   … бас ${problems.length - 20} мөр`);
  }
  if (raw.sheets.length === 0) messages.push('❌ Танигдах хуудас олдсонгүй. Загвар файлыг татаж ашиглана уу.');
  return { subjects, teachers, classrooms, classes, lessons, messages };
}

/** Орлон заалтын тайлан: товч (багшаар) ба дэлгэрэнгүй (зохицуулалт бүр) */
export function exportSubstitutionReport(
  summary: { name: string; absentPeriods: number; absentDays: number; substitutedPeriods: number; mergedHosted: number; ownMoved: number }[],
  detail: { date: string; time: string; className: string; subject: string; absentTeacher: string; action: string; byTeacher: string }[],
  from: string,
  to: string,
  schoolName: string
) {
  const wb = XLSX.utils.book_new();
  const head = [[`${schoolName} — орлон заалтын тайлан`], [`${from} – ${to}`], []];
  const sum = XLSX.utils.aoa_to_sheet([
    ...head,
    ['Багш', 'Чөлөөтэй цаг', 'Чөлөөтэй өдөр', 'Орлон заасан цаг', 'Нийлүүлж заасан цаг', 'Өөрөө нөхсөн цаг'],
    ...summary.map((r) => [r.name, r.absentPeriods, r.absentDays, r.substitutedPeriods, r.mergedHosted, r.ownMoved]),
  ]);
  sum['!cols'] = [{ wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, sum, 'Багшаар');
  const det = XLSX.utils.aoa_to_sheet([
    ...head,
    ['Огноо', 'Цаг', 'Анги', 'Хичээл', 'Чөлөөтэй багш', 'Шийдэл', 'Заасан багш'],
    ...detail.map((r) => [r.date, r.time, r.className, r.subject, r.absentTeacher, r.action, r.byTeacher]),
  ]);
  det['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 10 }, { wch: 18 }, { wch: 22 }, { wch: 46 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, det, 'Дэлгэрэнгүй');
  XLSX.writeFile(wb, `Orlon_zaalt_${from}_${to}.xlsx`);
}
