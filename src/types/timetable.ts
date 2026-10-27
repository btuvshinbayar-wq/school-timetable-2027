/**
 * Core type definitions for School Timetable 2027
 * Supporting 2-3 shifts (Ээлжүүд), Multi-Building (Хичээлийн байрууд), and Week A/B (А/Б 7 хоног)
 */

export interface Building {
  id: string;
  name: string; // e.g. "1-р байр (Үндсэн байр)"
  shortName: string; // e.g. "Байр 1"
  address?: string;
  color: string;
}

export interface ShiftConfig {
  shiftNumber: number; // 1 = 1-р ээлж (Өглөө), 2 = 2-р ээлж (Өдөр), 3 = 3-р ээлж (Орой)
  name: string; // "1-р ээлж (Өглөө)"
  startTime: string; // "08:00" or "13:15"
  periodsCount: number; // 6 or 7
  lessonDurationMinutes: number; // 40 min
  defaultBreakMinutes: number; // 5 min standard break in Mongolia
  bigBreakMinutes: number; // 10 min big break
  bigBreakAfterPeriod: number; // after 2nd or 3rd period
  bells: BellPeriod[];
}

export interface BellPeriod {
  periodIndex: number; // 1, 2, 3...
  name: string; // "1-р цаг"
  startTime: string; // "08:00"
  endTime: string; // "08:40"
  isBigBreakAfter?: boolean; // 10 min big break
  isLunchBreakAfter?: boolean; // legacy alias for big break
  breakDurationMinutes: number; // 5 min or 10 min
}

export interface Subject {
  id: string;
  name: string; // e.g. "Математик"
  shortName: string; // e.g. "Мат"
  color: string; // Hex color
  timeOff: Record<string, 'allowed' | 'forbidden' | 'discouraged'>;
  distributionRule?: 'ideal' | 'any' | 'consecutive_allowed';
  homework?: boolean;
}

export interface Teacher {
  id: string;
  name: string; // e.g. "Б. Болд"
  shortName: string; // e.g. "Болд"
  color: string;
  email?: string;
  managerId?: string; // Хариуцсан сургалтын менежерийн ID
  preferredShifts?: number[]; // [1, 2]
  primaryBuildingId?: string;
  timeOff: Record<string, 'allowed' | 'forbidden' | 'discouraged'>;
  maxPeriodsPerDay: number;
  maxGapsPerDay: number;
}

export interface SubgroupDefinition {
  id: string;
  name: string; // "Охид", "Хөвгүүд", "1-р бүлэг", "2-р бүлэг", etc.
  category?: 'gender' | 'division' | 'custom';
}

export interface ClassGroup {
  id: string;
  name: string; // e.g. "10А"
  shortName: string; // e.g. "10А"
  grade: number; // 10
  shift: number; // 1 = 1-р ээлж, 2 = 2-р ээлж, 3 = 3-р ээлж
  managerId?: string; // Хариуцсан сургалтын менежерийн ID
  buildingId?: string; // Which school building
  classTeacherId?: string;
  homeClassroomId?: string;
  color: string;
  subgroups?: SubgroupDefinition[]; // Дэд бүлгүүд: охид, хөвгүүд, 1,2 г.м
  timeOff: Record<string, 'allowed' | 'forbidden' | 'discouraged'>;
  maxPeriodsPerDay: number;
}

export interface Classroom {
  id: string;
  name: string; // e.g. "101 Математикийн танхим"
  shortName: string; // e.g. "101"
  buildingId: string; // Belongs to building
  capacity: number;
  isShared: boolean; // Хуваалцах танхим (үндсэн анги нь эзгүй үед өөр дэд бүлэг орж болно)
  maxConcurrentClasses?: number; // Зэрэгцэн орох ангийн тоо (урлагийн заал 4, спорт заал 2 г.м)
  sharedDescription?: string;
  color: string;
  timeOff: Record<string, 'allowed' | 'forbidden' | 'discouraged'>;
}

