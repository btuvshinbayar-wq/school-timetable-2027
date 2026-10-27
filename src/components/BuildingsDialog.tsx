import React, { useState } from 'react';
import { Building } from '../types/timetable';
import { Building2, Plus, Edit2, Trash2, X } from 'lucide-react';

interface BuildingsDialogProps {
  buildings: Building[];
  isOpen: boolean;
  onClose: () => void;
  onUpdateBuildings: (buildings: Building[]) => void;
}

export const BuildingsDialog: React.FC<BuildingsDialogProps> = ({
  buildings,
  isOpen,
  onClose,
  onUpdateBuildings,
}) => {
  const [selectedId, setSelectedId] = useState<string>(buildings[0]?.id || '');
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [isNew, setIsNew] = useState(false);

  if (!isOpen) return null;

  const handleCreateNew = () => {
    setIsNew(true);
    setEditingBuilding({
      id: `bld_${Date.now()}`,
      name: '',
      shortName: '',
      color: '#3b82f6',
      address: '',
    });
  };

  const handleEdit = (b: Building) => {
    setIsNew(false);
    setEditingBuilding({ ...b });
  };

  const handleDelete = (id: string) => {
    if (buildings.length <= 1) {
      alert('Сургуульд хамгийн багадаа 1 хичээлийн байр байх шаардлагатай.');
      return;
    }
    if (confirm('Энэ байрыг устгах уу? Энэ байранд хамаарах танхимуудын бүртгэлийг шалгана уу.')) {
      const next = buildings.filter((b) => b.id !== id);
      onUpdateBuildings(next);
      if (selectedId === id) setSelectedId(next[0]?.id || '');
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBuilding || !editingBuilding.name.trim()) return;

    if (isNew) {
      onUpdateBuildings([...buildings, editingBuilding]);
      setSelectedId(editingBuilding.id);
    } else {
      onUpdateBuildings(buildings.map((b) => (b.id === editingBuilding.id ? editingBuilding : b)));
    }
    setEditingBuilding(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-slate-50 rounded-lg shadow-2xl border border-slate-300 w-full max-w-2xl overflow-hidden flex flex-col">
        {/* Title bar */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white px-4 py-2.5 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-sky-200" />
            <span className="font-semibold text-sm">Хичээлийн байрууд (School Buildings / Campuses)</span>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-red-600 rounded px-2 py-0.5 text-xs font-bold"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex gap-4 text-xs">
          {/* Buildings list */}
          <div className="flex-1 border border-slate-300 rounded bg-white overflow-hidden shadow-xs">
            <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-300 font-semibold text-slate-700">
              Бүртгэгдсэн хичээлийн байрууд ({buildings.length}):
            </div>
            <div className="divide-y divide-slate-200 max-h-64 overflow-y-auto">
              {buildings.map((b) => {
                const isSelected = b.id === selectedId;
                return (
                  <div
                    key={b.id}
                    onClick={() => setSelectedId(b.id)}
                    className={`p-2.5 flex items-center justify-between cursor-pointer transition ${
                      isSelected ? 'bg-blue-50 border-l-4 border-blue-600' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3.5 h-3.5 rounded-xs shrink-0"
                        style={{ backgroundColor: b.color }}
                      />
                      <div>
                        <div className="font-bold text-slate-800">{b.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{b.shortName}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(b);
                        }}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        title="Засах"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(b.id);
                        }}
                        className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                        title="Устгах"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Action buttons */}
          <div className="w-32 flex flex-col gap-2">
            <button
              onClick={handleCreateNew}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded font-bold hover:bg-emerald-700 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>+ Шинэ байр</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-200/90 px-4 py-2 border-t border-slate-300 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-1 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-800 hover:bg-slate-100 shadow-xs"
          >
            Хаах
          </button>
        </div>
      </div>

      {/* Edit Building Modal */}
      {editingBuilding && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-300 w-full max-w-sm overflow-hidden">
            <div className="bg-blue-700 text-white px-4 py-2 text-sm font-semibold flex justify-between">
              <span>{isNew ? 'Шинэ хичээлийн байр нэмэх' : 'Байрны мэдээлэл засах'}</span>
              <button onClick={() => setEditingBuilding(null)} className="text-white hover:text-red-200">
                ✕
              </button>
            </div>
            <form onSubmit={handleSave} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Байрны бүтэн нэр:</label>
                <input
                  type="text"
                  required
                  value={editingBuilding.name}
                  onChange={(e) => setEditingBuilding({ ...editingBuilding, name: e.target.value })}
                  placeholder="Жишээ: 1-р байр (Төв хичээлийн байр)"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-medium focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Товчлол / Код:</label>
                  <input
                    type="text"
                    required
                    value={editingBuilding.shortName}
                    onChange={(e) => setEditingBuilding({ ...editingBuilding, shortName: e.target.value })}
                    placeholder="Жишээ: 1-р байр"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Өнгөний код:</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={editingBuilding.color}
                      onChange={(e) => setEditingBuilding({ ...editingBuilding, color: e.target.value })}
                      className="w-8 h-8 rounded border border-slate-300 cursor-pointer p-0"
                    />
                    <span className="font-mono text-slate-600">{editingBuilding.color}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingBuilding(null)}
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
    </div>
  );
};
