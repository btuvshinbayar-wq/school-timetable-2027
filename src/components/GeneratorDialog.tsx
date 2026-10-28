import React, { useEffect, useRef, useState } from 'react';
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
import { defaultTimeLimitMs, generateTimetable, testTimetableFeasibility } from '../utils/generator';
import confetti from 'canvas-confetti';
import { Siren, Play, CheckCircle2, AlertTriangle, XCircle, Zap, ShieldCheck, Square } from 'lucide-react';

type Mode = 'quick' | 'normal' | 'thorough';
const MODE_LABEL: Record<Mode, string> = {
  quick: 'Хурдан (~15 сек)',
  normal: 'Энгийн',
  thorough: 'Нарийн (3 мин)',
};

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
  const [mode, setMode] = useState<Mode>('normal');
  const [elapsed, setElapsed] = useState(0);
  const workerRef = useRef<Worker | null>(null);
  const stopRef = useRef(false);

  useEffect(() => {
    if (!isRunning) return;
    const t0 = Date.now();
    const id = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(id);
  }, [isRunning]);

  useEffect(() => () => workerRef.current?.terminate(), []);

  if (!isOpen) return null;

  const cardCount = lessons.reduce((s, l) => s + (l.totalPeriods || 0), 0);
  const timeLimitMs =
    mode === 'quick' ? 15000 : mode === 'thorough' ? 180000 : defaultTimeLimitMs(cardCount);

  const handleTestOnly = () => {
    const check = testTimetableFeasibility(subjects, teachers, classes, classrooms, lessons, settings, relationships);
    setFeasibilityLog(check.messages);
  };

  const onFinished = (result: { scheduledCards: ScheduledCard[]; stats: GenerationStats; conflicts: ConflictIssue[] }) => {
    setGeneratedResult(result);
    setIsRunning(false);
    setProgress(100);
    setStatusMessage(
      stopRef.current
        ? 'Зогсоосон — одоог хүртэлх хамгийн сайн хуваарийг харуулж байна.'
        : 'Хичээлийн хуваарь амжилттай бодогдож дууслаа!'
    );
    if (result.stats.hardConflicts === 0 && result.stats.unplacedCards === 0) {
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
    }
  };

  const handleStop = () => {
    stopRef.current = true;
    setStatusMessage('Зогсоож байна...');
    workerRef.current?.postMessage({ type: 'stop' });
  };

  const handleStartGeneration = async () => {
    setIsRunning(true);
    setProgress(5);
    setStatusMessage('Хуваарилалтын бэлтгэл тооцоог хийж байна...');
    setGeneratedResult(null);

    // Feasibility test first
    const feas = testTimetableFeasibility(subjects, teachers, classes, classrooms, lessons, settings, relationships);
    if (!feas.passed) {
      setFeasibilityLog(feas.messages);
      setIsRunning(false);
      setProgress(0);
      setStatusMessage('Боломжийн шалгалтаар алдаа илэрлээ! Нийт цагуудыг хянана уу.');
      return;
    }

    setFeasibilityLog(null);
    stopRef.current = false;
    setElapsed(0);
    const payload = {
      subjects,
      teachers,
      classes,
      classrooms,
      lessons,
      relationships,
      settings,
      existingCards,
      timeLimitMs,
      seed: Math.floor(Math.random() * 1e9),
    };

    // Тусдаа урсгалд (Web Worker) бодно; дэмжихгүй орчинд үндсэн урсгалд
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL('../workers/generator.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      worker = null;
    }

    if (worker) {
      workerRef.current?.terminate();
      workerRef.current = worker;
      worker.onmessage = (e: MessageEvent) => {
        const m = e.data;
        if (m.type === 'progress') {
          setProgress(m.pct);
          setStatusMessage(m.message);
        } else if (m.type === 'done') {
          onFinished(m.result);
          worker!.terminate();
          workerRef.current = null;
        } else if (m.type === 'error') {
          setIsRunning(false);
          setStatusMessage(`Алдаа гарлаа: ${m.error}`);
          worker!.terminate();
          workerRef.current = null;
        }
      };
      worker.onerror = (err) => {
        setIsRunning(false);
        setStatusMessage(`Алдаа гарлаа: ${err.message}`);
      };
      worker.postMessage({ type: 'start', payload });
      return;
    }

    try {
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
        },
        { timeLimitMs, seed: payload.seed, shouldStop: () => stopRef.current }
      );
      onFinished(result);
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
        <div className="dialog-titlebar text-white px-4 py-2.5 flex items-center justify-between select-none shadow-sm">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-white/20 rounded-full animate-pulse">
              <Siren className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-sm">Хуваарь бодох</span>
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
            <div className="w-14 h-14 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
              <Siren className={`w-8 h-8 text-blue-700 ${isRunning ? 'animate-bounce' : ''}`} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-800 text-sm">Түгжсэн хичээлээс бусдыг шинээр байршуулна</h3>
              <p className="text-slate-600 mt-0.5 text-xs">
                Багш, анги, танхимын давхардал, чөлөөт цаг болон 'Хатуу' дүрмийг заавал хангаж, 'Өндөр', 'Энгийн'
                дүрэм, цонхыг аль болох багасгана. Хэдийд ч зогсоож, тэр хүртэлх хамгийн сайн хуваарийг авч болно.
              </p>
              <div className="mt-2 text-indigo-700 font-semibold">{statusMessage}</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="bg-white p-4 rounded-lg border border-slate-300 shadow-xs space-y-2">
            <div className="flex justify-between font-semibold text-slate-700">
              <span>Бодолтын явц:</span>
              <span className="font-mono">
                {isRunning ? `${elapsed} / ${Math.round(timeLimitMs / 1000)} сек · ` : ''}
                {progress}%
              </span>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-slate-600 font-semibold">Бодох хугацаа:</span>
              {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={isRunning}
                  onClick={() => setMode(m)}
                  className={`px-2 py-0.5 rounded border text-[11px] font-semibold disabled:opacity-60 ${
                    mode === m ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {m === 'normal' ? `${MODE_LABEL[m]} (~${Math.round(defaultTimeLimitMs(cardCount) / 1000)} сек)` : MODE_LABEL[m]}
                </button>
              ))}
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3.5 overflow-hidden p-0.5 border border-slate-300">
              <div
                className="bg-blue-700 h-full rounded-full transition-all duration-300"
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
                  <div className="text-slate-500 text-[10px]">Хатуу зөрчил</div>
                  <div className={`font-bold text-base ${generatedResult.stats.hardConflicts === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {generatedResult.stats.hardConflicts}
                  </div>
                </div>

                <div className="bg-slate-50 p-2 rounded border border-slate-200">
                  <div className="text-slate-500 text-[10px]">Зөөлөн дүрмийн сануулга</div>
                  <div className="font-bold text-base text-amber-600">
                    {generatedResult.stats.softConflicts}
                  </div>
                </div>

                <div className="bg-slate-50 p-2 rounded border border-slate-200">
                  <div className="text-slate-500 text-[10px]">Зарцуулсан хугацаа</div>
                  <div className="font-bold text-slate-800 text-base font-mono">
                    {(generatedResult.stats.generationTimeMs / 1000).toFixed(1)} сек
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
              Ачаалал шалгах
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isRunning && (
              <button
                type="button"
                onClick={handleStop}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-white border border-slate-400 hover:bg-slate-100 text-slate-800 rounded font-bold shadow-sm text-xs"
                title="Одоог хүртэлх хамгийн сайн хуваарийг авна"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Зогсоох</span>
              </button>
            )}
            {!generatedResult ? (
              <button
                type="button"
                disabled={isRunning}
                onClick={handleStartGeneration}
                className="flex items-center gap-1.5 px-5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded font-bold shadow-sm transition disabled:opacity-50 text-xs"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{isRunning ? 'Бодож байна...' : 'Хуваарь бодох'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleApply}
                className="flex items-center gap-1.5 px-6 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold shadow-sm transition text-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Хуваарийг хэрэглэх</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
