import React, { useState } from 'react';
import { LessonContract, Subject, Teacher, ClassGroup, Classroom, WeekCycle } from '../types/timetable';
import { Plus, Edit2, Trash2, Layers, Filter, Copy, Users, Check, AlertCircle } from 'lucide-react';

interface LessonsDialogProps {
  lessons: LessonContract[];
  subjects: Subject[];
  teachers: Teacher[];
  classes: ClassGroup[];
  classrooms: Classroom[];
  enableWeekAB?: boolean;
  initialFilterSubjectId?: string;
  initialFilterTeacherId?: string;
  initialFilterClassId?: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdateLessons: (lessons: LessonContract[]) => void;
}

export const LessonsDialog: React.FC<LessonsDialogProps> = ({
  lessons,
  subjects,
  teachers,
  classes,
  classrooms,
  enableWeekAB = false,
  initialFilterSubjectId,
  initialFilterTeacherId,
  initialFilterClassId,
  isOpen,
  onClose,
  onUpdateLessons,
}) => {
  const [filterClass, setFilterClass] = useState<string>(initialFilterClassId || 'all');
  const [filterSubject, setFilterSubject] = useState<string>(initialFilterSubjectId || 'all');
  const [filterTeacher, setFilterTeacher] = useState<string>(initialFilterTeacherId || 'all');

  const [selectedId, setSelectedId] = useState<string>(lessons[0]?.id || '');
  const [editingLesson, setEditingLesson] = useState<LessonContract | null>(null);
  const [isNew, setIsNew] = useState(false);

  // Copy modal state
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copySourceClassId, setCopySourceClassId] = useState<string>(classes[0]?.id || '');
  const [copyTargetClassIds, setCopyTargetClassIds] = useState<string[]>([]);

  if (!isOpen) return null;

  const filteredLessons = lessons.filter((l) => {
    if (filterClass !== 'all' && l.classId !== filterClass) return false;
    if (filterSubject !== 'all' && l.subjectId !== filterSubject) return false;
    if (filterTeacher !== 'all' && l.teacherId !== filterTeacher) return false;
    return true;
  });

  const selectedLesson = lessons.find((l) => l.id === selectedId);

  const handleCreateNew = () => {
    setIsNew(true);
    setEditingLesson({
      id: `l_${Date.now()}`,
      subjectId: filterSubject !== 'all' ? filterSubject : subjects[0]?.id || '',
      teacherId: filterTeacher !== 'all' ? filterTeacher : teachers[0]?.id || '',
      classId: filterClass !== 'all' ? filterClass : classes[0]?.id || '',
      totalPeriods: 2,
      singleLessons: 2,
      doubleLessons: 0,
      coTeacherIds: [],
      jointClassIds: [],
      subgroupName: undefined,
      classroomId: undefined,
      weekCycle: 'all',
    });
  };

  const handleEdit = (l: LessonContract) => {
    setIsNew(false);
    setEditingLesson({
      ...l,
      coTeacherIds: l.coTeacherIds || [],
      jointClassIds: l.jointClassIds || [],
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('Энэ хичээлийн төлөвлөгөөг устгахдаа итгэлтэй байна уу?')) {
      const next = lessons.filter((l) => l.id !== id);
      onUpdateLessons(next);
      if (selectedId === id) setSelectedId(next[0]?.id || '');
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLesson) return;

    const calculatedTotal = (editingLesson.doubleLessons || 0) * 2 + (editingLesson.singleLessons || 0);
    const toSave: LessonContract = {
      ...editingLesson,
      totalPeriods: calculatedTotal,
      weekCycle: enableWeekAB ? editingLesson.weekCycle : 'all',
    };

    if (isNew) {
      onUpdateLessons([...lessons, toSave]);
      setSelectedId(toSave.id);
    } else {
      onUpdateLessons(lessons.map((l) => (l.id === toSave.id ? toSave : l)));
    }
    setEditingLesson(null);
  };

  const handleExecuteCopyHours = () => {
    if (!copySourceClassId || copyTargetClassIds.length === 0) {
      alert('Эх анги болон хуулах зорилтот ангиудыг сонгоно уу.');
      return;
    }

    const sourceLessons = lessons.filter((l) => l.classId === copySourceClassId);
    if (sourceLessons.length === 0) {
      alert('Сонгосон эх ангид ямар нэгэн хичээл бүртгэгдээгүй байна.');
      return;
    }

    const newCreatedLessons: LessonContract[] = [];
    copyTargetClassIds.forEach((targetClassId) => {
      sourceLessons.forEach((src) => {
        newCreatedLessons.push({
          ...src,
          id: `l_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          classId: targetClassId,
          jointClassIds: [], // reset joint classes for the copy
        });
      });
    });

    onUpdateLessons([...lessons, ...newCreatedLessons]);
    setShowCopyModal(false);
    alert(`${copyTargetClassIds.length} ангид нийт ${newCreatedLessons.length} хичээлийн цагийн тохиргоог амжилттай хууллаа!`);
  };

  const currentEditClass = classes.find((c) => c.id === editingLesson?.classId);
  const availableSubgroups = currentEditClass?.subgroups && currentEditClass.subgroups.length > 0
    ? currentEditClass.subgroups.map((s) => s.name)
    : ['Охид', 'Хөвгүүд', '1-р дэд бүлэг', '2-р дэд бүлэг'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none">
      <div className="bg-slate-50 rounded-lg shadow-2xl border border-slate-300 w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Title bar */}
        <div className="bg-gradient-to-r from-pink-700 to-rose-700 text-white px-4 py-2 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-pink-200" />
            <span className="font-semibold text-sm">Хичээл & Цагийн хуваарилалт</span>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-red-600 rounded px-2 py-0.5 text-xs font-bold"
          >
            ✕
          </button>
        </div>

        {/* Filter bar */}
        <div className="bg-white border-b border-slate-300 px-4 py-2 flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-slate-700">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span>Шүүлтүүр:</span>
          </div>

          <div>
            <label className="text-slate-500 mr-1.5">Анги:</label>
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="px-2 py-1 border border-slate-300 rounded font-medium"
            >
              <option value="all">Бүх анги</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.shift}-р ээлж)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-slate-500 mr-1.5">Хичээл:</label>
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="px-2 py-1 border border-slate-300 rounded font-medium"
            >
              <option value="all">Бүх хичээл</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-slate-500 mr-1.5">Багш:</label>
            <select
              value={filterTeacher}
              onChange={(e) => setFilterTeacher(e.target.value)}
              className="px-2 py-1 border border-slate-300 rounded font-medium"
            >
              <option value="all">Бүх багш</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="ml-auto text-slate-500 font-medium">
            Нийт багц: {filteredLessons.length}
          </div>
        </div>

        {/* Table + Actions */}
        <div className="flex flex-1 overflow-hidden p-3 gap-3">
          <div className="flex-1 flex flex-col border border-slate-300 rounded bg-white overflow-hidden shadow-inner">
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 sticky top-0 border-b border-slate-300 select-none shadow-xs">
                  <tr>
                    <th className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-700 w-28">Анги / Дэд бүлэг</th>
                    <th className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-700">Хичээл</th>
                    <th className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-700">Багш & Хамтрагч</th>
                    <th className="py-2 px-2 border-r border-slate-300 font-semibold text-slate-700 w-20 text-center">7 хоногт</th>
                    {enableWeekAB && (
                      <th className="py-2 px-2 border-r border-slate-300 font-semibold text-slate-700 w-24 text-center">А/Б 7 хоног</th>
                    )}
                    <th className="py-2 px-3 font-semibold text-slate-700 w-32">Танхим</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredLessons.map((l) => {
                    const isSelected = l.id === selectedId;
                    const sub = subjects.find((s) => s.id === l.subjectId);
                    const teacher = teachers.find((t) => t.id === l.teacherId);
                    const coTeachers = teachers.filter((t) => l.coTeacherIds?.includes(t.id));
                    const cls = classes.find((c) => c.id === l.classId);
                    const jointClasses = classes.filter((c) => l.jointClassIds?.includes(c.id));
                    const room = classrooms.find((r) => r.id === l.classroomId);

                    return (
                      <tr
                        key={l.id}
                        onClick={() => setSelectedId(l.id)}
                        onDoubleClick={() => handleEdit(l)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-pink-700 text-white font-medium' : 'hover:bg-pink-50/60 text-slate-800'
                        }`}
                      >
                        <td className="py-1.5 px-3 border-r border-slate-200">
                          <div className="font-bold flex items-center gap-1">
                            <span>{cls?.name || l.classId}</span>
                            {jointClasses.length > 0 && (
                              <span className={`text-[10px] px-1 rounded ${isSelected ? 'bg-pink-900 text-pink-100' : 'bg-blue-100 text-blue-700'}`}>
                                +{jointClasses.map((c) => c.name).join(', ')}
                              </span>
                            )}
                          </div>
                          {l.subgroupName && (
                            <span className={`text-[10px] px-1 py-0.2 rounded font-semibold inline-block ${isSelected ? 'bg-pink-800 text-pink-200' : 'bg-purple-100 text-purple-700'}`}>
                              {l.subgroupName}
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 border-r border-slate-200 flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: sub?.color || '#cbd5e1' }}
                          />
                          <span className="truncate">{sub?.name || l.subjectId}</span>
                        </td>
                        <td className="py-1.5 px-3 border-r border-slate-200">
                          <div className="truncate font-semibold">{teacher?.name || l.teacherId}</div>
                          {coTeachers.length > 0 && (
                            <div className={`text-[10px] truncate ${isSelected ? 'text-pink-200' : 'text-slate-500'}`}>
                              Хамтран: {coTeachers.map((ct) => ct.shortName || ct.name).join(', ')}
                            </div>
                          )}
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-200 text-center font-bold">
                          {l.totalPeriods} цаг
                        </td>
                        {enableWeekAB && (
                          <td className="py-1.5 px-2 border-r border-slate-200 text-center">
                            {l.weekCycle === 'week_a' ? (
                              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[10px]">
                                А 7 хоног
                              </span>
                            ) : l.weekCycle === 'week_b' ? (
                              <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded font-bold text-[10px]">
                                Б 7 хоног
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[10px]">Бүх 7 хоног</span>
                            )}
                          </td>
                        )}
                        <td className="py-1.5 px-3 text-[11px] truncate">
                          {room ? (
                            <span>
                              {room.name}
                              {room.isShared && <span className="ml-1 text-[9px] text-amber-600 font-bold">[Хуваалцах]</span>}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Ангийн өрөө</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action buttons */}
          <div className="w-32 flex flex-col gap-2 shrink-0 select-none">
            <button
              onClick={handleCreateNew}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-emerald-700 hover:bg-emerald-50 shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4 text-emerald-600" />
              <span>Шинэ</span>
            </button>
            <button
              disabled={!selectedLesson}
              onClick={() => selectedLesson && handleEdit(selectedLesson)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-blue-700 hover:bg-blue-50 shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              <Edit2 className="w-4 h-4 text-blue-600" />
              <span>Засварлах</span>
            </button>
            <button
              disabled={!selectedLesson}
              onClick={() => selectedLesson && handleDelete(selectedLesson.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-rose-700 hover:bg-rose-50 shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Устгах</span>
            </button>

            <div className="h-2"></div>

            {/* Хуулах товч */}
            <button
              onClick={() => {
                setCopySourceClassId(filterClass !== 'all' ? filterClass : classes[0]?.id || '');
                setCopyTargetClassIds([]);
                setShowCopyModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-purple-700 hover:bg-purple-50 shadow-xs transition cursor-pointer"
              title="Нэг ангийн бүх хичээлийн цагийн тохиргоог өөр ангид хуулах"
            >
              <Copy className="w-4 h-4 text-purple-600" />
              <span>Хуулах</span>
            </button>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="bg-slate-200/90 px-4 py-2 border-t border-slate-300 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-1 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-800 hover:bg-slate-100 shadow-xs cursor-pointer"
          >
            Хаах
          </button>
        </div>
      </div>

      {/* Edit / Create Lesson Contract Modal */}
      {editingLesson && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-300 w-full max-w-lg overflow-hidden animate-in fade-in">
            <div className="bg-gradient-to-r from-pink-700 to-rose-700 text-white px-4 py-2.5 text-sm font-semibold flex justify-between">
              <span>{isNew ? 'Шинэ хичээл үүсгэх' : 'Хичээлийн тохиргоо засварлах'}</span>
              <button onClick={() => setEditingLesson(null)} className="text-white hover:text-red-200">
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-4 space-y-3 text-xs max-h-[80vh] overflow-y-auto">
              {/* 1. Үндсэн анги & Хичээл */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Үндсэн анги:</label>
                  <select
                    value={editingLesson.classId}
                    onChange={(e) => setEditingLesson({ ...editingLesson, classId: e.target.value })}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded font-bold"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.shift}-р ээлж)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Хичээл:</label>
                  <select
                    value={editingLesson.subjectId}
                    onChange={(e) => setEditingLesson({ ...editingLesson, subjectId: e.target.value })}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded font-semibold text-blue-700"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 2. Дэд бүлэг & Хамтатгах өөр ангиуд */}
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200 space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Дэд бүлэг:</label>
                    <select
                      value={editingLesson.subgroupName || ''}
                      onChange={(e) =>
                        setEditingLesson({
                          ...editingLesson,
                          subgroupName: e.target.value || undefined,
                        })
                      }
                      className="w-full px-2 py-1 border border-slate-300 rounded bg-white font-medium"
                    >
                      <option value="">(Бүхэл анги - Бүгд орно)</option>
                      {availableSubgroups.map((sgName) => (
                        <option key={sgName} value={sgName}>
                          {sgName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Хамтатгах өөр ангиуд:</label>
                    <div className="max-h-20 overflow-y-auto border border-slate-300 rounded bg-white p-1 space-y-0.5">
                      {classes
                        .filter((c) => c.id !== editingLesson.classId)
                        .map((c) => {
                          const isChecked = editingLesson.jointClassIds?.includes(c.id);
                          return (
                            <label key={c.id} className="flex items-center gap-1.5 px-1 py-0.5 hover:bg-slate-100 rounded cursor-pointer text-[11px]">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const currentJoints = editingLesson.jointClassIds || [];
                                  if (e.target.checked) {
                                    setEditingLesson({ ...editingLesson, jointClassIds: [...currentJoints, c.id] });
                                  } else {
                                    setEditingLesson({ ...editingLesson, jointClassIds: currentJoints.filter((id) => id !== c.id) });
                                  }
                                }}
                                className="rounded text-pink-600"
                              />
                              <span>{c.name} ({c.shift}-р ээлж)</span>
                            </label>
                          );
                        })}
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Үндсэн багш & Хамтран заах багш нар */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Үндсэн заах багш:</label>
                  <select
                    value={editingLesson.teacherId}
                    onChange={(e) => setEditingLesson({ ...editingLesson, teacherId: e.target.value })}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded font-semibold text-slate-800"
                  >
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Хамтран заах багш нар:</label>
                  <div className="max-h-24 overflow-y-auto border border-slate-300 rounded bg-white p-1 space-y-0.5">
                    {teachers
                      .filter((t) => t.id !== editingLesson.teacherId)
                      .map((t) => {
                        const isChecked = editingLesson.coTeacherIds?.includes(t.id);
                        return (
                          <label key={t.id} className="flex items-center gap-1.5 px-1 py-0.5 hover:bg-slate-100 rounded cursor-pointer text-[11px]">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const currentCo = editingLesson.coTeacherIds || [];
                                if (e.target.checked) {
                                  setEditingLesson({ ...editingLesson, coTeacherIds: [...currentCo, t.id] });
                                } else {
                                  setEditingLesson({ ...editingLesson, coTeacherIds: currentCo.filter((id) => id !== t.id) });
                                }
                              }}
                              className="rounded text-pink-600"
                            />
                            <span>{t.name}</span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              </div>

              {/* 4. Орох танхим сонгох */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">Орох танхим:</label>
                <select
                  value={editingLesson.classroomId || ''}
                  onChange={(e) => setEditingLesson({ ...editingLesson, classroomId: e.target.value || undefined })}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded font-medium"
                >
                  <option value="">-- Ангийн үндсэн өрөөнд --</option>
                  {classrooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.capacity} суудал) {r.isShared ? '[Хуваалцах]' : ''} {r.maxConcurrentClasses && r.maxConcurrentClasses > 1 ? `[Зэрэгцэх: ${r.maxConcurrentClasses} анги]` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* 5. A/B 7 хоног сонголт (хэрэв enableWeekAB идэвхжсэн бол) */}
              {enableWeekAB && (
                <div className="bg-amber-50/80 p-2.5 rounded border border-amber-200">
                  <label className="block font-bold text-amber-900 mb-1">7 хоногийн давтамж (А/Б 7 хоног):</label>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="week_cycle"
                        checked={editingLesson.weekCycle === 'all'}
                        onChange={() => setEditingLesson({ ...editingLesson, weekCycle: 'all' })}
                      />
                      <span>Бүх 7 хоногт</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer font-bold text-amber-800">
                      <input
                        type="radio"
                        name="week_cycle"
                        checked={editingLesson.weekCycle === 'week_a'}
                        onChange={() => setEditingLesson({ ...editingLesson, weekCycle: 'week_a' })}
                      />
                      <span>А 7 хоногт</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer font-bold text-purple-800">
                      <input
                        type="radio"
                        name="week_cycle"
                        checked={editingLesson.weekCycle === 'week_b'}
                        onChange={() => setEditingLesson({ ...editingLesson, weekCycle: 'week_b' })}
                      />
                      <span>Б 7 хоногт</span>
                    </label>
                  </div>
                </div>
              )}

              {/* 6. Цагийн тохиргоо */}
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200 space-y-2">
                <div className="font-semibold text-slate-800">7 хоногт орох цагийн хуваарилалт:</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">Хос цаг (2 цаг):</label>
                    <input
                      type="number"
                      min="0"
                      max="5"
                      value={editingLesson.doubleLessons || 0}
                      onChange={(e) =>
                        setEditingLesson({ ...editingLesson, doubleLessons: Number(e.target.value) })
                      }
                      className="w-full px-2 py-1 border border-slate-300 rounded font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Дан цаг (1 цаг):</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={editingLesson.singleLessons || 0}
                      onChange={(e) =>
                        setEditingLesson({ ...editingLesson, singleLessons: Number(e.target.value) })
                      }
                      className="w-full px-2 py-1 border border-slate-300 rounded font-bold"
                    />
                  </div>
                </div>
                <div className="text-right text-xs font-bold text-pink-700">
                  Нийт цаг: {(editingLesson.doubleLessons || 0) * 2 + (editingLesson.singleLessons || 0)} цаг
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingLesson(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded font-medium text-slate-700 cursor-pointer"
                >
                  Болих
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-pink-700 hover:bg-pink-800 text-white rounded font-semibold cursor-pointer"
                >
                  Хадгалах
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Copy Hours Modal */}
      {showCopyModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-300 w-full max-w-md overflow-hidden animate-in fade-in">
            <div className="bg-gradient-to-r from-purple-700 to-indigo-700 text-white px-4 py-2.5 text-sm font-semibold flex justify-between">
              <span>Хичээлийн цагийн тохиргоог өөр ангид хуулах</span>
              <button onClick={() => setShowCopyModal(false)} className="text-white hover:text-purple-200">
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Хуулах эх анги (Source class):</label>
                <select
                  value={copySourceClassId}
                  onChange={(e) => setCopySourceClassId(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-bold text-purple-700"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.shift}-р ээлж) - {lessons.filter((l) => l.classId === c.id).length} хичээл
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Хуулж авах зорилтот ангиуд (Target classes):</label>
                <div className="max-h-36 overflow-y-auto border border-slate-300 rounded bg-slate-50 p-2 space-y-1">
                  {classes
                    .filter((c) => c.id !== copySourceClassId)
                    .map((c) => {
                      const isSelected = copyTargetClassIds.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center gap-2 p-1.5 rounded cursor-pointer border ${
                            isSelected ? 'bg-purple-100 border-purple-300 font-semibold' : 'bg-white border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setCopyTargetClassIds([...copyTargetClassIds, c.id]);
                              } else {
                                setCopyTargetClassIds(copyTargetClassIds.filter((id) => id !== c.id));
                              }
                            }}
                            className="rounded text-purple-600"
                          />
                          <span>{c.name} ({c.shift}-р ээлж)</span>
                        </label>
                      );
                    })}
                </div>
              </div>

              <div className="bg-purple-50 p-2 rounded border border-purple-200 text-purple-900 text-[11px]">
                💡 Энэ үйлдэл нь сонгосон эх ангийн бүх хичээлийн багц, 7 хоногийн цаг, хос/дан цагийн тохиргоог зорилтот ангиудад хуулж үүсгэнэ.
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCopyModal(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded font-medium text-slate-700 cursor-pointer"
                >
                  Болих
                </button>
                <button
                  type="button"
                  onClick={handleExecuteCopyHours}
                  disabled={copyTargetClassIds.length === 0}
                  className="px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded font-bold disabled:opacity-50 cursor-pointer"
                >
                  Хуулж үүсгэх
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
