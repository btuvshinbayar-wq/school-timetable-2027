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
import { ManagerProfile, SubstitutionDay } from '../types/timetable';
import { hasLegacyTimeOff, migrateTimeOff } from './constraints';
import { desktop } from '../desktop';

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
  /** Огноо бүрийн орлон заалтын төлөвлөгөө */
  substitutions?: SubstitutionDay[];
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
  if (desktop) {
    const base = customFileName || state.projectName || state.settings.schoolName || 'School_Timetable_2027';
    desktop.app.saveFile(`${base.replace(/[\\/:*?"<>|\s]+/g, '_')}.json`, dataStr);
    return;
  }
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

// ---------------------------------------------------------------------------
// Хөтчийн доторх нөөц хуулбар (IndexedDB) — статик хостинг/PWA үед сервер байхгүй тул
// ---------------------------------------------------------------------------
const IDB_NAME = 'school-timetable-backups';
const IDB_STORE = 'backups';
const LOCAL_KEEP = 30;
const LOCAL_MIN_INTERVAL_MS = 60_000;
let lastLocalBackupAt = 0;

function openBackupDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE, { keyPath: 'filename' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const displayTimeOf = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

async function saveLocalBackup(state: ProjectState, force: boolean): Promise<{ filename: string; displayTime: string } | null> {
  const now = Date.now();
  if (!force && now - lastLocalBackupAt < LOCAL_MIN_INTERVAL_MS) return null;
  const db = await openBackupDb();
  if (!db) return null;
  lastLocalBackupAt = now;
  const d = new Date(now);
  const filename = `local:${d.toISOString()}`;
  const data = JSON.stringify(state);
  await new Promise<void>((resolve) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.put({ filename, mtime: d.toISOString(), size: data.length, data });
    // Хамгийн сүүлийн LOCAL_KEEP хуулбарыг үлдээнэ
    const all = store.getAllKeys();
    all.onsuccess = () => {
      const keys = (all.result as string[]).sort();
      for (const k of keys.slice(0, Math.max(0, keys.length - LOCAL_KEEP))) store.delete(k);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
  return { filename, displayTime: displayTimeOf(d) };
}

async function listLocalBackups(): Promise<BackupItem[]> {
  const db = await openBackupDb();
  if (!db) return [];
  return new Promise((resolve) => {
    const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).getAll();
    req.onsuccess = () =>
      resolve(
        (req.result as any[])
          .map((r) => ({ filename: r.filename, size: r.size, mtime: r.mtime, displayTime: `${displayTimeOf(new Date(r.mtime))} (энэ хөтөч)` }))
          .sort((a, b) => b.mtime.localeCompare(a.mtime))
      );
    req.onerror = () => resolve([]);
  });
}

async function loadLocalBackup(filename: string): Promise<ProjectState> {
  const db = await openBackupDb();
  if (!db) throw new Error('Хөтчийн нөөц санах ой нээгдсэнгүй');
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(filename);
    req.onsuccess = () => (req.result ? resolve(normalizeProject(JSON.parse(req.result.data))) : reject(new Error('Хуулбар олдсонгүй')));
    req.onerror = () => reject(new Error('Хуулбарыг уншиж чадсангүй'));
  });
}

const announceBackup = (displayTime: string, filename: string) => {
  localStorage.setItem('school_timetable_last_backup_time', displayTime);
  localStorage.setItem('school_timetable_last_backup_file', filename);
  window.dispatchEvent(new CustomEvent('school_timetable_autobackup', { detail: { displayTime, filename } }));
};

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
    // Windows десктоп: Documents\School Timetable 2027\backups
    if (desktop) {
      try {
        const r = await desktop.backup.save(JSON.stringify(state));
        if (r.success && r.displayTime && r.filename) announceBackup(r.displayTime, r.filename);
      } catch {
        /* */
      }
      return;
    }
    let serverOk = false;
    try {
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      });
      if (res.ok && (res.headers.get('content-type') || '').includes('json')) {
        const result = await res.json();
        if (result.success && result.displayTime) {
          serverOk = true;
          announceBackup(result.displayTime, result.filename);
        }
      }
    } catch {
      serverOk = false;
    }
    // Сервергүй (статик байршуулалт, PWA) үед хөтчийн дотор хуулбар хадгална
    if (!serverOk) {
      const local = await saveLocalBackup(state, immediate);
      if (local) announceBackup(local.displayTime, local.filename);
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
  if (desktop) {
    try {
      return await desktop.backup.list();
    } catch {
      return [];
    }
  }
  let server: BackupItem[] = [];
  try {
    const res = await fetch('/api/backup/list');
    if (res.ok && (res.headers.get('content-type') || '').includes('json')) {
      const data = await res.json();
      server = data.backups || [];
    }
  } catch {
    server = [];
  }
  const local = await listLocalBackups();
  return [...server, ...local].sort((a, b) => b.mtime.localeCompare(a.mtime));
}

export async function loadServerBackup(filename: string): Promise<ProjectState> {
  if (filename.startsWith('local:')) return loadLocalBackup(filename);
  if (desktop) return normalizeProject(await desktop.backup.load(filename));
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
