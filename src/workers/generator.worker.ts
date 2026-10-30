/// <reference lib="webworker" />
/**
 * Хуваарь бодогчийг тусдаа урсгалд (Web Worker) ажиллуулна — том сургуульд дэлгэц гацахгүй.
 * Мессеж: { type: 'start', payload } | { type: 'stop' }  →  'progress' | 'done' | 'error'
 */
import { generateTimetable } from '../utils/generator';

let stopRequested = false;

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data;
  if (msg?.type === 'stop') {
    stopRequested = true;
    return;
  }
  if (msg?.type !== 'start') return;
  stopRequested = false;
  const p = msg.payload;
  try {
    const result = await generateTimetable(
      p.subjects,
      p.teachers,
      p.classes,
      p.classrooms,
      p.lessons,
      p.relationships,
      p.settings,
      p.existingCards,
      (pct, message) => (self as unknown as Worker).postMessage({ type: 'progress', pct, message }),
      { timeLimitMs: p.timeLimitMs, seed: p.seed, shouldStop: () => stopRequested }
    );
    (self as unknown as Worker).postMessage({ type: 'done', result });
  } catch (err: any) {
    (self as unknown as Worker).postMessage({ type: 'error', error: String(err?.message || err) });
  }
};