export type WeekCycle = 'all' | 'week_a' | 'week_b'; // Бүх 7 хоног, А 7 хоног, Б 7 хоног

export interface LessonContract {
  id: string;
  subjectId: string;
  teacherId: string;
  coTeacherIds?: string[]; // Хамтран заах багш
  classId: string;
  subgroupId?: string; // Дэд бүлэг
  subgroupName?: string; // Дэд бүлгийн нэр ("Охид", "1-р бүлэг" г.м)
  jointClassIds?: string[]; // Хамтатгах өөр ангиуд (жишээ: 10А + 10Б лекц)
  totalPeriods: number; // 7 хоногт орох цаг
  doubleLessons: number; // Хос цагийн тоо
  singleLessons: number; // Дан цагийн тоо
  classroomId?: string; // Орох танхим
  weekCycle: WeekCycle; // all, week_a, week_b
  pairedContractId?: string; // E.g., Week A has Art, Week B has Tech
}

export interface ScheduledCard {
  id: string;
  contractId: string;
  subjectId: string;
  teacherId: string;
  coTeacherIds?: string[];
  classId: string;
  subgroupName?: string;
  jointClassIds?: string[];
  classroomId?: string;
  shift: number; // 1, 2, or 3
  dayIndex: number;
  periodIndex: number;
  weekCycle: WeekCycle; // all, week_a, week_b
  isDoublePart?: 'first' | 'second';
  linkedCardId?: string;
  isLocked?: boolean;
}

export interface SchoolSettings {
  schoolName: string;
  academicYear: string;
  daysPerWeek: number; // 5 days (Даваа - Баасан)
  dayNames: string[];
  shiftsCount: number; // 1, 2, or 3 shifts
  shifts: ShiftConfig[];
  buildings: Building[];
  enableWeekAB: boolean; // А ба Б 7 хоногийн сэлгэлт дэмжих эсэх
  defaultBreakMinutes: number; // 5 минут
  lunchBreakMinutes: number; // 10 минут
  periodsPerDay: number; // Convenience max periods
  bells: BellPeriod[]; // Convenience default bells
}

export type RelationshipCondition =
  | 'cannot_same_day' // 1. 2 хичээл нэг өдөрт орохгүй
  | 'cannot_consecutive' // 2. 2 хичээл дараалласан цагт орохгүй
  | 'first_or_last' // 3. Сонгосон хичээл эхний юм уу сүүлийн цагт орох
  | 'allowed_periods_only' // 4. Сонгосон хичээл зөвхөн боломжтой цаг дээр хуваарилах
  | 'daily_hours_limit' // 5. Өдөрт заах цагийн хамгийн их/бага хязгаар
  | 'max_consecutive_periods' // 6. Дараалласан цагийн хамгийн их хязгаар
  | 'teacher_max_once_per_day' // 7. 1 багш 1 анги бүлэгт өдөрт 1-с илүүгүй удаа орох
  | 'same_subject_subgroups_simultaneous' // 8. 1 ангийн 1 хичээлийн дэд бүлгүүд ижил цагт хичээллэх
  | 'different_subjects_subgroups_simultaneous' // 9. 2 өөр хичээлийн дэд бүлгүүд зэрэгцэн ижил цагт орох
  | 'max_gaps_daily_weekly' // 10. Өдрийн болон 7 хоногийн цонхтой цагийн дээд хязгаарыг тогтоох
  | 'teaching_days_limit' // 11. 7 хоногт хичээл заах өдрийн дээд /доод хязгаар
  | 'minimize_shift_crossing_gap' // 12. хэрэв 2 буюу 3 ээлжинд хичээл заадаг бол аль болох 2 ээлжийг дамжих цонх бага байлгах
  | 'ideal_distribution'
  | 'must_be_same_day'
  | 'must_follow'
  | 'max_gaps_per_day'
  | 'building_transfer_buffer';

export interface ParallelSubjectSubgroupConfig {
  subjectId: string;
  subgroupId?: string;
  subgroupName?: string;
  teacherId?: string;
}

