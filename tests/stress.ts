/**
 * Стресс хэмжилт: 120 бүлэг, 3 ээлж, 3 байр.
 * Ажиллуулах: npm run stress   (STRESS_SECONDS=60 гэж хугацаа өгч болно)
 */
import { generateTimetable, testTimetableFeasibility } from '../src/utils/generator';
import { buildStressSchool } from './stressSchool';
import { auditHardConstraints, auditQuality } from './audit';

async function main() {
  const school = buildStressSchool();
  const { settings, subjects, teachers, classes, rooms, lessons, relationships } = school;
  const total = lessons.reduce((s, l) => s + l.totalPeriods, 0);
  console.log(
    `Сургууль: ${classes.length} бүлэг, ${teachers.length} багш, ${rooms.length} тусгай танхим, ${lessons.length} хичээлийн гэрээ, ${total} цаг`
  );
  const feas = testTimetableFeasibility(subjects, teachers, classes, rooms, lessons, settings, relationships);
  console.log(`Ачааллын шалгалт: ${feas.passed ? 'давсан' : 'УНАСАН'}${feas.passed ? '' : '\n  ' + feas.messages.slice(0, 12).join('\n  ')}`);

  const seconds = Number(process.env.STRESS_SECONDS || 60);
  const t0 = Date.now();
  let lastLog = 0;
  const r = await generateTimetable(subjects, teachers, classes, rooms, lessons, relationships, settings, [], (pct, msg) => {
    if (Date.now() - lastLog > 5000) {
      lastLog = Date.now();
      console.log(`  ${pct}% ${msg}`);
    }
  }, { timeLimitMs: seconds * 1000, seed: 1 } as any);
  const ms = Date.now() - t0;

  const audit = auditHardConstraints(r.scheduledCards, lessons, classes, teachers, rooms, settings);
  const quality = auditQuality(r.scheduledCards, lessons, classes, teachers, rooms, settings);
  const errs = r.conflicts.filter((c) => c.severity === 'error');
  const byType = new Map<string, number>();
  for (const c of r.conflicts) byType.set(`${c.severity}:${c.type}`, (byType.get(`${c.severity}:${c.type}`) || 0) + 1);

  console.log(`\nХугацаа: ${(ms / 1000).toFixed(1)} сек`);
  console.log(`Байршсан: ${r.scheduledCards.length}/${total} (${((100 * r.scheduledCards.length) / total).toFixed(2)}%)`);
  console.log(`Бие даасан хатуу аудит: ${JSON.stringify(audit)}`);
  console.log(`Чанар: ${JSON.stringify(quality)}`);
  console.log(`Verify: ${errs.length} алдаа, ${r.conflicts.length - errs.length} анхааруулга`);
  console.log(`  ${Array.from(byType.entries()).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  for (const e of errs.slice(0, 8)) console.log(`  ! ${e.description}`);
}

main();
