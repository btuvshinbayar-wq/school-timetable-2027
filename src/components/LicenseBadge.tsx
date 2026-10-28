import React, { useEffect, useState } from 'react';
import { KeyRound, FolderOpen, X } from 'lucide-react';
import { desktop, DesktopLicenseStatus } from '../desktop';

/** Десктоп хувилбарт: лицензийн мэдээлэл (толгой хэсгийн баруун талд) */
export const LicenseBadge: React.FC = () => {
  const [status, setStatus] = useState<DesktopLicenseStatus | null>(null);
  const [version, setVersion] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!desktop) return;
    desktop.license.status().then(setStatus);
    desktop.app.info().then((i) => setVersion(i.version));
  }, []);

  if (!desktop || !status?.license) return null;
  const lic = status.license;
  const soon = status.daysLeft != null && status.daysLeft <= 30;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11.5px] ${
          soon ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
        }`}
        title="Лицензийн мэдээлэл"
      >
        <KeyRound className="w-3.5 h-3.5" />
        <span className="max-w-[220px] truncate">{lic.licensee}</span>
        {soon && <span className="font-semibold">· {status.daysLeft} хоног үлдсэн</span>}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl border border-slate-300 shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-titlebar px-4 py-2.5 flex items-center justify-between">
              <span className="font-semibold text-sm">Лиценз</span>
              <button onClick={() => setOpen(false)} aria-label="Хаах" className="text-white/80 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 text-[13px] space-y-3">
              <div className="flex items-center gap-3">
                <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="w-11 h-11" />
                <div>
                  <div className="font-semibold text-slate-900">School Timetable 2027</div>
                  <div className="text-slate-500 text-[12px]">Хувилбар {version}</div>
                </div>
              </div>
              <dl className="grid grid-cols-[130px_1fr] gap-y-1.5 text-[12.5px]">
                <dt className="text-slate-500">Эзэмшигч</dt>
                <dd className="font-medium text-slate-900">{lic.licensee}</dd>
                <dt className="text-slate-500">Хугацаа</dt>
                <dd>{lic.expires ? `${lic.expires} хүртэл${status.daysLeft != null ? ` (${status.daysLeft} хоног)` : ''}` : 'Хугацаагүй'}</dd>
                <dt className="text-slate-500">Төрөл</dt>
                <dd>{lic.edition === 'pro' ? 'Pro' : 'Стандарт'}</dd>
                <dt className="text-slate-500">Компьютерын код</dt>
                <dd className="font-mono tracking-wider">{status.machineCode}</dd>
                <dt className="text-slate-500">Лицензийн дугаар</dt>
                <dd className="font-mono">{lic.id}</dd>
              </dl>
              <div className="flex gap-2 pt-2 border-t border-slate-200">
                <button
                  onClick={() => desktop!.backup.openFolder()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-100"
                >
                  <FolderOpen className="w-4 h-4" /> Нөөц хуулбарын хавтас
                </button>
                <button
                  onClick={() => desktop!.license.deactivate()}
                  className="ml-auto px-3 py-1.5 rounded-md border border-rose-200 text-rose-800 hover:bg-rose-50"
                  title="Өөр компьютерт шилжүүлэх үед"
                >
                  Лиценз хасах
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
