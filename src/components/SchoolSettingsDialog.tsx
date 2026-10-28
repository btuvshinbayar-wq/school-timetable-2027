import React, { useState } from 'react';
import { SchoolSettings, ShiftConfig, BellPeriod, Building } from '../types/timetable';
import { calculateShiftBells } from '../utils/defaultData';
import { School, Clock, Building2, Plus, Edit2, Trash2, Save, Calendar, Layers } from 'lucide-react';

interface SchoolSettingsDialogProps {
  settings: SchoolSettings;
  isOpen: boolean;
  isMandatorySetup?: boolean;
  projectName?: string;
  onClose: () => void;
  onSaveSettings: (settings: SchoolSettings, newProjectName?: string) => void;
}

export const SchoolSettingsDialog: React.FC<SchoolSettingsDialogProps> = ({
  settings,
  isOpen,
  isMandatorySetup = false,
  projectName = '',
  onClose,
  onSaveSettings,
}) => {
  const [current, setCurrent] = useState<SchoolSettings>({
    ...settings,
    shifts: settings.shifts.map((s) => ({ ...s, bells: [...s.bells] })),
    buildings: [...settings.buildings],
  });

  // Top tabs inside School Settings: 'general' (Сургуулийн мэдээлэл) | 'buildings' (Хичээлийн байр) | 'shifts' (Ээлж, Хонх, Завсарлага)
  const [activeTab, setActiveTab] = useState<'general' | 'buildings' | 'shifts'>('general');
  const [activeShiftNum, setActiveShiftNum] = useState<number>(1);

  // Building edit modal inside
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [isNewBuilding, setIsNewBuilding] = useState(false);

  // Mandatory naming modal state
  const [showNamingModal, setShowNamingModal] = useState<boolean>(false);
  const [projectNameInput, setProjectNameInput] = useState<string>('');
  const [nameError, setNameError] = useState<string>('');

  if (!isOpen) return null;

  const currentShift = current.shifts.find((s) => s.shiftNumber === activeShiftNum) || current.shifts[0];

  const updateShiftProperty = (shiftNum: number, prop: keyof ShiftConfig, val: any) => {
    setCurrent((prev) => {
      const nextShifts = prev.shifts.map((s) => {
        if (s.shiftNumber === shiftNum) {
          const updated = { ...s, [prop]: val };
          if (
            prop === 'startTime' ||
            prop === 'periodsCount' ||
            prop === 'lessonDurationMinutes' ||
            prop === 'defaultBreakMinutes' ||
            prop === 'bigBreakMinutes' ||
            prop === 'bigBreakAfterPeriod'
          ) {
            updated.bells = calculateShiftBells(
              updated.startTime,
              updated.periodsCount,
              updated.lessonDurationMinutes,
              updated.defaultBreakMinutes,
              updated.bigBreakMinutes,
              updated.bigBreakAfterPeriod
            );
          }
          return updated;
        }
        return s;
      });
      return { ...prev, shifts: nextShifts };
    });
  };

  const updateBellField = (shiftNum: number, bellIdx: number, field: keyof BellPeriod, value: any) => {
    setCurrent((prev) => {
      const nextShifts = prev.shifts.map((s) => {
        if (s.shiftNumber === shiftNum) {
          const nextBells = [...s.bells];
          nextBells[bellIdx] = { ...nextBells[bellIdx], [field]: value };
          return { ...s, bells: nextBells };
        }
        return s;
      });
      return { ...prev, shifts: nextShifts };
    });
  };

  // Building handlers
  const handleCreateBuilding = () => {
    setIsNewBuilding(true);
    setEditingBuilding({
      id: `bld_${Date.now()}`,
      name: '',
      shortName: '',
      color: '#2563eb',
      address: '',
    });
  };

  const handleSaveBuilding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBuilding || !editingBuilding.name.trim()) return;

    if (isNewBuilding) {
      setCurrent((prev) => ({ ...prev, buildings: [...prev.buildings, editingBuilding] }));
    } else {
      setCurrent((prev) => ({
        ...prev,
        buildings: prev.buildings.map((b) => (b.id === editingBuilding.id ? editingBuilding : b)),
      }));
    }
    setEditingBuilding(null);
  };

  const handleDeleteBuilding = (id: string) => {
    if (current.buildings.length <= 1) {
      alert('Сургуульд хамгийн багадаа 1 хичээлийн байр бүртгэлтэй байх шаардлагатай.');
      return;
    }
    if (confirm('Энэ байрыг устгах уу?')) {
      setCurrent((prev) => ({
        ...prev,
        buildings: prev.buildings.filter((b) => b.id !== id),
      }));
    }
  };

  const handleInitiateSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!current.schoolName.trim()) {
      setActiveTab('general');
      alert('Сургуулийн нэрийг заавал оруулна уу!');
      return;
    }

    if (isMandatorySetup) {
      // Must give project name and save
      const defaultName = projectName || `${current.schoolName}_${current.academicYear || '2026-2027'}_Хуваарь`;
      setProjectNameInput(defaultName);
      setNameError('');
      setShowNamingModal(true);
    } else {
      onSaveSettings(current, projectName);
      onClose();
    }
  };

  const handleConfirmNamingAndSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = projectNameInput.trim();
    if (!trimmed) {
      setNameError('Төслийн нэрийг заавал өгөх ёстой!');
      return;
    }
    onSaveSettings(current, trimmed);
    setShowNamingModal(false);
    onClose();
  };

  const handleAttemptClose = () => {
    if (isMandatorySetup) {
      alert('Сургуулийн үндсэн мэдээллийг оруулж, нэр өгч хадгалсны дараа хуваарийн систем рүү шилжинэ.');
      return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-slate-50 rounded-lg shadow-2xl border border-slate-300 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Title bar */}
        <div className="dialog-titlebar text-white px-4 py-2.5 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <School className="w-4 h-4 text-sky-200" />
            <span className="font-semibold text-sm">
              {isMandatorySetup
                ? 'Эхлэл: Сургуулийн үндсэн мэдээлэл оруулах'
                : 'Сургуулийн тохиргоо (Ээлж, Хонх, Завсарлага, Байр)'}
            </span>
          </div>
          <button
            onClick={handleAttemptClose}
            className="text-white/80 hover:text-white hover:bg-red-600 rounded px-2 py-0.5 text-xs font-bold"
          >
            ✕
          </button>
        </div>

        {/* Mandatory Setup Banner */}
        {isMandatorySetup && (
          <div className="bg-amber-100 border-b border-amber-300 px-4 py-2 text-xs text-amber-900 flex items-center justify-between font-medium select-none">
            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-800">1-р алхам:</span>
              <span>
                Сургуулийн үндсэн мэдээллээ оруулж тохируулна уу. Дууссаны дараа заавал нэр өгч JSON форматаар хадгална.
              </span>
            </div>
            <span className="text-[11px] bg-amber-200/90 px-2 py-0.5 rounded font-bold text-amber-800 shrink-0">
              Шинэ төсөл
            </span>
          </div>
        )}

        {/* Tab switcher: Сургуулийн мэдээлэл & А/Б 7 хоног | Хичээлийн байр | Ээлж & Хонх */}
        <div className="bg-slate-200 px-4 pt-2 border-b border-slate-300 flex items-center gap-1 text-xs select-none">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`px-3 py-1.5 rounded-t font-bold transition flex items-center gap-1.5 ${
              activeTab === 'general'
                ? 'bg-white text-blue-700 border-t-2 border-t-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300/60'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-amber-600" />
            <span>{current.enableWeekAB ? 'Сургуулийн мэдээлэл & А/Б 7 хоног' : 'Сургуулийн мэдээлэл'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('buildings')}
            className={`px-3 py-1.5 rounded-t font-bold transition flex items-center gap-1.5 ${
              activeTab === 'buildings'
                ? 'bg-white text-blue-700 border-t-2 border-t-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300/60'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-cyan-600" />
            <span>Хичээлийн байр ({current.buildings.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('shifts')}
            className={`px-3 py-1.5 rounded-t font-bold transition flex items-center gap-1.5 ${
              activeTab === 'shifts'
                ? 'bg-white text-blue-700 border-t-2 border-t-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            <span>Ээлж, Хонх & Завсарлага</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4 text-xs">
          {/* TAB 1: ЭЭЛЖ, ХОНХ, ЗАВСАРЛАГА (5 мин, 10 мин) */}
          {activeTab === 'shifts' && (
            <div className="space-y-3">
              {/* Shift selection sub-bar */}
              <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-300 shadow-xs">
                <div>
                  <div className="font-bold text-slate-800 text-sm">Сургуулийн хичээллэх ээлж:</div>
                  <div className="text-slate-500 text-[11px] mt-0.5">
                    Монголын сургуулиудын стандарт: Энгийн завсарлага 5 минут, Их завсарлага 10 минут
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded border border-slate-300">
                  {current.shifts.slice(0, current.shiftsCount).map((s) => (
                    <button
                      key={s.shiftNumber}
                      type="button"
                      onClick={() => setActiveShiftNum(s.shiftNumber)}
                      className={`px-3 py-1 rounded font-bold text-xs transition ${
                        activeShiftNum === s.shiftNumber
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-700 hover:text-slate-900'
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Shift Timing Inputs */}
              {currentShift && (
                <div className="bg-white p-3.5 rounded-lg border border-slate-300 shadow-xs space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-2.5 rounded border border-slate-200">
                    <div>
                      <label className="block text-slate-700 mb-1 font-bold">Эхлэх цаг:</label>
                      <input
                        type="time"
                        value={currentShift.startTime}
                        onChange={(e) =>
                          updateShiftProperty(currentShift.shiftNumber, 'startTime', e.target.value)
                        }
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-bold font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 mb-1 font-bold">
                        Хичээлийн хугацаа:
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="30"
                          max="60"
                          value={currentShift.lessonDurationMinutes}
                          onChange={(e) =>
                            updateShiftProperty(
                              currentShift.shiftNumber,
                              'lessonDurationMinutes',
                              Number(e.target.value)
                            )
                          }
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-bold font-mono"
                        />
                        <span className="text-slate-500">мин</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-700 mb-1 font-bold">
                        Энгийн завсарлага:
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="2"
                          max="20"
                          value={currentShift.defaultBreakMinutes}
                          onChange={(e) =>
                            updateShiftProperty(
                              currentShift.shiftNumber,
                              'defaultBreakMinutes',
                              Number(e.target.value)
                            )
                          }
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-bold font-mono"
                        />
                        <span className="text-slate-500">мин</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-700 mb-1 font-bold">
                        Өдрийн хичээлийн тоо:
                      </label>
                      <input
                        type="number"
                        min="3"
                        max="8"
                        value={currentShift.periodsCount}
                        onChange={(e) =>
                          updateShiftProperty(
                            currentShift.shiftNumber,
                            'periodsCount',
                            Number(e.target.value)
                          )
                        }
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-bold font-mono"
                      />
                    </div>
                  </div>

                  {/* Big break settings */}
                  <div className="p-2.5 bg-amber-50/80 rounded border border-amber-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-amber-900">Их завсарлага:</span>
                      <span className="text-slate-600">
                        Хэддүгээр цагийн дараа хэдэн минут завсарлах:
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={currentShift.bigBreakAfterPeriod}
                        onChange={(e) =>
                          updateShiftProperty(
                            currentShift.shiftNumber,
                            'bigBreakAfterPeriod',
                            Number(e.target.value)
                          )
                        }
                        className="px-2 py-1 bg-white border border-amber-300 rounded font-semibold text-xs"
                      >
                        {Array.from({ length: currentShift.periodsCount - 1 }).map((_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {i + 1}-р цагийн дараа
                          </option>
                        ))}
                      </select>

                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="5"
                          max="30"
                          value={currentShift.bigBreakMinutes}
                          onChange={(e) =>
                            updateShiftProperty(
                              currentShift.shiftNumber,
                              'bigBreakMinutes',
                              Number(e.target.value)
                            )
                          }
                          className="w-16 px-2 py-1 bg-white border border-amber-300 rounded font-bold font-mono text-xs"
                        />
                        <span className="font-semibold text-amber-900">минут</span>
                      </div>
                    </div>
                  </div>

                  {/* Bells table */}
                  <div className="border border-slate-200 rounded overflow-hidden">
                    <table className="w-full text-center border-collapse text-xs font-mono">
                      <thead className="bg-slate-100 border-b border-slate-200 font-sans font-semibold text-slate-700">
                        <tr>
                          <th className="py-1.5 px-3 border-r border-slate-200 text-left">Цаг</th>
                          <th className="py-1.5 px-3 border-r border-slate-200">Эхлэх</th>
                          <th className="py-1.5 px-3 border-r border-slate-200">Дуусах</th>
                          <th className="py-1.5 px-3 border-r border-slate-200">Завсарлага</th>
                          <th className="py-1.5 px-3 font-sans">Төлөв</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {currentShift.bells.map((bell, idx) => (
                          <tr
                            key={idx}
                            className={bell.isBigBreakAfter ? 'bg-amber-50/60' : 'hover:bg-slate-50'}
                          >
                            <td className="py-1 px-3 border-r border-slate-200 text-left font-sans font-bold text-slate-800">
                              {bell.periodIndex}-р цаг
                            </td>
                            <td className="py-1 px-3 border-r border-slate-200">
                              <input
                                type="time"
                                value={bell.startTime}
                                onChange={(e) =>
                                  updateBellField(currentShift.shiftNumber, idx, 'startTime', e.target.value)
                                }
                                className="px-1.5 py-0.5 border border-slate-300 rounded text-center"
                              />
                            </td>
                            <td className="py-1 px-3 border-r border-slate-200">
                              <input
                                type="time"
                                value={bell.endTime}
                                onChange={(e) =>
                                  updateBellField(currentShift.shiftNumber, idx, 'endTime', e.target.value)
                                }
                                className="px-1.5 py-0.5 border border-slate-300 rounded text-center"
                              />
                            </td>
                            <td className="py-1 px-3 border-r border-slate-200 font-sans text-slate-700">
                              {bell.breakDurationMinutes} минут
                            </td>
                            <td className="py-1 px-3 font-sans">
                              {bell.isBigBreakAfter ? (
                                <span className="px-2 py-0.5 bg-amber-200 text-amber-800 rounded font-semibold text-[10px]">
                                  Их завсарлага ({bell.breakDurationMinutes} мин)
                                </span>
                              ) : (
                                <span className="text-slate-400">Энгийн завсарлага</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ХИЧЭЭЛИЙН БАЙР (1-р байр, 2-р байр, өргөтгөл г.м) */}
          {activeTab === 'buildings' && (
            <div className="space-y-3">
              <div className="bg-white p-3.5 rounded-lg border border-slate-300 shadow-xs flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800 text-sm">Сургуулийн хичээлийн байр:</div>
                  <div className="text-slate-500 text-[11px] mt-0.5">
                    Сургуулийн 1-ээс олон хичээлийн байр, өргөтгөл, цогцолборуудыг энд бүртгэнэ
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCreateBuilding}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded font-bold hover:bg-emerald-700 shadow-xs text-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Шинэ байр нэмэх</span>
                </button>
              </div>

              <div className="border border-slate-300 rounded bg-white overflow-hidden shadow-xs divide-y divide-slate-200">
                {current.buildings.map((b) => (
                  <div
                    key={b.id}
                    className="p-3 flex items-center justify-between hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-4 h-4 rounded-xs shrink-0"
                        style={{ backgroundColor: b.color }}
                      />
                      <div>
                        <div className="font-bold text-slate-800 text-xs">{b.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          Код: {b.shortName}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsNewBuilding(false);
                          setEditingBuilding({ ...b });
                        }}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded border border-slate-200"
                        title="Засах"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteBuilding(b.id)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded border border-slate-200"
                        title="Устгах"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: ЕРӨНХИЙ МЭДЭЭЛЭЛ & А/Б 7 ХОНОГ */}
          {activeTab === 'general' && (
            <div className="bg-white p-3.5 rounded-lg border border-slate-300 shadow-xs space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Сургуулийн нэр:</label>
                  <input
                    type="text"
                    required
                    value={current.schoolName}
                    onChange={(e) => setCurrent({ ...current, schoolName: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-medium focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Хичээлийн жил:</label>
                  <input
                    type="text"
                    required
                    value={current.academicYear}
                    onChange={(e) => setCurrent({ ...current, academicYear: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-medium focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Сургуулийн ээлжийн тоо:</label>
                  <select
                    value={current.shiftsCount}
                    onChange={(e) => setCurrent({ ...current, shiftsCount: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-bold text-blue-700"
                  >
                    <option value={1}>1 ээлжтэй</option>
                    <option value={2}>2 ээлжтэй (Өглөө, Өдөр)</option>
                    <option value={3}>3 ээлжтэй (Өглөө, Өдөр, Орой)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">7 хоногийн ажлын өдрүүд:</label>
                  <select
                    value={current.daysPerWeek}
                    onChange={(e) => setCurrent({ ...current, daysPerWeek: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-semibold text-slate-800"
                  >
                    <option value={5}>5 өдөр (Даваа - Баасан)</option>
                    <option value={6}>6 өдөр (Даваа - Бямба)</option>
                  </select>
                </div>
              </div>

              {/* A/B Week Toggle */}
              <div className="p-3 bg-amber-50/80 rounded border border-amber-200">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-900">
                  <input
                    type="checkbox"
                    checked={current.enableWeekAB}
                    onChange={(e) => setCurrent({ ...current, enableWeekAB: e.target.checked })}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span>А ба Б 7 хоногоор ээлжилж орох хичээлүүдийг зөвшөөрөх</span>
                </label>
                <p className="text-[11px] text-slate-600 mt-1 ml-6">
                  Зарим хичээлүүд 2 долоо хоног тутамд сэлгэж орох хуваарь хийх боломжийг идэвхжүүлнэ.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-200/90 px-4 py-2.5 border-t border-slate-300 flex justify-end gap-2">
          {!isMandatorySetup && (
            <button
              type="button"
              onClick={handleAttemptClose}
              className="px-4 py-1.5 bg-white border border-slate-300 rounded text-slate-700 font-medium hover:bg-slate-100 shadow-xs cursor-pointer"
            >
              Болих
            </button>
          )}
          <button
            type="button"
            onClick={handleInitiateSave}
            className="flex items-center gap-1.5 px-5 py-1.5 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 shadow-sm cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>
              {isMandatorySetup ? 'Үндсэн мэдээллийг дуусгаж, нэр өгч хадгалах ➔' : 'Тохиргоог хадгалах'}
            </span>
          </button>
        </div>
      </div>

      {/* Mandatory Naming Modal */}
      {showNamingModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-300 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="dialog-titlebar text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Save className="w-4 h-4 text-sky-200" />
                <span className="font-bold text-sm">Хуваарийн төсөлд нэр өгч хадгалах</span>
              </div>
            </div>

            <form onSubmit={handleConfirmNamingAndSave} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-blue-900 leading-relaxed">
                <p className="font-semibold mb-1">
                  Хуваарийн төслийг заавал нэр өгч <strong>JSON (.json)</strong> форматаар хадгална.
                </p>
                <p className="text-[11px] text-blue-700">
                  Мөн тухайн программ суусан path орчны <code>backups/</code> фолдерт өөрчлөлт орох бүрд огноо, цаг минутын тэмдэглэгээтэй autobackup үүснэ.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1.5">
                  Төслийн нэр (Файлын нэр): <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    autoFocus
                    required
                    value={projectNameInput}
                    onChange={(e) => {
                      setProjectNameInput(e.target.value);
                      if (nameError) setNameError('');
                    }}
                    placeholder="Жишээ: 1-р_сургууль_2026-2027_Хуваарь"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-l font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <span className="px-3 py-2 bg-slate-100 border border-l-0 border-slate-300 rounded-r font-mono font-bold text-slate-600">
                    .json
                  </span>
                </div>
                {nameError && (
                  <p className="text-red-600 font-bold mt-1.5 text-[11px] flex items-center gap-1">
                    ⚠ {nameError}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                {!isMandatorySetup && (
                  <button
                    type="button"
                    onClick={() => setShowNamingModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded font-semibold text-slate-700 cursor-pointer"
                  >
                    Буцах
                  </button>
                )}
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Баталгаажуулж JSON-р хадгалах</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mini Building Modal */}
      {editingBuilding && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-300 w-full max-w-sm overflow-hidden">
            <div className="bg-blue-700 text-white px-4 py-2 text-sm font-semibold flex justify-between">
              <span>{isNewBuilding ? 'Шинэ хичээлийн байр нэмэх' : 'Байрны мэдээлэл засах'}</span>
              <button onClick={() => setEditingBuilding(null)} className="text-white hover:text-red-200">
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveBuilding} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Байрны нэр:</label>
                <input
                  type="text"
                  required
                  value={editingBuilding.name}
                  onChange={(e) => setEditingBuilding({ ...editingBuilding, name: e.target.value })}
                  placeholder="Жишээ: 1-р байр (Төв байр)"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-medium focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Товч код:</label>
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