export interface CardRelationship {
  id: string;
  name: string;
  condition: RelationshipCondition;
  subjectIds: string[];
  classIds: string[];
  teacherIds?: string[]; // Багш нарыг тусгайлан сонгох
  parallelPairs?: ParallelSubjectSubgroupConfig[]; // 2 өөр хичээлийн дэд бүлгүүд зэрэгцэн орох тохиргоо
  allowDoubleConsecutive?: boolean; // Хос цаг (2 цаг залгаж орох)-ийг 1 удаагийн оролт гэж тооцох
  allowedPeriods?: number[]; // [0, 1, 2] = 1, 2, 3-р цагууд
  firstOrLastMode?: 'first_or_last' | 'first_only' | 'last_only'; // 1-р эсвэл сүүлчийн цагт орох горим
  minPeriodsPerDay?: number; // Өдөрт орох хамгийн бага цаг
  maxPeriodsPerDay?: number; // Өдөрт орох хамгийн их цаг
  maxConsecutive?: number; // Дараалласан цагийн хамгийн их хязгаар (жишээ: 3 цаг)
  maxGapsPerDay?: number; // Өдрийн цонхны дээд хязгаар (жишээ: 1)
  maxGapsPerWeek?: number; // 7 хоногийн нийт цонхны дээд хязгаар (жишээ: 3)
  minDaysPerWeek?: number; // 7 хоногт хичээл заах хамгийн бага өдөр (жишээ: 3)
  maxDaysPerWeek?: number; // 7 хоногт хичээл заах хамгийн их өдөр (жишээ: 5)
  maxCrossShiftGap?: number; // 2-3 ээлж дамжих цонхны дээд хязгаар (жишээ: 1)
  targetEntity?: 'teachers' | 'classes'; // Багш нар эсвэл Ангиуд
  importance: 'strict' | 'high' | 'normal';
  value?: number;
  note?: string;
  isActive: boolean;
}

export interface ConflictIssue {
  id: string;
  type:
    | 'clash_teacher'
    | 'clash_class'
    | 'clash_room'
    | 'time_off_violation'
    | 'gap_excess'
    | 'building_clash'
    | 'shift_mismatch'
    | 'custom_constraint';
  severity: 'error' | 'warning';
  title: string;
  description: string;
  dayIndex?: number;
  periodIndex?: number;
  shift?: number;
  entityType?: 'teacher' | 'class' | 'room' | 'building';
  entityId?: string;
  cardIds?: string[];
}

export interface GenerationStats {
  totalCards: number;
  placedCards: number;
  unplacedCards: number;
  hardConflicts: number;
  softConflicts: number;
  generationTimeMs: number;
  fitnessScore: number;
}

export interface ManagerProfile {
  id: string;
  name: string; // e.g. "Б. Энхмаа"
  title: string; // e.g. "Бага ангийн сургалтын менежер (1-5-р анги)"
  color: string;
  assignedGrades?: number[]; // [1, 2, 3, 4, 5]
  assignedShift?: number; // 1 or 2
  notes?: string;
}

export interface ManagerExportPackage {
  format: 'school_manager_package' | 'asc_manager_package';
  version: '2027.2';
  exportedAt: string;
  manager: ManagerProfile;
  schoolName: string;
  teachers: Teacher[];
  classes: ClassGroup[];
  subjects: Subject[];
  classrooms?: Classroom[];
  lessons: LessonContract[];
  scheduledCards: ScheduledCard[];
  notes?: string;
}

export interface MergeConflict {
  id: string;
  type: 'teacher_clash' | 'room_clash' | 'class_clash';
  title: string;
  description: string;
  dayIndex: number;
  periodIndex: number;
  shift: number;
  entityId: string;
  entityName: string;
  existingCard: ScheduledCard;
  incomingCard: ScheduledCard;
  incomingManagerName: string;
  resolution: 'keep_existing' | 'use_incoming' | 'both_to_dock';
}
