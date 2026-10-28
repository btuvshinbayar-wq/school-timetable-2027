import React, { useMemo, useState } from 'react';
import { ConflictIssue } from '../types/timetable';
import { Gavel, CheckCircle, ChevronRight, ChevronDown } from 'lucide-react';

interface VerificationDialogProps {
  conflicts: ConflictIssue[];
  isOpen: boolean;
  onClose: () => void;
  /** Зөрчилтэй анги/багш/танхимын хуваарийг нээх */
  onShowEntity?: (entityType: 'teacher' | 'class' | 'room', entityId: string) => void;
}

interface Group {
  title: string;
  severity: 'error' | 'warning';
  items: ConflictIssue[];
}

export const VerificationDialog: React.FC<VerificationDialogProps> = ({ conflicts, isOpen, onClose, onShowEntity }) => {
  const [open, setOpen] = useState<string | null>(null);

  const groups = useMemo(() => {
    const m = new Map<string, Group>();
    for (const c of conflicts) {
      const key = `${c.severity}|${c.title}`;
      if (!m.has(key)) m.set(key, { title: c.title, severity: c.severity, items: [] });
      m.get(key)!.items.push(c);
    }
    return Array.from(m.values()).sort((a, b) =>
      a.severity !== b.severity ? (a.severity === 'error' ? -1 : 1) : b.items.length - a.items.length
    );
  }, [conflicts]);

  if (!isOpen) return null;
  const errorCount = conflicts.filter((c) => c.severity === 'error').length;
  const warnCount = conflicts.length - errorCount;
  const firstKey = groups[0] ? `${groups[0].severity}|${groups[0].title}` : null;
  const expanded = open ?? firstKey;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-slate-50 rounded-xl shadow-2xl border border-slate-300 w-full max-w-3xl overflow-hidden flex flex-col max-h-[86vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-titlebar px-4 py-2.5 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <Gavel className="w-4 h-4 opacity-80" />
            <span className="font-semibold text-sm">Хуваарийн шалгалт</span>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white rounded px-2 py-0.5 text-xs font-bold" aria-label="Хаах">
            ✕
          </button>
        </div>

        <div className="px-4 pt-3 pb-2 flex items-center gap-3 text-[12.5px] border-b border-slate-200 bg-white">
          <span className={errorCount > 0 ? 'text-rose-700 font-semibold' : 'text-emerald-700 font-semibold'}>
            {errorCount > 0 ? `${errorCount} хатуу зөрчил` : 'Хатуу зөрчил байхгүй'}
          </span>
          <span className="text-slate-500">{warnCount} сануулга — зөөлөн дүрэм, цонх, тархалт</span>
        </div>

        <div className="p-3 overflow-y-auto flex-1 space-y-2 text-xs">
          {conflicts.length === 0 ? (
            <div className="bg-white p-6 rounded-lg border border-slate-200 text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-700">
                <CheckCircle className="w-7 h-7" />
              </div>
              <h3 className="font-semibold text-slate-800 text-sm">Хуваарьт зөрчил, сануулга алга</h3>
              <p className="text-slate-600 max-w-md mx-auto">Бүх хичээл байршсан, давхардалгүй, дүрмүүд биелсэн байна.</p>
            </div>
          ) : (
            groups.map((g) => {
              const key = `${g.severity}|${g.title}`;
              const isOpen = expanded === key;
              const tone =
                g.severity === 'error'
                  ? 'border-rose-200 bg-rose-50 text-rose-900'
                  : 'border-slate-200 bg-white text-slate-800';
              return (
                <div key={key} className={`rounded-lg border overflow-hidden ${g.severity === 'error' ? 'border-rose-200' : 'border-slate-200'}`}>
                  <button
                    onClick={() => setOpen(isOpen ? '' : key)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left font-semibold ${tone}`}
                  >
                    {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    <span className={`w-1.5 h-1.5 rounded-full ${g.severity === 'error' ? 'bg-rose-600' : 'bg-amber-500'}`} />
                    <span className="flex-1">{g.title}</span>
                    <span className="text-[11px] font-medium opacity-70">{g.items.length}</span>
                  </button>
                  {isOpen && (
                    <div className="divide-y divide-slate-100 bg-white max-h-[46vh] overflow-y-auto">
                      {g.items.map((it) => (
                        <div key={it.id} className="px-3 py-2 flex items-start justify-between gap-3">
                          <div className="text-slate-700 text-[11.5px] leading-snug">{it.description}</div>
                          {onShowEntity && it.entityId && (it.entityType === 'class' || it.entityType === 'teacher' || it.entityType === 'room') && (
                            <button
                              onClick={() => {
                                onShowEntity(it.entityType as 'class' | 'teacher' | 'room', it.entityId!);
                                onClose();
                              }}
                              className="px-2 py-1 rounded-md border border-slate-300 text-slate-700 text-[11px] hover:bg-slate-100 shrink-0"
                            >
                              {it.entityType === 'teacher' ? 'Багшийн хуваарь' : it.entityType === 'room' ? 'Танхимын хуваарь' : 'Ангийн хуваарь'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="bg-slate-100 px-4 py-2 border-t border-slate-200 flex justify-end">
          <button onClick={onClose} className="px-5 py-1 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-800 hover:bg-slate-100">
            Хаах
          </button>
        </div>
      </div>
    </div>
  );
};
