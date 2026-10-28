/**
 * School timetable 2027
 * 2-3 ээлж, олон байр, А/Б 7 хоногтой Монголын сургуулийн хичээлийн хуваарийн систем
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  ConflictIssue,
  WeekCycle,
} from './types/timetable';
import {
  loadSavedProject,
  saveProjectToStorage,
  exportProjectToFile,
  importProjectFromFile,
  triggerAutoBackup,
  isAppInitialized,
  setAppInitialized,
  normalizeProject,
  ProjectState,
} from './utils/storage';
import { getDefaultSchoolSettings, DEFAULT_BUILDINGS, DEFAULT_RELATIONSHIPS, DEFAULT_MANAGERS } from './utils/defaultData';
import { verifyTimetable } from './utils/generator';
import { ensureIntegrity } from './utils/integrity';
import { ExcelImportRaw, mergeExcelImport } from './utils/excelIO';
import { applyMove, cardGroup, evaluateMove, evaluateNew, newCardsFromContract, EditContext } from './utils/manualEdit';

// Components
import { DesktopWindowFrame } from './components/DesktopWindowFrame';
import { SingleHeaderToolbar } from './components/SingleHeaderToolbar';
import { TimetableGrid } from './components/TimetableGrid';
import { BottomCardsDock } from './components/BottomCardsDock';
import { DataDialog, DataTab } from './components/DataDialog';
import { LessonsDialog } from './components/LessonsDialog';
import { RelationshipsDialog } from './components/RelationshipsDialog';
import { ManagerExchangeDialog } from './components/ManagerExchangeDialog';
import { SchoolSettingsDialog } from './components/SchoolSettingsDialog';
import { GeneratorDialog } from './components/GeneratorDialog';
import { VerificationDialog } from './components/VerificationDialog';
import { ExcelImportExportDialog } from './components/ExcelImportExportDialog';
import { PrintPreviewDialog } from './components/PrintPreviewDialog';
import { BackupsDialog } from './components/BackupsDialog';
import { SubstitutionDialog } from './components/SubstitutionDialog';

export default function App() {
  const [project, setProjectRaw] = useState<ProjectState>(() => ensureIntegrity(loadSavedProject()).project);

  // --- Буцаах / дахих түүх (сүүлийн 60 алхам) ---
  const past = useRef<ProjectState[]>([]);
  const future = useRef<ProjectState[]>([]);
  const [, setHistoryTick] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<any>(null);
  const notify = useCallback((msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4000);
  }, []);

  /** Хэрэглэгчийн өөрчлөлт: түүхэнд хадгалж, холбоосын бүрэн бүтэн байдлыг хангана */
  const setProject = useCallback((updater: ProjectState | ((prev: ProjectState) => ProjectState)) => {
    setProjectRaw((prev) => {
      const raw = typeof updater === 'function' ? (updater as (p: ProjectState) => ProjectState)(prev) : updater;
      if (raw === prev) return prev;
      const { project: next } = ensureIntegrity(raw);
      past.current.push(prev);
      if (past.current.length > 60) past.current.shift();
      future.current = [];
      return next;
    });
    setHistoryTick((t) => t + 1);
  }, []);

  /** Түүхгүй солих (файл нээх, хуулбар сэргээх) */
  const replaceProject = useCallback((next: ProjectState) => {
    past.current = [];
    future.current = [];
    setProjectRaw(ensureIntegrity(next).project);
    setHistoryTick((t) => t + 1);
  }, []);

  const undo = useCallback(() => {
    if (past.current.length === 0) return;
    setProjectRaw((prev) => {
      const last = past.current.pop()!;
      future.current.push(prev);
      return last;
    });
    setHistoryTick((t) => t + 1);
  }, []);

  const redo = useCallback(() => {
    if (future.current.length === 0) return;
    setProjectRaw((prev) => {
      const next = future.current.pop()!;
      past.current.push(prev);
      return next;
    });
    setHistoryTick((t) => t + 1);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if ((k === 'z' && !e.shiftKey) || k === 'я') {
        e.preventDefault();
        undo();
      } else if (k === 'y' || (k === 'z' && e.shiftKey) || k === 'н') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const [dockDragContractId, setDockDragContractId] = useState<string | null>(null);
  const [isInitialMandatory, setIsInitialMandatory] = useState<boolean>(() => !isAppInitialized());
  const [showBackups, setShowBackups] = useState(false);
  const [lastBackupTime, setLastBackupTime] = useState<string>(
    () => localStorage.getItem('school_timetable_last_backup_time') || ''
  );

  // View & Filter states
  const [viewMode, setViewMode] = useState<
    'whole_classes' | 'whole_teachers' | 'single_class' | 'single_teacher' | 'single_room'
  >('whole_classes');
  const [activeEntityId, setActiveEntityId] = useState<string>('');
  const [activeShift, setActiveShift] = useState<number>(0); // 0 = all shifts
  const [activeWeekCycle, setActiveWeekCycle] = useState<WeekCycle>('all');

  // Dialog visibility states
  const [dataDialogTab, setDataDialogTab] = useState<DataTab | null>(null);
  const [showLessons, setShowLessons] = useState(false);
  const [lessonsFilterSubjectId, setLessonsFilterSubjectId] = useState<string | undefined>();
  const [lessonsFilterTeacherId, setLessonsFilterTeacherId] = useState<string | undefined>();
  const [lessonsFilterClassId, setLessonsFilterClassId] = useState<string | undefined>();
  const [showRelationships, setShowRelationships] = useState(false);
  const [showManagerExchange, setShowManagerExchange] = useState(false);
  const [activeManagerId, setActiveManagerId] = useState<string>('all');
  const [showSchoolSettings, setShowSchoolSettings] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [showExcel, setShowExcel] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showSubstitution, setShowSubstitution] = useState(false);

  // File picker ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Conflicts list
  const [conflicts, setConflicts] = useState<ConflictIssue[]>([]);

  // First startup requirement: open School settings dialog first
  useEffect(() => {
    if (!isAppInitialized()) {
      setShowSchoolSettings(true);
      setIsInitialMandatory(true);
    }
  }, []);

  // Listen to autobackup events
  useEffect(() => {
    const handleAutobackupEvent = (e: any) => {
      if (e.detail?.displayTime) {
        setLastBackupTime(e.detail.displayTime);
      }
    };
    window.addEventListener('school_timetable_autobackup', handleAutobackupEvent);
    return () => window.removeEventListener('school_timetable_autobackup', handleAutobackupEvent);
  }, []);

  // Ensure "Математик өдөрт 1-с илүүгүй удаа орох" is removed and all requested rules are present in exact order
  useEffect(() => {
    setProjectRaw((prev) => {
      let changed = false;
      const filtered = prev.relationships.filter(
        (r) => r.id !== 'rel-1' && !r.name?.includes('Математик өдөрт 1') && r.id !== 'rel-2' && r.id !== 'rel-3'
      );
      if (filtered.length !== prev.relationships.length) changed = true;

      const existingMap = new Map(filtered.map((r) => [r.id, r]));
      const nextRels: CardRelationship[] = [];

      for (const defRel of DEFAULT_RELATIONSHIPS) {
        if (existingMap.has(defRel.id)) {
          const cur = existingMap.get(defRel.id)!;
          // Synchronize name and condition, keep user customization
          nextRels.push({
            ...defRel,
            ...cur,
            name: defRel.name,
            condition: defRel.condition,
          });
          existingMap.delete(defRel.id);
        } else {
          nextRels.push(defRel);
          changed = true;
        }
      }

      // Add any custom added relationships
      for (const [, customRel] of existingMap) {
        nextRels.push(customRel);
      }

      const prevIds = prev.relationships.map((r) => r.id).join(',');
      const nextIds = nextRels.map((r) => r.id).join(',');
      if (prevIds !== nextIds) changed = true;

      return changed ? { ...prev, relationships: nextRels } : prev;
    });
  }, []);

  // Automatically clamp activeShift if settings.shiftsCount decreases
  useEffect(() => {
    const maxShifts = project.settings.shiftsCount || 2;
    if (activeShift > maxShifts) {
      setActiveShift(0);
    }
  }, [project.settings.shiftsCount, activeShift]);

  // Update conflict verification whenever cards or entities change, plus autobackup
  useEffect(() => {
    const list = verifyTimetable(
      project.scheduledCards,
      project.subjects,
      project.teachers,
      project.classes,
      project.classrooms,
      project.settings,
      project.relationships,
      project.lessons
    );
    setConflicts(list);
    saveProjectToStorage(project);

    // Autobackup on every change to schedule
    if (isAppInitialized()) {
      triggerAutoBackup(project);
    }
  }, [project]);

  // Анх ачаалахад хуваарийг автоматаар бодохгүй: том сургуульд бодолт удаан тул
  // хэрэглэгч "Хуваарь бодох" цонхоор (тусдаа урсгалд) өөрөө эхлүүлнэ.

  const handleOpenLessonsForSubject = (subjectId: string) => {
    setLessonsFilterSubjectId(subjectId);
    setLessonsFilterTeacherId(undefined);
    setLessonsFilterClassId(undefined);
    setShowLessons(true);
  };

  const handleOpenLessonsForTeacher = (teacherId: string) => {
    setLessonsFilterTeacherId(teacherId);
    setLessonsFilterSubjectId(undefined);
    setLessonsFilterClassId(undefined);
    setShowLessons(true);
  };

  const handleOpenLessonsForClass = (classId: string) => {
    setLessonsFilterClassId(classId);
    setLessonsFilterSubjectId(undefined);
    setLessonsFilterTeacherId(undefined);
    setShowLessons(true);
  };

  const editCtx: EditContext = {
    settings: project.settings,
    subjects: project.subjects,
    teachers: project.teachers,
    classes: project.classes,
    classrooms: project.classrooms,
    lessons: project.lessons,
  };

  // Чирж зөөх: анги хэзээ ч солигдохгүй, хос цаг хамт, түгжсэнийг хөдөлгөхгүй, эзэлсэн бол солино
  const handleMoveCard = (cardId: string, targetDay: number, targetPeriod: number) => {
    const verdict = evaluateMove(editCtx, project.scheduledCards, cardId, targetDay, targetPeriod);
    if (verdict.status === 'bad') {
      if (verdict.reason && verdict.reason !== 'Ижил байрлал') notify(verdict.reason);
      return;
    }
    const nextCards = applyMove(project.scheduledCards, cardId, targetDay, targetPeriod, verdict);
    setProject((prev) => ({ ...prev, scheduledCards: nextCards }));
    // Хатуу дүрэм (жишээ нь "нэг өдөр орохгүй") зөрчигдсөн эсэхийг мэдэгдэнэ — зөөлтийг хориглохгүй, aSc-тай адил
    const newErrors = newRuleErrors(nextCards);
    if (newErrors.length > 0) notify(`Зөөгдлөө, гэхдээ: ${newErrors[0]}. Буцаах бол Ctrl+Z.`);
    else if (verdict.status === 'swap') notify('Хоёр хичээлийн байрыг солилоо. Буцаах бол Ctrl+Z.');
  };

  /** Өөрчлөлтийн дараа шинээр гарч ирсэн хатуу зөрчлүүдийн тайлбар */
  const newRuleErrors = (nextCards: ScheduledCard[]): string[] => {
    const before = new Set(conflicts.filter((c) => c.severity === 'error').map((c) => c.id));
    return verifyTimetable(
      nextCards,
      project.subjects,
      project.teachers,
      project.classes,
      project.classrooms,
      project.settings,
      project.relationships,
      project.lessons
    )
      .filter((c) => c.severity === 'error' && !before.has(c.id))
      .map((c) => c.title.toLowerCase());
  };

  const handleRemoveCard = (cardId: string) => {
    const ids = new Set(cardGroup(project.scheduledCards, cardId).map((c) => c.id));
    setProject((prev) => ({
      ...prev,
      scheduledCards: prev.scheduledCards.filter((c) => !ids.has(c.id)),
    }));
  };

  const handleToggleLock = (cardId: string) => {
    const group = cardGroup(project.scheduledCards, cardId);
    const ids = new Set(group.map((c) => c.id));
    const lock = !group[0]?.isLocked;
    setProject((prev) => ({
      ...prev,
      scheduledCards: prev.scheduledCards.map((c) => (ids.has(c.id) ? { ...c, isLocked: lock } : c)),
    }));
  };

  const placeFromContract = (contract: LessonContract, day: number, period: number, quiet = false): boolean => {
    const placed = project.scheduledCards.filter((c) => c.contractId === contract.id).length;
    if (placed >= contract.totalPeriods) {
      if (!quiet) notify('Энэ хичээлийн бүх цаг хуваарьт орсон байна');
      return false;
    }
    const cls = project.classes.find((c) => c.id === contract.classId);
    const cards = newCardsFromContract(contract, cls, project.scheduledCards, day, period);
    const verdict = evaluateNew(editCtx, project.scheduledCards, cards);
    if (verdict.status !== 'ok') {
      if (!quiet) notify(verdict.reason || 'Энэ цагт тавих боломжгүй');
      return false;
    }
    const nextCards = [...project.scheduledCards, ...cards];
    setProject((prev) => ({ ...prev, scheduledCards: [...prev.scheduledCards, ...cards] }));
    if (!quiet) {
      const newErrors = newRuleErrors(nextCards);
      if (newErrors.length > 0) notify(`Тавигдлаа, гэхдээ: ${newErrors[0]}. Буцаах бол Ctrl+Z.`);
    }
    return true;
  };

  const handleDropNewCard = (contractId: string, day: number, period: number) => {
    const contract = project.lessons.find((l) => l.id === contractId);
    if (contract) placeFromContract(contract, day, period);
    setDockDragContractId(null);
  };

  // Тавиур дээр товшиход: хатуу хязгаарлалт зөрчихгүй эхний нүдэнд тавина
  const handleQuickPlaceCard = (contract: LessonContract) => {
    const cls = project.classes.find((c) => c.id === contract.classId);
    const shiftConf = project.settings.shifts.find((s) => s.shiftNumber === (cls?.shift || 1)) || project.settings.shifts[0];
    const periodsCount = shiftConf?.periodsCount || 6;
    for (let d = 0; d < project.settings.daysPerWeek; d++) {
      for (let p = 0; p < periodsCount; p++) {
        if (placeFromContract(contract, d, p, true)) return;
      }
    }
    notify('Энэ хичээлийг зөрчилгүй тавих сул цаг олдсонгүй. Чирж тавьбал аль цаг боломжгүйг харуулна.');
  };

  // Project file handling
  const handleNewProject = () => {
    if (
      confirm(
        'Шинэ хичээлийн хуваарийн төсөл эхлүүлэх үү? Сургуулийн үндсэн мэдээллээ оруулж, нэр өгч JSON-р хадгална.'
      )
    ) {
      const freshSettings = getDefaultSchoolSettings();
      // Шинэ төсөл: хичээлийн жагсаалт, дүрмүүдийг үлдээж, сургуулийн бусад мэдээллийг цэвэрлэнэ
      replaceProject({
        ...project,
        projectName: '',
        settings: freshSettings,
        buildings: DEFAULT_BUILDINGS,
        teachers: [],
        classes: [],
        classrooms: [],
        lessons: [],
        scheduledCards: [],
      });
      setIsInitialMandatory(true);
      setShowSchoolSettings(true);
    }
  };

  const handleOpenProjectFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importProjectFromFile(file);
      replaceProject(imported);
      setAppInitialized(true);
      setIsInitialMandatory(false);
      triggerAutoBackup(imported, true);
      alert('School timetable 2027 төслийн файл амжилттай нээгдлээ!');
    } catch (err: any) {
      alert(`Алдаа: ${err?.message || err}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveProjectFile = () => {
    exportProjectToFile(project, 'json');
    triggerAutoBackup(project, true);
  };

  const handleSaveSchoolSettings = (newSettings: SchoolSettings, newProjectName?: string) => {
    const finalName = newProjectName || project.projectName || newSettings.schoolName;
    const updated: ProjectState = {
      ...project,
      projectName: finalName,
      settings: newSettings,
      buildings: newSettings.buildings,
    };
    setProject(updated);

    if (isInitialMandatory) {
      setAppInitialized(true);
      setIsInitialMandatory(false);
      // Заавал JSON форматаар файл татаж хадгална
      exportProjectToFile(updated, 'json', finalName);
      // Суулгасан path орчны backups/ фолдерт огноо цаг минутын хуулбар үүсгэнэ
      triggerAutoBackup(updated, true);
      alert(
        `"${finalName}.json" төсөл амжилттай хадгалагдаж, тухайн программ суусан path орчны backups/ хавтаст autobackup үүслээ.`
      );
    } else {
      triggerAutoBackup(updated);
    }
  };

  // Excel импорт: нэрээр нэгтгэнэ (одоо байгаа ID, гэрээ, хуваарь хадгалагдана)
  const handleExcelImport = (raw: ExcelImportRaw): string[] => {
    const merged = mergeExcelImport(
      {
        subjects: project.subjects,
        teachers: project.teachers,
        classrooms: project.classrooms,
        classes: project.classes,
        lessons: project.lessons,
        buildings: project.settings.buildings || project.buildings || [],
      },
      raw
    );
    setProject((prev) => ({
      ...prev,
      subjects: merged.subjects,
      teachers: merged.teachers,
      classrooms: merged.classrooms,
      classes: merged.classes,
      lessons: merged.lessons,
    }));
    return merged.messages;
  };

  const currentBuildings = project.settings.buildings || project.buildings || [];

  return (
    <DesktopWindowFrame title="Цагийн хуваарь 2027">
      <input
        ref={fileInputRef}
        type="file"
        accept=".roz,.json"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* ГАНЦХАН НЭГДМЭЛ ЦЭС: Бүх үйлдэл нүүрний товчлуураар харагдана */}
      <SingleHeaderToolbar
        onUndo={undo}
        onRedo={redo}
        canUndo={past.current.length > 0}
        canRedo={future.current.length > 0}
        onOpenSubjects={() => setDataDialogTab('subjects')}
        onOpenTeachers={() => setDataDialogTab('teachers')}
        onOpenClasses={() => setDataDialogTab('classes')}
        onOpenClassrooms={() => setDataDialogTab('classrooms')}
        onOpenLessons={() => setShowLessons(true)}
        onOpenRelations={() => setShowRelationships(true)}
        onOpenManagerExchange={() => setShowManagerExchange(true)}
        onOpenSchoolSettings={() => setShowSchoolSettings(true)}
        onOpenGenerator={() => setShowGenerator(true)}
        onOpenVerification={() => setShowVerification(true)}
        onOpenSubstitution={() => setShowSubstitution(true)}
        onOpenExcel={() => setShowExcel(true)}
        onOpenPrintPreview={() => setShowPrintPreview(true)}
        onNewProject={handleNewProject}
        onOpenProjectFile={handleOpenProjectFile}
        onSaveProjectFile={handleSaveProjectFile}
        onOpenBackups={() => setShowBackups(true)}
        lastBackupTime={lastBackupTime}
        projectName={project.projectName}
        schoolName={project.settings.schoolName}
        academicYear={project.settings.academicYear}
        viewMode={viewMode}
        onChangeViewMode={(mode) => {
          setViewMode(mode);
          if (mode === 'single_class' && !activeEntityId) setActiveEntityId(project.classes[0]?.id || '');
          if (mode === 'single_teacher' && !activeEntityId) setActiveEntityId(project.teachers[0]?.id || '');
          if (mode === 'single_room' && !activeEntityId) setActiveEntityId(project.classrooms[0]?.id || '');
        }}
        activeEntityId={activeEntityId}
        onChangeActiveEntityId={setActiveEntityId}
        activeManagerId={activeManagerId}
        onChangeActiveManagerId={setActiveManagerId}
        managers={project.managers && project.managers.length > 0 ? project.managers : DEFAULT_MANAGERS}
        shiftsCount={project.settings.shiftsCount || project.settings.shifts?.length || 2}
        shifts={project.settings.shifts}
        activeShift={activeShift}
        onChangeShift={setActiveShift}
        activeWeekCycle={activeWeekCycle}
        onChangeWeekCycle={setActiveWeekCycle}
        classes={project.classes}
        teachers={project.teachers}
        classrooms={project.classrooms}
        buildings={currentBuildings}
        enableWeekAB={project.settings.enableWeekAB}
      />

      {/* Main Interactive Timetable Grid Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <TimetableGrid
          viewMode={viewMode}
          onChangeViewMode={setViewMode}
          activeEntityId={activeEntityId}
          onChangeActiveEntityId={setActiveEntityId}
          activeManagerId={activeManagerId}
          managers={project.managers && project.managers.length > 0 ? project.managers : DEFAULT_MANAGERS}
          activeShift={activeShift}
          activeWeekCycle={activeWeekCycle}
          scheduledCards={project.scheduledCards}
          subjects={project.subjects}
          teachers={project.teachers}
          classes={project.classes}
          classrooms={project.classrooms}
          buildings={currentBuildings}
          settings={project.settings}
          conflicts={conflicts}
          lessons={project.lessons}
          dockDragContractId={dockDragContractId}
          onMoveCard={handleMoveCard}
          onRemoveCard={handleRemoveCard}
          onToggleLock={handleToggleLock}
          onDropNewCard={handleDropNewCard}
          onNotify={notify}
        />

        {notice && (
          <div
            role="status"
            className="fixed left-1/2 -translate-x-1/2 top-4 z-[70] bg-[#2e2b26] text-[#fdfbf6] text-[12.5px] px-4 py-2 rounded-lg shadow-[0_6px_24px_rgba(46,43,38,0.25)] max-w-[560px] text-center"
          >
            {notice}
          </div>
        )}

        {/* Bottom Unplaced Cards Dock */}
        <BottomCardsDock
          lessons={project.lessons}
          scheduledCards={project.scheduledCards}
          subjects={project.subjects}
          teachers={project.teachers}
          classes={project.classes}
          classrooms={project.classrooms}
          selectedClassId={viewMode === 'single_class' ? activeEntityId : undefined}
          selectedTeacherId={viewMode === 'single_teacher' ? activeEntityId : undefined}
          activeManagerId={activeManagerId}
          onCardDragStart={(id) => setDockDragContractId(id)}
          onCardDragEnd={() => setDockDragContractId(null)}
          onQuickPlaceCard={handleQuickPlaceCard}
        />
      </div>

      {/* Bottom Status Bar (Classic Desktop Inset Panels) */}
      <div className="bg-[#e6e2da] border-t border-[#d6d1c6] px-3 py-1 flex items-center justify-between text-[11px] text-slate-700 select-none font-sans">
        <div className="flex items-center gap-2">
          <div className="asc-status-panel font-bold text-slate-900">
            {project.settings.schoolName} ({project.settings.academicYear})
          </div>
          <div className="asc-status-panel">
            Ээлж: <strong className="text-slate-900">{project.settings.shiftsCount}</strong> | Байр: <strong className="text-slate-900">{currentBuildings.length}</strong>
          </div>
          <div className="asc-status-panel">
            Байршсан: <strong className="text-blue-900">{project.scheduledCards.length}</strong> цаг
          </div>
          <div className="asc-status-panel hidden md:block">
            Анги: {project.classes.length} | Багш: {project.teachers.length} | Хичээл: {project.lessons.length}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {conflicts.length > 0 ? (
            (() => {
              const errorCount = conflicts.filter((c) => c.severity === 'error').length;
              const warnCount = conflicts.length - errorCount;
              return (
                <button
                  onClick={() => setShowVerification(true)}
                  className={`flex items-center gap-1 font-bold px-2 py-0.5 rounded-xs transition cursor-pointer border ${
                    errorCount > 0
                      ? 'text-rose-700 bg-rose-100/90 border-rose-300 hover:bg-rose-200'
                      : 'text-amber-800 bg-amber-100/90 border-amber-300 hover:bg-amber-200'
                  }`}
                  title="Шалгалтын жагсаалтыг нээх"
                >
                  <span>
                    {errorCount > 0 ? `⚠️ ${errorCount} алдаа` : '✓ Хатуу зөрчилгүй'} · {warnCount} сануулга
                  </span>
                </button>
              );
            })()
          ) : (
            <div className="asc-status-panel text-emerald-700 font-semibold flex items-center gap-1">
              <span>✓ Хуваарь зөрчилгүй</span>
            </div>
          )}
          <div className="asc-status-panel font-medium text-slate-600 text-[10px]">
            School timetable 2027
          </div>
        </div>
      </div>

      {/* Нэгдсэн Дата цонх (Хичээл, Анги бүлэг, Танхим, Багш нар хоорондоо чөлөөтэй шилжинэ) */}
      {dataDialogTab && (
        <DataDialog
          initialTab={dataDialogTab}
          isOpen={!!dataDialogTab}
          onClose={() => setDataDialogTab(null)}
          subjects={project.subjects}
          teachers={project.teachers}
          classes={project.classes}
          classrooms={project.classrooms}
          buildings={currentBuildings}
          lessons={project.lessons}
          settings={project.settings}
          onUpdateSubjects={(subjects) => setProject((prev) => ({ ...prev, subjects }))}
          onUpdateTeachers={(teachers) => setProject((prev) => ({ ...prev, teachers }))}
          onUpdateClasses={(classes) => setProject((prev) => ({ ...prev, classes }))}
          onUpdateClassrooms={(classrooms) => setProject((prev) => ({ ...prev, classrooms }))}
          onUpdateLessons={(lessons) => setProject((prev) => ({ ...prev, lessons }))}
          onOpenLessonsForSubject={handleOpenLessonsForSubject}
          onOpenLessonsForTeacher={handleOpenLessonsForTeacher}
          onOpenLessonsForClass={handleOpenLessonsForClass}
          onOpenConstraints={() => setShowRelationships(true)}
          onOpenExcelImport={() => setShowExcel(true)}
        />
      )}

      {showLessons && (
        <LessonsDialog
          lessons={project.lessons}
          subjects={project.subjects}
          teachers={project.teachers}
          classes={project.classes}
          classrooms={project.classrooms}
          enableWeekAB={project.settings.enableWeekAB}
          initialFilterSubjectId={lessonsFilterSubjectId}
          initialFilterTeacherId={lessonsFilterTeacherId}
          initialFilterClassId={lessonsFilterClassId}
          isOpen={showLessons}
          onClose={() => setShowLessons(false)}
          onUpdateLessons={(lessons) => setProject((prev) => ({ ...prev, lessons }))}
        />
      )}

      {/* Тохиргоо (Хичээлийн хамаарал, дараалал, хязгаарлалт) */}
      {showRelationships && (
        <RelationshipsDialog
          relationships={project.relationships}
          subjects={project.subjects}
          classes={project.classes}
          teachers={project.teachers}
          isOpen={showRelationships}
          onClose={() => setShowRelationships(false)}
          onUpdateRelationships={(relationships) => setProject((prev) => ({ ...prev, relationships }))}
        />
      )}

      {/* 2-3 менежерийн цаг хуваарилалт солилцох & Нэгтгэх төв */}
      {showManagerExchange && (
        <ManagerExchangeDialog
          isOpen={showManagerExchange}
          onClose={() => setShowManagerExchange(false)}
          settings={project.settings}
          subjects={project.subjects}
          teachers={project.teachers}
          classes={project.classes}
          classrooms={project.classrooms}
          lessons={project.lessons}
          scheduledCards={project.scheduledCards}
          managers={project.managers && project.managers.length > 0 ? project.managers : DEFAULT_MANAGERS}
          onUpdateManagers={(managers) => setProject((prev) => ({ ...prev, managers }))}
          onMergeComplete={(merged) => {
            setProject((prev) => ({
              ...prev,
              teachers: merged.teachers,
              classes: merged.classes,
              lessons: merged.lessons,
              scheduledCards: merged.scheduledCards,
              lastModified: new Date().toISOString(),
            }));
            setShowManagerExchange(false);
          }}
          onUpdateTeachers={(teachers) => setProject((prev) => ({ ...prev, teachers }))}
        />
      )}

      {/* Сургууль (Байрууд, 2-3 ээлж, хонхны цаг, завсарлага, А/Б 7 хоног) */}
      {showSchoolSettings && (
        <SchoolSettingsDialog
          settings={project.settings}
          isOpen={showSchoolSettings}
          isMandatorySetup={isInitialMandatory}
          projectName={project.projectName}
          onClose={() => {
            if (!isInitialMandatory) setShowSchoolSettings(false);
          }}
          onSaveSettings={handleSaveSchoolSettings}
        />
      )}

      {showGenerator && (
        <GeneratorDialog
          subjects={project.subjects}
          teachers={project.teachers}
          classes={project.classes}
          classrooms={project.classrooms}
          lessons={project.lessons}
          relationships={project.relationships}
          settings={project.settings}
          existingCards={project.scheduledCards}
          isOpen={showGenerator}
          onClose={() => setShowGenerator(false)}
          onApplyTimetable={(scheduledCards) => {
            setProject((prev) => ({
              ...prev,
              scheduledCards,
            }));
          }}
        />
      )}

      {showVerification && (
        <VerificationDialog
          conflicts={conflicts}
          isOpen={showVerification}
          onClose={() => setShowVerification(false)}
          onShowEntity={(type, id) => {
            setViewMode(type === 'class' ? 'single_class' : type === 'teacher' ? 'single_teacher' : 'single_room');
            setActiveEntityId(id);
          }}
        />
      )}

      {showExcel && (
        <ExcelImportExportDialog
          scheduledCards={project.scheduledCards}
          subjects={project.subjects}
          teachers={project.teachers}
          classes={project.classes}
          classrooms={project.classrooms}
          settings={project.settings}
          isOpen={showExcel}
          onClose={() => setShowExcel(false)}
          onImportData={handleExcelImport}
        />
      )}

      {showPrintPreview && (
        <PrintPreviewDialog
          scheduledCards={project.scheduledCards}
          subjects={project.subjects}
          teachers={project.teachers}
          classes={project.classes}
          classrooms={project.classrooms}
          settings={project.settings}
          isOpen={showPrintPreview}
          onClose={() => setShowPrintPreview(false)}
        />
      )}

      {showSubstitution && (
        <SubstitutionDialog
          isOpen={showSubstitution}
          onClose={() => setShowSubstitution(false)}
          settings={project.settings}
          subjects={project.subjects}
          teachers={project.teachers}
          classes={project.classes}
          classrooms={project.classrooms}
          lessons={project.lessons}
          scheduledCards={project.scheduledCards}
          substitutions={project.substitutions || []}
          onChange={(substitutions) => setProject((prev) => ({ ...prev, substitutions }))}
          onNotify={notify}
        />
      )}

      {/* Авто-хуулбарын удирдлага (Autobackup) */}
      <BackupsDialog
        isOpen={showBackups}
        onClose={() => setShowBackups(false)}
        onRestoreProject={(raw) => {
          const restored = normalizeProject(raw);
          replaceProject(restored);
          saveProjectToStorage(restored);
          triggerAutoBackup(restored, true);
        }}
        currentProject={project}
      />
    </DesktopWindowFrame>
  );
}
