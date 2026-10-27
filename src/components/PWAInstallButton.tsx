import React, { useState } from 'react';
import { usePWAInstall } from './usePWAInstall';
import { Download, Monitor, CheckCircle } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded">
        <CheckCircle className="w-3.5 h-3.5" />
        <span className="font-medium">Десктоп суулгагдсан</span>
      </div>
    );
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded shadow-sm transition-all"
        title="Компьютер дээр десктоп програм байдлаар суулгах"
      >
        <Monitor className="w-3.5 h-3.5" />
        <span>Десктоп суулгах</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1 px-2 py-1 text-xs text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
        >
          <Download className="w-3.5 h-3.5" />
          <span>iOS суулгах</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl text-slate-800">
              <h3 className="text-base font-bold text-slate-900">iPhone / iPad дээр суулгах</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                1. Safari доод талын <strong>Share (Хуваалцах)</strong> товч дээр дарна.<br />
                2. Доош гүйлгээд <strong>Дэлгэцэнд нэмэх (Add to Home Screen)</strong> сонгоно.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded bg-blue-600 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                Хаах
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <button
      onClick={() => {
        alert('Энэ вэб хөтчийн цэснээс "Install App" эсвэл "Add to Desktop" товчийг дарж десктоп дээрээ шууд суулгаж болно.');
      }}
      className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded"
      title="Десктоп дээр суулгах заавар"
    >
      <Monitor className="w-3.5 h-3.5 text-slate-600" />
      <span>Десктоп горим</span>
    </button>
  );
};
