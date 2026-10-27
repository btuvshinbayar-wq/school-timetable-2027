import React, { useState } from 'react';
import { ClassGroup, LessonContract, Teacher, Classroom, Building, SchoolSettings } from '../types/timetable';
import { Plus, Edit2, Trash2, Clock, BookOpen, Users, DoorOpen, GraduationCap, ArrowUp, ArrowDown } from 'lucide-react';
import { TimeOffMatrixDialog } from './TimeOffMatrixDialog';

interface ClassesDialogProps {
  classes: ClassGroup[];
  lessons: LessonContract[];
  teachers: Teacher[];
  classrooms: Classroom[];
  buildings: Building[];
  settings: SchoolSettings;
  isOpen: boolean;
  onClose: () => void;
  onUpdateClasses: (classes: ClassGroup[]) => void;
  onNavigateTab?: (tab: 'subjects' | 'classes' | 'classrooms' | 'teachers') => void;
  onOpenLessonsForClass?: (classId: string) => void;
  onOpenExcelImport?: () => void;
}

export const ClassesDialog: React.FC<ClassesDialogProps> = ({
  classes,
  lessons,
  teachers,
  classrooms,
  buildings,
  settings,
  isOpen,
  onClose,
  onUpdateClasses,
  onNavigateTab,
  onOpenLessonsForClass,
  onOpenExcelImport,
}) => {
  const [selectedId, setSelectedId] = useState<string>(classes[0]?.id || '');
  const [editingClass, setEditingClass] = useState<ClassGroup | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [timeOffClass, setTimeOffClass] = useState<ClassGroup | null>(null);

  if (!isOpen) return null;

  const selectedClass = classes.find((c) => c.id === selectedId);

  const getClassCount = (classId: string) => {
    return lessons
      .filter((l) => l.classId === classId)
      .reduce((sum, l) => sum + l.totalPeriods, 0);
  };

  const handleCreateNew = () => {
    setIsNew(true);
    setEditingClass({
      id: `c_${Date.now()}`,
      name: '',
      shortName: '',
      grade: 10,
      shift: 1,
      buildingId: buildings[0]?.id || '',
      color: '#38bdf8',
      maxPeriodsPerDay: 6,
      timeOff: {},
    });
  };

  const handleEdit = (c: ClassGroup) => {
    setIsNew(false);
    setEditingClass({ ...c });
  };

  const handleDelete = (id: string) => {
    if (confirm('Энэ ангийг устгах уу? Ангид хуваарилагдсан хичээлийн төлөвлөгөө цуцлагдана.')) {
      const next = classes.filter((c) => c.id !== id);
      onUpdateClasses(next);
      if (selectedId === id) setSelectedId(next[0]?.id || '');
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass || !editingClass.name.trim()) return;

    if (isNew) {
      onUpdateClasses([...classes, editingClass]);
      setSelectedId(editingClass.id);
    } else {
      onUpdateClasses(classes.map((c) => (c.id === editingClass.id ? editingClass : c)));
    }
    setEditingClass(null);
  };

  const moveClass = (direction: 'up' | 'down') => {
    const idx = classes.findIndex((c) => c.id === selectedId);
    if (idx < 0) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= classes.length) return;

    const list = [...classes];
    const temp = list[idx];
    list[idx] = list[targetIdx];
    list[targetIdx] = temp;
    onUpdateClasses(list);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-hidden">
      <div className="bg-slate-50 rounded-lg shadow-2xl border border-slate-300 w-full max-w-4xl overflow-hidden flex flex-col h-[86vh] max-h-[680px]">
        {/* Title bar */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 text-white px-4 py-2 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-sky-200" />
            <span className="font-semibold text-sm">Анги бүлгүүд & Ээлжийн хуваарилалт (Classes)</span>
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
          {/* Table */}
          <div className="flex-1 flex flex-col border border-slate-300 rounded bg-white overflow-hidden shadow-inner">
            <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-300 text-xs font-semibold text-slate-700">
              Ангиудын жагсаалт ({classes.length}):
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 sticky top-0 border-b border-slate-300 select-none shadow-xs">
                  <tr>
                    <th className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-700">Анги</th>
                    <th className="py-2 px-2 border-r border-slate-300 font-semibold text-slate-700 w-20 text-center">Ээлж</th>
                    <th className="py-2 px-2 border-r border-slate-300 font-semibold text-slate-700 w-28">Байр</th>
                    <th className="py-2 px-2 border-r border-slate-300 font-semibold text-slate-700 w-16 text-center">Цаг</th>
                    <th className="py-2 px-2 border-r border-slate-300 font-semibold text-slate-700 w-24 text-center">Чөлөөт цаг</th>
                    <th className="py-2 px-2 border-r border-slate-300 font-semibold text-slate-700 w-28">Ангийн багш</th>
                    <th className="py-2 px-2 font-semibold text-slate-700 w-24">Үндсэн танхим</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {classes.map((cls) => {
                    const isSelected = cls.id === selectedId;
                    const count = getClassCount(cls.id);
                    const classTeacher = teachers.find((t) => t.id === cls.classTeacherId);
                    const homeRoom = classrooms.find((r) => r.id === cls.homeClassroomId);
                    const bld = buildings.find((b) => b.id === cls.buildingId);

                    return (
                      <tr
                        key={cls.id}
                        onClick={() => setSelectedId(cls.id)}
                        onDoubleClick={() => handleEdit(cls)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-amber-600 text-white font-medium' : 'hover:bg-amber-50/60 text-slate-800'
                        }`}
                      >
                        <td className="py-1.5 px-3 border-r border-slate-200 flex items-center gap-2">
                          <span
                            className="w-3.5 h-3.5 rounded-sm border shrink-0"
                            style={{ backgroundColor: cls.color, borderColor: isSelected ? '#ffffff' : '#94a3b8' }}
                          />
                          <span className="font-bold truncate">{cls.name}</span>
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-200 text-center">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              cls.shift === 1
                                ? 'bg-blue-100 text-blue-800'
                                : cls.shift === 2
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {cls.shift}-р ээлж
                          </span>
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-200 truncate text-[11px]">
                          {bld?.shortName || bld?.name || '-'}
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-200 text-center font-bold">
                          {count}
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-200 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setTimeOffClass(cls);
                            }}
                            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] border border-slate-300"
                          >
                            Чөлөөт цаг
                          </button>
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-200 text-[11px] truncate">
                          {classTeacher?.name || '-'}
                        </td>
                        <td className="py-1.5 px-2 text-[11px] truncate">{homeRoom?.name || '-'}</td>
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
              <span>+ Шинэ анги</span>
            </button>
            <button
              disabled={!selectedClass}
              onClick={() => selectedClass && handleEdit(selectedClass)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-blue-700 hover:bg-blue-50 shadow-xs transition disabled:opacity-50"
            >
              <Edit2 className="w-4 h-4 text-blue-600" />
              <span>Засах</span>
            </button>
            <button
              disabled={!selectedClass}
              onClick={() => selectedClass && handleDelete(selectedClass.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-rose-700 hover:bg-rose-50 shadow-xs transition disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Устгах</span>
            </button>

            <button
              disabled={!selectedClass}
              onClick={() => selectedClass && onOpenLessonsForClass?.(selectedClass.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-pink-700 hover:bg-pink-50 shadow-xs transition disabled:opacity-50 mt-2"
            >
              <span className="w-3 h-3 bg-pink-600 rounded-[2px]" />
              <span>Хичээлүүд</span>
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
        </div>

        {/* Bottom bar */}
        <div className="bg-slate-200/90 px-4 py-2 border-t border-slate-300 flex items-center justify-between">
          <button
            onClick={onOpenExcelImport}
            className="px-3 py-1 bg-amber-50 border border-amber-300 rounded text-xs font-medium text-amber-800 hover:bg-amber-100 shadow-xs"
          >
            📥 Ангиудыг Excel-ээс татах
          </button>
          <button
            onClick={onClose}
            className="px-5 py-1 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-800 hover:bg-slate-100 shadow-xs"
          >
            Хаах
          </button>
        </div>
      </div>

      {/* Edit Class Modal */}
      {editingClass && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-300 w-full max-w-md overflow-hidden">
            <div className="bg-amber-600 text-white px-4 py-2 text-sm font-semibold flex justify-between">
              <span>{isNew ? 'Шинэ анги бүлэг нэмэх' : 'Ангийн мэдээлэл засах'}</span>
              <button onClick={() => setEditingClass(null)} className="text-white hover:text-red-200">
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Ангийн нэр:</label>
                  <input
                    type="text"
                    required
                    value={editingClass.name}
                    onChange={(e) => setEditingClass({ ...editingClass, name: e.target.value })}
                    placeholder="Жишээ: 10А"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-amber-500 font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Хэддүгээр анги (Grade):</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={editingClass.grade}
                    onChange={(e) => setEditingClass({ ...editingClass, grade: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Shift Selection & Building Selection */}
              <div className="grid grid-cols-2 gap-3 bg-amber-50/70 p-2.5 rounded border border-amber-200">
                <div>
                  <label className="block font-bold text-amber-900 mb-1">Хичээллэх ээлж:</label>
                  <select
                    value={editingClass.shift}
                    onChange={(e) => setEditingClass({ ...editingClass, shift: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 bg-white border border-amber-300 rounded font-bold text-amber-900"
                  >
                    <option value={1}>1-р ээлж (Өглөөний ээлж)</option>
                    <option value={2}>2-р ээлж (Өдрийн ээлж)</option>
                    <option value={3}>3-р ээлж (Оройн ээлж)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-amber-900 mb-1">Хичээллэх байр:</label>
                  <select
                    value={editingClass.buildingId || ''}
                    onChange={(e) => setEditingClass({ ...editingClass, buildingId: e.target.value || undefined })}
                    className="w-full px-2 py-1.5 bg-white border border-amber-300 rounded font-semibold text-slate-800"
                  >
                    {buildings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Ангийн удирдагч багш:</label>
                <select
                  value={editingClass.classTeacherId || ''}
                  onChange={(e) => setEditingClass({ ...editingClass, classTeacherId: e.target.value || undefined })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-amber-500"
                >
                  <option value="">-- Сонгохгүй --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Үндсэн танхим (Home classroom):</label>
                <select
                  value={editingClass.homeClassroomId || ''}
                  onChange={(e) => setEditingClass({ ...editingClass, homeClassroomId: e.target.value || undefined })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-amber-500"
                >
                  <option value="">-- Сонгохгүй --</option>
                  {classrooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Өдөрт орох дээд цаг:</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={editingClass.maxPeriodsPerDay}
                    onChange={(e) =>
                      setEditingClass({ ...editingClass, maxPeriodsPerDay: Number(e.target.value) })
                    }
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Өнгө (Color):</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={editingClass.color}
                      onChange={(e) => setEditingClass({ ...editingClass, color: e.target.value })}
                      className="w-8 h-8 rounded border border-slate-300 cursor-pointer p-0"
                    />
                    <span className="font-mono text-slate-600">{editingClass.color}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingClass(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded font-medium text-slate-700"
                >
                  Болих
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-semibold"
                >
                  Хадгалах
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Time-off */}
      {timeOffClass && (
        <TimeOffMatrixDialog
          isOpen={true}
          title={`${timeOffClass.name} анги`}
          subtitle="Энэ ангийн хичээллэх боломжгүй цагуудыг улаанаар тэмдэглэнэ үү."
          initialTimeOff={timeOffClass.timeOff}
          settings={settings}
          onClose={() => setTimeOffClass(null)}
          onSave={(matrix) => {
            onUpdateClasses(
              classes.map((c) => (c.id === timeOffClass.id ? { ...c, timeOff: matrix } : c))
            );
          }}
        />
      )}
    </div>
  );
};
