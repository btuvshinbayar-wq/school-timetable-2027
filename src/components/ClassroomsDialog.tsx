import React, { useState } from 'react';
import { Classroom, Building, SchoolSettings } from '../types/timetable';
import { Plus, Edit2, Trash2, Clock, DoorOpen, ArrowUp, ArrowDown } from 'lucide-react';
import { TimeOffMatrixDialog } from './TimeOffMatrixDialog';

interface ClassroomsDialogProps {
  classrooms: Classroom[];
  buildings: Building[];
  settings: SchoolSettings;
  isOpen: boolean;
  onClose: () => void;
  onUpdateClassrooms: (rooms: Classroom[]) => void;
  onNavigateTab?: (tab: 'subjects' | 'classes' | 'classrooms' | 'teachers') => void;
  onOpenExcelImport?: () => void;
}

export const ClassroomsDialog: React.FC<ClassroomsDialogProps> = ({
  classrooms,
  buildings,
  settings,
  isOpen,
  onClose,
  onUpdateClassrooms,
  onNavigateTab,
  onOpenExcelImport,
}) => {
  const [selectedId, setSelectedId] = useState<string>(classrooms[0]?.id || '');
  const [editingRoom, setEditingRoom] = useState<Classroom | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [timeOffRoom, setTimeOffRoom] = useState<Classroom | null>(null);

  if (!isOpen) return null;

  const selectedRoom = classrooms.find((r) => r.id === selectedId);

  const handleCreateNew = () => {
    setIsNew(true);
    setEditingRoom({
      id: `r_${Date.now()}`,
      name: '',
      shortName: '',
      buildingId: buildings[0]?.id || '',
      capacity: 36,
      isShared: false,
      color: '#60a5fa',
      timeOff: {},
    });
  };

  const handleEdit = (r: Classroom) => {
    setIsNew(false);
    setEditingRoom({ ...r });
  };

  const handleDelete = (id: string) => {
    if (confirm('Энэ танхимыг устгах уу?')) {
      const next = classrooms.filter((r) => r.id !== id);
      onUpdateClassrooms(next);
      if (selectedId === id) setSelectedId(next[0]?.id || '');
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom || !editingRoom.name.trim()) return;

    if (isNew) {
      onUpdateClassrooms([...classrooms, editingRoom]);
      setSelectedId(editingRoom.id);
    } else {
      onUpdateClassrooms(classrooms.map((r) => (r.id === editingRoom.id ? editingRoom : r)));
    }
    setEditingRoom(null);
  };

  const moveRoom = (direction: 'up' | 'down') => {
    const idx = classrooms.findIndex((r) => r.id === selectedId);
    if (idx < 0) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= classrooms.length) return;

    const list = [...classrooms];
    const temp = list[idx];
    list[idx] = list[targetIdx];
    list[targetIdx] = temp;
    onUpdateClassrooms(list);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-hidden">
      <div className="bg-slate-50 rounded-lg shadow-2xl border border-slate-300 w-full max-w-4xl overflow-hidden flex flex-col h-[86vh] max-h-[680px]">
        {/* Title bar */}
        <div className="bg-gradient-to-r from-teal-700 via-teal-600 to-cyan-700 text-white px-4 py-2 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <DoorOpen className="w-4 h-4 text-sky-200" />
            <span className="font-semibold text-sm">Анги танхимууд & Байрны хуваарилалт (Classrooms)</span>
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
              Танхимын жагсаалт ({classrooms.length}):
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 sticky top-0 border-b border-slate-300 select-none shadow-xs">
                  <tr>
                    <th className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-700">Танхим</th>
                    <th className="py-2 px-2 border-r border-slate-300 font-semibold text-slate-700 w-28">Хичээлийн байр</th>
                    <th className="py-2 px-2 border-r border-slate-300 font-semibold text-slate-700 w-20">Дугаар</th>
                    <th className="py-2 px-2 border-r border-slate-300 font-semibold text-slate-700 w-16 text-center">Суудал</th>
                    <th className="py-2 px-2 border-r border-slate-300 font-semibold text-slate-700 w-24 text-center">Чөлөөт цаг</th>
                    <th className="py-2 px-2 font-semibold text-slate-700 w-24 text-center">Төрөл</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {classrooms.map((r) => {
                    const isSelected = r.id === selectedId;
                    const bld = buildings.find((b) => b.id === r.buildingId);
                    return (
                      <tr
                        key={r.id}
                        onClick={() => setSelectedId(r.id)}
                        onDoubleClick={() => handleEdit(r)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-teal-700 text-white font-medium' : 'hover:bg-teal-50/60 text-slate-800'
                        }`}
                      >
                        <td className="py-1.5 px-3 border-r border-slate-200 flex items-center gap-2">
                          <span
                            className="w-3.5 h-3.5 rounded-sm border shrink-0"
                            style={{ backgroundColor: r.color, borderColor: isSelected ? '#ffffff' : '#94a3b8' }}
                          />
                          <span className="font-bold truncate">{r.name}</span>
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-200 truncate text-[11px]">
                          {bld?.name || bld?.shortName || '-'}
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-200 font-mono">{r.shortName}</td>
                        <td className="py-1.5 px-2 border-r border-slate-200 text-center font-bold">
                          {r.capacity}
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-200 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setTimeOffRoom(r);
                            }}
                            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] border border-slate-300"
                          >
                            Чөлөөт цаг
                          </button>
                        </td>
                        <td className="py-1.5 px-2 text-center text-[11px]">
                          {r.isShared ? (
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px]">Хуваалцах</span>
                          ) : (
                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px]">Дан</span>
                          )}
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
              onClick={handleCreateNew}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-emerald-700 hover:bg-emerald-50 shadow-xs transition"
            >
              <Plus className="w-4 h-4 text-emerald-600" />
              <span>+ Шинэ танхим</span>
            </button>
            <button
              disabled={!selectedRoom}
              onClick={() => selectedRoom && handleEdit(selectedRoom)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-blue-700 hover:bg-blue-50 shadow-xs transition disabled:opacity-50"
            >
              <Edit2 className="w-4 h-4 text-blue-600" />
              <span>Засах</span>
            </button>
            <button
              disabled={!selectedRoom}
              onClick={() => selectedRoom && handleDelete(selectedRoom.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-rose-700 hover:bg-rose-50 shadow-xs transition disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Устгах</span>
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
        </div>

        {/* Bottom bar */}
        <div className="bg-slate-200/90 px-4 py-2 border-t border-slate-300 flex items-center justify-between">
          <button
            onClick={onOpenExcelImport}
            className="px-3 py-1 bg-amber-50 border border-amber-300 rounded text-xs font-medium text-amber-800 hover:bg-amber-100 shadow-xs"
          >
            📥 Танхимуудыг Excel-ээс татах
          </button>
          <button
            onClick={onClose}
            className="px-5 py-1 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-800 hover:bg-slate-100 shadow-xs"
          >
            Хаах
          </button>
        </div>
      </div>

      {/* Edit Room Modal */}
      {editingRoom && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-300 w-full max-w-md overflow-hidden">
            <div className="bg-teal-700 text-white px-4 py-2 text-sm font-semibold flex justify-between">
              <span>{isNew ? 'Шинэ танхим нэмэх' : 'Танхимын мэдээлэл засах'}</span>
              <button onClick={() => setEditingRoom(null)} className="text-white hover:text-red-200">
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Танхимын нэр:</label>
                <input
                  type="text"
                  required
                  value={editingRoom.name}
                  onChange={(e) => setEditingRoom({ ...editingRoom, name: e.target.value })}
                  placeholder="Жишээ: 101 Математик"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-teal-500 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Хичээлийн байр:</label>
                <select
                  value={editingRoom.buildingId}
                  onChange={(e) => setEditingRoom({ ...editingRoom, buildingId: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-bold text-teal-800"
                >
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Товч нэр / Дугаар:</label>
                  <input
                    type="text"
                    required
                    value={editingRoom.shortName}
                    onChange={(e) => setEditingRoom({ ...editingRoom, shortName: e.target.value })}
                    placeholder="Жишээ: 101"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Суудлын тоо:</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={editingRoom.capacity}
                    onChange={(e) => setEditingRoom({ ...editingRoom, capacity: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                  <input
                    type="checkbox"
                    checked={editingRoom.isShared}
                    onChange={(e) => setEditingRoom({ ...editingRoom, isShared: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Олон анги зэрэг ашиглах боломжтой (Спорт заал гэх мэт)</span>
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingRoom(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded font-medium text-slate-700"
                >
                  Болих
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded font-semibold"
                >
                  Хадгалах
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Time-off */}
      {timeOffRoom && (
        <TimeOffMatrixDialog
          isOpen={true}
          title={`${timeOffRoom.name} танхим`}
          subtitle="Энэ танхимыг хичээлд ашиглах боломжгүй цагуудыг улаанаар тэмдэглэнэ үү."
          initialTimeOff={timeOffRoom.timeOff}
          settings={settings}
          onClose={() => setTimeOffRoom(null)}
          onSave={(matrix) => {
            onUpdateClassrooms(
              classrooms.map((r) => (r.id === timeOffRoom.id ? { ...r, timeOff: matrix } : r))
            );
          }}
        />
      )}
    </div>
  );
};
