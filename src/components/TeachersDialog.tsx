import React, { useState } from 'react';
import { Teacher, LessonContract, SchoolSettings } from '../types/timetable';
import { Plus, Edit2, Trash2, Clock, BookOpen, Users, DoorOpen, GraduationCap, ArrowUp, ArrowDown } from 'lucide-react';
import { TimeOffMatrixDialog } from './TimeOffMatrixDialog';

interface TeachersDialogProps {
  teachers: Teacher[];
  lessons: LessonContract[];
  settings: SchoolSettings;
  isOpen: boolean;
  onClose: () => void;
  onUpdateTeachers: (teachers: Teacher[]) => void;
  onNavigateTab?: (tab: 'subjects' | 'classes' | 'classrooms' | 'teachers') => void;
  onOpenLessonsForTeacher?: (teacherId: string) => void;
  onOpenConstraints?: () => void;
  onOpenExcelImport?: () => void;
}

export const TeachersDialog: React.FC<TeachersDialogProps> = ({
  teachers,
  lessons,
  settings,
  isOpen,
  onClose,
  onUpdateTeachers,
  onNavigateTab,
  onOpenLessonsForTeacher,
  onOpenConstraints,
  onOpenExcelImport,
}) => {
  const [selectedId, setSelectedId] = useState<string>(teachers[0]?.id || '');
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [timeOffTeacher, setTimeOffTeacher] = useState<Teacher | null>(null);

  if (!isOpen) return null;

  const selectedTeacher = teachers.find((t) => t.id === selectedId);

  const getTeacherCount = (teacherId: string) => {
    return lessons
      .filter((l) => l.teacherId === teacherId)
      .reduce((sum, l) => sum + l.totalPeriods, 0);
  };

  const handleCreateNew = () => {
    setIsNew(true);
    setEditingTeacher({
      id: `t_${Date.now()}`,
      name: '',
      shortName: '',
      color: '#10b981',
      maxPeriodsPerDay: 5,
      maxGapsPerDay: 1,
      timeOff: {},
    });
  };

  const handleEdit = (t: Teacher) => {
    setIsNew(false);
    setEditingTeacher({ ...t });
  };

  const handleDelete = (id: string) => {
    if (confirm('Энэ багшийг устгах уу? Багшийн заах хичээлүүдийн төлөвлөгөө цуцлагдана.')) {
      const next = teachers.filter((t) => t.id !== id);
      onUpdateTeachers(next);
      if (selectedId === id) setSelectedId(next[0]?.id || '');
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher || !editingTeacher.name.trim()) return;

    if (isNew) {
      onUpdateTeachers([...teachers, editingTeacher]);
      setSelectedId(editingTeacher.id);
    } else {
      onUpdateTeachers(teachers.map((t) => (t.id === editingTeacher.id ? editingTeacher : t)));
    }
    setEditingTeacher(null);
  };

  const moveTeacher = (direction: 'up' | 'down') => {
    const idx = teachers.findIndex((t) => t.id === selectedId);
    if (idx < 0) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= teachers.length) return;

    const list = [...teachers];
    const temp = list[idx];
    list[idx] = list[targetIdx];
    list[targetIdx] = temp;
    onUpdateTeachers(list);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-hidden">
      <div className="bg-slate-50 rounded-lg shadow-2xl border border-slate-300 w-full max-w-4xl overflow-hidden flex flex-col h-[86vh] max-h-[680px]">
        {/* Title bar */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 text-white px-4 py-2 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-sky-200" />
            <span className="font-semibold text-sm">Багш нар (Teachers)</span>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-red-600 rounded px-2 py-0.5 text-xs font-bold"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden p-3 gap-3">
          {/* Left quick switchers */}
          <div className="w-14 bg-slate-200/80 rounded border border-slate-300 flex flex-col items-center py-3 gap-4 shrink-0">
            <button
              onClick={() => onNavigateTab?.('subjects')}
              title="Хичээлүүд"
              className="w-10 h-10 rounded bg-white border border-slate-300 flex items-center justify-center shadow-xs text-blue-600 hover:bg-slate-100 hover:scale-105 transition"
            >
              <BookOpen className="w-6 h-6" />
            </button>
            <button
              onClick={() => onNavigateTab?.('classes')}
              title="Анги бүлгүүд"
              className="w-10 h-10 rounded bg-white border border-slate-300 flex items-center justify-center shadow-xs text-amber-600 hover:bg-slate-100 hover:scale-105 transition"
            >
              <Users className="w-6 h-6" />
            </button>
            <button
              onClick={() => onNavigateTab?.('classrooms')}
              title="Анги танхим"
              className="w-10 h-10 rounded bg-white border border-slate-300 flex items-center justify-center shadow-xs text-amber-700 hover:bg-slate-100 hover:scale-105 transition"
            >
              <DoorOpen className="w-6 h-6" />
            </button>
            <button
              onClick={() => onNavigateTab?.('teachers')}
              title="Багш нар"
              className="w-10 h-10 rounded bg-indigo-100 border border-indigo-400 flex items-center justify-center shadow-xs text-indigo-700 hover:scale-105 transition"
            >
              <GraduationCap className="w-6 h-6 text-indigo-700" />
            </button>
          </div>

          {/* Table */}
          <div className="flex-1 flex flex-col border border-slate-300 rounded bg-white overflow-hidden shadow-inner">
            <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-300 text-xs font-semibold text-slate-700">
              Багш нарын жагсаалт (Enter teachers):
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 sticky top-0 border-b border-slate-300 select-none shadow-xs">
                  <tr>
                    <th className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-700">Багшийн нэр (Name)</th>
                    <th className="py-2 px-2 border-r border-slate-300 font-semibold text-slate-700 w-24">Товч нэр</th>
                    <th className="py-2 px-2 border-r border-slate-300 font-semibold text-slate-700 w-16 text-center">Цаг</th>
                    <th className="py-2 px-2 border-r border-slate-300 font-semibold text-slate-700 w-28 text-center">Чөлөөт цаг</th>
                    <th className="py-2 px-2 border-r border-slate-300 font-semibold text-slate-700 w-20 text-center">Дээд цаг/өдөр</th>
                    <th className="py-2 px-2 font-semibold text-slate-700 w-20 text-center">Цонх цаг</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {teachers.map((t) => {
                    const isSelected = t.id === selectedId;
                    const count = getTeacherCount(t.id);
                    return (
                      <tr
                        key={t.id}
                        onClick={() => setSelectedId(t.id)}
                        onDoubleClick={() => handleEdit(t)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-indigo-600 text-white font-medium' : 'hover:bg-indigo-50/60 text-slate-800'
                        }`}
                      >
                        <td className="py-1.5 px-3 border-r border-slate-200 flex items-center gap-2">
                          <span
                            className="w-3.5 h-3.5 rounded-sm border shrink-0"
                            style={{ backgroundColor: t.color, borderColor: isSelected ? '#ffffff' : '#94a3b8' }}
                          />
                          <span className="truncate">{t.name}</span>
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-200 text-[11px]">{t.shortName}</td>
                        <td className="py-1.5 px-2 border-r border-slate-200 text-center font-bold">
                          {count}
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-200 text-center">
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setTimeOffTeacher(t);
                            }}
                            className={`inline-grid grid-cols-5 gap-[1px] p-[2px] rounded border hover:scale-105 transition cursor-pointer ${
                              isSelected ? 'bg-indigo-800 border-indigo-400' : 'bg-slate-200 border-slate-300'
                            }`}
                            title="Чөлөөт цаг засах"
                          >
                            {Array.from({ length: 15 }).map((_, idx) => {
                              const day = idx % 5;
                              const p = Math.floor(idx / 5);
                              const isForbidden = t.timeOff[`${day}_${p}`] === 'forbidden';
                              return (
                                <div
                                  key={idx}
                                  className={`w-2 h-1.5 rounded-[1px] ${
                                    isForbidden ? 'bg-rose-500' : 'bg-emerald-500'
                                  }`}
                                />
                              );
                            })}
                          </div>
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-200 text-center">{t.maxPeriodsPerDay || 5}</td>
                        <td className="py-1.5 px-2 text-center">{t.maxGapsPerDay || 1}</td>
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
              onClick={handleCreateNew}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-emerald-700 hover:bg-emerald-50 shadow-xs transition"
            >
              <Plus className="w-4 h-4 text-emerald-600" />
              <span>+ New</span>
            </button>
            <button
              disabled={!selectedTeacher}
              onClick={() => selectedTeacher && handleEdit(selectedTeacher)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-blue-700 hover:bg-blue-50 shadow-xs transition disabled:opacity-50"
            >
              <Edit2 className="w-4 h-4 text-blue-600" />
              <span>Edit</span>
            </button>
            <button
              disabled={!selectedTeacher}
              onClick={() => selectedTeacher && handleDelete(selectedTeacher.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-rose-700 hover:bg-rose-50 shadow-xs transition disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Remove</span>
            </button>

            <div className="h-2"></div>

            <button
              disabled={!selectedTeacher}
              onClick={() => selectedTeacher && onOpenLessonsForTeacher?.(selectedTeacher.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-pink-700 hover:bg-pink-50 shadow-xs transition disabled:opacity-50"
            >
              <span className="w-3 h-3 bg-pink-600 rounded-[2px]" />
              <span>Lessons</span>
            </button>

            <button
              disabled={!selectedTeacher}
              onClick={() => selectedTeacher && setTimeOffTeacher(selectedTeacher)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-700 hover:bg-slate-100 shadow-xs transition disabled:opacity-50"
            >
              <Clock className="w-4 h-4 text-sky-600" />
              <span>Time off</span>
            </button>

            <div className="flex-1"></div>

            <div className="flex justify-center gap-2 py-1">
              <button
                onClick={() => moveTeacher('up')}
                className="p-1.5 bg-white border border-slate-300 rounded hover:bg-slate-100 shadow-xs"
                title="Дээш зөөх"
              >
                <ArrowUp className="w-4 h-4 text-slate-600" />
              </button>
              <button
                onClick={() => moveTeacher('down')}
                className="p-1.5 bg-white border border-slate-300 rounded hover:bg-slate-100 shadow-xs"
                title="Доош зөөх"
              >
                <ArrowDown className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="bg-slate-200/90 px-4 py-2 border-t border-slate-300 flex items-center justify-between">
          <button
            onClick={onOpenExcelImport}
            className="px-3 py-1 bg-amber-50 border border-amber-300 rounded text-xs font-medium text-amber-800 hover:bg-amber-100 shadow-xs"
          >
            📥 Багш нарыг Excel-ээс татах
          </button>
          <button
            onClick={onClose}
            className="px-5 py-1 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-800 hover:bg-slate-100 shadow-xs"
          >
            Close
          </button>
        </div>
      </div>

      {/* Edit Teacher Modal */}
      {editingTeacher && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-300 w-full max-w-md overflow-hidden">
            <div className="bg-indigo-600 text-white px-4 py-2 text-sm font-semibold flex justify-between">
              <span>{isNew ? 'Шинэ багш бүртгэх' : 'Багшийн мэдээлэл засах'}</span>
              <button onClick={() => setEditingTeacher(null)} className="text-white hover:text-red-200">
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Багшийн бүтэн нэр:</label>
                <input
                  type="text"
                  required
                  value={editingTeacher.name}
                  onChange={(e) => setEditingTeacher({ ...editingTeacher, name: e.target.value })}
                  placeholder="Жишээ: Б. Бат-Эрдэнэ"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Товч нэр (Short):</label>
                  <input
                    type="text"
                    required
                    value={editingTeacher.shortName}
                    onChange={(e) => setEditingTeacher({ ...editingTeacher, shortName: e.target.value })}
                    placeholder="Жишээ: Бат-Эрдэнэ"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Өнгө (Color):</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={editingTeacher.color}
                      onChange={(e) => setEditingTeacher({ ...editingTeacher, color: e.target.value })}
                      className="w-8 h-8 rounded border border-slate-300 cursor-pointer p-0"
                    />
                    <span className="font-mono text-slate-600">{editingTeacher.color}</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Өдөрт орох дээд цаг:</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={editingTeacher.maxPeriodsPerDay}
                    onChange={(e) =>
                      setEditingTeacher({ ...editingTeacher, maxPeriodsPerDay: Number(e.target.value) })
                    }
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Дээд цонх цаг (Өдөрт):</label>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    value={editingTeacher.maxGapsPerDay}
                    onChange={(e) =>
                      setEditingTeacher({ ...editingTeacher, maxGapsPerDay: Number(e.target.value) })
                    }
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingTeacher(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded font-medium text-slate-700"
                >
                  Болих
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-semibold"
                >
                  Хадгалах
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Time-off */}
      {timeOffTeacher && (
        <TimeOffMatrixDialog
          isOpen={true}
          title={timeOffTeacher.name}
          subtitle="Багш хичээл заах боломжгүй, чөлөө авсан өдөр цагуудыг улаанаар тэмдэглэнэ үү."
          initialTimeOff={timeOffTeacher.timeOff}
          settings={settings}
          onClose={() => setTimeOffTeacher(null)}
          onSave={(matrix) => {
            onUpdateTeachers(
              teachers.map((t) => (t.id === timeOffTeacher.id ? { ...t, timeOff: matrix } : t))
            );
          }}
        />
      )}
    </div>
  );
};
