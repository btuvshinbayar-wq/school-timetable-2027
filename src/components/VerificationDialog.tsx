import React from 'react';
import { ConflictIssue, ScheduledCard, SchoolSettings } from '../types/timetable';
import { Gavel, CheckCircle, AlertTriangle, XCircle, ArrowRight } from 'lucide-react';

interface VerificationDialogProps {
  conflicts: ConflictIssue[];
  isOpen: boolean;
  onClose: () => void;
  onSelectSlot?: (day: number, period: number) => void;
}

export const VerificationDialog: React.FC<VerificationDialogProps> = ({
  conflicts,
  isOpen,
  onClose,
  onSelectSlot,
}) => {
  if (!isOpen) return null;

  const errors = conflicts.filter((c) => c.severity === 'error');
  const warnings = conflicts.filter((c) => c.severity === 'warning');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-slate-50 rounded-lg shadow-2xl border border-slate-300 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Title bar */}
        <div className="bg-gradient-to-r from-amber-700 to-amber-800 text-white px-4 py-2.5 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <Gavel className="w-4 h-4 text-amber-200" />
            <span className="font-semibold text-sm">Хуваарийн шалгалт & Зөрчил илрүүлэлт (Verification)</span>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-red-600 rounded px-2 py-0.5 text-xs font-bold"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3 text-xs">
          {conflicts.length === 0 ? (
            <div className="bg-white p-6 rounded-lg border border-slate-300 text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                <CheckCircle className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-slate-800 text-sm">Хуваарь 100% Зөрчилгүй байна!</h3>
              <p className="text-slate-600 max-w-md mx-auto text-xs">
                Багш, анги танхимын давхардалгүй бөгөөд бүх чөлөөт цагийн хязгаарлалтууд бүрэн биелсэн байна.
              </p>
            </div>
          ) : (
            <>
              {/* Errors section */}
              {errors.length > 0 && (
                <div className="bg-white rounded-lg border border-rose-200 overflow-hidden shadow-xs">
                  <div className="bg-rose-50 px-3 py-1.5 border-b border-rose-200 font-bold text-rose-800 flex items-center gap-1.5">
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span>Ноцтой давхардал, зөрчлүүд ({errors.length}):</span>
                  </div>
                  <div className="divide-y divide-rose-100 max-h-48 overflow-y-auto">
                    {errors.map((err) => (
                      <div
                        key={err.id}
                        className="p-2.5 hover:bg-rose-50/50 flex items-start justify-between gap-3"
                      >
                        <div>
                          <div className="font-semibold text-rose-900">{err.title}</div>
                          <div className="text-slate-600 text-[11px] mt-0.5">{err.description}</div>
                        </div>
                        {err.dayIndex !== undefined && err.periodIndex !== undefined && (
                          <button
                            onClick={() => {
                              onSelectSlot?.(err.dayIndex!, err.periodIndex!);
                              onClose();
                            }}
                            className="px-2 py-1 bg-rose-100 text-rose-800 rounded font-semibold text-[10px] hover:bg-rose-200 shrink-0 flex items-center gap-1"
                          >
                            <span>Харах</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings section */}
              {warnings.length > 0 && (
                <div className="bg-white rounded-lg border border-amber-200 overflow-hidden shadow-xs">
                  <div className="bg-amber-50 px-3 py-1.5 border-b border-amber-200 font-bold text-amber-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Анхааруулга & Цонх цаг ({warnings.length}):</span>
                  </div>
                  <div className="divide-y divide-amber-100 max-h-48 overflow-y-auto">
                    {warnings.map((warn) => (
                      <div
                        key={warn.id}
                        className="p-2.5 hover:bg-amber-50/50 flex items-start justify-between gap-3"
                      >
                        <div>
                          <div className="font-semibold text-amber-900">{warn.title}</div>
                          <div className="text-slate-600 text-[11px] mt-0.5">{warn.description}</div>
                        </div>
                        {warn.dayIndex !== undefined && (
                          <button
                            onClick={() => {
                              onSelectSlot?.(warn.dayIndex!, 0);
                              onClose();
                            }}
                            className="px-2 py-1 bg-amber-100 text-amber-800 rounded font-semibold text-[10px] hover:bg-amber-200 shrink-0 flex items-center gap-1"
                          >
                            <span>Харах</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
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
    </div>
  );
};
