import React, { useRef, useState } from 'react';
import {
  Subject,
  Teacher,
  ClassGroup,
  Classroom,
  LessonContract,
  ScheduledCard,
  SchoolSettings,
} from '../types/timetable';
import { exportTimetableToExcel, downloadExcelTemplate, importExcelFile, ExcelImportRaw } from '../utils/excelIO';
import { FileSpreadsheet, Download, Upload, CheckCircle2, AlertCircle } from 'lucide-react';

interface ExcelImportExportDialogProps {
  scheduledCards: ScheduledCard[];
  subjects: Subject[];
  teachers: Teacher[];
  classes: ClassGroup[];
  classrooms: Classroom[];
  settings: SchoolSettings;
  isOpen: boolean;
  onClose: () => void;
  /** Түүхий мөрүүдийг App нэрээр нэгтгэж, мэдэгдлийн мөрүүдийг буцаана */
  onImportData: (raw: ExcelImportRaw) => string[];
}

export const ExcelImportExportDialog: React.FC<ExcelImportExportDialogProps> = ({
  scheduledCards,
  subjects,
  teachers,
  classes,
  classrooms,
  settings,
  isOpen,
  onClose,
  onImportData,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importLog, setImportLog] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleExportTimetable = () => {
    exportTimetableToExcel(scheduledCards, subjects, teachers, classes, classrooms, settings);
  };

  const handleDownloadTemplate = () => {
    downloadExcelTemplate();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setImportLog([]);

    try {
      const raw = await importExcelFile(file);
      setImportLog(onImportData(raw));
    } catch (err: any) {
      setImportLog([`❌ Алдаа: ${err?.message || err}`]);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-slate-50 rounded-lg shadow-2xl border border-slate-300 w-full max-w-xl overflow-hidden flex flex-col">
        {/* Title bar */}
        <div className="dialog-titlebar text-white px-4 py-2.5 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span className="font-semibold text-sm">Excel Импорт & Экспорт (Excel Data Center)</span>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-red-600 rounded px-2 py-0.5 text-xs font-bold"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 text-xs">
          {/* Export Timetable */}
          <div className="bg-white p-3.5 rounded-lg border border-slate-300 shadow-xs flex items-center justify-between">
            <div>
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Download className="w-4 h-4 text-emerald-600" />
                <span>Бэлэн болсон хуваарийг Excel-рүү татах</span>
              </h4>
              <p className="text-slate-500 text-xs mt-0.5">
                Анги бүрийн хуваарь болон багш нарын нэгдсэн хуваарийг форматын дагуу .xlsx татах
              </p>
            </div>
            <button
              onClick={handleExportTimetable}
              className="px-4 py-2 bg-emerald-600 text-white rounded font-bold hover:bg-emerald-700 shadow-xs shrink-0"
            >
              Экспортлох (.xlsx)
            </button>
          </div>

          {/* Download Sample Template */}
          <div className="bg-white p-3.5 rounded-lg border border-slate-300 shadow-xs flex items-center justify-between">
            <div>
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                <span>Бэлдэц Excel загвар татах</span>
              </h4>
              <p className="text-slate-500 text-xs mt-0.5">
                Хичээл, багш, анги танхимын мэдээлэл оруулах бэлэн хүснэгтийн загвар
              </p>
            </div>
            <button
              onClick={handleDownloadTemplate}
              className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 shadow-xs shrink-0"
            >
              Загвар татах
            </button>
          </div>

          {/* Import File */}
          <div className="bg-white p-3.5 rounded-lg border border-slate-300 shadow-xs space-y-2">
            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Upload className="w-4 h-4 text-indigo-600" />
              <span>Excel файлаас дата импортлох</span>
            </h4>
            <p className="text-slate-500 text-xs">
              Excel (.xlsx, .xls) файлыг сонгож оруулснаар хичээл, багш, танхим, ангиуд автоматаар нэмэгдэнэ.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-lg p-5 text-center cursor-pointer bg-slate-50 hover:bg-indigo-50/40 transition"
            >
              <Upload className="w-6 h-6 text-indigo-500 mx-auto mb-1" />
              <div className="font-semibold text-slate-700">Excel файл сонгох эсвэл чирч оруулах</div>
              <div className="text-[11px] text-slate-400">.xlsx формат дэмжинэ</div>
            </div>

            {/* Import results log */}
            {importLog.length > 0 && (
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200 space-y-1">
                {importLog.map((log, i) => (
                  <div key={i} className="text-emerald-700 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            )}
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
    </div>
  );
};
