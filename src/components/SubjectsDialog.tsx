import React, { useState } from 'react';
import { Subject, LessonContract, SchoolSettings } from '../types/timetable';
import { Plus, Edit2, Trash2, Clock, Sliders, BookOpen, Users, DoorOpen, GraduationCap, ArrowUp, ArrowDown } from 'lucide-react';
import { TimeOffMatrixDialog } from './TimeOffMatrixDialog';

interface SubjectsDialogProps {
  subjects: Subject[];
  lessons: LessonContract[];
  settings: SchoolSettings;
  isOpen: boolean;
  onClose: () => void;
  onUpdateSubjects: (subjects: Subject[]) => void;
  onNavigateTab?: (tab: 'subjects' | 'classes' | 'classrooms' | 'teachers') => void;
  onOpenLessonsForSubject?: (subjectId: string) => void;
  onOpenConstraints?: () => void;
  onOpenExcelImport?: () => void;
}

export const SubjectsDialog: React.FC<SubjectsDialogProps> = ({
  subjects,
  lessons,
  settings,
  isOpen,
  onClose,
  onUpdateSubjects,
  onNavigateTab,
  onOpenLessonsForSubject,
  onOpenConstraints,
  onOpenExcelImport,
}) => {
  const [selectedId, setSelectedId] = useState<string>(subjects[0]?.id || '');
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [timeOffSubject, setTimeOffSubject] = useState<Subject | null>(null);

  if (!isOpen) return null;

  const selectedSubject = subjects.find((s) => s.id === selectedId);

  // Calculate total weekly count of lessons for each subject
  const getSubjectCount = (subId: string) => {
    return lessons
      .filter((l) => l.subjectId === subId)
      .reduce((sum, l) => sum + l.totalPeriods, 0);
  };

  const handleCreateNew = () => {
    setIsNew(true);
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

  const handleEdit = (sub: Subject) => {
    setIsNew(false);
    setEditingSubject({ ...sub });
  };

  const handleDelete = (id: string) => {
    if (confirm('Та энэ хичээлийг устгахдаа итгэлтэй байна уу? Үүнд хамаарах хичээлийн төлөвлөгөө ч мөн цуцлагдана.')) {
      const next = subjects.filter((s) => s.id !== id);
      onUpdateSubjects(next);
      if (selectedId === id) setSelectedId(next[0]?.id || '');
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubject || !editingSubject.name.trim()) return;

    if (isNew) {
      onUpdateSubjects([...subjects, editingSubject]);
      setSelectedId(editingSubject.id);
    } else {
      onUpdateSubjects(subjects.map((s) => (s.id === editingSubject.id ? editingSubject : s)));
    }
    setEditingSubject(null);
  };

  const moveSubject = (direction: 'up' | 'down') => {
    const idx = subjects.findIndex((s) => s.id === selectedId);
    if (idx < 0) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= subjects.length) return;

    const list = [...subjects];
    const temp = list[idx];
    list[idx] = list[targetIdx];
    list[targetIdx] = temp;
    onUpdateSubjects(list);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-hidden">
      <div className="bg-slate-50 rounded-lg shadow-2xl border border-slate-300 w-full max-w-4xl overflow-hidden flex flex-col h-[86vh] max-h-[680px]">
        {/* Windows classic dialog title bar */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 text-white px-4 py-2 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-sky-200" />
            <span className="font-semibold text-sm">Хичээлүүд (Subjects)</span>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-red-600 rounded px-2 py-0.5 text-xs font-bold"
          >
            ✕
          </button>
        </div>

        {/* Main Body */}
        <div className="flex flex-1 overflow-hidden p-3 gap-3">
          {/* Left Navigation bar (Matches asc Timetables left icons!) */}
          <div className="w-14 bg-slate-200/80 rounded border border-slate-300 flex flex-col items-center py-3 gap-4 shrink-0">
            <button
              onClick={() => onNavigateTab?.('subjects')}
              title="Хичээлүүд"
              className="w-10 h-10 rounded bg-blue-100 border border-blue-400 flex items-center justify-center shadow-xs text-blue-700 hover:scale-105 transition"
            >
              <BookOpen className="w-6 h-6 text-blue-600" />
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
              className="w-10 h-10 rounded bg-white border border-slate-300 flex items-center justify-center shadow-xs text-indigo-700 hover:bg-slate-100 hover:scale-105 transition"
            >
              <GraduationCap className="w-6 h-6" />
            </button>
          </div>

          {/* Table Container */}
          <div className="flex-1 flex flex-col border border-slate-300 rounded bg-white overflow-hidden shadow-inner">
            <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-300 text-xs font-semibold text-slate-700">
              Хичээлийн жагсаалт (Enter subjects):
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 sticky top-0 border-b border-slate-300 select-none shadow-xs">
                  <tr>
                    <th className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-700">Name (Нэр)</th>
                    <th className="py-2 px-2 border-r border-slate-300 font-semibold text-slate-700 w-16">Short</th>
                    <th className="py-2 px-2 border-r border-slate-300 font-semibold text-slate-700 w-16 text-center">Count</th>
                    <th className="py-2 px-2 border-r border-slate-300 font-semibold text-slate-700 w-28 text-center">Time off</th>
                    <th className="py-2 px-2 border-r border-slate-300 font-semibold text-slate-700 w-24">Distribution</th>
                    <th className="py-2 px-2 font-semibold text-slate-700 w-20 text-center">Homework</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {subjects.map((sub) => {
                    const isSelected = sub.id === selectedId;
                    const count = getSubjectCount(sub.id);
                    return (
                      <tr
                        key={sub.id}
                        onClick={() => setSelectedId(sub.id)}
                        onDoubleClick={() => handleEdit(sub)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-600 text-white font-medium' : 'hover:bg-blue-50/60 text-slate-800'
                        }`}
                      >
                        <td className="py-1.5 px-3 border-r border-slate-200 flex items-center gap-2">
                          <span
                            className="w-3.5 h-3.5 rounded-sm border shrink-0"
                            style={{ backgroundColor: sub.color, borderColor: isSelected ? '#ffffff' : '#94a3b8' }}
                          />
                          <span className="truncate">{sub.name}</span>
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-200 font-mono text-[11px]">{sub.shortName}</td>
                        <td className="py-1.5 px-2 border-r border-slate-200 text-center font-bold">
                          {count}
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-200 text-center">
                          {/* Visual mini time off grid (Like aSc Timetables green cells!) */}
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setTimeOffSubject(sub);
                            }}
                            className={`inline-grid grid-cols-5 gap-[1px] p-[2px] rounded border hover:scale-105 transition cursor-pointer ${
                              isSelected ? 'bg-blue-800 border-blue-400' : 'bg-slate-200 border-slate-300'
                            }`}
                            title="Чөлөөт цагийн хуваарь харах/өөрчлөх"
                          >
                            {Array.from({ length: 15 }).map((_, idx) => {
                              const day = idx % 5;
                              const p = Math.floor(idx / 5);
                              const isForbidden = sub.timeOff[`${day}_${p}`] === 'forbidden';
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
                        <td className="py-1.5 px-2 border-r border-slate-200 text-[11px]">Ideal</td>
                        <td className="py-1.5 px-2 text-center text-[11px]">-</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Action buttons (Matches image 1 exactly!) */}
          <div className="w-32 flex flex-col gap-2 shrink-0 select-none">
            <button
              onClick={handleCreateNew}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-emerald-700 hover:bg-emerald-50 shadow-xs transition"
            >
              <Plus className="w-4 h-4 text-emerald-600" />
              <span>+ New</span>
            </button>
            <button
              disabled={!selectedSubject}
              onClick={() => selectedSubject && handleEdit(selectedSubject)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-blue-700 hover:bg-blue-50 shadow-xs transition disabled:opacity-50"
            >
              <Edit2 className="w-4 h-4 text-blue-600" />
              <span>Edit</span>
            </button>
            <button
              disabled={!selectedSubject}
              onClick={() => selectedSubject && handleDelete(selectedSubject.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-rose-700 hover:bg-rose-50 shadow-xs transition disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Remove</span>
            </button>

            <div className="h-2"></div>

            <button
              disabled={!selectedSubject}
              onClick={() => selectedSubject && onOpenLessonsForSubject?.(selectedSubject.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-pink-700 hover:bg-pink-50 shadow-xs transition disabled:opacity-50"
            >
              <span className="w-3 h-3 bg-pink-600 rounded-[2px]" />
              <span>Lessons</span>
            </button>

            <button
              disabled={!selectedSubject}
              onClick={() => selectedSubject && setTimeOffSubject(selectedSubject)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-700 hover:bg-slate-100 shadow-xs transition disabled:opacity-50"
            >
              <Clock className="w-4 h-4 text-sky-600" />
              <span>Time off</span>
            </button>

            <button
              onClick={onOpenConstraints}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-indigo-700 hover:bg-indigo-50 shadow-xs transition"
            >
              <Sliders className="w-4 h-4 text-indigo-600" />
              <span>Constraints</span>
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
        </div>

        {/* Bottom bar (Image 1 style) */}
        <div className="bg-slate-200/90 px-4 py-2 border-t border-slate-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => alert('Хичээл оруулах заавар: Нэр, товчлол, өнгө болон тухайн хичээлийн 7 хоногт орох нийт цагийг тохируулна.')}
              className="px-3 py-1 bg-white border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-xs"
            >
              ? Help
            </button>
            <button
              onClick={onOpenExcelImport}
              className="px-3 py-1 bg-amber-50 border border-amber-300 rounded text-xs font-medium text-amber-800 hover:bg-amber-100 shadow-xs"
            >
              📥 Import
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-1 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-800 hover:bg-slate-100 shadow-xs"
          >
            Close
          </button>
        </div>
      </div>

      {/* Edit Subject Modal */}
      {editingSubject && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-300 w-full max-w-md overflow-hidden">
            <div className="bg-blue-600 text-white px-4 py-2 text-sm font-semibold flex justify-between">
              <span>{isNew ? 'Шинэ хичээл нэмэх' : 'Хичээл засварлах'}</span>
              <button onClick={() => setEditingSubject(null)} className="text-white hover:text-red-200">
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Хичээлийн нэр (Subject name):</label>
                <input
                  type="text"
                  required
                  value={editingSubject.name}
                  onChange={(e) => setEditingSubject({ ...editingSubject, name: e.target.value })}
                  placeholder="Жишээ: Математик"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
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
                    placeholder="Жишээ: Мат"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 uppercase"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Өнгө (Color):</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={editingSubject.color}
                      onChange={(e) => setEditingSubject({ ...editingSubject, color: e.target.value })}
                      className="w-8 h-8 rounded border border-slate-300 cursor-pointer p-0"
                    />
                    <span className="font-mono text-slate-600">{editingSubject.color}</span>
                  </div>
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingSubject(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded font-medium text-slate-700"
                >
                  Болих
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold"
                >
                  Хадгалах
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Time-off Matrix */}
      {timeOffSubject && (
        <TimeOffMatrixDialog
          isOpen={true}
          title={timeOffSubject.name}
          subtitle="Хичээл орохыг хориглосон өдөр, цагуудыг улаанаар тэмдэглэнэ үү."
          initialTimeOff={timeOffSubject.timeOff}
          settings={settings}
          onClose={() => setTimeOffSubject(null)}
          onSave={(matrix) => {
            onUpdateSubjects(
              subjects.map((s) => (s.id === timeOffSubject.id ? { ...s, timeOff: matrix } : s))
            );
          }}
        />
      )}
    </div>
  );
};
