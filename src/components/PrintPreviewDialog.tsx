import React, { useState } from 'react';
import {
  Subject,
  Teacher,
  ClassGroup,
  Classroom,
  ScheduledCard,
  SchoolSettings,
} from '../types/timetable';
import { Printer, X } from 'lucide-react';

interface PrintPreviewDialogProps {
  scheduledCards: ScheduledCard[];
  subjects: Subject[];
  teachers: Teacher[];
  classes: ClassGroup[];
  classrooms: Classroom[];
  settings: SchoolSettings;
  isOpen: boolean;
  onClose: () => void;
}

export const PrintPreviewDialog: React.FC<PrintPreviewDialogProps> = ({
  scheduledCards,
  subjects,
  teachers,
  classes,
  classrooms,
  settings,
  isOpen,
  onClose,
}) => {
  const [printType, setPrintType] = useState<'class' | 'teacher'>('class');
  const [targetId, setTargetId] = useState<string>(classes[0]?.id || '');

  if (!isOpen) return null;

  const subMap = new Map(subjects.map((s) => [s.id, s]));
  const teachMap = new Map(teachers.map((t) => [t.id, t]));
  const roomMap = new Map(classrooms.map((r) => [r.id, r]));

  const currentClass = classes.find((c) => c.id === targetId);
  const currentTeacher = teachers.find((t) => t.id === targetId);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-lg shadow-2xl border border-slate-300 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:w-full">
        {/* Controls header (hidden on print) */}
        <div className="bg-slate-800 text-white px-4 py-2.5 flex items-center justify-between print:hidden select-none">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-sm">Хэвлэх харагдац (Print Preview)</span>
            <div className="flex bg-slate-700 rounded p-0.5 text-xs">
              <button
                onClick={() => {
                  setPrintType('class');
                  setTargetId(classes[0]?.id || '');
                }}
                className={`px-3 py-1 rounded font-medium ${
                  printType === 'class' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                Ангиар
              </button>
              <button
                onClick={() => {
                  setPrintType('teacher');
                  setTargetId(teachers[0]?.id || '');
                }}
                className={`px-3 py-1 rounded font-medium ${
                  printType === 'teacher' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                Багшаар
              </button>
            </div>

            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="px-2 py-1 bg-slate-700 text-white border border-slate-600 rounded text-xs"
            >
              {printType === 'class'
                ? classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} анги
                    </option>
                  ))
                : teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Хэвлэх (Print)</span>
            </button>
            <button onClick={onClose} className="p-1 text-slate-300 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Paper Canvas */}
        <div className="p-8 overflow-y-auto flex-1 bg-slate-100 print:bg-white print:p-0">
          <div className="bg-white p-6 rounded shadow-sm border border-slate-300 mx-auto max-w-3xl print:border-none print:shadow-none print:p-2">
            {/* School Header */}
            <div className="text-center border-b-2 border-slate-800 pb-3 mb-4">
              <h2 className="text-xl font-bold text-slate-900 tracking-wide uppercase">
                {settings.schoolName}
              </h2>
              <h3 className="text-sm font-semibold text-slate-700 mt-0.5">
                {settings.academicYear} Хичээлийн жилийн хуваарь
              </h3>
              <div className="mt-1 font-bold text-base text-blue-800">
                {printType === 'class' ? `${currentClass?.name || ''} Анги` : `${currentTeacher?.name || ''} Багш`}
              </div>
            </div>

            {/* Timetable Sheet Grid */}
            <div className="border-2 border-slate-800 rounded overflow-hidden">
              <table className="w-full text-center border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-200 border-b-2 border-slate-800">
                    <th className="p-2 border-r border-slate-400 font-bold w-12">Цаг</th>
                    <th className="p-2 border-r border-slate-400 font-bold w-24">Хугацаа</th>
                    {settings.dayNames.map((dName, dIdx) => (
                      <th key={dIdx} className="p-2 border-r border-slate-400 font-bold">
                        {dName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {Array.from({ length: settings.periodsPerDay }).map((_, p) => {
                    const bell = settings.bells[p];
                    return (
                      <React.Fragment key={p}>
                        <tr className="h-14">
                          <td className="p-1 border-r border-slate-400 font-bold bg-slate-50">
                            {p + 1}
                          </td>
                          <td className="p-1 border-r border-slate-400 font-mono text-[11px] bg-slate-50">
                            {bell ? `${bell.startTime} - ${bell.endTime}` : ''}
                          </td>
                          {settings.dayNames.map((_, d) => {
                            const card = scheduledCards.find((c) => {
                              if (printType === 'class') {
                                return c.classId === targetId && c.dayIndex === d && c.periodIndex === p;
                              } else {
                                return c.teacherId === targetId && c.dayIndex === d && c.periodIndex === p;
                              }
                            });

                            if (!card) {
                              return <td key={d} className="p-1 border-r border-slate-300 bg-slate-50/20" />;
                            }

                            const sub = subMap.get(card.subjectId);
                            const teacher = teachMap.get(card.teacherId);
                            const cls = classes.find((c) => c.id === card.classId);
                            const room = card.classroomId ? roomMap.get(card.classroomId) : undefined;

                            return (
                              <td key={d} className="p-1 border-r border-slate-300 align-middle">
                                <div className="p-1 rounded border border-slate-300 bg-blue-50/80 leading-tight">
                                  <div className="font-bold text-slate-900 truncate">
                                    {sub?.name || 'Хичээл'}
                                  </div>
                                  <div className="text-[10px] text-slate-600 truncate mt-0.5">
                                    {printType === 'class' ? teacher?.name : cls?.name}
                                    {room && ` (${room.shortName})`}
                                  </div>
                                </div>
                              </td>
                            );
                          })}
                        </tr>

                        {bell?.isLunchBreakAfter && (
                          <tr className="bg-amber-100 border-y border-amber-300 text-amber-900 font-semibold text-[10px]">
                            <td colSpan={2 + settings.daysPerWeek} className="py-1">
                              🍽️ ИХ ЗАВСАРЛАГА / ХООЛЛОХ ЦАГ ({bell.breakDurationMinutes} минут)
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Print Footer */}
            <div className="mt-6 flex justify-between text-[11px] text-slate-500 pt-4 border-t border-slate-200">
              <div>Хэвлэсэн огноо: {new Date().toLocaleDateString('mn-MN')}</div>
              <div>Баталсан: Сургалтын менежер ....................</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
