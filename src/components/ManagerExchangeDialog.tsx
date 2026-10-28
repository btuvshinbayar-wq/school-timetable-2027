import { classSlotCompatible, weeksOverlap } from '../utils/constraints';
import React, { useState, useRef } from 'react';
import {
  Teacher,
  ClassGroup,
  Subject,
  Classroom,
  LessonContract,
  ScheduledCard,
  ManagerProfile,
  ManagerExportPackage,
  MergeConflict,
  SchoolSettings,
} from '../types/timetable';
import {
  Users,
  Upload,
  Download,
  Share2,
  CheckCircle2,
  AlertTriangle,
  ArrowRightLeft,
  FileCheck,
  FileSpreadsheet,
  Settings,
  Plus,
  Trash2,
  Save,
  Check,
  Layers,
  GraduationCap,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

interface ManagerExchangeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SchoolSettings;
  subjects: Subject[];
  teachers: Teacher[];
  classes: ClassGroup[];
  classrooms: Classroom[];
  lessons: LessonContract[];
  scheduledCards: ScheduledCard[];
  managers: ManagerProfile[];
  onUpdateManagers: (managers: ManagerProfile[]) => void;
  onMergeComplete: (merged: {
    teachers: Teacher[];
    classes: ClassGroup[];
    lessons: LessonContract[];
    scheduledCards: ScheduledCard[];
  }) => void;
  onUpdateTeachers: (teachers: Teacher[]) => void;
}

interface LoadedManagerSlot {
  managerId: string;
  managerName: string;
  sourceType: 'file' | 'system' | 'empty';
  fileName?: string;
  teachers: Teacher[];
  classes: ClassGroup[];
  lessons: LessonContract[];
  scheduledCards: ScheduledCard[];
  rawPackage?: ManagerExportPackage;
}

