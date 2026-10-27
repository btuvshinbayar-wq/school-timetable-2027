import React, { useState, useEffect } from 'react';
import { History, Download, RefreshCw, AlertCircle, HardDrive, CheckCircle2 } from 'lucide-react';
import { BackupItem, listServerBackups, loadServerBackup, ProjectState, triggerAutoBackup } from '../utils/storage';

interface BackupsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreProject: (project: ProjectState) => void;
  currentProject: ProjectState;
}

export const BackupsDialog: React.FC<BackupsDialogProps> = ({
  isOpen,
  onClose,
  onRestoreProject,
  currentProject,
}) => {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [backupPath, setBackupPath] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/backup/list');
      if (res.ok) {
        const data = await res.json();
        setBackups(data.backups || []);
        if (data.path) setBackupPath(data.path);
      } else {
        const list = await listServerBackups();
        setBackups(list);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchList();
      setStatusMessage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateNow = async () => {
    setLoading(true);
    triggerAutoBackup(currentProject, true);
    setTimeout(async () => {
      await fetchList();
      setStatusMessage('Шинэ хуулбар амжилттай үүслээ!');
      setLoading(false);
    }, 400);
  };

  const handleRestore = async (filename: string) => {
    if (!confirm(`"${filename}" хуулбарыг одоогийн хуваарь дээр сэргээх үү?`)) return;
    try {
      setLoading(true);
      const restored = await loadServerBackup(filename);
      onRestoreProject(restored);
      setStatusMessage(`"${filename}" хуулбар амжилттай сэргээгдлээ!`);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      alert(`Сэргээхэд алдаа гарлаа: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (filename: string) => {
    try {
      const data = await loadServerBackup(filename);
      const dataStr = JSON.stringify(data, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Татахад алдаа гарлаа: ${err?.message || err}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-slate-50 rounded-lg shadow-2xl border border-slate-300 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="dialog-titlebar px-4 py-2.5 flex items-center justify-between select-none border-b border-[#264b42]">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-sm">Авто-хуулбарын удирдлага (Autobackup)</span>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-red-600 rounded px-2 py-0.5 text-xs font-bold"
          >
            ✕
          </button>
        </div>

        {/* Path banner */}
        <div className="bg-emerald-50 px-4 py-2 border-b border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Суусан path орчны хавтас:</strong>{' '}
              <code className="bg-emerald-100/80 px-1 py-0.5 rounded text-[11px] font-mono">
                {backupPath || './backups/'}
              </code>
            </span>
          </div>
          <button
            onClick={handleCreateNow}
            disabled={loading}
            className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-[11px] shadow-xs cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            <span>Одоо хуулбар үүсгэх</span>
          </button>
        </div>

        {statusMessage && (
          <div className="bg-green-100 text-green-800 px-4 py-1.5 text-xs font-medium flex items-center gap-1.5 border-b border-green-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* List content */}
        <div className="p-4 flex-1 overflow-y-auto">
          <p className="text-xs text-slate-600 mb-3">
            Хуваарийн программ дээр өөрчлөлт оруулах бүрд систем автоматаар огноо, цаг минут бүхий autobackup файлыг
            программ суусан path орчны <code>backups/</code> фолдерт .json форматаар үүсгэж хадгалдаг.
          </p>

          {loading && backups.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
              Хуулбаруудыг шалгаж байна...
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-8 bg-white rounded border border-slate-200 text-xs text-slate-500">
              <AlertCircle className="w-5 h-5 mx-auto mb-1.5 text-amber-500" />
              Одоогоор авто-хуулбар үүсээгүй байна. Хичээлийн хуваарьт өөрчлөлт оруулахад автоматаар үүснэ.
            </div>
          ) : (
            <div className="space-y-2">
              {backups.map((b) => (
                <div
                  key={b.filename}
                  className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between hover:border-slate-300 transition text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="font-semibold text-slate-800 font-mono text-[11px] flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      {b.filename}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-3">
                      <span>Огноо, цаг: <strong>{b.displayTime || b.mtime}</strong></span>
                      <span>Хэмжээ: {(b.size / 1024).toFixed(1)} KB</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleDownload(b.filename)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-[11px] flex items-center gap-1 transition"
                      title="Файлыг JSON-р татах"
                    >
                      <Download className="w-3 h-3 text-slate-600" />
                      <span>Татах</span>
                    </button>
                    <button
                      onClick={() => handleRestore(b.filename)}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[11px] flex items-center gap-1 transition shadow-xs"
                      title="Энэ хувилбарыг одоогийн хуваарь дээр сэргээх"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Сэргээх</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-200/90 px-4 py-2 border-t border-slate-300 flex justify-between items-center text-xs">
          <span className="text-slate-600">Нийт хуулбар: <strong>{backups.length}</strong></span>
          <button
            onClick={onClose}
            className="px-4 py-1 bg-white border border-slate-300 rounded text-slate-700 font-semibold hover:bg-slate-100"
          >
            Хаах
          </button>
        </div>
      </div>
    </div>
  );
};
