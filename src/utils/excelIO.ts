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
    ['Ангийн нэр', 'Товч нэр', 'Хэддүгээр анги', 'Өдөрт орох дээд цаг'],
    ['10А', '10А', 10, 6],
    ['10Б', '10Б', 10, 6],
    ['11А', '11А', 11, 7],
  ];
  const wsClasses = XLSX.utils.aoa_to_sheet(classesData);
  wsClasses['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsClasses, 'Анги бүлэг');

  // 5. Lessons contract sheet
  const lessonsData = [
    ['Анги', 'Хичээл', 'Багш', '7 хоногийн нийт цаг', 'Хос цагийн тоо', 'Дан цагийн тоо', 'Танхим'],
    ['10А', 'Математик', 'Б. Бат-Эрдэнэ', 4, 1, 2, '101'],
    ['10А', 'Монгол хэл', 'Д. Цэцэгмаа', 3, 0, 3, ''],
    ['10А', 'Физик', 'Г. Мөнхбат', 3, 1, 1, '201'],
    ['10Б', 'Математик', 'Г. Мөнхбат', 4, 1, 2, '101'],
  ];
  const wsLessons = XLSX.utils.aoa_to_sheet(lessonsData);
  wsLessons['!cols'] = [{ wch: 10 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, wsLessons, 'Хичээлийн багц');

  XLSX.writeFile(wb, 'School_Timetable_Template_Mongolia.xlsx');
}

/**
 * Imports Excel file and parses entities
 */
export async function importExcelFile(file: File): Promise<{
  subjects?: Subject[];
  teachers?: Teacher[];
  classrooms?: Classroom[];
  classes?: ClassGroup[];
  lessons?: LessonContract[];
  messages: string[];
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const messages: string[] = [];

        let newSubjects: Subject[] | undefined;
        let newTeachers: Teacher[] | undefined;
        let newRooms: Classroom[] | undefined;
        let newClasses: ClassGroup[] | undefined;
        let newLessons: LessonContract[] | undefined;

        // Try to read 'Хичээл' or 'Subjects'
        const subSheetName = wb.SheetNames.find((s) => s.includes('Хичээл') || s.toLowerCase().includes('subject'));
        if (subSheetName) {
          const sheet = wb.Sheets[subSheetName];
          const rows: any[] = XLSX.utils.sheet_to_json(sheet);
          newSubjects = rows.map((r, i) => {
            const name = r['Хичээлийн нэр'] || r['Name'] || r['name'] || `Хичээл ${i + 1}`;
            const shortName = r['Товчлол'] || r['Short'] || r['short'] || name.substring(0, 3);
            const color = r['Өнгөний код'] || r['Color'] || '#3b82f6';
            return {
              id: `sub_imp_${i + 1}`,
              name,
              shortName,
              color,
              timeOff: {},
              distributionRule: 'ideal',
            };
          });
          messages.push(`Хичээлүүд: ${newSubjects.length} ширхэг импортлогдлоо.`);
        }

        // Teachers
        const teachSheetName = wb.SheetNames.find((s) => s.includes('Багш') || s.toLowerCase().includes('teacher'));
        if (teachSheetName) {
          const sheet = wb.Sheets[teachSheetName];
          const rows: any[] = XLSX.utils.sheet_to_json(sheet);
          newTeachers = rows.map((r, i) => {
            const name = r['Багшийн овог нэр'] || r['Name'] || r['name'] || `Багш ${i + 1}`;
            const shortName = r['Товч нэр'] || r['Short'] || r['short'] || name.split(' ').pop() || name;
            return {
              id: `t_imp_${i + 1}`,
              name,
              shortName,
              color: '#10b981',
              maxPeriodsPerDay: Number(r['Өдөрт орох дээд цаг']) || 5,
              maxGapsPerDay: Number(r['Цонх цагийн хязгаар']) || 1,
              timeOff: {},
            };
          });
          messages.push(`Багш нар: ${newTeachers.length} ширхэг импортлогдлоо.`);
        }

        // Rooms
        const roomSheetName = wb.SheetNames.find((s) => s.includes('танхим') || s.toLowerCase().includes('room'));
        if (roomSheetName) {
          const sheet = wb.Sheets[roomSheetName];
          const rows: any[] = XLSX.utils.sheet_to_json(sheet);
          newRooms = rows.map((r, i) => {
            const name = r['Танхимын нэр'] || r['Name'] || r['name'] || `Танхим ${i + 1}`;
            const shortName = r['Дугаар'] || r['Short'] || name;
            const sharedStr = String(r['Хуваалцах боломжтой (тийм/үгүй)'] || r['Shared'] || '').toLowerCase();
            return {
              id: `r_imp_${i + 1}`,
              name,
              shortName,
              buildingId: 'bld-1',
              capacity: Number(r['Суудлын тоо']) || 36,
              isShared: sharedStr.includes('тийм') || sharedStr.includes('true') || sharedStr.includes('yes'),
              color: '#60a5fa',
              timeOff: {},
            };
          });
          messages.push(`Танхимууд: ${newRooms.length} ширхэг импортлогдлоо.`);
        }

        // Classes
        const classSheetName = wb.SheetNames.find((s) => s.includes('бүлэг') || s.toLowerCase().includes('class'));
        if (classSheetName) {
          const sheet = wb.Sheets[classSheetName];
          const rows: any[] = XLSX.utils.sheet_to_json(sheet);
          newClasses = rows.map((r, i) => {
            const name = r['Ангийн нэр'] || r['Name'] || `Анги ${i + 1}`;
            const shortName = r['Товч нэр'] || name;
            const grade = Number(r['Хэддүгээр анги']) || parseInt(name) || 10;
            return {
              id: `c_imp_${i + 1}`,
              name,
              shortName,
              grade,
              shift: Number(r['Ээлж']) || (grade <= 6 ? 2 : 1),
              buildingId: 'bld-1',
              color: '#38bdf8',
              maxPeriodsPerDay: Number(r['Өдөрт орох дээд цаг']) || 6,
              timeOff: {},
            };
          });
          messages.push(`Ангиуд: ${newClasses.length} ширхэг импортлогдлоо.`);
        }

        resolve({
          subjects: newSubjects,
          teachers: newTeachers,
          classrooms: newRooms,
          classes: newClasses,
          messages,
        });
      } catch (err: any) {
        reject(new Error(`Excel файл уншихад алдаа гарлаа: ${err?.message || err}`));
      }
    };

    reader.onerror = () => reject(new Error('Файл уншихад алдаа гарлаа.'));
    reader.readAsArrayBuffer(file);
  });
}