export const ManagerExchangeDialog: React.FC<ManagerExchangeDialogProps> = ({
  isOpen,
  onClose,
  settings,
  subjects,
  teachers,
  classes,
  classrooms,
  lessons,
  scheduledCards,
  managers,
  onUpdateManagers,
  onMergeComplete,
  onUpdateTeachers,
}) => {
  const [activeTab, setActiveTab] = useState<'merge' | 'export' | 'settings'>('merge');

  // Slots for 3 managers in the Merge tab
  const [slots, setSlots] = useState<LoadedManagerSlot[]>(() => {
    return managers.map((m) => {
      // Find teachers assigned to this manager in system
      const assignedTeachers = teachers.filter((t) => t.managerId === m.id);
      const teacherIds = new Set(assignedTeachers.map((t) => t.id));
      const assignedLessons = lessons.filter((l) => teacherIds.has(l.teacherId));
      const contractIds = new Set(assignedLessons.map((l) => l.id));
      const assignedCards = scheduledCards.filter(
        (c) => teacherIds.has(c.teacherId) || contractIds.has(c.contractId)
      );

      return {
        managerId: m.id,
        managerName: m.name,
        sourceType: assignedLessons.length > 0 ? 'system' : 'empty',
        fileName: assignedLessons.length > 0 ? `Систем дэх ${m.title}` : undefined,
        teachers: assignedTeachers,
        classes: classes.filter((c) => c.managerId === m.id),
        lessons: assignedLessons,
        scheduledCards: assignedCards,
      };
    });
  });

  // Export tab state
  const [exportManagerId, setExportManagerId] = useState<string>(managers[0]?.id || 'mgr-1');
  const [exportSelectedTeacherIds, setExportSelectedTeacherIds] = useState<string[]>([]);
  const [exportIncludeCards, setExportIncludeCards] = useState<boolean>(true);
  const [exportNotes, setExportNotes] = useState<string>('');

  // Merge Conflict resolutions
  const [conflictResolutions, setConflictResolutions] = useState<
    Record<string, 'keep_existing' | 'use_incoming' | 'both_to_dock'>
  >({});
  const [mergeSuccess, setMergeSuccess] = useState<boolean>(false);

  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  if (!isOpen) return null;

  // Selected manager for export
  const currentExportManager =
    managers.find((m) => m.id === exportManagerId) || managers[0] || {
      id: 'mgr-1',
      name: 'Менежер 1',
      title: 'Сургалтын менежер',
      color: '#0284c7',
    };

  // Helper to load file into a specific manager slot
  const handleFileUpload = (managerId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);

        let parsedTeachers: Teacher[] = [];
        let parsedClasses: ClassGroup[] = [];
        let parsedLessons: LessonContract[] = [];
        let parsedCards: ScheduledCard[] = [];
        let mgrName = 'Менежерийн файл';

        if (parsed.format === 'school_manager_package' || parsed.format === 'asc_manager_package') {
          parsedTeachers = parsed.teachers || [];
          parsedClasses = parsed.classes || [];
          parsedLessons = parsed.lessons || [];
          parsedCards = parsed.scheduledCards || [];
          mgrName = parsed.manager?.name || parsed.manager?.title || mgrName;
        } else if (parsed.lessons) {
          // generic timetable project json
          parsedTeachers = parsed.teachers || [];
          parsedClasses = parsed.classes || [];
          parsedLessons = parsed.lessons || [];
          parsedCards = parsed.scheduledCards || [];
          mgrName = parsed.projectName || 'Хуваарийн файл';
        }

        setSlots((prev) =>
          prev.map((s) =>
            s.managerId === managerId
              ? {
                  ...s,
                  sourceType: 'file',
                  fileName: file.name,
                  managerName: mgrName,
                  teachers: parsedTeachers,
                  classes: parsedClasses,
                  lessons: parsedLessons,
                  scheduledCards: parsedCards,
                  rawPackage: parsed,
                }
              : s
          )
        );
      } catch (err) {
        alert('Файл уншихад алдаа гарлаа. Зөв .json файл сонгоно уу.');
      }
    };
    reader.readAsText(file);
  };

  // Pull system data for slot
  const handlePullSystemData = (managerId: string) => {
    const mgr = managers.find((m) => m.id === managerId);
    if (!mgr) return;

    // Filter teachers and classes by this manager
    const assignedTeachers = teachers.filter((t) => t.managerId === mgr.id);
    const teacherIds = new Set(assignedTeachers.map((t) => t.id));
    const assignedLessons = lessons.filter((l) => teacherIds.has(l.teacherId));
    const contractIds = new Set(assignedLessons.map((l) => l.id));
    const assignedCards = scheduledCards.filter(
      (c) => teacherIds.has(c.teacherId) || contractIds.has(c.contractId)
    );

    setSlots((prev) =>
      prev.map((s) =>
        s.managerId === managerId
          ? {
              ...s,
              sourceType: 'system',
              fileName: `Систем дэх ${mgr.title}`,
              managerName: mgr.name,
              teachers: assignedTeachers,
              classes: classes.filter((c) => c.managerId === mgr.id || (mgr.assignedGrades && mgr.assignedGrades.includes(c.grade))),
              lessons: assignedLessons,
              scheduledCards: assignedCards,
            }
          : s
      )
    );
  };

  // Pull all managers' system data at once
  const handlePullAllFromSystem = () => {
    setSlots(
      managers.map((mgr) => {
        const assignedTeachers = teachers.filter((t) => t.managerId === mgr.id);
        const teacherIds = new Set(assignedTeachers.map((t) => t.id));
        const assignedLessons = lessons.filter((l) => teacherIds.has(l.teacherId));
        const contractIds = new Set(assignedLessons.map((l) => l.id));
        const assignedCards = scheduledCards.filter(
          (c) => teacherIds.has(c.teacherId) || contractIds.has(c.contractId)
        );

        return {
          managerId: mgr.id,
          managerName: mgr.name,
          sourceType: 'system',
          fileName: `Систем дэх ${mgr.title}`,
          teachers: assignedTeachers,
          classes: classes.filter((c) => c.managerId === mgr.id || (mgr.assignedGrades && mgr.assignedGrades.includes(c.grade))),
          lessons: assignedLessons,
          scheduledCards: assignedCards,
        };
      })
    );
  };

  // Clear slot
  const handleClearSlot = (managerId: string) => {
    setSlots((prev) =>
      prev.map((s) =>
        s.managerId === managerId
          ? {
              ...s,
              sourceType: 'empty',
              fileName: undefined,
              teachers: [],
              classes: [],
              lessons: [],
              scheduledCards: [],
              rawPackage: undefined,
            }
          : s
      )
    );
  };

  // Calculate Conflicts across all loaded slots
  const detectConflicts = (): MergeConflict[] => {
    const loaded = slots.filter((s) => s.scheduledCards.length > 0);
    // Нэгтгэлд ороогүй багш нарын системд байгаа картууд мөн давхцал шалгалтад орно
    const mergingTeacherIds = new Set(
      slots.filter((s) => s.lessons.length > 0 || s.scheduledCards.length > 0 || s.teachers.length > 0).flatMap((s) => s.teachers.map((t) => t.id))
    );
    const systemCards = scheduledCards.filter((c) => !mergingTeacherIds.has(c.teacherId));
    const activeSlots = [
      ...(systemCards.length > 0 ? [{ managerName: 'Одоогийн хуваарь', scheduledCards: systemCards } as any] : []),
      ...loaded,
    ];
    const conflicts: MergeConflict[] = [];

    // Map: key = `${day}_${period}_${shift}_${teacherId}` -> Card
    const teacherGrid = new Map<string, { card: ScheduledCard; managerName: string }>();
    const roomGrid = new Map<string, { card: ScheduledCard; managerName: string }>();
    const classGrid = new Map<string, { card: ScheduledCard; managerName: string }>();

    for (const slot of activeSlots) {
      for (const card of slot.scheduledCards) {
        // 1. Teacher Clash
        const teacherKey = `${card.dayIndex}_${card.periodIndex}_${card.shift}_${card.teacherId}`;
        if (teacherGrid.has(teacherKey) && weeksOverlap(teacherGrid.get(teacherKey)!.card.weekCycle, card.weekCycle)) {
          const existing = teacherGrid.get(teacherKey)!;
          const tObj = teachers.find((t) => t.id === card.teacherId);
          const dayName = settings.dayNames[card.dayIndex] || `${card.dayIndex + 1}-р өдөр`;
          conflicts.push({
            id: `clash_t_${teacherKey}`,
            type: 'teacher_clash',
            title: 'Багшийн цагийн давхцал',
            description: `${tObj?.name || 'Багш'} ${dayName} гарагийн ${card.periodIndex + 1}-р цагт "${
              existing.managerName
            }" болон "${slot.managerName}" менежерүүдийн хуваарьт зэрэг тавигдсан байна!`,
            dayIndex: card.dayIndex,
            periodIndex: card.periodIndex,
            shift: card.shift,
            entityId: card.teacherId,
            entityName: tObj?.name || 'Багш',
            existingCard: existing.card,
            incomingCard: card,
            incomingManagerName: slot.managerName,
            resolution: conflictResolutions[`clash_t_${teacherKey}`] || 'keep_existing',
          });
        } else {
          teacherGrid.set(teacherKey, { card, managerName: slot.managerName });
        }

        // 1б. Ангийн давхцал (өөр хуваалтын дэд бүлэг, бүхэл анги)
        const classKey = `${card.dayIndex}_${card.periodIndex}_${card.shift}_${card.classId}`;
        const prevClass = classGrid.get(classKey);
        if (prevClass && prevClass.card.id !== card.id && !classSlotCompatible(classes, card.classId, prevClass.card, card) && weeksOverlap(prevClass.card.weekCycle, card.weekCycle)) {
          const cObj = classes.find((c) => c.id === card.classId);
          const dayName = settings.dayNames[card.dayIndex] || `${card.dayIndex + 1}-р өдөр`;
          conflicts.push({
            id: `clash_c_${classKey}`,
            type: 'class_clash',
            title: 'Ангийн давхцал',
            description: `${cObj?.name || 'Анги'} ${dayName} гарагийн ${card.periodIndex + 1}-р цагт "${prevClass.managerName}" болон "${slot.managerName}"-ийн хуваарьт зэрэг хичээлтэй байна!`,
            dayIndex: card.dayIndex,
            periodIndex: card.periodIndex,
            shift: card.shift,
            entityId: card.classId,
            entityName: cObj?.name || 'Анги',
            existingCard: prevClass.card,
            incomingCard: card,
            incomingManagerName: slot.managerName,
            resolution: conflictResolutions[`clash_c_${classKey}`] || 'keep_existing',
          });
        } else if (!prevClass) {
          classGrid.set(classKey, { card, managerName: slot.managerName });
        }

        // 2. Room Clash (for non-shared rooms)
        if (card.classroomId) {
          const roomObj = classrooms.find((r) => r.id === card.classroomId);
          if (roomObj && !roomObj.isShared) {
            const roomKey = `${card.dayIndex}_${card.periodIndex}_${card.shift}_${card.classroomId}`;
            if (roomGrid.has(roomKey)) {
              const existing = roomGrid.get(roomKey)!;
              const dayName = settings.dayNames[card.dayIndex] || `${card.dayIndex + 1}-р өдөр`;
              conflicts.push({
                id: `clash_r_${roomKey}`,
                type: 'room_clash',
                title: 'Танхимын давхцал',
                description: `${roomObj.name} танхим ${dayName} гарагийн ${card.periodIndex + 1}-р цагт "${
                  existing.managerName
                }" болон "${slot.managerName}" менежерүүдэд зэрэг оноогдсон байна!`,
                dayIndex: card.dayIndex,
                periodIndex: card.periodIndex,
                shift: card.shift,
                entityId: card.classroomId,
                entityName: roomObj.name,
                existingCard: existing.card,
                incomingCard: card,
                incomingManagerName: slot.managerName,
                resolution: conflictResolutions[`clash_r_${roomKey}`] || 'keep_existing',
              });
            } else {
              roomGrid.set(roomKey, { card, managerName: slot.managerName });
            }
          }
        }
      }
    }

    return conflicts;
  };

  const detectedConflicts = detectConflicts();

  // Perform Final Merge
  const handleExecuteMerge = () => {
    const activeSlots = slots.filter(
      (s) => s.lessons.length > 0 || s.scheduledCards.length > 0 || s.teachers.length > 0
    );

    if (activeSlots.length === 0) {
      alert('Нэгтгэх менежерийн өгөгдөл олдсонгүй. Файл оруулна уу эсвэл системээс татна уу.');
      return;
    }

    // 1. Merge Teachers
    const mergedTeachersMap = new Map<string, Teacher>(teachers.map((t) => [t.id, t]));
    for (const slot of activeSlots) {
      for (const t of slot.teachers) {
        if (!mergedTeachersMap.has(t.id)) {
          mergedTeachersMap.set(t.id, t);
        } else {
          // Merge metadata
          const existing = mergedTeachersMap.get(t.id)!;
          mergedTeachersMap.set(t.id, {
            ...existing,
            managerId: slot.managerId || existing.managerId,
          });
        }
      }
    }

    // 2. Merge Classes
    const mergedClassesMap = new Map<string, ClassGroup>(classes.map((c) => [c.id, c]));
    for (const slot of activeSlots) {
      for (const c of slot.classes) {
        if (!mergedClassesMap.has(c.id)) {
          mergedClassesMap.set(c.id, c);
        }
      }
    }

    // 3. Merge Lessons
    const mergedLessonsMap = new Map<string, LessonContract>(lessons.map((l) => [l.id, l]));
    for (const slot of activeSlots) {
      for (const l of slot.lessons) {
        mergedLessonsMap.set(l.id, l);
      }
    }

    // 4. Хуваарийн картуудыг нэгтгэх: эхлээд бүгдийг цуглуулаад, дараа нь давхцлын шийдвэрийг хэрэгжүүлнэ
    const cardMap = new Map<string, ScheduledCard>();

    // Нэгтгэлд ороогүй багш нарын системийн картууд хэвээр
    const activeSlotTeacherIds = new Set(activeSlots.flatMap((s) => s.teachers.map((t) => t.id)));
    for (const card of scheduledCards) {
      if (!activeSlotTeacherIds.has(card.teacherId)) cardMap.set(card.id, card);
    }
    for (const slot of activeSlots) {
      for (const card of slot.scheduledCards) cardMap.set(card.id, card);
    }

    for (const conf of detectedConflicts) {
      const res = conflictResolutions[conf.id] || 'keep_existing';
      if (res === 'keep_existing') {
        cardMap.delete(conf.incomingCard.id);
      } else if (res === 'use_incoming') {
        cardMap.delete(conf.existingCard.id);
        cardMap.set(conf.incomingCard.id, conf.incomingCard);
      } else if (res === 'both_to_dock') {
        // Хоёуланг нь хуваариас авч тавиурт буцаана
        cardMap.delete(conf.incomingCard.id);
        cardMap.delete(conf.existingCard.id);
      }
    }

    onMergeComplete({
      teachers: Array.from(mergedTeachersMap.values()),
      classes: Array.from(mergedClassesMap.values()),
      lessons: Array.from(mergedLessonsMap.values()),
      scheduledCards: Array.from(cardMap.values()),
    });

    setMergeSuccess(true);
    setTimeout(() => {
      setMergeSuccess(false);
      onClose();
    }, 1200);
  };

  // Export My Manager Package
  const handleDownloadExportPackage = () => {
    const mgr = currentExportManager;

    // Filter teachers: either custom selected or all assigned to this manager
    const targetTeachers =
      exportSelectedTeacherIds.length > 0
        ? teachers.filter((t) => exportSelectedTeacherIds.includes(t.id))
        : teachers.filter((t) => t.managerId === mgr.id);

    const targetTeacherIds = new Set(targetTeachers.map((t) => t.id));

    // Filter classes
    const targetClasses = classes.filter((c) => {
      if (mgr.assignedGrades && mgr.assignedGrades.length > 0) {
        return mgr.assignedGrades.includes(c.grade);
      }
      return c.managerId === mgr.id;
    });
    const targetClassIds = new Set(targetClasses.map((c) => c.id));

    // Filter lessons
    const targetLessons = lessons.filter(
      (l) => targetTeacherIds.has(l.teacherId) || targetClassIds.has(l.classId)
    );
    const contractIds = new Set(targetLessons.map((l) => l.id));

    // Filter cards
    const targetCards = exportIncludeCards
      ? scheduledCards.filter(
          (c) =>
            targetTeacherIds.has(c.teacherId) ||
            targetClassIds.has(c.classId) ||
            contractIds.has(c.contractId)
        )
      : [];

    const pkg: ManagerExportPackage = {
      format: 'school_manager_package',
      version: '2027.2',
      exportedAt: new Date().toISOString(),
      manager: mgr,
      schoolName: settings.schoolName || 'Сургууль',
      teachers: targetTeachers,
      classes: targetClasses,
      subjects,
      classrooms,
      lessons: targetLessons,
      scheduledCards: targetCards,
      notes: exportNotes || `${mgr.name} менежерийн хариуцсан цаг, хуваарилалтын багц`,
    };

    const jsonStr = JSON.stringify(pkg, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = (mgr.title || mgr.name).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\u0400-\u04FF]/g, '');
    a.download = `${safeTitle}_Хуваарь_2027.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Toggle teacher assignment in settings tab
  const handleAssignTeacherToManager = (teacherId: string, managerId: string) => {
    const updated = teachers.map((t) => (t.id === teacherId ? { ...t, managerId } : t));
    onUpdateTeachers(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 select-none">
      <div className="bg-slate-50 rounded-lg shadow-2xl border border-slate-300 w-full max-w-6xl overflow-hidden flex flex-col h-[90vh]">
        {/* Header - Classic aSc Windows Title Bar */}
        <div className="dialog-titlebar text-white px-4 py-2.5 flex items-center justify-between select-none shrink-0">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-indigo-200" />
            <span className="font-bold text-sm tracking-wide">
              Менежерүүдийн цаг, хуваарь солилцох & Нэгтгэх төв (Multi-Manager Collaboration)
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-red-600 rounded px-2 py-0.5 text-xs font-bold transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation & Status Bar */}
        <div className="bg-[#f3f1ec] px-4 py-1.5 border-b border-slate-300 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('merge')}
              className={`px-3 py-1.5 rounded font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'merge'
                  ? 'bg-white text-indigo-800 shadow-xs border border-slate-300'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>1. Менежерүүдийн хуваарь нэгтгэх (Merge)</span>
              {detectedConflicts.length > 0 && (
                <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px] font-bold">
                  {detectedConflicts.length} давхцал
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('export')}
              className={`px-3 py-1.5 rounded font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'export'
                  ? 'bg-white text-indigo-800 shadow-xs border border-slate-300'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>2. Миний багцыг экспортлох / татах</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-1.5 rounded font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-white text-indigo-800 shadow-xs border border-slate-300'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Settings className="w-4 h-4 text-slate-600" />
              <span>3. Менежерүүдийн тохиргоо ({managers.length})</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-500 font-medium">
            1 сургуулийн 2-3 менежер тусдаа хуваарь хийгээд энд нэгтгэнэ
          </div>
        </div>

        {/* TAB 1: MERGE (ХУВААРЬ НЭГТГЭХ) */}
        {activeTab === 'merge' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f3f1ec]">
            {/* Guide Banner with Quick Actions */}
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-950 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Хуваарь нэгтгэх зарчим:</strong> 3 менежер (Бага, Дунд, Ахлах анги эсвэл Ээлж хариуцсан) өөрийн хариуцсан багш нарынхаа цаг хуваарилалт, хичээлийн картуудаа оруулна. Нэгтгэгч менежер доорх 3 хайрцагт файлуудыг нь оруулахад багшийн давхцал, танхимын давхцлыг автоматаар шалгаж, нэгтгэн үндсэн хуваарь болгоно.
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handlePullAllFromSystem}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold transition flex items-center gap-1.5 text-xs shadow-xs cursor-pointer"
                  title="Одоогийн систем дэх 3 менежерийн өгөгдлийг хайрцгуудад автоматаар татах"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>3 хайрцгийг системээс татах</span>
                </button>
                <button
                  type="button"
                  onClick={() => slots.forEach((s) => handleClearSlot(s.managerId))}
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded font-semibold border border-slate-300 transition text-xs cursor-pointer"
                  title="Бүх хайрцгийг цэвэрлэх"
                >
                  Цэвэрлэх
                </button>
              </div>
            </div>

            {/* 3 Manager Slots Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {slots.map((slot, sIdx) => {
                const mgrMeta = managers.find((m) => m.id === slot.managerId) || {
                  id: slot.managerId,
                  name: slot.managerName || `${sIdx + 1}-р менежер`,
                  color: '#2563eb',
                  title: `${sIdx + 1}-р менежер`,
                };
                const hasData = slot.lessons.length > 0 || slot.scheduledCards.length > 0;

                return (
                  <div
                    key={slot.managerId}
                    className="bg-white rounded-lg border border-slate-300 shadow-xs overflow-hidden flex flex-col"
                  >
                    {/* Slot Header */}
                    <div
                      className="px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between"
                      style={{ borderTop: `4px solid ${mgrMeta.color}` }}
                    >
                      <div>
                        <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: mgrMeta.color }}
                          />
                          <span>{slot.managerName || mgrMeta.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[200px]">
                          {mgrMeta.title}
                        </div>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          hasData
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        {hasData ? 'Өгөгдөл бэлэн' : 'Хүлээгдэж байна'}
                      </span>
                    </div>

                    {/* Slot Content */}
                    <div className="p-3.5 flex-1 space-y-3 text-xs">
                      {hasData ? (
                        <div className="space-y-2 bg-slate-50 p-2.5 rounded border border-slate-200">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-500">Эх сурвалж:</span>
                            <span className="font-bold text-slate-700 truncate max-w-[150px]">
                              {slot.fileName || 'Файл'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-500">Багш нар:</span>
                            <span className="font-bold text-blue-700">{slot.teachers.length} багш</span>
                          </div>
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-500">Цагийн хуваарилалт:</span>
                            <span className="font-bold text-emerald-700">{slot.lessons.length} хичээл</span>
                          </div>
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-500">Тавигдсан картууд:</span>
                            <span className="font-bold text-purple-700">{slot.scheduledCards.length} карт</span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 border-2 border-dashed border-slate-200 rounded-lg text-center text-slate-400">
                          <Upload className="w-6 h-6 mx-auto mb-1.5 text-slate-300" />
                          <p className="text-[11px]">Файл сонгох эсвэл системээс татаж оруулна уу</p>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="space-y-1.5 pt-1">
                        <input
                          type="file"
                          accept=".json"
                          ref={(el) => {
                            fileInputRefs.current[slot.managerId] = el;
                          }}
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(slot.managerId, file);
                          }}
                        />

                        <button
                          type="button"
                          onClick={() => fileInputRefs.current[slot.managerId]?.click()}
                          className="w-full py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded border border-indigo-200 transition flex items-center justify-center gap-1.5 text-[11px] cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Файл хуулах (.json)</span>
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handlePullSystemData(slot.managerId)}
                            className="flex-1 py-1 px-2 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded border border-slate-300 transition text-[10px] cursor-pointer"
                            title="Одоогийн систем дэх багш нарын өгөгдлийг энэ менежерт татах"
                          >
                            Системээс татах
                          </button>
                          {hasData && (
                            <button
                              type="button"
                              onClick={() => handleClearSlot(slot.managerId)}
                              className="py-1 px-2 text-rose-600 hover:bg-rose-50 rounded border border-slate-300 text-[10px] cursor-pointer font-semibold"
                              title="Цэвэрлэх"
                            >
                              Цэвэрлэх
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Conflict Detection Section */}
            <div className="bg-white rounded-lg border border-slate-300 p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
                  <h4 className="font-bold text-slate-800 text-xs">
                    Менежерүүдийн хоорондох давхцал шалгалт (Conflict Pre-check):
                  </h4>
                </div>

                {detectedConflicts.length === 0 ? (
                  <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded font-bold text-xs flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Давхцалгүй (0 мөргөлдөөн)</span>
                  </span>
                ) : (
                  <span className="text-rose-700 bg-rose-50 border border-rose-300 px-2.5 py-0.5 rounded font-bold text-xs flex items-center gap-1 animate-pulse">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{detectedConflicts.length} давхцал илэрлээ!</span>
                  </span>
                )}
              </div>

              {detectedConflicts.length === 0 ? (
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded text-emerald-900 text-xs leading-relaxed flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Оруулсан менежерүүдийн багш, танхим, анги хооронд цагийн зөрчил илрээгүй тул бүх өгөгдөл найдвартай шууд нэгтгэгдэхэд бэлэн байна.
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-slate-600 text-xs">
                    Олон менежер нэг дундын багш эсвэл танхимыг ижил цагт зэрэг оноосон байна. Давхцал тус бүрийг хэрхэн шийдвэрлэхийг сонгоно уу:
                  </p>
                  <div className="max-h-60 overflow-y-auto border border-slate-200 rounded divide-y divide-slate-100 text-xs">
                    {detectedConflicts.map((conf) => {
                      const res = conflictResolutions[conf.id] || 'keep_existing';
                      const sub1 = subjects.find((s) => s.id === conf.existingCard.subjectId)?.name || 'Хичээл';
                      const sub2 = subjects.find((s) => s.id === conf.incomingCard.subjectId)?.name || 'Хичээл';

                      return (
                        <div key={conf.id} className="p-3 bg-rose-50/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <div className="font-bold text-rose-950 flex items-center gap-2">
                              <span className="px-1.5 py-0.5 bg-rose-200 text-rose-800 rounded text-[10px]">
                                {conf.type === 'teacher_clash' ? 'Багшийн давхцал' : conf.type === 'class_clash' ? 'Ангийн давхцал' : 'Танхимын давхцал'}
                              </span>
                              <span>{conf.entityName}</span>
                              <span className="text-slate-500 font-mono text-[11px]">
                                ({settings.dayNames[conf.dayIndex]}, {conf.periodIndex + 1}-р цаг)
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600">
                              Нэгтгэлд: <strong>{sub1}</strong> ⚡ <strong>{conf.incomingManagerName}</strong> менежерийн <strong>{sub2}</strong> хоёр мөргөлдөж байна.
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[11px] font-semibold text-slate-600">Шийдэл:</span>
                            <select
                              value={res}
                              onChange={(e) =>
                                setConflictResolutions((prev) => ({
                                  ...prev,
                                  [conf.id]: e.target.value as any,
                                }))
                              }
                              className="px-2 py-1 border border-slate-300 rounded font-bold text-indigo-900 bg-white text-xs"
                            >
                              <option value="keep_existing">Өмнөх хуваарийг хэвээр үлдээх</option>
                              <option value="use_incoming">{conf.incomingManagerName}-ийнхээр солих</option>
                              <option value="both_to_dock">Картын самбарт (Dock) шилжүүлэх</option>
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Merge Action Summary Card */}
            <div className="bg-indigo-900 text-white rounded-lg p-4 flex flex-col md:flex-row items-center justify-between gap-3 shadow-md">
              <div className="space-y-1">
                <h4 className="font-bold text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Бүх менежерүүдийн хуваарийг нэгтгэн Сургуулийн үндсэн хуваарь болгох</span>
                </h4>
                <p className="text-indigo-200 text-xs">
                  Нэгтгэсний дараа сургуулийн үндсэн хуваарийн дэлгэц дээр бүх менежерийн багш нар, ангиуд, цагууд нэг дор харагдах болно.
                </p>
              </div>

              <button
                type="button"
                onClick={handleExecuteMerge}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded font-bold transition shadow cursor-pointer text-xs flex items-center gap-2 shrink-0"
              >
                {mergeSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-white animate-bounce" />
                    <span>Амжилттай нэгтгэлээ!</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Нэгтгэн баталгаажуулах</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: EXPORT MY PACKAGE (МЕНЕЖЕРИЙН БАГЦ ТАТАХ) */}
        {activeTab === 'export' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f3f1ec]">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-950 flex items-start gap-2.5">
              <Download className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>Экспорт хийх заавар:</strong> Та сургуулийн аль сургалтын менежер вэ гэдгээ сонгоод, өөрийн оруулсан багш нарын цаг хуваарилалт, хичээлийн картуудаа <strong>.json</strong> файл болгон татаж авна. Энэхүү файлыг нэгтгэгч менежертээ өгөх буюу илгээнэ.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column: Choose Manager Profile & Scope */}
              <div className="bg-white rounded-lg border border-slate-300 p-4 shadow-xs space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-800 mb-1.5">
                    1. Та аль менежер вэ? (Менежерийн профайл сонгох):
                  </label>
                  <select
                    value={exportManagerId}
                    onChange={(e) => {
                      const newId = e.target.value;
                      setExportManagerId(newId);
                      // Pre-select teachers of that manager
                      const assigned = teachers.filter((t) => t.managerId === newId).map((t) => t.id);
                      setExportSelectedTeacherIds(assigned);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded font-bold text-indigo-900 bg-white text-xs"
                  >
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} — {m.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-bold text-slate-800">
                      2. Хариуцсан багш нарыг сонгох:
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setExportSelectedTeacherIds(
                            teachers.filter((t) => t.managerId === exportManagerId).map((t) => t.id)
                          )
                        }
                        className="text-[10px] text-indigo-700 hover:underline font-semibold"
                      >
                        Миний багш нар
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setExportSelectedTeacherIds(teachers.map((t) => t.id))}
                        className="text-[10px] text-blue-700 hover:underline font-semibold"
                      >
                        Бүгд ({teachers.length})
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setExportSelectedTeacherIds([])}
                        className="text-[10px] text-rose-600 hover:underline font-semibold"
                      >
                        Цэвэрлэх
                      </button>
                    </div>
                  </div>

                  <div className="max-h-52 overflow-y-auto border border-slate-200 rounded p-1.5 divide-y divide-slate-100 bg-slate-50">
                    {teachers.map((t) => {
                      const checked =
                        exportSelectedTeacherIds.length > 0
                          ? exportSelectedTeacherIds.includes(t.id)
                          : t.managerId === exportManagerId;
                      const mgrMeta = managers.find((m) => m.id === t.managerId);

                      return (
                        <label
                          key={t.id}
                          className="flex items-center gap-2 py-1 px-1.5 hover:bg-white cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const list =
                                exportSelectedTeacherIds.length > 0
                                  ? exportSelectedTeacherIds
                                  : teachers.filter((x) => x.managerId === exportManagerId).map((x) => x.id);
                              const next = list.includes(t.id)
                                ? list.filter((id) => id !== t.id)
                                : [...list, t.id];
                              setExportSelectedTeacherIds(next);
                            }}
                          />
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: t.color }}
                          />
                          <span className="font-semibold text-slate-800">{t.name}</span>
                          {mgrMeta && (
                            <span
                              className="ml-auto text-[9px] px-1.5 py-0.2 rounded font-semibold text-white"
                              style={{ backgroundColor: mgrMeta.color }}
                            >
                              {mgrMeta.title.split('(')[0]}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={exportIncludeCards}
                      onChange={(e) => setExportIncludeCards(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600"
                    />
                    <span>Эдгээр багш нарын байршуулсан хуваарийн картуудыг хамт оруулах</span>
                  </label>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Нэмэлт тэмдэглэл / мессеж:
                    </label>
                    <input
                      type="text"
                      value={exportNotes}
                      onChange={(e) => setExportNotes(e.target.value)}
                      placeholder="Жишээ: 1-р ээлжийн бага ангийн багш нарын цаг бүрэн дууссан хувилбар"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Export Package Preview & Download */}
              <div className="bg-white rounded-lg border border-slate-300 p-4 shadow-xs flex flex-col justify-between text-xs space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <FileCheck className="w-4 h-4 text-emerald-600" />
                    <h4 className="font-bold text-slate-800">
                      Экспортлогдох багцын мэдээлэл:
                    </h4>
                  </div>

                  <div className="bg-emerald-50/60 p-3.5 rounded-lg border border-emerald-200 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Менежер:</span>
                      <span className="font-bold text-emerald-950">{currentExportManager.name} ({currentExportManager.title})</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Сонгосон багш нар:</span>
                      <span className="font-bold text-blue-700">
                        {exportSelectedTeacherIds.length > 0
                          ? exportSelectedTeacherIds.length
                          : teachers.filter((t) => t.managerId === exportManagerId).length}{' '}
                        багш
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Хичээлийн цагийн хуваарилалт:</span>
                      <span className="font-bold text-purple-700">
                        {
                          lessons.filter((l) =>
                            (exportSelectedTeacherIds.length > 0
                              ? exportSelectedTeacherIds
                              : teachers.filter((t) => t.managerId === exportManagerId).map((t) => t.id)
                            ).includes(l.teacherId)
                          ).length
                        }{' '}
                        гэрээ/заалт
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Тавигдсан картууд:</span>
                      <span className="font-bold text-indigo-700">
                        {exportIncludeCards
                          ? scheduledCards.filter((c) =>
                              (exportSelectedTeacherIds.length > 0
                                ? exportSelectedTeacherIds
                                : teachers.filter((t) => t.managerId === exportManagerId).map((t) => t.id)
                              ).includes(c.teacherId)
                            ).length
                          : 0}{' '}
                        карт
                      </span>
                    </div>
                  </div>

                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Татаж авсан файлыг сургуулийн бусад менежерүүд эсвэл нэгтгэгч менежер шууд өөрийн хуваарь дээрээ "Менежерүүдийн хуваарь нэгтгэх" табаас сонгон хуулж нэгтгэх боломжтой.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadExportPackage}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow transition flex items-center justify-center gap-2 cursor-pointer text-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Менежерийн файлыг татах (.json)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: MANAGER SETTINGS & TEACHER ASSIGNMENTS */}
        {activeTab === 'settings' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f3f1ec] text-xs">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-950 flex items-start gap-2.5">
              <Users className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong>Сургуулийн сургалтын менежерүүдийн хуваарилалт:</strong> Энд 2-3 менежерийн нэр, хариуцах түвшин (Бага, Дунд, Ахлах анги) болон аль менежер ямар багш нарын цаг хуваарилалтыг хариуцахыг заана.
              </div>
            </div>

            {/* Managers Profiles Configuration */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {managers.map((mgr, index) => {
                const assignedTeachersCount = teachers.filter((t) => t.managerId === mgr.id).length;
                return (
                  <div key={mgr.id} className="bg-white rounded-lg border border-slate-300 p-3.5 shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: mgr.color }}
                        />
                        <span>{index + 1}-р менежер</span>
                      </span>
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold text-slate-600">
                        {assignedTeachersCount} багш хариуцсан
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Нэр:</label>
                        <input
                          type="text"
                          value={mgr.name}
                          onChange={(e) => {
                            const updated = managers.map((m) =>
                              m.id === mgr.id ? { ...m, name: e.target.value } : m
                            );
                            onUpdateManagers(updated);
                          }}
                          className="w-full px-2.5 py-1 border border-slate-300 rounded font-bold text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Албан тушаал / Хариуцах чиглэл:</label>
                        <input
                          type="text"
                          value={mgr.title}
                          onChange={(e) => {
                            const updated = managers.map((m) =>
                              m.id === mgr.id ? { ...m, title: e.target.value } : m
                            );
                            onUpdateManagers(updated);
                          }}
                          className="w-full px-2.5 py-1 border border-slate-300 rounded text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Таних өнгө:</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={mgr.color}
                            onChange={(e) => {
                              const updated = managers.map((m) =>
                                m.id === mgr.id ? { ...m, color: e.target.value } : m
                              );
                              onUpdateManagers(updated);
                            }}
                            className="w-8 h-8 rounded border border-slate-300 p-0.5 cursor-pointer"
                          />
                          <span className="text-[11px] text-slate-500 font-mono">{mgr.color}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Teacher Assignment Table */}
            <div className="bg-white rounded-lg border border-slate-300 p-4 shadow-xs space-y-3">
              <h4 className="font-bold text-slate-800 text-xs">
                Багш нарыг хариуцах менежерт хуваарилах (Teacher Assignment Table):
              </h4>

              <div className="max-h-64 overflow-y-auto border border-slate-200 rounded divide-y divide-slate-100">
                {teachers.map((t) => (
                  <div key={t.id} className="py-2 px-3 flex items-center justify-between hover:bg-slate-50">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: t.color }}
                      />
                      <span className="font-bold text-slate-800">{t.name}</span>
                      <span className="text-slate-400 font-mono text-[10px]">({t.shortName})</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-[11px]">Хариуцах менежер:</span>
                      <select
                        value={t.managerId || ''}
                        onChange={(e) => handleAssignTeacherToManager(t.id, e.target.value)}
                        className="px-2.5 py-1 border border-slate-300 rounded font-semibold text-xs bg-white text-indigo-900"
                      >
                        <option value="">(Оноогоогүй)</option>
                        {managers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.title})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="bg-slate-200/90 px-4 py-2.5 border-t border-slate-300 flex justify-between items-center text-xs shrink-0">
          <span className="text-slate-600 font-medium">
            💡 Менежерүүдийн хооронд хуваарийн өгөгдлийг найдвартай солилцож, нэгдсэн нэг хуваарь болгон нэгтгэнэ.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-white border border-slate-300 rounded text-slate-700 font-bold hover:bg-slate-100 shadow-xs cursor-pointer"
            >
              Хаах
            </button>
            {activeTab === 'merge' && (
              <button
                onClick={handleExecuteMerge}
                className="px-5 py-1.5 bg-emerald-600 text-white rounded font-bold hover:bg-emerald-700 shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Нэгтгэн хадгалах</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
