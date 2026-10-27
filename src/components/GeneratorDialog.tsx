import React, { useState } from 'react';
import {
  Subject,
  Teacher,
  ClassGroup,
  Classroom,
  LessonContract,
  ScheduledCard,
  CardRelationship,
  SchoolSettings,
  GenerationStats,
  ConflictIssue,
} from '../types/timetable';
import { generateTimetable, testTimetableFeasibility } from '../utils/generator';
import confetti from 'canvas-confetti';
import { Siren, Play, CheckCircle2, AlertTriangle, XCircle, Zap, ShieldCheck } from 'lucide-react';

interface GeneratorDialogProps {
  subjects: Subject[];
  teachers: Teacher[];
  classes: ClassGroup[];
  classrooms: Classroom[];
  lessons: LessonContract[];
  relationships: CardRelationship[];
  settings: SchoolSettings;
  existingCards: ScheduledCard[];
  isOpen: boolean;
  onClose: () => void;
  onApplyTimetable: (cards: ScheduledCard[], stats: GenerationStats, conflicts: ConflictIssue[]) => void;
}

export const GeneratorDialog: React.FC<GeneratorDialogProps> = ({
  subjects,
  teachers,
  classes,
  classrooms,
  lessons,
  relationships,
  settings,
  existingCards,
  isOpen,
  onClose,
  onApplyTimetable,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Хуваарь бодоход бэлэн байна.');
  const [generatedResult, setGeneratedResult] = useState<{
    scheduledCards: ScheduledCard[];
    stats: GenerationStats;
    conflicts: ConflictIssue[];
  } | null>(null);

  const [feasibilityLog, setFeasibilityLog] = useState<string[] | null>(null);

  if (!isOpen) return null;

  const handleTestOnly = () => {
    const check = testTimetableFeasibility(subjects, teachers, classes, classrooms, lessons, settings);
    setFeasibilityLog(check.messages);
  };

  const handleStartGeneration = async () => {
    setIsRunning(true);
    setProgress(5);
    setStatusMessage('Хуваарилалтын бэлтгэл тооцоог хийж байна...');
    setGeneratedResult(null);

    // Feasibility test first
    const feas = testTimetableFeasibility(subjects, teachers, classes, classrooms, lessons, settings);
    if (!feas.passed) {
      setFeasibilityLog(feas.messages);
      setIsRunning(false);
      setProgress(0);
      setStatusMessage('Боломжийн шалгалтаар алдаа илэрлээ! Нийт цагуудыг хянана уу.');
      return;
    }

    try {
      // Small timeout to allow UI to breathe
      setTimeout(async () => {
        const result = await generateTimetable(
          subjects,
          teachers,
          classes,
          classrooms,
          lessons,
          relationships,
          settings,
          existingCards,
          (pct, msg) => {
            setProgress(pct);
            setStatusMessage(msg);
          }
        );

        setGeneratedResult(result);
        setIsRunning(false);
        setProgress(100);
        setStatusMessage('Хичээлийн хуваарь амжилттай бодогдож дууслаа!');

        if (result.stats.hardConflicts === 0) {
          confetti({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.6 },
          });
        }
      }, 100);
    } catch (err: any) {
      setIsRunning(false);
      setStatusMessage(`Алдаа гарлаа: ${err?.message || err}`);
    }
  };

  const handleApply = () => {
    if (generatedResult) {
      onApplyTimetable(
        generatedResult.scheduledCards,
        generatedResult.stats,
        generatedResult.conflicts
      );
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-slate-50 rounded-lg shadow-2xl border border-slate-300 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Title bar - aSc Siren style */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white px-4 py-2.5 flex items-center justify-between select-none shadow-sm">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-white/20 rounded-full animate-pulse">
              <Siren className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-sm">Хичээлийн хуваарь бодох (Generate Timetable)</span>
          </div>
          <button
            onClick={onClose}
            disabled={isRunning}
            className="text-white/80 hover:text-white hover:bg-red-800 rounded px-2 py-0.5 text-xs font-bold disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {/* Status Banner */}
          <div className="bg-white p-4 rounded-lg border border-slate-300 shadow-xs flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-red-100 border border-red-200 flex items-center justify-center shrink-0">
              <Siren className={`w-8 h-8 text-red-600 ${isRunning ? 'animate-bounce' : ''}`} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-800 text-sm">School Timetable Бодолтын Хөдөлгүүр</h3>
              <p className="text-slate-600 mt-0.5 text-xs">
                Бүх багш, анги танхим, хичээлийн төлөвлөгөө болон хамаарлын дүрмүүдийг шалгаж автоматаар
                зөрчилгүй хуваарь зохионо.
              </p>
              <div className="mt-2 text-indigo-700 font-semibold">{statusMessage}</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="bg-white p-4 rounded-lg border border-slate-300 shadow-xs space-y-2">
            <div className="flex justify-between font-semibold text-slate-700">
              <span>Бодолтын явц:</span>
              <span className="font-mono">{progress}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3.5 overflow-hidden p-0.5 border border-slate-300">
              <div
                className="bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Test log if triggered */}
          {feasibilityLog && (
            <div className="bg-white p-3 rounded-lg border border-slate-300 shadow-xs space-y-1.5 max-h-40 overflow-y-auto">
              <div className="font-bold text-slate-700 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>Хүчин чадлын шалгалтын дүн:</span>
              </div>
              {feasibilityLog.map((msg, i) => (
                <div key={i} className="text-[11px] leading-tight text-slate-700">
                  {msg}
                </div>
              ))}
            </div>
          )}

          {/* Generation Stats Results */}
          {generatedResult && (
            <div className="bg-white p-4 rounded-lg border border-slate-300 shadow-xs space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-800 text-sm">Бодолтын Үр Дүн:</span>
                <span className="px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 text-xs">
                  Үнэлгээ: {generatedResult.stats.fitnessScore}%
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
                <div className="bg-slate-50 p-2 rounded border border-slate-200">
                  <div className="text-slate-500 text-[10px]">Байршуулсан цаг</div>
                  <div className="font-bold text-slate-800 text-base">
                    {generatedResult.stats.placedCards} / {generatedResult.stats.totalCards}
                  </div>
                </div>

                <div className="bg-slate-50 p-2 rounded border border-slate-200">
                  <div className="text-slate-500 text-[10px]">Багш, ангийн давхардал</div>
                  <div className="font-bold text-base text-emerald-600">
                    {generatedResult.stats.hardConflicts}
                  </div>
                </div>

                <div className="bg-slate-50 p-2 rounded border border-slate-200">
                  <div className="text-slate-500 text-[10px]">Цонх цагийн сануулга</div>
                  <div className="font-bold text-base text-amber-600">
                    {generatedResult.stats.softConflicts}
                  </div>
                </div>

                <div className="bg-slate-50 p-2 rounded border border-slate-200">
                  <div className="text-slate-500 text-[10px]">Зарцуулсан хугацаа</div>
                  <div className="font-bold text-slate-800 text-base font-mono">
                    {generatedResult.stats.generationTimeMs} ms
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="bg-slate-200/90 px-5 py-3 border-t border-slate-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isRunning}
              onClick={handleTestOnly}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-700 hover:bg-slate-100 shadow-xs disabled:opacity-50"
            >
              ✓ Хүчин чадал тестлэх (Test)
            </button>
          </div>

          <div className="flex items-center gap-2">
            {!generatedResult ? (
              <button
                type="button"
                disabled={isRunning}
                onClick={handleStartGeneration}
                className="flex items-center gap-1.5 px-5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded font-bold shadow-sm transition disabled:opacity-50 text-xs"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{isRunning ? 'Бодож байна...' : 'Хуваарь бодох (Generate)'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleApply}
                className="flex items-center gap-1.5 px-6 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold shadow-sm transition text-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Хуваарийг батлах & Байршуулах</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
