import React, { useState } from 'react';
import {
  Subject,
  Teacher,
  ClassGroup,
  Classroom,
  Building,
  LessonContract,
  SchoolSettings,
} from '../types/timetable';
import {
  BookOpen,
  Users,
  DoorOpen,
  GraduationCap,
  Plus,
  Edit2,
  Trash2,
  Clock,
  Sliders,
  ArrowUp,
  ArrowDown,
  Copy,
  Check,
  HelpCircle,
} from 'lucide-react';
import { TimeOffMatrixDialog } from './TimeOffMatrixDialog';

export type DataTab = 'subjects' | 'classes' | 'classrooms' | 'teachers';

interface DataDialogProps {
  initialTab?: DataTab;
  isOpen: boolean;
  onClose: () => void;

  subjects: Subject[];
  teachers: Teacher[];
  classes: ClassGroup[];
  classrooms: Classroom[];
  buildings: Building[];
  lessons: LessonContract[];
  settings: SchoolSettings;

  onUpdateSubjects: (subjects: Subject[]) => void;
  onUpdateTeachers: (teachers: Teacher[]) => void;
  onUpdateClasses: (classes: ClassGroup[]) => void;
  onUpdateClassrooms: (classrooms: Classroom[]) => void;
  onUpdateLessons?: (lessons: LessonContract[]) => void;

  onOpenLessonsForSubject?: (subjectId: string) => void;
  onOpenLessonsForTeacher?: (teacherId: string) => void;
  onOpenLessonsForClass?: (classId: string) => void;
  onOpenConstraints?: () => void;
  onOpenExcelImport?: () => void;
}

