import React, { useState } from 'react';
import { SchoolSettings, ClassGroup, Teacher } from '../types/timetable';
import { Check, X, AlertCircle, Copy, Users, GraduationCap, CheckSquare, Square } from 'lucide-react';

interface TimeOffMatrixDialogProps {
  title: string;
  subtitle?: string;
  initialTimeOff: Record<string, 'allowed' | 'forbidden' | 'discouraged'>;
  settings: SchoolSettings;
  isOpen: boolean;
  onClose: () => void;
  onSave: (timeOff: Record<string, 'allowed' | 'forbidden' | 'discouraged'>) => void;
  classes?: ClassGroup[];
  teachers?: Teacher[];
  onCopyToOthers?: (
    type: 'classes' | 'teachers',
    ids: string[],
    matrix: Record<string, 'allowed' | 'forbidden' | 'discouraged'>
  ) => void;
}

export const TimeOffMatrixDialog: React.FC<TimeOffMatrixDialogProps> = ({
  title,
  subtitle,
  initialTimeOff,
  settings,
  isOpen,
  onClose,
  onSave,
  classes = [],
  teachers = [],
  onCopyToOthers,
}) => {
  const [matrix, setMatrix] = useState<Record<string, 'allowed' | 'forbidden' | 'discouraged'>>({
    ...initialTimeOff,
  });

  // Copy modal state
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyTargetType, setCopyTargetType] = useState<'classes' | 'teachers'>('classes');
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [copySuccessMsg, setCopySuccessMsg] = useState('');

  if (!isOpen) return null;

  const toggleCell = (day: number, period: number) => {
    const key = `${day}_${period}`;
    const current = matrix[key] || 'allowed';
    let next: 'allowed' | 'forbidden' | 'discouraged' = 'allowed';

    if (current === 'allowed') next = 'forbidden';
    else if (current === 'forbidden') next = 'discouraged';
    else next = 'allowed';

    setMatrix((prev) => ({
      ...prev,
      [key]: next,
    }));
  };

  const toggleDay = (day: number) => {
    // If all allowed, make forbidden, else allowed
    let anyAllowed = false;
    for (let p = 0; p < settings.periodsPerDay; p++) {
      if ((matrix[`${day}_${p}`] || 'allowed') === 'allowed') anyAllowed = true;
    }

    const nextVal = anyAllowed ? 'forbidden' : 'allowed';
    setMatrix((prev) => {
      const updated = { ...prev };
      for (let p = 0; p < settings.periodsPerDay; p++) {
        updated[`${day}_${p}`] = nextVal;
      }
      return updated;
    });
  };

  const togglePeriod = (period: number) => {
    let anyAllowed = false;
    for (let d = 0; d < settings.daysPerWeek; d++) {
      if ((matrix[`${d}_${period}`] || 'allowed') === 'allowed') anyAllowed = true;
    }

    const nextVal = anyAllowed ? 'forbidden' : 'allowed';
    setMatrix((prev) => {
      const updated = { ...prev };
      for (let d = 0; d < settings.daysPerWeek; d++) {
        updated[`${d}_${period}`] = nextVal;
      }
      return updated;
    });
  };

  const setAll = (status: 'allowed' | 'forbidden') => {
    const updated: Record<string, 'allowed' | 'forbidden' | 'discouraged'> = {};
    for (let d = 0; d < settings.daysPerWeek; d++) {
      for (let p = 0; p < settings.periodsPerDay; p++) {
        updated[`${d}_${p}`] = status;
      }
    }
    setMatrix(updated);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-lg shadow-2xl border border-slate-300 w-full max-w-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Title bar - aSc Windows style */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white px-4 py-2.5 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-full bg-amber-400"></div>
            <span className="font-semibold text-sm">Чөлөөт цаг тохируулах (Time-off): {title}</span>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-red-600 rounded px-2 py-0.5 text-xs font-bold"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 bg-slate-50 flex-1">
          {subtitle && <p className="text-xs text-slate-600 mb-3">{subtitle}</p>}

          <div className="flex items-center justify-between mb-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 font-medium text-emerald-700">
                <span className="w-3.5 h-3.5 bg-emerald-500 rounded flex items-center justify-center text-white text-[10px]">
                  ✓
                </span>{' '}
                Хичээллэх боломжтой
              </span>
              <span className="flex items-center gap-1 font-medium text-rose-700">
                <span className="w-3.5 h-3.5 bg-rose-500 rounded flex items-center justify-center text-white text-[10px]">
                  ✕
                </span>{' '}
                Боломжгүй (Чөлөөтэй)
              </span>
              <span className="flex items-center gap-1 font-medium text-amber-700">
                <span className="w-3.5 h-3.5 bg-amber-500 rounded flex items-center justify-center text-white text-[10px]">
                  ?
                </span>{' '}
                Хүсээгүй
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setAll('allowed')}
                className="px-2 py-1 bg-white border border-slate-300 rounded text-xs hover:bg-emerald-50 text-emerald-700 font-medium"
              >
                Бүгд зөвшөөрөгдсөн
              </button>
              <button
                type="button"
                onClick={() => setAll('forbidden')}
                className="px-2 py-1 bg-white border border-slate-300 rounded text-xs hover:bg-rose-50 text-rose-700 font-medium"
              >
                Бүгдийг хаах
              </button>
            </div>
          </div>

          {/* Matrix table */}
          <div className="border border-slate-300 rounded bg-white overflow-hidden shadow-xs">
            <table className="w-full text-center border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300">
                  <th className="p-2 border-r border-slate-300 text-slate-600 w-28 text-left font-semibold">
                    Цаг / Гараг
                  </th>
                  {settings.dayNames.map((dayName, d) => (
                    <th
                      key={d}
                      onClick={() => toggleDay(d)}
                      className="p-2 border-r border-slate-300 font-semibold text-slate-800 cursor-pointer hover:bg-blue-100 transition-colors"
                      title="Бүх өдрийг солих"
                    >
                      {dayName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: settings.periodsPerDay }).map((_, p) => {
                  const bell = settings.bells[p];
                  return (
                    <tr key={p} className="border-b border-slate-200 hover:bg-slate-50/50">
                      <td
                        onClick={() => togglePeriod(p)}
                        className="p-2 border-r border-slate-300 text-left font-medium text-slate-700 bg-slate-50 cursor-pointer hover:bg-blue-100 transition-colors"
                        title="Энэ цагийг бүх өдрүүдэд солих"
                      >
                        <div className="leading-tight">
                          <span className="font-semibold">{p + 1}-р цаг</span>
                          {bell && (
                            <span className="block text-[10px] text-slate-500 font-mono">
                              {bell.startTime}-{bell.endTime}
                            </span>
                          )}
                        </div>
                      </td>

                      {settings.dayNames.map((_, d) => {
                        const status = matrix[`${d}_${p}`] || 'allowed';
                        let bgClass = 'bg-emerald-500 hover:bg-emerald-600 text-white';
                        let icon = <Check className="w-4 h-4 mx-auto stroke-[2.5]" />;

                        if (status === 'forbidden') {
                          bgClass = 'bg-rose-500 hover:bg-rose-600 text-white';
                          icon = <X className="w-4 h-4 mx-auto stroke-[2.5]" />;
                        } else if (status === 'discouraged') {
                          bgClass = 'bg-amber-400 hover:bg-amber-500 text-white';
                          icon = <AlertCircle className="w-4 h-4 mx-auto stroke-[2.5]" />;
                        }

                        return (
                          <td
                            key={d}
                            className="p-1 border-r border-slate-200 cursor-pointer select-none"
                            onClick={() => toggleCell(d, p)}
                          >
                            <div
                              className={`h-9 w-full rounded flex items-center justify-center transition shadow-xs ${bgClass}`}
                            >
                              {icon}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-2 text-[11px] text-slate-500 italic">
            * Нүдэн дээр дарахад Зөвшөөрөгдсөн (Ногоон) → Хаалттай (Улаан) → Хүсээгүй (Шар) болж солигдоно.
          </p>
        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-4 py-2.5 border-t border-slate-300 flex items-center justify-between gap-2">
          {onCopyToOthers && (classes.length > 0 || teachers.length > 0) && (
            <button
              type="button"
              onClick={() => {
                setSelectedTargetIds([]);
                setCopySuccessMsg('');
                setShowCopyModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded text-xs font-semibold cursor-pointer shadow-xs transition"
              title="Энэ цагийн тохиргоог өөр анги эсвэл өөр багш нарт хуулж тавих"
            >
              <Copy className="w-3.5 h-3.5 text-indigo-600" />
              <span>Бусад анги / багшид хуулах</span>
            </button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer"
            >
              Болих
            </button>
            <button
              type="button"
              onClick={() => {
                onSave(matrix);
                onClose();
              }}
              className="px-5 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 shadow-sm transition cursor-pointer"
            >
              Хадгалах
            </button>
          </div>
        </div>
      </div>
    </div>

      {/* Copy Time Off to other Classes / Teachers modal */}
      {showCopyModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-300 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-indigo-700 to-blue-800 text-white px-4 py-2.5 flex items-center justify-between select-none">
              <div className="flex items-center gap-2">
                <Copy className="w-4 h-4 text-indigo-200" />
                <span className="font-bold text-sm">Цагийн тохиргоог хуулах</span>
              </div>
              <button
                onClick={() => setShowCopyModal(false)}
                className="text-white hover:text-red-200 rounded px-1.5 py-0.5"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <p className="text-slate-600">
                <strong>{title}</strong>-н цагийн хуваарийн менежмент (Time off)-ийн тохиргоог сонгосон зорилтот
                ангиуд эсвэл багш нарт яг адилаар хуулна.
              </p>

              {/* Target Type switch */}
              <div className="flex rounded-lg border border-slate-300 overflow-hidden font-bold select-none">
                <button
                  type="button"
                  onClick={() => {
                    setCopyTargetType('classes');
                    setSelectedTargetIds([]);
                  }}
                  className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 transition ${
                    copyTargetType === 'classes' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Ангиудад хуулах ({classes.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCopyTargetType('teachers');
                    setSelectedTargetIds([]);
                  }}
                  className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 transition ${
                    copyTargetType === 'teachers' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>Багш нарт хуулах ({teachers.length})</span>
                </button>
              </div>

              {/* Selection controls */}
              <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1">
                <span>Сонгосон: <strong>{selectedTargetIds.length}</strong></span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const allIds =
                        copyTargetType === 'classes' ? classes.map((c) => c.id) : teachers.map((t) => t.id);
                      setSelectedTargetIds(allIds);
                    }}
                    className="text-blue-600 hover:underline font-semibold"
                  >
                    Бүгдийг сонгох
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTargetIds([])}
                    className="text-slate-500 hover:underline"
                  >
                    Арилгах
                  </button>
                </div>
              </div>

              {/* Target List */}
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded p-2 space-y-1 bg-slate-50">
                {copyTargetType === 'classes' ? (
                  classes.map((c) => {
                    const isChecked = selectedTargetIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 p-1 rounded hover:bg-white cursor-pointer select-none"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedTargetIds([...selectedTargetIds, c.id]);
                            else setSelectedTargetIds(selectedTargetIds.filter((id) => id !== c.id));
                          }}
                          className="rounded text-amber-600"
                        />
                        <span
                          className="w-2.5 h-2.5 rounded-xs"
                          style={{ backgroundColor: c.color }}
                        />
                        <span className="font-semibold text-slate-800">{c.name}</span>
                        <span className="text-[10px] text-slate-500 ml-auto">{c.shift}-р ээлж</span>
                      </label>
                    );
                  })
                ) : (
                  teachers.map((t) => {
                    const isChecked = selectedTargetIds.includes(t.id);
                    return (
                      <label
                        key={t.id}
                        className="flex items-center gap-2 p-1 rounded hover:bg-white cursor-pointer select-none"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedTargetIds([...selectedTargetIds, t.id]);
                            else setSelectedTargetIds(selectedTargetIds.filter((id) => id !== t.id));
                          }}
                          className="rounded text-indigo-600"
                        />
                        <span
                          className="w-2.5 h-2.5 rounded-xs"
                          style={{ backgroundColor: t.color }}
                        />
                        <span className="font-semibold text-slate-800">{t.name}</span>
                      </label>
                    );
                  })
                )}
              </div>

              {copySuccessMsg && (
                <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded font-semibold text-center text-xs">
                  {copySuccessMsg}
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCopyModal(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded font-semibold text-slate-700"
                >
                  Болих
                </button>
                <button
                  type="button"
                  disabled={selectedTargetIds.length === 0}
                  onClick={() => {
                    if (onCopyToOthers) {
                      onCopyToOthers(copyTargetType, selectedTargetIds, matrix);
                      setCopySuccessMsg(
                        `Цагийн тохиргоог сонгосон ${selectedTargetIds.length} ${
                          copyTargetType === 'classes' ? 'ангид' : 'багшид'
                        } амжилттай хууллаа!`
                      );
                      setTimeout(() => {
                        setShowCopyModal(false);
                      }, 1200);
                    }
                  }}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold disabled:opacity-50 flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Сонгосон {selectedTargetIds.length}-д хуулах</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
