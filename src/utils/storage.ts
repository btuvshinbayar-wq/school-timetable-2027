import {
  Subject,
  Teacher,
  ClassGroup,
  Classroom,
  Building,
  LessonContract,
  ScheduledCard,
  SchoolSettings,
  CardRelationship,
} from '../types/timetable';
import {
  DEFAULT_SUBJECTS,
  DEFAULT_TEACHERS,
  DEFAULT_CLASSES,
  DEFAULT_CLASSROOMS,
  DEFAULT_BUILDINGS,
  DEFAULT_LESSONS,
  DEFAULT_RELATIONSHIPS,
  DEFAULT_MANAGERS,
  getDefaultSchoolSettings,
} from './defaultData';
import { ManagerProfile } from '../types/timetable';
import { hasLegacyTimeOff, migrateTimeOff } from './constraints';

/**
 * Хуучин хувилбарын өгөгдлийг шинэ бүтэц рүү шилжүүлнэ:
 *  - Чөлөөт цагийн `${өдөр}_${цаг}` түлхүүрийг `${ээлж}_${өдөр}_${цаг}` болгоно
 *    (анги → өөрийн ээлж; багш, хичээл, танхим → бүх ээлж, өмнөх үйлдэлтэй адил).
 */
export function normalizeProject(state: ProjectState): ProjectState {
  const shiftNums =
    state.settings?.shifts && state.settings.shifts.length > 0
      ? state.settings.shifts.map((s) => s.shiftNumber)
      : [1, 2];
  const fixAll = <T extends { timeOff: any }>(list: T[] | undefined): T[] =>
    (list || []).map((x) => (hasLegacyTimeOff(x.timeOff) ? { ...x, timeOff: migrateTimeOff(x.timeOff, shiftNums) } : x));

  return {
    ...state,
    teachers: fixAll(state.teachers),
    subjects: fixAll(state.subjects),
    classrooms: fixAll(state.classrooms),
    classes: (state.classes || []).map((c) =>
      hasLegacyTimeOff(c.timeOff) ? { ...c, timeOff: migrateTimeOff(c.timeOff, [c.shift || 1]) } : c
    ),
  };
}

export interface ProjectState {
  version: string;
  projectName?: string;
  settings: SchoolSettings;
  subjects: Subject[];
  teachers: Teacher[];
  classes: ClassGroup[];
  classrooms: Classroom[];
  buildings: Building[];
  lessons: LessonContract[];
  scheduledCards: ScheduledCard[];
  relationships: CardRelationship[];
  managers?: ManagerProfile[];
  lastModified: string;
}

const STORAGE_KEY = 'school_timetable_2027_v2';
export const INITIALIZED_KEY = 'school_timetable_initialized_v2';

export function isAppInitialized(): boolean {
  try {
    return localStorage.getItem(INITIALIZED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setAppInitialized(val: boolean = true): void {
  try {
    if (val) {
      localStorage.setItem(INITIALIZED_KEY, 'true');
    } else {
      localStorage.removeItem(INITIALIZED_KEY);
    }
  } catch (err) {
    console.error('Failed to set initialized flag', err);
  }
}

export function loadSavedProject(): ProjectState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.subjects && parsed.teachers) {
        if (!parsed.buildings) parsed.buildings = DEFAULT_BUILDINGS;
        if (!parsed.managers || parsed.managers.length === 0) parsed.managers = DEFAULT_MANAGERS;
        if (parsed.relationships) {
          parsed.relationships = parsed.relationships.filter(
            (r: any) =>
              r.id !== 'rel-1' &&
              !r.name?.includes('Математик өдөрт 1')
          );
        }
        return normalizeProject(parsed);
      }
    }
  } catch (err) {
    console.error('Failed to parse saved project from storage', err);
  }

  return {
    version: '2027.2',
    projectName: '',
    settings: getDefaultSchoolSettings(),
    subjects: DEFAULT_SUBJECTS,
    teachers: DEFAULT_TEACHERS,
    classes: DEFAULT_CLASSES,
    classrooms: DEFAULT_CLASSROOMS,
    buildings: DEFAULT_BUILDINGS,
    lessons: DEFAULT_LESSONS,
    scheduledCards: [],
    relationships: DEFAULT_RELATIONSHIPS,
    managers: DEFAULT_MANAGERS,
    lastModified: new Date().toISOString(),
  };
}

export function saveProjectToStorage(state: ProjectState) {
  try {
    state.lastModified = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save to localStorage', err);
  }
}

export function exportProjectToFile(
  state: ProjectState,
  format: 'json' | 'roz' = 'json',
  customFileName?: string
) {
  const dataStr = JSON.stringify(state, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  let baseName = customFileName || state.projectName || state.settings.schoolName || 'School_Timetable_2027';
  const sanitizedName = baseName.replace(/[\s\W]+/g, '_');
  link.href = url;
  link.download = `${sanitizedName}.${format}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Autobackup debounce timer
let autoBackupTimer: any = null;

export interface BackupItem {
  filename: string;
  size: number;
  mtime: string;
  displayTime: string;
}

/**
 * Тухайн программ суусан path орчинд хуваарийн программ дээр
 * өөрчлөлт оруулах бүрд огноо, цаг минут бүхий autobackup үүсгэнэ.
 */
export function triggerAutoBackup(state: ProjectState, immediate = false): void {
  if (autoBackupTimer) {
    clearTimeout(autoBackupTimer);
    autoBackupTimer = null;
  }

  const performBackup = async () => {
    try {
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.displayTime) {
          localStorage.setItem('school_timetable_last_backup_time', result.displayTime);
          localStorage.setItem('school_timetable_last_backup_file', result.filename);
          window.dispatchEvent(
            new CustomEvent('school_timetable_autobackup', {
              detail: {
                displayTime: result.displayTime,
                filename: result.filename,
              },
            })
          );
        }
      }
    } catch (err) {
      console.warn('Path environment autobackup write skipped or network offline:', err);
    }
  };

  if (immediate) {
    performBackup();
  } else {
    // Debounce by 800ms to avoid overwhelming disk writes during fast interactions
    autoBackupTimer = setTimeout(performBackup, 800);
  }
}

export async function listServerBackups(): Promise<BackupItem[]> {
  try {
    const res = await fetch('/api/backup/list');
    if (!res.ok) throw new Error('Хуулбарын жагсаалт авахад алдаа гарлаа');
    const data = await res.json();
    return data.backups || [];
  } catch (err) {
    console.error('Failed to list server backups', err);
    return [];
  }
}

export async function loadServerBackup(filename: string): Promise<ProjectState> {
  const res = await fetch('/api/backup/load', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename }),
  });
  if (!res.ok) throw new Error('Хуулбарыг уншиж чадсангүй');
  const data = await res.json();
  if (!data.success || !data.data) {
    throw new Error(data.error || 'Хуулбарын өгөгдөл буруу байна');
  }
  return normalizeProject(data.data as ProjectState);
}

export async function importProjectFromFile(file: File): Promise<ProjectState> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        if (!parsed.subjects || !parsed.teachers || !parsed.classes) {
          throw new Error('Файлын бүтэц буруу байна. School Timetable төслийн файл биш байна.');
        }
        if (!parsed.buildings) parsed.buildings = DEFAULT_BUILDINGS;
        resolve(normalizeProject(parsed as ProjectState));
      } catch (err: any) {
        reject(new Error(`Төслийн файл уншихад алдаа: ${err?.message || err}`));
      }
    };
    reader.onerror = () => reject(new Error('Файл уншиж чадсангүй.'));
    reader.readAsText(file);
  });
}