export const DataDialog: React.FC<DataDialogProps> = ({
  initialTab = 'subjects',
  isOpen,
  onClose,
  subjects,
  teachers,
  classes,
  classrooms,
  buildings,
  lessons,
  settings,
  onUpdateSubjects,
  onUpdateTeachers,
  onUpdateClasses,
  onUpdateClassrooms,
  onUpdateLessons,
  onOpenLessonsForSubject,
  onOpenLessonsForTeacher,
  onOpenLessonsForClass,
  onOpenConstraints,
  onOpenExcelImport,
}) => {
  const [activeTab, setActiveTab] = useState<DataTab>(initialTab);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [helpTab, setHelpTab] = useState<'general' | 'subjects' | 'classes' | 'classrooms' | 'teachers'>('general');

  // Subjects tab state
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(subjects[0]?.id || '');
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [isNewSubject, setIsNewSubject] = useState(false);
  const [timeOffSubject, setTimeOffSubject] = useState<Subject | null>(null);

  // Teachers tab state
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(teachers[0]?.id || '');
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [isNewTeacher, setIsNewTeacher] = useState(false);
  const [timeOffTeacher, setTimeOffTeacher] = useState<Teacher | null>(null);
  const [copyTeacherModalOpen, setCopyTeacherModalOpen] = useState(false);
  const [copyTeacherSourceId, setCopyTeacherSourceId] = useState<string>(teachers[0]?.id || '');
  const [copyTeacherTargetIds, setCopyTeacherTargetIds] = useState<string[]>([]);

  // Classes tab state
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || '');
  const [editingClass, setEditingClass] = useState<ClassGroup | null>(null);
  const [isNewClass, setIsNewClass] = useState(false);
  const [timeOffClass, setTimeOffClass] = useState<ClassGroup | null>(null);
  const [subgroupClass, setSubgroupClass] = useState<ClassGroup | null>(null);
  const [newSubgroupName, setNewSubgroupName] = useState<string>('');
  const [copyClassModalOpen, setCopyClassModalOpen] = useState(false);
  const [copyClassSourceId, setCopyClassSourceId] = useState<string>(classes[0]?.id || '');
  const [copyClassTargetIds, setCopyClassTargetIds] = useState<string[]>([]);
  const [copyClassCopyLessons, setCopyClassCopyLessons] = useState(true);
  const [copyClassCopyTimeOff, setCopyClassCopyTimeOff] = useState(true);

  // Classrooms tab state
  const [selectedRoomId, setSelectedRoomId] = useState<string>(classrooms[0]?.id || '');
  const [editingRoom, setEditingRoom] = useState<Classroom | null>(null);
  const [isNewRoom, setIsNewRoom] = useState(false);
  const [timeOffRoom, setTimeOffRoom] = useState<Classroom | null>(null);

  const handleCopyClassSettings = () => {
    if (!copyClassSourceId || copyTargetClassIdsLength === 0) {
      alert('Эх анги болон зорилтот ангиудыг сонгоно уу.');
      return;
    }
    const sourceClass = classes.find((c) => c.id === copyClassSourceId);
    if (!sourceClass) return;

    // 1. Copy Time Off if selected
    if (copyClassCopyTimeOff && sourceClass.timeOff) {
      onUpdateClasses(
        classes.map((c) =>
          copyClassTargetIds.includes(c.id) ? { ...c, timeOff: { ...sourceClass.timeOff } } : c
        )
      );
    }

    // 2. Copy Lesson Contracts if selected
    if (copyClassCopyLessons && onUpdateLessons) {
      const sourceLessons = lessons.filter((l) => l.classId === copyClassSourceId);
      if (sourceLessons.length > 0) {
        const newContracts: LessonContract[] = [];
        copyClassTargetIds.forEach((targetId) => {
          sourceLessons.forEach((src) => {
            newContracts.push({
              ...src,
              id: `l_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              classId: targetId,
              jointClassIds: [],
            });
          });
        });
        onUpdateLessons([...lessons, ...newContracts]);
      }
    }

    setCopyClassModalOpen(false);
    alert('Сонгосон ангиудын тохиргоог амжилттай хууллаа!');
  };

  const copyTargetClassIdsLength = copyClassTargetIds.length;

  const handleCopyTeacherSettings = () => {
    if (!copyTeacherSourceId || copyTeacherTargetIds.length === 0) {
      alert('Эх багш болон зорилтот багш нарыг сонгоно уу.');
      return;
    }
    const sourceTeacher = teachers.find((t) => t.id === copyTeacherSourceId);
    if (!sourceTeacher || !sourceTeacher.timeOff) return;

    onUpdateTeachers(
      teachers.map((t) =>
        copyTeacherTargetIds.includes(t.id) ? { ...t, timeOff: { ...sourceTeacher.timeOff } } : t
      )
    );
    setCopyTeacherModalOpen(false);
    alert('Багш нарын цагийн менежментийг амжилттай хууллаа!');
  };

  const handleBatchCopyTimeOff = (
    type: 'classes' | 'teachers',
    ids: string[],
    matrix: Record<string, 'allowed' | 'forbidden' | 'discouraged'>
  ) => {
    if (type === 'classes') {
      onUpdateClasses(
        classes.map((c) => (ids.includes(c.id) ? { ...c, timeOff: { ...matrix } } : c))
      );
    } else {
      onUpdateTeachers(
        teachers.map((t) => (ids.includes(t.id) ? { ...t, timeOff: { ...matrix } } : t))
      );
    }
  };

  if (!isOpen) return null;

  // Helpers
  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);
  const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId);
  const selectedClass = classes.find((c) => c.id === selectedClassId);
  const selectedRoom = classrooms.find((r) => r.id === selectedRoomId);

  const getSubjectCount = (subId: string) => {
    return lessons.filter((l) => l.subjectId === subId).reduce((sum, l) => sum + l.totalPeriods, 0);
  };
  const getTeacherCount = (teachId: string) => {
    return lessons.filter((l) => l.teacherId === teachId).reduce((sum, l) => sum + l.totalPeriods, 0);
  };
  const getClassCount = (clsId: string) => {
    return lessons.filter((l) => l.classId === clsId).reduce((sum, l) => sum + l.totalPeriods, 0);
  };

  // --- Handlers: Subjects ---
  const handleCreateSubject = () => {
    setIsNewSubject(true);
    setEditingSubject({
      id: `sub_${Date.now()}`,
      name: '',
      shortName: '',
      color: '#3b82f6',
      timeOff: {},
      distributionRule: 'ideal',
      homework: false,
    });
  };
  const handleDeleteSubject = (id: string) => {
    if (confirm('Та энэ хичээлийг устгахдаа итгэлтэй байна уу? Үүнд хамаарах хичээлийн хуваарь мөн цуцлагдана.')) {
      const next = subjects.filter((s) => s.id !== id);
      onUpdateSubjects(next);
      if (selectedSubjectId === id) setSelectedSubjectId(next[0]?.id || '');
    }
  };
  const handleSaveSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubject || !editingSubject.name.trim()) return;
    if (isNewSubject) {
      onUpdateSubjects([...subjects, editingSubject]);
      setSelectedSubjectId(editingSubject.id);
    } else {
      onUpdateSubjects(subjects.map((s) => (s.id === editingSubject.id ? editingSubject : s)));
    }
    setEditingSubject(null);
  };
  const moveSubject = (direction: 'up' | 'down') => {
    const idx = subjects.findIndex((s) => s.id === selectedSubjectId);
    if (idx < 0) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= subjects.length) return;
    const list = [...subjects];
    const temp = list[idx];
    list[idx] = list[targetIdx];
    list[targetIdx] = temp;
    onUpdateSubjects(list);
  };

  // --- Handlers: Teachers ---
  const handleCreateTeacher = () => {
    setIsNewTeacher(true);
    setEditingTeacher({
      id: `teach_${Date.now()}`,
      name: '',
      shortName: '',
      color: '#6366f1',
      timeOff: {},
      maxPeriodsPerDay: 5,
      maxGapsPerDay: 1,
    });
  };
  const handleDeleteTeacher = (id: string) => {
    if (confirm('Та энэ багшийг устгахдаа итгэлтэй байна уу?')) {
      const next = teachers.filter((t) => t.id !== id);
      onUpdateTeachers(next);
      if (selectedTeacherId === id) setSelectedTeacherId(next[0]?.id || '');
    }
  };
  const handleSaveTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher || !editingTeacher.name.trim()) return;
    if (isNewTeacher) {
      onUpdateTeachers([...teachers, editingTeacher]);
      setSelectedTeacherId(editingTeacher.id);
    } else {
      onUpdateTeachers(teachers.map((t) => (t.id === editingTeacher.id ? editingTeacher : t)));
    }
    setEditingTeacher(null);
  };
  const moveTeacher = (direction: 'up' | 'down') => {
    const idx = teachers.findIndex((t) => t.id === selectedTeacherId);
    if (idx < 0) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= teachers.length) return;
    const list = [...teachers];
    const temp = list[idx];
    list[idx] = list[targetIdx];
    list[targetIdx] = temp;
    onUpdateTeachers(list);
  };

  // --- Handlers: Classes ---
  const handleCreateClass = () => {
    setIsNewClass(true);
    setEditingClass({
      id: `cls_${Date.now()}`,
      name: '',
      shortName: '',
      grade: 1,
      color: '#f59e0b',
      shift: 1,
      buildingId: buildings[0]?.id || '',
      timeOff: {},
      maxPeriodsPerDay: 6,
    });
  };
  const handleDeleteClass = (id: string) => {
    if (confirm('Та энэ анги бүлгийг устгахдаа итгэлтэй байна уу?')) {
      const next = classes.filter((c) => c.id !== id);
      onUpdateClasses(next);
      if (selectedClassId === id) setSelectedClassId(next[0]?.id || '');
    }
  };
  const handleSaveClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass || !editingClass.name.trim()) return;
    if (isNewClass) {
      onUpdateClasses([...classes, editingClass]);
      setSelectedClassId(editingClass.id);
    } else {
      onUpdateClasses(classes.map((c) => (c.id === editingClass.id ? editingClass : c)));
    }
    setEditingClass(null);
  };
  const moveClass = (direction: 'up' | 'down') => {
    const idx = classes.findIndex((c) => c.id === selectedClassId);
    if (idx < 0) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= classes.length) return;
    const list = [...classes];
    const temp = list[idx];
    list[idx] = list[targetIdx];
    list[targetIdx] = temp;
    onUpdateClasses(list);
  };

  // --- Handlers: Classrooms ---
  const handleCreateRoom = () => {
    setIsNewRoom(true);
    setEditingRoom({
      id: `room_${Date.now()}`,
      name: '',
      shortName: '',
      capacity: 35,
      buildingId: buildings[0]?.id || '',
      color: '#0d9488',
      timeOff: {},
      isShared: false,
    });
  };
  const handleDeleteRoom = (id: string) => {
    if (confirm('Та энэ анги танхимыг устгахдаа итгэлтэй байна уу?')) {
      const next = classrooms.filter((r) => r.id !== id);
      onUpdateClassrooms(next);
      if (selectedRoomId === id) setSelectedRoomId(next[0]?.id || '');
    }
  };
  const handleSaveRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom || !editingRoom.name.trim()) return;
    if (isNewRoom) {
      onUpdateClassrooms([...classrooms, editingRoom]);
      setSelectedRoomId(editingRoom.id);
    } else {
      onUpdateClassrooms(classrooms.map((r) => (r.id === editingRoom.id ? editingRoom : r)));
    }
    setEditingRoom(null);
  };
  const moveRoom = (direction: 'up' | 'down') => {
    const idx = classrooms.findIndex((r) => r.id === selectedRoomId);
    if (idx < 0) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= classrooms.length) return;
    const list = [...classrooms];
    const temp = list[idx];
    list[idx] = list[targetIdx];
    list[targetIdx] = temp;
    onUpdateClassrooms(list);
  };

  // Title bar metadata based on active tab
  const getHeaderInfo = () => {
    switch (activeTab) {
      case 'subjects':
        return {
          title: 'Хичээлүүд (Subjects)',
          icon: <BookOpen className="w-4 h-4 text-slate-300" />,
          helpText: 'Хичээл оруулах заавар: Нэр, товчлол, өнгө болон тухайн хичээлийн 7 хоногт орох нийт цагийг тохируулна.',
        };
      case 'classes':
        return {
          title: 'Анги бүлгүүд & Ээлжийн хуваарилалт (Classes)',
          icon: <Users className="w-4 h-4 text-slate-300" />,
          helpText: 'Анги бүлгүүдийн ээлж (1, 2, 3-р ээлж) болон хичээллэх байрыг сонгож тохируулна.',
        };
      case 'classrooms':
        return {
          title: 'Анги танхимууд & Байрны хуваарилалт (Classrooms)',
          icon: <DoorOpen className="w-4 h-4 text-slate-300" />,
          helpText: 'Анги танхим, лаборатори, өрөөнүүдийн суудал болон харьяалагдах хичээлийн байрыг бүртгэнэ.',
        };
      case 'teachers':
        return {
          title: 'Багш нар (Teachers)',
          icon: <GraduationCap className="w-4 h-4 text-slate-300" />,
          helpText: 'Багш нарын бүртгэл, чөлөөт цаг, өдөрт орох дээд цагийн хязгаарыг тохируулна.',
        };
    }
  };

  const headerInfo = getHeaderInfo();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-hidden select-none">
      <div className="bg-slate-50 rounded-lg shadow-2xl border border-slate-300 w-full max-w-4xl overflow-hidden flex flex-col h-[86vh] max-h-[680px]">
        {/* Clean slate dialog title bar */}
        <div className="bg-slate-800 text-white px-4 py-2 flex items-center justify-between select-none border-b border-slate-700">
          <div className="flex items-center gap-2">
            {headerInfo.icon}
            <span className="font-semibold text-sm text-slate-100">{headerInfo.title}</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white hover:bg-slate-700 rounded px-2 py-0.5 text-xs font-bold transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Main Dialog Body with Permanent Left Sidebar */}
        <div className="flex flex-1 overflow-hidden p-3 gap-3">
          {/* Left Navigation bar: Always visible on all 4 tabs! */}
          <div className="w-14 bg-slate-200/80 rounded border border-slate-300 flex flex-col items-center py-3 gap-4 shrink-0 select-none">
            {/* 1. Subjects button */}
            <button
              onClick={() => setActiveTab('subjects')}
              title="Хичээлүүд"
              className={`w-10 h-10 rounded flex items-center justify-center transition cursor-pointer ${
                activeTab === 'subjects'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-5 h-5" />
            </button>

            {/* 2. Classes button */}
            <button
              onClick={() => setActiveTab('classes')}
              title="Анги бүлгүүд"
              className={`w-10 h-10 rounded flex items-center justify-center transition cursor-pointer ${
                activeTab === 'classes'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Users className="w-5 h-5" />
            </button>

            {/* 3. Classrooms button */}
            <button
              onClick={() => setActiveTab('classrooms')}
              title="Анги танхим"
              className={`w-10 h-10 rounded flex items-center justify-center transition cursor-pointer ${
                activeTab === 'classrooms'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <DoorOpen className="w-5 h-5" />
            </button>

            {/* 4. Teachers button */}
            <button
              onClick={() => setActiveTab('teachers')}
              title="Багш нар"
              className={`w-10 h-10 rounded flex items-center justify-center transition cursor-pointer ${
                activeTab === 'teachers'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <GraduationCap className="w-5 h-5" />
            </button>
          </div>

          {/* TAB 1: SUBJECTS VIEW */}
          {activeTab === 'subjects' && (
            <>
              <div className="flex-1 flex flex-col border border-slate-300 rounded bg-white overflow-hidden shadow-inner">
                <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-300 text-xs font-semibold text-slate-700">
                  Хичээлийн жагсаалт (Enter subjects):
                </div>
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 sticky top-0 border-b border-slate-300 select-none shadow-xs">
                      <tr>
                        <th className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-700 text-left">Хичээлийн нэр</th>
                        <th className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-700 w-24 text-left">Товчлол</th>
                        <th className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-700 w-20 text-left">Цаг</th>
                        <th className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-700 w-32 text-left">Цагийн менежмент</th>
                        <th className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-700 w-28 text-left">Тархалт</th>
                        <th className="py-2 px-3 font-semibold text-slate-700 w-28 text-left">Гэрийн даалгавар</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {subjects.map((sub) => {
                        const isSelected = sub.id === selectedSubjectId;
                        const count = getSubjectCount(sub.id);
                        return (
                          <tr
                            key={sub.id}
                            onClick={() => setSelectedSubjectId(sub.id)}
                            onDoubleClick={() => {
                              setIsNewSubject(false);
                              setEditingSubject({ ...sub });
                            }}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-slate-800 text-white font-medium' : 'hover:bg-slate-100 text-slate-800'
                            }`}
                          >
                            <td className="py-1.5 px-3 border-r border-slate-200 text-left flex items-center gap-2">
                              <span
                                className="w-3.5 h-3.5 rounded-xs border shrink-0"
                                style={{ backgroundColor: sub.color, borderColor: isSelected ? '#ffffff' : '#94a3b8' }}
                              />
                              <span className="truncate">{sub.name}</span>
                            </td>
                            <td className="py-1.5 px-3 border-r border-slate-200 font-mono text-[11px] text-left">{sub.shortName}</td>
                            <td className="py-1.5 px-3 border-r border-slate-200 text-left font-medium">{count} цаг</td>
                            <td className="py-1.5 px-3 border-r border-slate-200 text-left">
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTimeOffSubject(sub);
                                }}
                                className={`inline-grid grid-cols-5 gap-[1px] p-[2px] rounded border hover:scale-105 transition cursor-pointer ${
                                  isSelected ? 'bg-slate-700 border-slate-600' : 'bg-slate-200 border-slate-300'
                                }`}
                                title="Цагийн менежмент тохируулах"
                              >
                                {Array.from({ length: 15 }).map((_, i) => (
                                  <div
                                    key={i}
                                    className={`w-1.5 h-1 rounded-[1px] ${
                                      sub.timeOff && Object.values(sub.timeOff)[i] === 'forbidden'
                                        ? 'bg-rose-500'
                                        : 'bg-emerald-500'
                                    }`}
                                  />
                                ))}
                              </div>
                            </td>
                            <td className="py-1.5 px-3 border-r border-slate-200 text-left text-[11px]">
                              {sub.distributionRule === 'ideal' ? 'Идеал' : sub.distributionRule === 'consecutive_allowed' ? 'Дараалсан' : 'Энгийн'}
                            </td>
                            <td className="py-1.5 px-3 text-left text-[11px]">{sub.homework ? 'Тийм' : '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Action buttons */}
              <div className="w-32 flex flex-col gap-2 shrink-0 select-none">
                <button
                  onClick={handleCreateSubject}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-slate-600" />
                  <span>Шинэ</span>
                </button>
                <button
                  disabled={!selectedSubject}
                  onClick={() => {
                    if (selectedSubject) {
                      setIsNewSubject(false);
                      setEditingSubject({ ...selectedSubject });
                    }
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-xs transition disabled:opacity-40 cursor-pointer"
                >
                  <Edit2 className="w-4 h-4 text-slate-600" />
                  <span>Засварлах</span>
                </button>
                <button
                  disabled={!selectedSubject}
                  onClick={() => selectedSubject && handleDeleteSubject(selectedSubject.id)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-xs transition disabled:opacity-40 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-slate-600" />
                  <span>Устгах</span>
                </button>

                <div className="h-2"></div>

                <button
                  disabled={!selectedSubject}
                  onClick={() => selectedSubject && onOpenLessonsForSubject?.(selectedSubject.id)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-xs transition disabled:opacity-40 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 text-slate-600" />
                  <span>Хичээл</span>
                </button>

                <button
                  disabled={!selectedSubject}
                  onClick={() => selectedSubject && setTimeOffSubject(selectedSubject)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-xs transition disabled:opacity-40 cursor-pointer"
                >
                  <Clock className="w-4 h-4 text-slate-600" />
                  <span>Цагийн менежмент</span>
                </button>

                <div className="flex-1"></div>

                <div className="flex justify-center gap-2 py-1">
                  <button
                    onClick={() => moveSubject('up')}
                    className="p-1.5 bg-white border border-slate-300 rounded hover:bg-slate-100 shadow-xs"
                    title="Дээш зөөх"
                  >
                    <ArrowUp className="w-4 h-4 text-slate-600" />
                  </button>
                  <button
                    onClick={() => moveSubject('down')}
                    className="p-1.5 bg-white border border-slate-300 rounded hover:bg-slate-100 shadow-xs"
                    title="Доош зөөх"
                  >
                    <ArrowDown className="w-4 h-4 text-slate-600" />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: CLASSES VIEW */}
          {activeTab === 'classes' && (
            <>
              <div className="flex-1 flex flex-col border border-slate-300 rounded bg-white overflow-hidden shadow-inner">
                <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-300 text-xs font-semibold text-slate-700">
                  Ангиудын жагсаалт ({classes.length}):
                </div>
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 sticky top-0 border-b border-slate-300 select-none shadow-xs">
                      <tr>
                        <th className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-700 text-left">Анги</th>
                        <th className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-700 w-24 text-left">Ээлж</th>
                        <th className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-700 w-28 text-left">Байр</th>
                        <th className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-700 w-20 text-left">Цаг</th>
                        <th className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-700 w-36 text-left">Дэд бүлгүүд</th>
                        <th className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-700 w-32 text-left">Цагийн менежмент</th>
                        <th className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-700 w-32 text-left">Ангийн багш</th>
                        <th className="py-2 px-3 font-semibold text-slate-700 w-28 text-left">Үндсэн танхим</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {classes.map((cls) => {
                        const isSelected = cls.id === selectedClassId;
                        const count = getClassCount(cls.id);
                        const classTeacher = teachers.find((t) => t.id === cls.classTeacherId);
                        const homeRoom = classrooms.find((r) => r.id === cls.homeClassroomId);
                        const bld = buildings.find((b) => b.id === cls.buildingId);
                        return (
                          <tr
                            key={cls.id}
                            onClick={() => setSelectedClassId(cls.id)}
                            onDoubleClick={() => {
                              setIsNewClass(false);
                              setEditingClass({ ...cls });
                            }}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-slate-800 text-white font-medium' : 'hover:bg-slate-100 text-slate-800'
                            }`}
                          >
                            <td className="py-1.5 px-3 border-r border-slate-200 text-left flex items-center gap-2">
                              <span
                                className="w-3.5 h-3.5 rounded-xs border shrink-0"
                                style={{ backgroundColor: cls.color, borderColor: isSelected ? '#ffffff' : '#94a3b8' }}
                              />
                              <span className="truncate font-semibold">{cls.name}</span>
                            </td>
                            <td className="py-1.5 px-3 border-r border-slate-200 text-left font-medium">
                              {cls.shift}-р ээлж
                            </td>
                            <td className="py-1.5 px-3 border-r border-slate-200 text-[11px] text-left truncate">
                              {bld ? bld.shortName : '1-р байр'}
                            </td>
                            <td className="py-1.5 px-3 border-r border-slate-200 text-left font-medium">{count} цаг</td>
                            <td className="py-1.5 px-3 border-r border-slate-200 text-[11px] text-left truncate">
                              {cls.subgroups && cls.subgroups.length > 0 ? (
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${isSelected ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                                  {cls.subgroups.map((s) => s.name).join(', ')}
                                </span>
                              ) : (
                                <span className={isSelected ? 'text-slate-300 italic' : 'text-slate-400 italic'}>Бүхэл</span>
                              )}
                            </td>
                            <td className="py-1.5 px-3 border-r border-slate-200 text-left">
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTimeOffClass(cls);
                                }}
                                className={`inline-grid grid-cols-5 gap-[1px] p-[2px] rounded border hover:scale-105 transition cursor-pointer ${
                                  isSelected ? 'bg-slate-700 border-slate-600' : 'bg-slate-200 border-slate-300'
                                }`}
                                title="Цагийн менежмент тохируулах"
                              >
                                {Array.from({ length: 15 }).map((_, i) => (
                                  <div
                                    key={i}
                                    className={`w-1.5 h-1 rounded-[1px] ${
                                      cls.timeOff && Object.values(cls.timeOff)[i] === 'forbidden'
                                        ? 'bg-rose-500'
                                        : 'bg-emerald-500'
                                    }`}
                                  />
                                ))}
                              </div>
                            </td>
                            <td className="py-1.5 px-3 border-r border-slate-200 text-[11px] text-left truncate">
                              {classTeacher?.name || '-'}
                            </td>
                            <td className="py-1.5 px-3 text-[11px] text-left truncate">{homeRoom?.name || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Action buttons */}
              <div className="w-32 flex flex-col gap-2 shrink-0 select-none">
                <button
                  onClick={handleCreateClass}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-slate-600" />
                  <span>Шинэ</span>
                </button>
                <button
                  disabled={!selectedClass}
                  onClick={() => {
                    if (selectedClass) {
                      setIsNewClass(false);
                      setEditingClass({ ...selectedClass });
                    }
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-xs transition disabled:opacity-40 cursor-pointer"
                >
                  <Edit2 className="w-4 h-4 text-slate-600" />
                  <span>Засварлах</span>
                </button>
                <button
                  disabled={!selectedClass}
                  onClick={() => selectedClass && handleDeleteClass(selectedClass.id)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-xs transition disabled:opacity-40 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-slate-600" />
                  <span>Устгах</span>
                </button>

                <div className="h-2"></div>

                <button
                  disabled={!selectedClass}
                  onClick={() => selectedClass && onOpenLessonsForClass?.(selectedClass.id)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-xs transition disabled:opacity-40 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 text-slate-600" />
                  <span>Хичээл</span>
                </button>

                {/* Дэд бүлэг товч */}
                <button
                  disabled={!selectedClass}
                  onClick={() => selectedClass && setSubgroupClass({ ...selectedClass })}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-xs transition disabled:opacity-40 cursor-pointer"
                  title="Охид, хөвгүүд, 1,2-р дэд бүлэг тохируулах"
                >
                  <Users className="w-4 h-4 text-slate-600" />
                  <span>Дэд бүлэг</span>
                </button>

                <button
                  disabled={!selectedClass}
                  onClick={() => selectedClass && setTimeOffClass(selectedClass)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-xs transition disabled:opacity-40 cursor-pointer"
                >
                  <Clock className="w-4 h-4 text-slate-600" />
                  <span>Цагийн менежмент</span>
                </button>

                {/* Хуулах товч */}
                <button
                  disabled={!selectedClass}
                  onClick={() => {
                    setCopyClassSourceId(selectedClass?.id || classes[0]?.id || '');
                    setCopyClassTargetIds([]);
                    setCopyClassCopyLessons(true);
                    setCopyClassCopyTimeOff(true);
                    setCopyClassModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-xs transition disabled:opacity-40 cursor-pointer"
                  title="Энэ ангийн хичээлийн цаг болон тохиргоог өөр ангиудад хуулах"
                >
                  <Copy className="w-4 h-4 text-slate-600" />
                  <span>Хуулах</span>
                </button>

                <div className="flex-1"></div>

                <div className="flex justify-center gap-2 py-1">
                  <button
                    onClick={() => moveClass('up')}
                    className="p-1.5 bg-white border border-slate-300 rounded hover:bg-slate-100 shadow-xs"
                    title="Дээш зөөх"
                  >
                    <ArrowUp className="w-4 h-4 text-slate-600" />
                  </button>
                  <button
                    onClick={() => moveClass('down')}
                    className="p-1.5 bg-white border border-slate-300 rounded hover:bg-slate-100 shadow-xs"
                    title="Доош зөөх"
                  >
                    <ArrowDown className="w-4 h-4 text-slate-600" />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* TAB 3: CLASSROOMS VIEW */}
          {activeTab === 'classrooms' && (
            <>
              <div className="flex-1 flex flex-col border border-slate-300 rounded bg-white overflow-hidden shadow-inner">
                <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-300 text-xs font-semibold text-slate-700">
                  Танхимын жагсаалт ({classrooms.length}):
                </div>
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 sticky top-0 border-b border-slate-300 select-none shadow-xs">
                      <tr>
                        <th className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-700 text-left">Танхим</th>
                        <th className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-700 w-32 text-left">Хичээлийн байр</th>
                        <th className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-700 w-24 text-left">Дугаар</th>
                        <th className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-700 w-24 text-left">Суудал</th>
                        <th className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-700 w-32 text-left">Цагийн менежмент</th>
                        <th className="py-2 px-3 font-semibold text-slate-700 w-44 text-left">Хуваалцах / Зэрэгцэх</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {classrooms.map((r) => {
                        const isSelected = r.id === selectedRoomId;
                        const bld = buildings.find((b) => b.id === r.buildingId);
                        return (
                          <tr
                            key={r.id}
                            onClick={() => setSelectedRoomId(r.id)}
                            onDoubleClick={() => {
                              setIsNewRoom(false);
                              setEditingRoom({ ...r });
                            }}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-slate-800 text-white font-medium' : 'hover:bg-slate-100 text-slate-800'
                            }`}
                          >
                            <td className="py-1.5 px-3 border-r border-slate-200 text-left flex items-center gap-2">
                              <span
                                className="w-3.5 h-3.5 rounded-xs border shrink-0"
                                style={{ backgroundColor: r.color, borderColor: isSelected ? '#ffffff' : '#94a3b8' }}
                              />
                              <span className="truncate font-semibold">{r.name}</span>
                            </td>
                            <td className="py-1.5 px-3 border-r border-slate-200 text-[11px] text-left truncate">
                              {bld ? bld.name : '1-р байр'}
                            </td>
                            <td className="py-1.5 px-3 border-r border-slate-200 text-left font-mono text-[11px]">
                              {r.shortName || '-'}
                            </td>
                            <td className="py-1.5 px-3 border-r border-slate-200 text-left font-medium">
                              {r.capacity} суудал
                            </td>
                            <td className="py-1.5 px-3 border-r border-slate-200 text-left">
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTimeOffRoom(r);
                                }}
                                className={`inline-grid grid-cols-5 gap-[1px] p-[2px] rounded border hover:scale-105 transition cursor-pointer ${
                                  isSelected ? 'bg-slate-700 border-slate-600' : 'bg-slate-200 border-slate-300'
                                }`}
                                title="Цагийн менежмент тохируулах"
                              >
                                {Array.from({ length: 15 }).map((_, i) => (
                                  <div
                                    key={i}
                                    className={`w-1.5 h-1 rounded-[1px] ${
                                      r.timeOff && Object.values(r.timeOff)[i] === 'forbidden'
                                        ? 'bg-rose-500'
                                        : 'bg-emerald-500'
                                    }`}
                                  />
                                ))}
                              </div>
                            </td>
                            <td className="py-1.5 px-3 text-left text-[11px]">
                              <div className="flex flex-col items-start gap-1">
                                {r.isShared && (
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${isSelected ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                                    Хуваалцах
                                  </span>
                                )}
                                {r.maxConcurrentClasses && r.maxConcurrentClasses > 1 && (
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${isSelected ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                                    Зэрэгцэх: {r.maxConcurrentClasses} анги
                                  </span>
                                )}
                                {!r.isShared && (!r.maxConcurrentClasses || r.maxConcurrentClasses <= 1) && (
                                  <span className={isSelected ? 'text-slate-300 text-[10px]' : 'text-slate-400 text-[10px]'}>Энгийн</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Action buttons */}
              <div className="w-32 flex flex-col gap-2 shrink-0 select-none">
                <button
                  onClick={handleCreateRoom}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-slate-600" />
                  <span>Шинэ</span>
                </button>
                <button
                  disabled={!selectedRoom}
                  onClick={() => {
                    if (selectedRoom) {
                      setIsNewRoom(false);
                      setEditingRoom({ ...selectedRoom });
                    }
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-xs transition disabled:opacity-40 cursor-pointer"
                >
                  <Edit2 className="w-4 h-4 text-slate-600" />
                  <span>Засварлах</span>
                </button>
                <button
                  disabled={!selectedRoom}
                  onClick={() => selectedRoom && handleDeleteRoom(selectedRoom.id)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-xs transition disabled:opacity-40 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-slate-600" />
                  <span>Устгах</span>
                </button>

                <div className="h-2"></div>

                <button
                  disabled={!selectedRoom}
                  onClick={() => selectedRoom && setTimeOffRoom(selectedRoom)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-xs transition disabled:opacity-40 cursor-pointer"
                >
                  <Clock className="w-4 h-4 text-slate-600" />
                  <span>Цагийн менежмент</span>
                </button>

                <div className="flex-1"></div>

                <div className="flex justify-center gap-2 py-1">
                  <button
                    onClick={() => moveRoom('up')}
                    className="p-1.5 bg-white border border-slate-300 rounded hover:bg-slate-100 shadow-xs"
                    title="Дээш зөөх"
                  >
                    <ArrowUp className="w-4 h-4 text-slate-600" />
                  </button>
                  <button
                    onClick={() => moveRoom('down')}
                    className="p-1.5 bg-white border border-slate-300 rounded hover:bg-slate-100 shadow-xs"
                    title="Доош зөөх"
                  >
                    <ArrowDown className="w-4 h-4 text-slate-600" />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* TAB 4: TEACHERS VIEW */}
          {activeTab === 'teachers' && (
            <>
              <div className="flex-1 flex flex-col border border-slate-300 rounded bg-white overflow-hidden shadow-inner">
                <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-300 text-xs font-semibold text-slate-700">
                  Багш нарын жагсаалт ({teachers.length}):
                </div>
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 sticky top-0 border-b border-slate-300 select-none shadow-xs">
                      <tr>
                        <th className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-700 text-left">Багшийн нэр</th>
                        <th className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-700 w-24 text-left">Товчлол</th>
                        <th className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-700 w-20 text-left">Цаг</th>
                        <th className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-700 w-32 text-left">Цагийн менежмент</th>
                        <th className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-700 w-28 text-left">Өдөрт дээд</th>
                        <th className="py-2 px-3 font-semibold text-slate-700 w-28 text-left">Өдрийн дээд цонх</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {teachers.map((teach) => {
                        const isSelected = teach.id === selectedTeacherId;
                        const count = getTeacherCount(teach.id);
                        return (
                          <tr
                            key={teach.id}
                            onClick={() => setSelectedTeacherId(teach.id)}
                            onDoubleClick={() => {
                              setIsNewTeacher(false);
                              setEditingTeacher({ ...teach });
                            }}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-slate-800 text-white font-medium' : 'hover:bg-slate-100 text-slate-800'
                            }`}
                          >
                            <td className="py-1.5 px-3 border-r border-slate-200 text-left flex items-center gap-2">
                              <span
                                className="w-3.5 h-3.5 rounded-xs border shrink-0"
                                style={{ backgroundColor: teach.color, borderColor: isSelected ? '#ffffff' : '#94a3b8' }}
                              />
                              <span className="truncate font-semibold">{teach.name}</span>
                            </td>
                            <td className="py-1.5 px-3 border-r border-slate-200 text-left font-mono text-[11px]">{teach.shortName}</td>
                            <td className="py-1.5 px-3 border-r border-slate-200 text-left font-medium">{count} цаг</td>
                            <td className="py-1.5 px-3 border-r border-slate-200 text-left">
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTimeOffTeacher(teach);
                                }}
                                className={`inline-grid grid-cols-5 gap-[1px] p-[2px] rounded border hover:scale-105 transition cursor-pointer ${
                                  isSelected ? 'bg-slate-700 border-slate-600' : 'bg-slate-200 border-slate-300'
                                }`}
                                title="Цагийн менежмент тохируулах"
                              >
                                {Array.from({ length: 15 }).map((_, i) => (
                                  <div
                                    key={i}
                                    className={`w-1.5 h-1 rounded-[1px] ${
                                      teach.timeOff && Object.values(teach.timeOff)[i] === 'forbidden'
                                        ? 'bg-rose-500'
                                        : 'bg-emerald-500'
                                    }`}
                                  />
                                ))}
                              </div>
                            </td>
                            <td className="py-1.5 px-3 border-r border-slate-200 text-left font-medium">
                              {teach.maxPeriodsPerDay || 6} цаг
                            </td>
                            <td className="py-1.5 px-3 text-left text-[11px] text-slate-600">
                              {teach.maxGapsPerDay || 1} цонх
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Action buttons */}
              <div className="w-32 flex flex-col gap-2 shrink-0 select-none">
                <button
                  onClick={handleCreateTeacher}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-slate-600" />
                  <span>Шинэ</span>
                </button>
                <button
                  disabled={!selectedTeacher}
                  onClick={() => {
                    if (selectedTeacher) {
                      setIsNewTeacher(false);
                      setEditingTeacher({ ...selectedTeacher });
                    }
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-xs transition disabled:opacity-40 cursor-pointer"
                >
                  <Edit2 className="w-4 h-4 text-slate-600" />
                  <span>Засварлах</span>
                </button>
                <button
                  disabled={!selectedTeacher}
                  onClick={() => selectedTeacher && handleDeleteTeacher(selectedTeacher.id)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-xs transition disabled:opacity-40 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-slate-600" />
                  <span>Устгах</span>
                </button>

                <div className="h-2"></div>

                <button
                  disabled={!selectedTeacher}
                  onClick={() => selectedTeacher && onOpenLessonsForTeacher?.(selectedTeacher.id)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-xs transition disabled:opacity-40 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 text-slate-600" />
                  <span>Хичээл</span>
                </button>

                <button
                  disabled={!selectedTeacher}
                  onClick={() => selectedTeacher && setTimeOffTeacher(selectedTeacher)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-xs transition disabled:opacity-40 cursor-pointer"
                >
                  <Clock className="w-4 h-4 text-slate-600" />
                  <span>Цагийн менежмент</span>
                </button>

                {/* Хуулах товч */}
                <button
                  disabled={!selectedTeacher}
                  onClick={() => {
                    setCopyTeacherSourceId(selectedTeacher?.id || teachers[0]?.id || '');
                    setCopyTeacherTargetIds([]);
                    setCopyTeacherModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-xs transition disabled:opacity-40 cursor-pointer"
                  title="Багшийн цагийн менежментийг өөр багш нарт хуулах"
                >
                  <Copy className="w-4 h-4 text-slate-600" />
                  <span>Хуулах</span>
                </button>

                <div className="flex-1"></div>

                <div className="flex justify-center gap-2 py-1">
                  <button
                    onClick={() => moveTeacher('up')}
                    className="p-1.5 bg-white border border-slate-300 rounded hover:bg-slate-100 shadow-xs cursor-pointer"
                    title="Дээш зөөх"
                  >
                    <ArrowUp className="w-4 h-4 text-slate-600" />
                  </button>
                  <button
                    onClick={() => moveTeacher('down')}
                    className="p-1.5 bg-white border border-slate-300 rounded hover:bg-slate-100 shadow-xs cursor-pointer"
                    title="Доош зөөх"
                  >
                    <ArrowDown className="w-4 h-4 text-slate-600" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Dialog Bottom Footer Bar */}
        <div className="bg-slate-200/90 px-4 py-2 border-t border-slate-300 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setHelpTab(activeTab);
                setShowHelpModal(true);
              }}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-100 shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-slate-600" />
              <span>Тусламж</span>
            </button>
            <button
              onClick={onOpenExcelImport}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-100 shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <span>📥</span>
              <span>Импорт</span>
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-1 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-800 hover:bg-slate-100 shadow-xs cursor-pointer"
          >
            Хаах
          </button>
        </div>
      </div>

      {/* --- SUB MODALS --- */}

      {/* 0. Help Guide Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 select-none">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-300 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in">
            {/* Modal Header */}
            <div className="bg-slate-800 text-white px-5 py-3 flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-2.5">
                <HelpCircle className="w-5 h-5 text-slate-300" />
                <span className="font-semibold text-sm text-slate-100">Өгөгдөл (Data) цэстэй ажиллах зааварчилгаа</span>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-slate-400 hover:text-white hover:bg-slate-700 rounded px-2 py-0.5 text-xs font-bold transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="bg-slate-100 border-b border-slate-300 px-4 py-2 flex items-center gap-2 overflow-x-auto">
              <button
                onClick={() => setHelpTab('general')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  helpTab === 'general'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>Ерөнхий заавар</span>
              </button>
              <button
                onClick={() => setHelpTab('subjects')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  helpTab === 'subjects'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Хичээлүүд</span>
              </button>
              <button
                onClick={() => setHelpTab('classes')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  helpTab === 'classes'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Анги бүлгүүд</span>
              </button>
              <button
                onClick={() => setHelpTab('classrooms')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  helpTab === 'classrooms'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <DoorOpen className="w-3.5 h-3.5" />
                <span>Анги танхим</span>
              </button>
              <button
                onClick={() => setHelpTab('teachers')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  helpTab === 'teachers'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Багш нар</span>
              </button>
            </div>

            {/* Modal Body with Left-Aligned Text, Clean Typography, and Detailed Mongolian Guidance */}
            <div className="p-5 overflow-y-auto text-xs text-slate-700 space-y-4 max-h-[62vh] text-left leading-relaxed">
              {helpTab === 'general' && (
                <div className="space-y-4 text-left">
                  <div className="bg-slate-100 p-3.5 rounded border border-slate-300">
                    <h4 className="font-bold text-slate-900 text-sm mb-1.5 text-left">1. Өгөгдөл (Data) цэсний зорилго</h4>
                    <p className="text-slate-700 text-left">
                      Энэхүү цонх нь сургуулийн хичээлийн хуваарь боловсруулахад шаардлагатай анхан шатны бүх үндсэн өгөгдөл буюу <strong>Хичээл</strong>, <strong>Анги бүлэг</strong>, <strong>Анги танхим</strong>, <strong>Багш нар</strong>-ыг нэгдсэн системтэйгээр бүртгэх, удирдах, цагийн хязгаарлалт тогтоох төв удирдлагын цонх юм.
                    </p>
                  </div>

                  <div className="border border-slate-200 rounded p-3.5 bg-white space-y-2">
                    <h4 className="font-bold text-slate-900 text-xs text-left">2. Үндсэн навигаци ба хүснэгттэй ажиллах</h4>
                    <ul className="list-disc pl-5 space-y-1.5 text-slate-700 text-left">
                      <li><strong>Зүүн талын цэс:</strong> 4 үндсэн дэд хэсгийн хооронд шилжих товчнууд байрлана (Хичээлүүд, Анги бүлгүүд, Анги танхим, Багш нар).</li>
                      <li><strong>Сонголт хийх:</strong> Хүснэгтийн аль нэг мөр дээр 1 товшиж идэвхжүүлнэ. Идэвхтэй мөр тод саарал өнгөөр ялгарч харагдана.</li>
                      <li><strong>Шуурхай засварлах:</strong> Хүснэгтийн мөр дээр 2 товшиход (Double-click) тухайн өгөгдлийг засах цонх шууд нээгдэнэ.</li>
                      <li><strong>Урагш тэгшилсэн хүснэгт:</strong> Хүснэгтийн бүх багануудын текст зүүн гар тийш урагш тэгшлэгдсэн тул харахад эмх цэгцтэй, уншихад хялбар.</li>
                      <li><strong>Дээш / Доош зөөх:</strong> Хүснэгтийн мөрийг сонгоод баруун доод талын сумтай товчоор дарааллыг нь өөрчилж болно.</li>
                    </ul>
                  </div>

                  <div className="border border-slate-200 rounded p-3.5 bg-white space-y-2">
                    <h4 className="font-bold text-slate-900 text-xs text-left">3. Үйлдлийн товчнууд (Баруун талд)</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-left">
                      <div className="p-2 bg-slate-50 rounded border border-slate-200 text-left">
                        <span className="font-bold text-slate-800">Шинэ:</span> Шинээр бичлэг (хичээл, анги, өрөө, багш) нэмэх.
                      </div>
                      <div className="p-2 bg-slate-50 rounded border border-slate-200 text-left">
                        <span className="font-bold text-slate-800">Засварлах:</span> Сонгосон бичлэгийн нэр, товчлол, тохиргоог өөрчлөх.
                      </div>
                      <div className="p-2 bg-slate-50 rounded border border-slate-200 text-left">
                        <span className="font-bold text-slate-800">Устгах:</span> Сонгосон бичлэгийг сангаас устгах.
                      </div>
                      <div className="p-2 bg-slate-50 rounded border border-slate-200 text-left">
                        <span className="font-bold text-slate-800">Хичээл:</span> Сонгосон анги эсвэл багшийн заах хичээлийн хуваарилалт руу шилжих.
                      </div>
                      <div className="p-2 bg-slate-50 rounded border border-slate-200 text-left">
                        <span className="font-bold text-slate-800">Цагийн менежмент:</span> Боломжгүй, хориглосон гараг цагуудыг тэмдэглэх.
                      </div>
                      <div className="p-2 bg-slate-50 rounded border border-slate-200 text-left">
                        <span className="font-bold text-slate-800">Хуулах:</span> Ангийн нийт хичээлүүд эсвэл багшийн цагийн менежментийг бусад руу хуулбарлах.
                      </div>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded p-3.5 bg-white text-left">
                    <h4 className="font-bold text-slate-900 text-xs mb-1 text-left">4. Excel Импорт</h4>
                    <p className="text-slate-700 text-left">
                      Цонхны зүүн доод хэсэгт байрлах <strong>Импорт</strong> товчоор Excel загвар файлыг татан авч, сургуулийн мэдээллийг бэлтгээд нэгэн зэрэг системд бөөнөөр оруулах боломжтой.
                    </p>
                  </div>
                </div>
              )}

              {helpTab === 'subjects' && (
                <div className="space-y-4 text-left">
                  <div className="bg-slate-100 p-3.5 rounded border border-slate-300">
                    <h4 className="font-bold text-slate-900 text-sm mb-1 text-left">Хичээлүүдтэй ажиллах заавар</h4>
                    <p className="text-slate-700 text-left">
                      Сургууль дээр заагдах бүх хичээлийг (жишээ нь: Математик, Монгол хэл, Физик, Биеийн тамир) нэг бүрчлэн бүртгэнэ.
                    </p>
                  </div>

                  <div className="border border-slate-200 rounded p-3.5 bg-white space-y-2 text-left">
                    <h5 className="font-bold text-slate-900 text-xs text-left">Үндсэн талбарууд:</h5>
                    <ul className="list-disc pl-5 space-y-1.5 text-slate-700 text-left">
                      <li><strong>Хичээлийн нэр:</strong> Хичээлийн бүтэн албан ёсны нэр (жишээ нь: Хими).</li>
                      <li><strong>Товчлол (Short):</strong> Хуваарийн нүдэнд багтаж харагдах 2-4 үсэгтэй товчлол (жишээ нь: ХИМ).</li>
                      <li><strong>Өнгө:</strong> Хуваарийн хүснэгтэд тухайн хичээлийн картууд энэ өнгөөр ялгарч харагдана.</li>
                      <li><strong>Хуваарилалтын дүрэм:</strong>
                        <ul className="list-disc pl-4 mt-1 space-y-1 text-slate-600">
                          <li><em>Идеал (жигд тархалт):</em> Тухайн хичээл 7 хоногийн өдрүүдэд 1 өдөр алгасаж жигд тархана.</li>
                          <li><em>Дараалсан өдрүүдэд:</em> Шаардлагатай бол дараалсан өдрүүдэд орохыг зөвшөөрнө.</li>
                          <li><em>Хос цагаар орж болно:</em> 2 цагаар залгаж орох боломжтой хичээлүүд (Лаборатори, Уран зохиол, Биеийн тамир гэх мэт).</li>
                        </ul>
                      </li>
                      <li><strong>Гэрийн даалгавар шаардах:</strong> Хэрэв чагталбал хичээл орсны дараагийн өдөр дахин орохгүй байх хязгаарлалт тавигдана (сурагч гэрийн даалгавар хийх боломж олгох зорилготой).</li>
                    </ul>
                  </div>

                  <div className="border border-slate-200 rounded p-3.5 bg-white text-left space-y-1.5">
                    <h5 className="font-bold text-slate-900 text-xs text-left">Цагийн менежмент:</h5>
                    <p className="text-slate-700 text-left">
                      Хүснэгтийн жижиг матрицын нүдэн дээр дарж эсвэл баруун талын <strong>Цагийн менежмент</strong> товчоор орно. Тухайн хичээл орох боломжгүй цагуудыг (жишээ нь: 1-р цагт эсвэл 7-р цагт орохгүй байх) улаанаар дарж хаана.
                    </p>
                  </div>
                </div>
              )}

              {helpTab === 'classes' && (
                <div className="space-y-4 text-left">
                  <div className="bg-slate-100 p-3.5 rounded border border-slate-300">
                    <h4 className="font-bold text-slate-900 text-sm mb-1 text-left">Анги бүлгүүдтэй ажиллах заавар</h4>
                    <p className="text-slate-700 text-left">
                      Анги бүлэг бүрийн хичээллэх ээлж, байр, үндсэн танхим болон дэд бүлгийн хуваарилалтыг энд тохируулна.
                    </p>
                  </div>

                  <div className="border border-slate-200 rounded p-3.5 bg-white space-y-2 text-left">
                    <h5 className="font-bold text-slate-900 text-xs text-left">Үндсэн тохиргоонууд:</h5>
                    <ul className="list-disc pl-5 space-y-1.5 text-slate-700 text-left">
                      <li><strong>Ээлж (1, 2, 3-р ээлж):</strong> Тухайн анги өглөө, өдөр эсвэл оройн ээлжинд хичээллэхийг заана. Хуваарь зохиогч нь ээлжийн дагуу цагуудад хуваарилна.</li>
                      <li><strong>Хичээллэх байр:</strong> Хэрэв сургууль хэд хэдэн салбар хичээлийн байртай бол тухайн ангийн суралцах үндсэн байрыг сонгоно.</li>
                      <li><strong>Ангийн багш:</strong> Анги хариуцсан багшийг сонгож холбоно.</li>
                      <li><strong>Үндсэн танхим:</strong> Ангийн байнгын суух үндсэн танхимыг сонгоно.</li>
                    </ul>
                  </div>

                  <div className="border border-slate-200 rounded p-3.5 bg-white space-y-2 text-left">
                    <h5 className="font-bold text-slate-900 text-xs text-left">Дэд бүлэг тохируулах (Дэд бүлэг товч):</h5>
                    <p className="text-slate-700 text-left">
                      Хэрэв нэг анги хичээл дээр 2 тусдаа хэсэгт хуваагдаж ордог бол (жишээ нь: Охид / Хөвгүүд биеийн тамир, эсвэл 1-р бүлэг / 2-р бүлэг гадаад хэл, мэдээлэл зүй) дэд бүлэг нэмнэ. Ингэснээр нэг цагт нэг ангид 2 өөр багш зэрэг хичээл зааж болно.
                    </p>
                  </div>

                  <div className="border border-slate-200 rounded p-3.5 bg-white space-y-2 text-left">
                    <h5 className="font-bold text-slate-900 text-xs text-left">Хуулах боломж (Хуулах товч):</h5>
                    <p className="text-slate-700 text-left">
                      Жишээлбэл, 10А анги дээр 32 цагийн нийт хичээлүүдийн төлөвлөгөөг бүрэн оруулсан бол <strong>Хуулах</strong> товчийг дарж 10Б, 10В, 10Г ангиудыг сонгон багцаар нь хуулж үүсгэж болно. Ингэснээр дахин гараар шивэх шаардлагагүй болж цаг ихээхэн хэмнэнэ.
                    </p>
                  </div>
                </div>
              )}

              {helpTab === 'classrooms' && (
                <div className="space-y-4 text-left">
                  <div className="bg-slate-100 p-3.5 rounded border border-slate-300">
                    <h4 className="font-bold text-slate-900 text-sm mb-1 text-left">Анги танхимуудтай ажиллах заавар</h4>
                    <p className="text-slate-700 text-left">
                      Сургуулийн нийт хичээлийн анги танхим, лаборатори, спорт заал, тусгай кабинетуудыг бүртгэнэ.
                    </p>
                  </div>

                  <div className="border border-slate-200 rounded p-3.5 bg-white space-y-2 text-left">
                    <h5 className="font-bold text-slate-900 text-xs text-left">Танхимын онцлог тохиргоонууд:</h5>
                    <ul className="list-disc pl-5 space-y-1.5 text-slate-700 text-left">
                      <li><strong>Суудлын багтаамж:</strong> Тухайн өрөөнд нэг дор суух боломжтой сурагчдын суудлын тоо.</li>
                      <li><strong>Хуваалцах боломжтой танхим:</strong> Бусад ангиуд сул үед нь орж хичээллэх боломжтой эсэх.</li>
                      <li><strong>Зэрэгцэх ангийн тоо (Concurrent classes):</strong> Спорт заал, урлаг заал, том спорт талбай зэрэгт нэг цагт хэдэн өөр анги зэрэг орж хичээллэж болохыг (жишээ нь: 2 анги эсвэл 3 анги) заана. Энэ нь биеийн тамирын хуваарийг үр дүнтэй зохиоход маш чухал тохиргоо юм.</li>
                      <li><strong>Цагийн менежмент:</strong> Тухайн танхим засвартай, эсвэл захирлын уулзалт, дугуйлан зэрэгт зориулагдаж хичээл орох боломжгүй цагуудыг улаанаар дарж хаана.</li>
                    </ul>
                  </div>
                </div>
              )}

              {helpTab === 'teachers' && (
                <div className="space-y-4 text-left">
                  <div className="bg-slate-100 p-3.5 rounded border border-slate-300">
                    <h4 className="font-bold text-slate-900 text-sm mb-1 text-left">Багш нарын бүртгэл ба цагийн менежмент</h4>
                    <p className="text-slate-700 text-left">
                      Багш бүрийн ажлын ачаалал, өдөрт орох дээд цаг, чөлөөт цагийн хязгаарлалтуудыг тогтооно.
                    </p>
                  </div>

                  <div className="border border-slate-200 rounded p-3.5 bg-white space-y-2 text-left">
                    <h5 className="font-bold text-slate-900 text-xs text-left">Хязгаарлалтууд (Constraints):</h5>
                    <ul className="list-disc pl-5 space-y-1.5 text-slate-700 text-left">
                      <li><strong>Өдөрт орох дээд цаг:</strong> Багшийн нэг өдөрт заах хичээлийн дээд хязгаар (жишээ нь: 6 цаг). Хуваарь зохиох үед энэ тооноос хэтрэхгүйгээр хуваарилна.</li>
                      <li><strong>Өдрийн дээд цонх (Сул цаг):</strong> Багшийн тухайн өдрийн хичээлүүдийн дунд үүсэх сул цагийн хамгийн их тоо (жишээ нь: 1 цонх).</li>
                      <li><strong>Цагийн менежмент (Time off):</strong> Багш тухайн гарагт сургалттай, өөр газар ажилладаг эсвэл хичээл орох боломжгүй өдөр цагуудыг улаанаар дарж хаана. Хуваарь автоматаар зохиогдохдоо тухайн цагуудад хичээл хуваарилахгүй.</li>
                      <li><strong>Хуулах товч:</strong> Нэг багшийн цагийн менежментийн тохиргоог бусад багш нарт бөөнөөр хуулбарлах боломжтой.</li>
                      <li><strong>Хичээл (Lessons) товч:</strong> Тухайн багшийн заах нийт ангиуд, 7 хоногт орох хичээлийн цагуудыг шалгах, шинэ гэрээ/хичээл нэмэх цонх руу шууд үсрэнэ.</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-100 px-5 py-3 border-t border-slate-300 flex items-center justify-between select-none">
              <span className="text-slate-500 text-xs text-left">
                Өгөгдлөө шалгаад "Хаах" дарж хуваарийн төв цонхонд ажиллана уу.
              </span>
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-5 py-1.5 bg-slate-800 text-white rounded text-xs font-semibold hover:bg-slate-900 shadow-xs transition cursor-pointer"
              >
                Ойлголоо, Хаах
              </button>
            </div>
          </div>
        </div>
      )}
      {editingSubject && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-300 w-full max-w-md p-4 animate-in fade-in">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200 font-bold text-slate-800 text-sm">
              <span>{isNewSubject ? 'Шинэ хичээл нэмэх' : 'Хичээл засварлах'}</span>
              <button onClick={() => setEditingSubject(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <form onSubmit={handleSaveSubject} className="space-y-3 mt-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Хичээлийн нэр:</label>
                <input
                  type="text"
                  required
                  value={editingSubject.name}
                  onChange={(e) => setEditingSubject({ ...editingSubject, name: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 font-medium"
                  placeholder="жнь: Математик"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Товчлол (Short):</label>
                  <input
                    type="text"
                    required
                    value={editingSubject.shortName}
                    onChange={(e) => setEditingSubject({ ...editingSubject, shortName: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded uppercase font-mono"
                    placeholder="Мат"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Өнгө (Color):</label>
                  <input
                    type="color"
                    value={editingSubject.color}
                    onChange={(e) => setEditingSubject({ ...editingSubject, color: e.target.value })}
                    className="w-full h-8 p-1 border border-slate-300 rounded cursor-pointer"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Хуваарилалтын дүрэм:</label>
                <select
                  value={editingSubject.distributionRule}
                  onChange={(e) => setEditingSubject({ ...editingSubject, distributionRule: e.target.value as any })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-medium"
                >
                  <option value="ideal">Идеал (Өдрүүдэд жигд тараах)</option>
                  <option value="consecutive_allowed">Дараалсан өдрүүдэд байж болно</option>
                  <option value="any">Энгийн (Хязгаарлалтгүй)</option>
                </select>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="sub_hw"
                  checked={editingSubject.homework}
                  onChange={(e) => setEditingSubject({ ...editingSubject, homework: e.target.checked })}
                  className="rounded text-blue-600"
                />
                <label htmlFor="sub_hw" className="text-slate-700 font-medium cursor-pointer">
                  Гэрийн даалгавар шаардах (Дараалсан өдөр орохгүй байх)
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingSubject(null)}
                  className="px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-100 font-medium text-slate-700 cursor-pointer"
                >
                  Болих
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-slate-800 text-white font-bold hover:bg-slate-900 shadow-xs cursor-pointer"
                >
                  Хадгалах
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Edit Teacher Modal */}
      {editingTeacher && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-300 w-full max-w-md p-4 animate-in fade-in">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200 font-bold text-slate-800 text-sm">
              <span>{isNewTeacher ? 'Шинэ багш бүртгэх' : 'Багшийн мэдээлэл засах'}</span>
              <button onClick={() => setEditingTeacher(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <form onSubmit={handleSaveTeacher} className="space-y-3 mt-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Багшийн нэр:</label>
                <input
                  type="text"
                  required
                  value={editingTeacher.name}
                  onChange={(e) => setEditingTeacher({ ...editingTeacher, name: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-medium"
                  placeholder="Б. Болд"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Товчлол:</label>
                  <input
                    type="text"
                    required
                    value={editingTeacher.shortName}
                    onChange={(e) => setEditingTeacher({ ...editingTeacher, shortName: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded uppercase font-mono"
                    placeholder="БОЛ"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Өнгө:</label>
                  <input
                    type="color"
                    value={editingTeacher.color}
                    onChange={(e) => setEditingTeacher({ ...editingTeacher, color: e.target.value })}
                    className="w-full h-8 p-1 border border-slate-300 rounded cursor-pointer"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Өдөрт орох дээд цаг:</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={editingTeacher.maxPeriodsPerDay || 6}
                    onChange={(e) => setEditingTeacher({ ...editingTeacher, maxPeriodsPerDay: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-bold"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Өдрийн дээд цонх:</label>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={editingTeacher.maxGapsPerDay ?? 1}
                    onChange={(e) => setEditingTeacher({ ...editingTeacher, maxGapsPerDay: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-bold"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingTeacher(null)}
                  className="px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-100 font-medium text-slate-700 cursor-pointer"
                >
                  Болих
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-slate-800 text-white font-bold hover:bg-slate-900 shadow-xs cursor-pointer"
                >
                  Хадгалах
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Edit Class Modal */}
      {editingClass && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-300 w-full max-w-md p-4 animate-in fade-in">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200 font-bold text-slate-800 text-sm">
              <span>{isNewClass ? 'Шинэ анги бүлэг нэмэх' : 'Анги бүлгийн мэдээлэл засах'}</span>
              <button onClick={() => setEditingClass(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <form onSubmit={handleSaveClass} className="space-y-3 mt-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Ангийн нэр:</label>
                  <input
                    type="text"
                    required
                    value={editingClass.name}
                    onChange={(e) => setEditingClass({ ...editingClass, name: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-bold"
                    placeholder="10А"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Товчлол:</label>
                  <input
                    type="text"
                    required
                    value={editingClass.shortName}
                    onChange={(e) => setEditingClass({ ...editingClass, shortName: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded uppercase font-mono"
                    placeholder="10A"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 bg-slate-100 p-2.5 rounded border border-slate-300">
                <div>
                  <label className="block font-medium text-slate-800 mb-1">Хичээллэх ээлж:</label>
                  <select
                    value={editingClass.shift}
                    onChange={(e) => setEditingClass({ ...editingClass, shift: Number(e.target.value) })}
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-semibold text-slate-800"
                  >
                    <option value={1}>1-р ээлж (Өглөө)</option>
                    <option value={2}>2-р ээлж (Өдөр)</option>
                    <option value={3}>3-р ээлж (Орой)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-800 mb-1">Хичээллэх байр:</label>
                  <select
                    value={editingClass.buildingId || ''}
                    onChange={(e) => setEditingClass({ ...editingClass, buildingId: e.target.value })}
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-semibold text-slate-800"
                  >
                    {buildings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Ангийн багш:</label>
                  <select
                    value={editingClass.classTeacherId || ''}
                    onChange={(e) => setEditingClass({ ...editingClass, classTeacherId: e.target.value || undefined })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                  >
                    <option value="">(Сонгоогүй)</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Үндсэн танхим:</label>
                  <select
                    value={editingClass.homeClassroomId || ''}
                    onChange={(e) => setEditingClass({ ...editingClass, homeClassroomId: e.target.value || undefined })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                  >
                    <option value="">(Сонгоогүй)</option>
                    {classrooms.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingClass(null)}
                  className="px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-100 font-medium text-slate-700 cursor-pointer"
                >
                  Болих
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-slate-800 text-white font-bold hover:bg-slate-900 shadow-xs cursor-pointer"
                >
                  Хадгалах
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Edit Classroom Modal */}
      {editingRoom && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-300 w-full max-w-md p-4 animate-in fade-in">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200 font-bold text-slate-800 text-sm">
              <span>{isNewRoom ? 'Шинэ танхим нэмэх' : 'Танхимын мэдээлэл засах'}</span>
              <button onClick={() => setEditingRoom(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <form onSubmit={handleSaveRoom} className="space-y-3 mt-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Танхимын нэр:</label>
                  <input
                    type="text"
                    required
                    value={editingRoom.name}
                    onChange={(e) => setEditingRoom({ ...editingRoom, name: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-bold"
                    placeholder="301 тоот"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Товчлол (Short):</label>
                  <input
                    type="text"
                    required
                    value={editingRoom.shortName || ''}
                    onChange={(e) => setEditingRoom({ ...editingRoom, shortName: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono"
                    placeholder="301"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Хичээлийн байр:</label>
                  <select
                    value={editingRoom.buildingId || ''}
                    onChange={(e) => setEditingRoom({ ...editingRoom, buildingId: e.target.value })}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded font-bold text-slate-800"
                  >
                    {buildings.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Суудлын тоо:</label>
                  <input
                    type="number"
                    min={1}
                    value={editingRoom.capacity}
                    onChange={(e) => setEditingRoom({ ...editingRoom, capacity: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-bold"
                  />
                </div>
              </div>
              <div className="bg-slate-100 p-2.5 rounded border border-slate-300 space-y-2">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="room_shared"
                    checked={editingRoom.isShared}
                    onChange={(e) => setEditingRoom({ ...editingRoom, isShared: e.target.checked })}
                    className="rounded text-slate-800 mt-0.5"
                  />
                  <div>
                    <label htmlFor="room_shared" className="text-slate-900 font-bold cursor-pointer block">
                      Хуваалцах танхим
                    </label>
                    <p className="text-[11px] text-slate-600 leading-relaxed mt-0.5">
                      💡 <strong>Тайлбар:</strong> Тухайн танхим хоосон байх үед өөр ангийн дэд бүлгийн хичээл орох боломжтой.
                      <br />
                      <em>Жишээлбэл:</em> Тухайн танхимд үндсэн хичээл нь ордог 6А анги биеийн тамирын зааланд хичээлтэй үед гадаад хэлний кабинет хүрэлцээгүй 8Б ангийн 2-р дэд бүлэг энэ танхимд хичээл орох гэх мэт.
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-300">
                  <label className="block font-medium text-slate-800 mb-1">
                    Анги зэрэгцэн орох боломж (нэгэн зэрэг хичээллэх ангийн тоо):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={editingRoom.maxConcurrentClasses || 1}
                      onChange={(e) =>
                        setEditingRoom({
                          ...editingRoom,
                          maxConcurrentClasses: Math.max(1, Number(e.target.value)),
                        })
                      }
                      className="w-20 px-2 py-1 border border-slate-300 rounded font-bold bg-white text-left text-slate-800"
                    />
                    <span className="text-[11px] text-slate-700 font-medium">анги зэрэг орох боломжтой</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    <em>Жишээлбэл:</em> Урлагийн зааланд 4 анги зэрэг лекц орж болно, биеийн тамирын зааланд 2 анги зэрэг хичээллэх боломжтой гэх мэт тоог оруулна.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingRoom(null)}
                  className="px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-100 font-medium text-slate-700 cursor-pointer"
                >
                  Болих
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-slate-800 text-white font-bold hover:bg-slate-900 shadow-xs cursor-pointer"
                >
                  Хадгалах
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Subgroup Management Modal */}
      {subgroupClass && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-300 w-full max-w-md overflow-hidden animate-in fade-in">
            <div className="bg-slate-800 text-white px-4 py-2.5 text-sm font-semibold flex justify-between">
              <span>{subgroupClass.name} анги - Дэд бүлгүүд</span>
              <button onClick={() => setSubgroupClass(null)} className="text-slate-300 hover:text-white">
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <p className="text-slate-600">
                Энэ ангид гадаад хэл, технологи, биеийн тамир, мэдээлэл зүй зэрэг хичээлүүдэд хуваагдан хичээллэх
                дэд бүлгүүдийг үүсгэнэ.
              </p>

              {/* Quick Presets */}
              <div className="space-y-1.5">
                <div className="font-bold text-slate-700">Бэлэн дэд бүлэг нэмэх:</div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const cur = subgroupClass.subgroups || [];
                      const existsG = cur.some((s) => s.name === 'Охид');
                      const existsB = cur.some((s) => s.name === 'Хөвгүүд');
                      const toAdd = [];
                      if (!existsG) toAdd.push({ id: `sg_${Date.now()}_g`, name: 'Охид', category: 'gender' as const });
                      if (!existsB) toAdd.push({ id: `sg_${Date.now()}_b`, name: 'Хөвгүүд', category: 'gender' as const });
                      setSubgroupClass({ ...subgroupClass, subgroups: [...cur, ...toAdd] });
                    }}
                    className="px-2.5 py-1 bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200 rounded font-medium text-[11px] cursor-pointer"
                  >
                    + Охид / Хөвгүүд
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = subgroupClass.subgroups || [];
                      const exists1 = cur.some((s) => s.name === '1-р дэд бүлэг');
                      const exists2 = cur.some((s) => s.name === '2-р дэд бүлэг');
                      const toAdd = [];
                      if (!exists1) toAdd.push({ id: `sg_${Date.now()}_1`, name: '1-р дэд бүлэг', category: 'division' as const });
                      if (!exists2) toAdd.push({ id: `sg_${Date.now()}_2`, name: '2-р дэд бүлэг', category: 'division' as const });
                      setSubgroupClass({ ...subgroupClass, subgroups: [...cur, ...toAdd] });
                    }}
                    className="px-2.5 py-1 bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200 rounded font-medium text-[11px] cursor-pointer"
                  >
                    + 1, 2-р дэд бүлэг
                  </button>
                </div>
              </div>

              {/* Custom subgroup addition */}
              <div className="space-y-1 pt-1 border-t border-slate-200">
                <div className="font-bold text-slate-700">Нэмэлт дэд бүлэг нэмэх:</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSubgroupName}
                    onChange={(e) => setNewSubgroupName(e.target.value)}
                    placeholder="Жишээ: 3-р дэд бүлэг, Англи хэл гүнзгий..."
                    className="flex-1 px-2.5 py-1 border border-slate-300 rounded font-medium text-slate-800"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newSubgroupName.trim()) {
                          const cur = subgroupClass.subgroups || [];
                          setSubgroupClass({
                            ...subgroupClass,
                            subgroups: [...cur, { id: `sg_${Date.now()}`, name: newSubgroupName.trim(), category: 'custom' }],
                          });
                          setNewSubgroupName('');
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newSubgroupName.trim()) {
                        const cur = subgroupClass.subgroups || [];
                        setSubgroupClass({
                          ...subgroupClass,
                          subgroups: [...cur, { id: `sg_${Date.now()}`, name: newSubgroupName.trim(), category: 'custom' }],
                        });
                        setNewSubgroupName('');
                      }
                    }}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded font-medium cursor-pointer"
                  >
                    + Нэмэх
                  </button>
                </div>
              </div>

              {/* Current Subgroups List */}
              <div className="space-y-1 pt-1 border-t border-slate-200">
                <div className="font-bold text-slate-700">Одоогийн бүртгэлтэй дэд бүлгүүд:</div>
                <div className="max-h-36 overflow-y-auto border border-slate-200 rounded p-2 bg-slate-50 space-y-1.5">
                  {subgroupClass.subgroups && subgroupClass.subgroups.length > 0 ? (
                    subgroupClass.subgroups.map((sg) => (
                      <div
                        key={sg.id}
                        className="flex items-center justify-between p-1.5 bg-white border border-slate-200 rounded"
                      >
                        <span className="font-semibold text-slate-800">{sg.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const cur = subgroupClass.subgroups || [];
                            setSubgroupClass({
                              ...subgroupClass,
                              subgroups: cur.filter((s) => s.id !== sg.id),
                            });
                          }}
                          className="text-rose-600 hover:text-rose-800 text-[11px] font-semibold"
                        >
                          Устгах
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-400 italic text-center py-2">
                      Дэд бүлэг үүсгээгүй байна (Анги бүхлээрээ хичээллэнэ).
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSubgroupClass(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded font-medium text-slate-700 cursor-pointer"
                >
                  Болих
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateClasses(
                      classes.map((c) => (c.id === subgroupClass.id ? { ...c, subgroups: subgroupClass.subgroups } : c))
                    );
                    setSubgroupClass(null);
                  }}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded font-bold cursor-pointer"
                >
                  Хадгалах
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Copy Class Settings Modal */}
      {copyClassModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-300 w-full max-w-md overflow-hidden animate-in fade-in text-left">
            <div className="bg-slate-800 text-white px-4 py-2.5 text-sm font-semibold flex justify-between items-center border-b border-slate-700">
              <span>Ангийн хичээл & тохиргоог өөр ангид хуулах</span>
              <button onClick={() => setCopyClassModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs text-left">
              <div>
                <label className="block font-bold text-slate-700 mb-1 text-left">Хуулах эх анги (Source class):</label>
                <select
                  value={copyClassSourceId}
                  onChange={(e) => setCopyClassSourceId(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-bold text-slate-800 text-left"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.shift}-р ээлж) - {lessons.filter((l) => l.classId === c.id).length} хичээл
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 text-left">Хуулж авах зорилтот ангиуд (Target classes):</label>
                <div className="max-h-32 overflow-y-auto border border-slate-300 rounded bg-slate-50 p-2 space-y-1 text-left">
                  {classes
                    .filter((c) => c.id !== copyClassSourceId)
                    .map((c) => {
                      const isSelected = copyClassTargetIds.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center gap-2 p-1.5 rounded cursor-pointer border text-left ${
                            isSelected ? 'bg-slate-200 border-slate-400 font-semibold text-slate-900' : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setCopyClassTargetIds([...copyClassTargetIds, c.id]);
                              } else {
                                setCopyClassTargetIds(copyClassTargetIds.filter((id) => id !== c.id));
                              }
                            }}
                            className="rounded accent-slate-800"
                          />
                          <span className="text-left">{c.name} ({c.shift}-р ээлж)</span>
                        </label>
                      );
                    })}
                </div>
              </div>

              {/* Options */}
              <div className="bg-slate-100 p-2.5 rounded border border-slate-300 space-y-1.5 text-left">
                <div className="font-bold text-slate-900 text-left">Хуулах төрлүүд:</div>
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800 text-left">
                  <input
                    type="checkbox"
                    checked={copyClassCopyLessons}
                    onChange={(e) => setCopyClassCopyLessons(e.target.checked)}
                    className="rounded accent-slate-800"
                  />
                  <span className="text-left">Хичээлийн багц, цагуудыг хуулж үүсгэх ({lessons.filter((l) => l.classId === copyClassSourceId).length} хичээл)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800 text-left">
                  <input
                    type="checkbox"
                    checked={copyClassCopyTimeOff}
                    onChange={(e) => setCopyClassCopyTimeOff(e.target.checked)}
                    className="rounded accent-slate-800"
                  />
                  <span className="text-left">Цагийн менежмент (Time off чөлөөт цаг)-ийн тохиргоог хуулах</span>
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setCopyClassModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded font-medium text-slate-700 cursor-pointer"
                >
                  Болих
                </button>
                <button
                  type="button"
                  onClick={handleCopyClassSettings}
                  disabled={copyClassTargetIds.length === 0 || (!copyClassCopyLessons && !copyClassCopyTimeOff)}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded font-bold disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  Хуулж үүсгэх
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Copy Teacher Settings Modal */}
      {copyTeacherModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-300 w-full max-w-md overflow-hidden animate-in fade-in text-left">
            <div className="bg-slate-800 text-white px-4 py-2.5 text-sm font-semibold flex justify-between items-center border-b border-slate-700">
              <span>Багшийн цагийн менежментийг хуулах</span>
              <button onClick={() => setCopyTeacherModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs text-left">
              <div>
                <label className="block font-bold text-slate-700 mb-1 text-left">Эх багш (Source teacher):</label>
                <select
                  value={copyTeacherSourceId}
                  onChange={(e) => setCopyTeacherSourceId(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-bold text-slate-800 text-left"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.shortName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 text-left">Хуулж авах зорилтот багш нар:</label>
                <div className="max-h-36 overflow-y-auto border border-slate-300 rounded bg-slate-50 p-2 space-y-1 text-left">
                  {teachers
                    .filter((t) => t.id !== copyTeacherSourceId)
                    .map((t) => {
                      const isSelected = copyTeacherTargetIds.includes(t.id);
                      return (
                        <label
                          key={t.id}
                          className={`flex items-center gap-2 p-1.5 rounded cursor-pointer border text-left ${
                            isSelected ? 'bg-slate-200 border-slate-400 font-semibold text-slate-900' : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setCopyTeacherTargetIds([...copyTeacherTargetIds, t.id]);
                              } else {
                                setCopyTeacherTargetIds(copyTeacherTargetIds.filter((id) => id !== t.id));
                              }
                            }}
                            className="rounded accent-slate-800"
                          />
                          <span className="text-left">{t.name}</span>
                        </label>
                      );
                    })}
                </div>
              </div>

              <div className="bg-slate-100 p-2.5 rounded border border-slate-300 text-slate-700 text-[11px] text-left">
                💡 Сонгосон багшийн хичээл заах боломжгүй / чөлөөт цагийн хуваарийн тохиргоог зорилтот багш нарт хуулна.
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setCopyTeacherModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded font-medium text-slate-700 cursor-pointer"
                >
                  Болих
                </button>
                <button
                  type="button"
                  onClick={handleCopyTeacherSettings}
                  disabled={copyTeacherTargetIds.length === 0}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded font-bold disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  Хуулж тохируулах
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. TimeOff Dialogs */}
      {timeOffSubject && (
        <TimeOffMatrixDialog
          title={`${timeOffSubject.name} - Чөлөөт цаг`}
          subtitle="Хичээл орохыг хориглосон өдөр, цагуудыг улаанаар тэмдэглэнэ үү."
          initialTimeOff={timeOffSubject.timeOff || {}}
          settings={settings}
          isOpen={!!timeOffSubject}
          onClose={() => setTimeOffSubject(null)}
          onSave={(timeOff) => {
            onUpdateSubjects(
              subjects.map((s) => (s.id === timeOffSubject.id ? { ...s, timeOff } : s))
            );
          }}
        />
      )}

      {timeOffTeacher && (
        <TimeOffMatrixDialog
          title={`${timeOffTeacher.name} - Багшийн цагийн менежмент`}
          subtitle="Багш хичээл заах боломжгүй цагуудыг улаанаар тэмдэглэнэ үү."
          initialTimeOff={timeOffTeacher.timeOff || {}}
          settings={settings}
          classes={classes}
          teachers={teachers}
          onCopyToOthers={handleBatchCopyTimeOff}
          isOpen={!!timeOffTeacher}
          onClose={() => setTimeOffTeacher(null)}
          onSave={(timeOff) => {
            onUpdateTeachers(
              teachers.map((t) => (t.id === timeOffTeacher.id ? { ...t, timeOff } : t))
            );
          }}
        />
      )}

      {timeOffClass && (
        <TimeOffMatrixDialog
          title={`${timeOffClass.name} анги - Цагийн менежмент`}
          subtitle="Анги хичээллэх боломжгүй цагуудыг улаанаар тэмдэглэнэ үү."
          initialTimeOff={timeOffClass.timeOff || {}}
          settings={settings}
          classes={classes}
          teachers={teachers}
          onCopyToOthers={handleBatchCopyTimeOff}
          isOpen={!!timeOffClass}
          onClose={() => setTimeOffClass(null)}
          onSave={(timeOff) => {
            onUpdateClasses(
              classes.map((c) => (c.id === timeOffClass.id ? { ...c, timeOff } : c))
            );
          }}
        />
      )}

      {timeOffRoom && (
        <TimeOffMatrixDialog
          title={`${timeOffRoom.name} - Танхимын сул цаг`}
          subtitle="Танхим ашиглах боломжгүй цагуудыг улаанаар тэмдэглэнэ үү."
          initialTimeOff={timeOffRoom.timeOff || {}}
          settings={settings}
          isOpen={!!timeOffRoom}
          onClose={() => setTimeOffRoom(null)}
          onSave={(timeOff) => {
            onUpdateClassrooms(
              classrooms.map((r) => (r.id === timeOffRoom.id ? { ...r, timeOff } : r))
            );
          }}
        />
      )}
    </div>
  );
};
