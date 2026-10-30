import React, { useMemo, useState } from 'react';
import {
  AbsenceReason,
  ClassGroup,
  Classroom,
  LessonContract,
  ScheduledCard,
  SchoolSettings,
  Subject,
  SubstitutionAction,
  SubstitutionDay,
  Teacher,
  TeacherAbsence,
  WeekCycle,
} from '../types/timetable';
import {
  actionFromOption,
  affectedCards,
  applyActions,
  autoPlan,
  baseDayCards,
  dayIndexOfDate,
  EffectiveCard,
  isActionStale,
  KIND_LABEL,
  nextSchoolDay,
  optionsForCard,
  REASON_LABEL,
  SubContext,
  SubOption,
  substitutionReport,
  todayISO,
  validatePlan,
  weekCycleOfDate,
} from '../utils/substitution';
import { teachersOf } from '../utils/constraints';
import { exportSubstitutionReport } from '../utils/excelIO';
import { UserX, Wand2, Printer, Copy, Trash2, Plus, X, FileSpreadsheet, ClipboardList, CalendarDays } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: SchoolSettings;
  subjects: Subject[];
  teachers: Teacher[];
  classes: ClassGroup[];
  classrooms: Classroom[];
  lessons: LessonContract[];
  scheduledCards: ScheduledCard[];
  substitutions: SubstitutionDay[];
  onChange: (days: SubstitutionDay[]) => void;
  onNotify?: (message: string) => void;
}

const KIND_TONE: Record<string, string> = {
  substitute: 'bg-blue-50 text-blue-800 border-blue-200',
  drop_coteacher: 'bg-blue-50 text-blue-800 border-blue-200',
  merge_subgroups: 'bg-purple-50 text-purple-800 border-purple-200',
  merge_classes: 'bg-purple-50 text-purple-800 border-purple-200',
  swap: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  move: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  pull: 'bg-amber-50 text-amber-800 border-amber-200',
  cancel: 'bg-rose-50 text-rose-800 border-rose-200',
};

const optKey = (o: { kind: string; teacherId?: string; hostCardId?: string; otherCardId?: string; toPeriod?: number }) =>
  `${o.kind}|${o.teacherId || ''}|${o.hostCardId || ''}|${o.otherCardId || ''}|${o.toPeriod ?? ''}`;

const monthStart = (d: string) => `${d.slice(0, 8)}01`;

export const SubstitutionDialog: React.FC<Props> = ({
  isOpen,
  onClose,
  settings,
  subjects,
  teachers,
  classes,
  classrooms,
  lessons,
  scheduledCards,
  substitutions,
  onChange,
  onNotify,
}) => {
  const [date, setDate] = useState(() => nextSchoolDay(todayISO(), settings.daysPerWeek));
  const [tab, setTab] = useState<'day' | 'report'>('day');
  const [teacherQuery, setTeacherQuery] = useState('');
  const [newTeacherId, setNewTeacherId] = useState('');
  const [newReason, setNewReason] = useState<AbsenceReason>('sick');
  const [newAllDay, setNewAllDay] = useState(true);
  const [newSlots, setNewSlots] = useState<string[]>([]);
  const [reportFrom, setReportFrom] = useState(() => monthStart(todayISO()));
  const [reportTo, setReportTo] = useState(() => todayISO());

  const ctx: SubContext = useMemo(
    () => ({ settings, subjects, teachers, classes, classrooms, lessons, cards: scheduledCards, history: substitutions }),
    [settings, subjects, teachers, classes, classrooms, lessons, scheduledCards, substitutions]
  );
  const teacherMap = useMemo(() => new Map(teachers.map((t) => [t.id, t])), [teachers]);
  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const tName = (id?: string) => (id && teacherMap.get(id)?.name) || '—';
  const cName = (id: string) => classMap.get(id)?.name || '—';
  const sName = (id: string) => subjectMap.get(id)?.name || '—';
  const shiftConf = (sh: number) => settings.shifts.find((s) => s.shiftNumber === sh) || settings.shifts[0];
  const timeOf = (sh: number, p: number) => {
    const b = shiftConf(sh)?.bells?.[p];
    return b ? `${b.startTime}` : '';
  };
  const slotLabel = (sh: number, p: number) => `${settings.shiftsCount > 1 ? `${sh}-р ээлж, ` : ''}${p + 1}-р цаг`;

  const dayIndex = dayIndexOfDate(date, settings.daysPerWeek);
  const existing = substitutions.find((d) => d.date === date);
  const day: SubstitutionDay | null =
    dayIndex === null
      ? null
      : existing || {
          date,
          dayIndex,
          weekCycle: weekCycleOfDate(date, settings),
          absences: [],
          actions: [],
          updatedAt: '',
        };

  const saveDay = (next: SubstitutionDay) => {
    const rest = substitutions.filter((d) => d.date !== next.date);
    const stamped = { ...next, updatedAt: new Date().toISOString() };
    onChange(stamped.absences.length === 0 ? rest : [...rest, stamped].sort((a, b) => a.date.localeCompare(b.date)));
  };

  // ---------- Тухайн өдрийн тооцоо ----------
  const computed = useMemo(() => {
    if (!day) return null;
    const dayCards = baseDayCards(ctx, day.dayIndex, day.weekCycle);
    const affected = affectedCards(dayCards, day.absences);
    const options = new Map<string, SubOption[]>();
    for (const c of affected) options.set(c.id, optionsForCard(ctx, day, dayCards, day.actions, c.id));
    const validation = validatePlan(ctx, day);
    return { dayCards, affected, options, validation };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day && JSON.stringify([day.date, day.dayIndex, day.weekCycle, day.absences, day.actions]), ctx]);

  if (!isOpen) return null;

  // ---------- Үйлдлүүд ----------
  const addAbsence = () => {
    if (!day || !newTeacherId) return;
    if (!newAllDay && newSlots.length === 0) {
      onNotify?.('Чөлөөтэй цагаа сонгоно уу');
      return;
    }
    const absence: TeacherAbsence = {
      id: `abs_${Date.now().toString(36)}`,
      teacherId: newTeacherId,
      reason: newReason,
      allDay: newAllDay,
      slots: newAllDay ? undefined : [...newSlots],
    };
    const withAbsence = { ...day, absences: [...day.absences.filter((a) => a.teacherId !== newTeacherId), absence] };
    // Шинэ багш нэмэгдэхэд автоматаар зохицуулна (менежерийн сонголт хадгалагдана)
    saveDay({ ...withAbsence, actions: autoPlan(ctx, withAbsence) });
    setNewTeacherId('');
    setTeacherQuery('');
    setNewSlots([]);
    setNewAllDay(true);
  };

  const removeAbsence = (id: string) => {
    if (!day) return;
    const next = { ...day, absences: day.absences.filter((a) => a.id !== id) };
    saveDay({ ...next, actions: next.absences.length ? autoPlan(ctx, { ...next, actions: next.actions.filter((a) => a.manual) }) : [] });
  };

  const runAuto = () => {
    if (!day) return;
    saveDay({ ...day, actions: autoPlan(ctx, day) });
    onNotify?.('Автоматаар зохицууллаа. Гараар сонгосон шийдлүүд хадгалагдсан.');
  };

  const resetAll = () => {
    if (!day) return;
    saveDay({ ...day, actions: autoPlan(ctx, { ...day, actions: [] }) });
  };

  const chooseOption = (card: ScheduledCard, key: string) => {
    if (!day || !computed) return;
    const rest = day.actions.filter((a) => a.cardId !== card.id);
    if (key === '') {
      saveDay({ ...day, actions: rest });
      return;
    }
    const opt = computed.options.get(card.id)?.find((o) => optKey(o) === key);
    if (!opt) return;
    saveDay({ ...day, actions: [...rest, actionFromOption(card, opt, true)] });
  };

  const setWeek = (w: WeekCycle) => {
    if (!day) return;
    const next = { ...day, weekCycle: w };
    saveDay({ ...next, actions: autoPlan(ctx, { ...next, actions: [] }) });
  };

  // ---------- Тайлбар текст ----------
  const actionText = (a: SubstitutionAction, card: ScheduledCard): { action: string; by: string } => {
    const other = a.otherCardId ? computed?.dayCards.find((c) => c.id === a.otherCardId) : undefined;
    const host = a.hostCardId ? computed?.dayCards.find((c) => c.id === a.hostCardId) : undefined;
    switch (a.kind) {
      case 'substitute':
        return { action: `${tName(a.teacherId)} орлон заана`, by: tName(a.teacherId) };
      case 'drop_coteacher':
        return { action: `${tName(card.teacherId)} дангаараа орно`, by: tName(card.teacherId) };
      case 'merge_subgroups':
        return { action: `${host?.subgroupName || 'Нөгөө бүлэг'}-тэй нийлж ${tName(host?.teacherId)} заана`, by: tName(host?.teacherId) };
      case 'merge_classes':
        return { action: `${cName(host?.classId || '')}-тай нийлж ${tName(host?.teacherId)} заана`, by: tName(host?.teacherId) };
      case 'swap':
        return { action: `${sName(other?.subjectId || '')}-тэй солиж ${(a.toPeriod ?? 0) + 1}-р цагт ${tName(card.teacherId)} заана`, by: tName(card.teacherId) };
      case 'move':
        return { action: `${(a.toPeriod ?? 0) + 1}-р цаг руу шилжинэ`, by: tName(card.teacherId) };
      case 'pull':
        return { action: `${sName(other?.subjectId || '')} (${(other?.periodIndex ?? 0) + 1}-р цаг) энэ цаг руу; анги эрт тарна/хожуу ирнэ`, by: tName(other?.teacherId) };
      default:
        return { action: 'Хичээл орохгүй', by: '' };
    }
  };

  const printDay = () => {
    if (!day || !computed) return;
    const rows = computed.affected
      .map((c) => {
        const a = day.actions.find((x) => x.cardId === c.id);
        const t = a ? actionText(a, c) : { action: 'ШИЙДЭГДЭЭГҮЙ', by: '' };
        return `<tr><td>${slotLabel(c.shift, c.periodIndex)}<br><small>${timeOf(c.shift, c.periodIndex)}</small></td><td>${cName(c.classId)}${
          c.subgroupName ? `<br><small>${c.subgroupName}</small>` : ''
        }</td><td>${sName(c.subjectId)}</td><td>${tName(c.teacherId)}</td><td>${t.action}</td><td><b>${t.by}</b></td></tr>`;
      })
      .join('');
    const absent = day.absences.map((a) => `${tName(a.teacherId)} (${REASON_LABEL[a.reason]}${a.allDay ? '' : ', хэсэгчлэн'})`).join(', ');
    const w = window.open('', '_blank');
    if (!w) {
      onNotify?.('Хэвлэх цонх нээгдсэнгүй — хөтчийн pop-up хориглолтыг шалгана уу');
      return;
    }
    w.document.write(`<!doctype html><html lang="mn"><head><meta charset="utf-8"><title>Орлон заалт ${day.date}</title>
<style>body{font-family:"Golos Text",system-ui,sans-serif;color:#2e2b26;margin:24px}h1{font-size:18px;margin:0 0 4px}p{margin:0 0 14px;color:#686155;font-size:13px}
table{border-collapse:collapse;width:100%;font-size:12.5px}th,td{border:1px solid #d6d1c6;padding:6px 8px;text-align:left;vertical-align:top}th{background:#f3f1ec}small{color:#857d70}
.sign{margin-top:28px;font-size:12.5px;color:#514b42}</style></head><body>
<h1>${settings.schoolName} — орлон заалт</h1>
<p>${day.date}, ${settings.dayNames[day.dayIndex]}${day.weekCycle ? ` · ${day.weekCycle === 'week_a' ? 'А' : 'Б'} 7 хоног` : ''}<br>Чөлөөтэй: ${absent}</p>
<table><thead><tr><th>Цаг</th><th>Анги</th><th>Хичээл</th><th>Чөлөөтэй багш</th><th>Шийдэл</th><th>Заах багш</th></tr></thead><tbody>${rows}</tbody></table>
<div class="sign">Сургалтын менежер: ____________________</div>
<script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  };

  const copyNotice = async () => {
    if (!day || !computed) return;
    const byTeacher = new Map<string, string[]>();
    for (const c of computed.affected) {
      const a = day.actions.find((x) => x.cardId === c.id);
      if (!a) continue;
      const t = actionText(a, c);
      if (!t.by) continue;
      const line = `• ${slotLabel(c.shift, a.kind === 'swap' || a.kind === 'move' ? a.toPeriod ?? c.periodIndex : c.periodIndex)} — ${cName(c.classId)}${
        c.subgroupName ? ` (${c.subgroupName})` : ''
      }, ${sName(c.subjectId)}: ${t.action}`;
      if (!byTeacher.has(t.by)) byTeacher.set(t.by, []);
      byTeacher.get(t.by)!.push(line);
    }
    const text = [
      `${day.date} (${settings.dayNames[day.dayIndex]}) орлон заалт`,
      '',
      ...Array.from(byTeacher.entries()).flatMap(([name, lines]) => [`${name}:`, ...lines, '']),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      onNotify?.('Багш нарт илгээх мэдэгдлийг хуулсан');
    } catch {
      onNotify?.('Хуулах боломжгүй байна');
    }
  };

  // ---------- Тайлан ----------
  const report = substitutionReport(substitutions, reportFrom, reportTo);
  const exportReport = () => {
    const detail: Parameters<typeof exportSubstitutionReport>[1] = [];
    for (const d of substitutions) {
      if (d.date < reportFrom || d.date > reportTo) continue;
      for (const a of d.actions) {
        const s = a.snapshot;
        const fake = { ...s, id: a.cardId } as unknown as ScheduledCard;
        const t =
          a.kind === 'substitute'
            ? { action: `${tName(a.teacherId)} орлон заасан`, by: tName(a.teacherId) }
            : a.kind === 'merge_subgroups' || a.kind === 'merge_classes'
              ? { action: KIND_LABEL[a.kind], by: tName(a.hostTeacherId) }
              : a.kind === 'swap' || a.kind === 'move'
                ? { action: `${KIND_LABEL[a.kind]} → ${(a.toPeriod ?? 0) + 1}-р цаг`, by: tName(s.teacherId) }
                : { action: KIND_LABEL[a.kind], by: '' };
        void fake;
        detail.push({
          date: d.date,
          time: slotLabel(s.shift, s.periodIndex),
          className: cName(s.classId) + (s.subgroupName ? ` (${s.subgroupName})` : ''),
          subject: sName(s.subjectId),
          absentTeacher: tName(s.teacherId),
          action: t.action,
          byTeacher: t.by,
        });
      }
    }
    exportSubstitutionReport(
      report.rows
        .map((r) => ({ ...r, name: tName(r.teacherId) }))
        .sort((a, b) => b.substitutedPeriods - a.substitutedPeriods || a.name.localeCompare(b.name)),
      detail,
      reportFrom,
      reportTo,
      settings.schoolName
    );
  };

  // ---------- Чөлөөтэй багш нэмэх: тухайн багшийн өдрийн цагууд ----------
  const teacherDaySlots =
    day && newTeacherId
      ? baseDayCards(ctx, day.dayIndex, day.weekCycle)
          .filter((c) => teachersOf(c).includes(newTeacherId))
          .sort((a, b) => a.shift - b.shift || a.periodIndex - b.periodIndex)
      : [];
  const q = teacherQuery.trim().toLowerCase();
  const teacherMatches = q
    ? teachers.filter((t) => t.name.toLowerCase().includes(q) || t.shortName?.toLowerCase().includes(q)).slice(0, 8)
    : [];

  // ---------- Харагдац ----------
  const stats = (() => {
    if (!day || !computed) return null;
    const by: Record<string, number> = {};
    for (const a of day.actions) by[a.kind] = (by[a.kind] || 0) + 1;
    return by;
  })();

  const changedClasses = (() => {
    if (!day || !computed) return [] as string[];
    const ids = new Set<string>();
    for (const c of computed.affected) ids.add(c.classId);
    for (const a of day.actions) {
      for (const id of [a.hostCardId, a.otherCardId]) {
        const c = id && computed.dayCards.find((x) => x.id === id);
        if (c) ids.add(c.classId);
      }
    }
    return Array.from(ids).sort((a, b) => (classMap.get(a)?.shift || 1) - (classMap.get(b)?.shift || 1) || cName(a).localeCompare(cName(b), 'mn'));
  })();

  const dayView = (cards: EffectiveCard[], classId: string, p: number) =>
    cards.filter((c) => c.periodIndex === p && (c.classId === classId || c.jointClassIds?.includes(classId)));

  const staleCount = day && computed ? day.actions.filter((a) => isActionStale(a, computed.dayCards, day.absences)).length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3" onClick={onClose}>
      <div
        className="bg-slate-50 rounded-xl shadow-2xl border border-slate-300 w-full max-w-[1180px] h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-titlebar px-4 py-2.5 flex items-center justify-between select-none shrink-0">
          <div className="flex items-center gap-2">
            <UserX className="w-4 h-4 opacity-80" />
            <span className="font-semibold text-sm">Орлон заалт</span>
          </div>
          <div className="flex items-center gap-1 text-[12px]">
            <button
              onClick={() => setTab('day')}
              className={`px-3 py-1 rounded-md ${tab === 'day' ? 'bg-white/20 font-semibold' : 'hover:bg-white/10'}`}
            >
              Өдрийн зохицуулалт
            </button>
            <button
              onClick={() => setTab('report')}
              className={`px-3 py-1 rounded-md ${tab === 'report' ? 'bg-white/20 font-semibold' : 'hover:bg-white/10'}`}
            >
              Тайлан
            </button>
            <button onClick={onClose} className="ml-2 text-white/80 hover:text-white px-2 py-0.5 text-xs font-bold" aria-label="Хаах">
              ✕
            </button>
          </div>
        </div>

        {tab === 'report' ? (
          <div className="flex-1 overflow-auto p-4 text-[12.5px]">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-slate-600">Хугацаа</span>
              <input type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} className="px-2 py-1 border border-slate-300 rounded-md bg-white" />
              <span className="text-slate-500">–</span>
              <input type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)} className="px-2 py-1 border border-slate-300 rounded-md bg-white" />
              <span className="ml-3 text-slate-600">
                {report.total} хичээл зохицуулсан, {report.cancelled} нь ороогүй
              </span>
              <button
                onClick={exportReport}
                disabled={report.total === 0}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-700 text-white font-semibold disabled:opacity-40"
              >
                <FileSpreadsheet className="w-4 h-4" /> Excel татах
              </button>
            </div>
            {report.rows.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500">Энэ хугацаанд орлон заалт бүртгэгдээгүй байна.</div>
            ) : (
              <table className="w-full bg-white border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Багш</th>
                    <th className="text-right px-3 py-2 font-semibold">Чөлөөтэй цаг</th>
                    <th className="text-right px-3 py-2 font-semibold">Чөлөөтэй өдөр</th>
                    <th className="text-right px-3 py-2 font-semibold">Орлон заасан цаг</th>
                    <th className="text-right px-3 py-2 font-semibold">Нийлүүлж заасан</th>
                    <th className="text-right px-3 py-2 font-semibold">Өөрөө нөхсөн</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows
                    .map((r) => ({ ...r, name: tName(r.teacherId) }))
                    .sort((a, b) => b.substitutedPeriods - a.substitutedPeriods || b.absentPeriods - a.absentPeriods)
                    .map((r) => (
                      <tr key={r.teacherId} className="border-t border-slate-100">
                        <td className="px-3 py-1.5">{r.name}</td>
                        <td className="px-3 py-1.5 text-right">{r.absentPeriods || ''}</td>
                        <td className="px-3 py-1.5 text-right">{r.absentDays || ''}</td>
                        <td className="px-3 py-1.5 text-right font-semibold text-blue-800">{r.substitutedPeriods || ''}</td>
                        <td className="px-3 py-1.5 text-right">{r.mergedHosted || ''}</td>
                        <td className="px-3 py-1.5 text-right">{r.ownMoved || ''}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            {/* Зүүн: огноо ба чөлөөтэй багш нар */}
            <aside className="w-[300px] shrink-0 border-r border-slate-200 bg-white flex flex-col overflow-hidden">
              <div className="p-3 border-b border-slate-200 space-y-2">
                <label className="block text-[11.5px] text-slate-600">Огноо</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => e.target.value && setDate(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-[13px] bg-white"
                />
                <div className="text-[12px] text-slate-700">
                  {dayIndex === null ? (
                    <span className="text-rose-700">Хичээлгүй өдөр</span>
                  ) : (
                    <>
                      {settings.dayNames[dayIndex]}
                      {settings.enableWeekAB && day && (
                        <span className="ml-2 inline-flex rounded-md border border-slate-300 overflow-hidden align-middle">
                          {(['week_a', 'week_b'] as WeekCycle[]).map((w) => (
                            <button
                              key={w}
                              onClick={() => setWeek(w)}
                              className={`px-2 py-0.5 text-[11px] ${day.weekCycle === w ? 'bg-amber-200 text-amber-900 font-semibold' : 'hover:bg-slate-100'}`}
                              title="Энэ өдөр аль 7 хоногт хамаарах"
                            >
                              {w === 'week_a' ? 'А' : 'Б'} 7 хоног
                            </button>
                          ))}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>

              {day && (
                <div className="p-3 border-b border-slate-200 space-y-2 text-[12.5px]">
                  <div className="font-semibold text-slate-800">Чөлөөтэй багш нэмэх</div>
                  <div className="relative">
                    <input
                      value={newTeacherId ? tName(newTeacherId) : teacherQuery}
                      onChange={(e) => {
                        setNewTeacherId('');
                        setTeacherQuery(e.target.value);
                      }}
                      placeholder="Багшийн нэрээр хайх"
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-md bg-white"
                    />
                    {!newTeacherId && teacherMatches.length > 0 && (
                      <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-300 rounded-md shadow-lg max-h-56 overflow-y-auto">
                        {teacherMatches.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => {
                              setNewTeacherId(t.id);
                              setNewSlots([]);
                            }}
                            className="w-full text-left px-2 py-1.5 hover:bg-slate-100"
                          >
                            {t.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {newTeacherId && (
                    <>
                      <div className="flex gap-1 flex-wrap">
                        {(Object.keys(REASON_LABEL) as AbsenceReason[]).map((r) => (
                          <button
                            key={r}
                            onClick={() => setNewReason(r)}
                            className={`px-2 py-0.5 rounded-md border text-[11.5px] ${newReason === r ? 'bg-blue-700 text-white border-blue-700' : 'border-slate-300 hover:bg-slate-100'}`}
                          >
                            {REASON_LABEL[r]}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-3 text-[12px]">
                        <label className="flex items-center gap-1">
                          <input type="radio" checked={newAllDay} onChange={() => setNewAllDay(true)} /> Бүтэн өдөр
                        </label>
                        <label className="flex items-center gap-1">
                          <input type="radio" checked={!newAllDay} onChange={() => setNewAllDay(false)} /> Зарим цаг
                        </label>
                      </div>
                      {teacherDaySlots.length === 0 ? (
                        <div className="text-[11.5px] text-slate-500">Энэ өдөр хичээлгүй багш байна.</div>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {teacherDaySlots.map((c) => {
                            const k = `${c.shift}_${c.periodIndex}`;
                            const on = newAllDay || newSlots.includes(k);
                            return (
                              <button
                                key={c.id}
                                data-slot={k}
                                disabled={newAllDay}
                                onClick={() => setNewSlots((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))}
                                className={`px-1.5 py-0.5 rounded border text-[11px] ${
                                  on ? 'bg-rose-50 border-rose-300 text-rose-800' : 'border-slate-300 text-slate-600'
                                } disabled:cursor-default`}
                                title={`${sName(c.subjectId)} · ${cName(c.classId)}`}
                              >
                                {settings.shiftsCount > 1 ? `${c.shift}·` : ''}
                                {c.periodIndex + 1} {cName(c.classId)}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <button
                        onClick={addAbsence}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-700 text-white font-semibold"
                      >
                        <Plus className="w-4 h-4" /> Нэмж зохицуулах
                      </button>
                    </>
                  )}
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[12.5px]">
                {day && day.absences.length > 0 && (
                  <div>
                    <div className="font-semibold text-slate-800 mb-1.5">Чөлөөтэй ({day.absences.length})</div>
                    <div className="space-y-1">
                      {day.absences.map((a) => (
                        <div key={a.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-rose-50 border border-rose-200">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-900 truncate">{tName(a.teacherId)}</div>
                            <div className="text-[11px] text-rose-800">
                              {REASON_LABEL[a.reason]} · {a.allDay ? 'бүтэн өдөр' : a.slots!.map((s) => s.replace('_', '·').replace(/·(\d+)$/, (_, p) => `·${Number(p) + 1}`)).join(', ')}
                            </div>
                          </div>
                          <button onClick={() => removeAbsence(a.id)} className="p-1 rounded hover:bg-rose-100" aria-label="Хасах">
                            <X className="w-3.5 h-3.5 text-rose-700" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <div className="font-semibold text-slate-800 mb-1.5 flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5" /> Бүртгэлтэй өдрүүд
                  </div>
                  {substitutions.length === 0 ? (
                    <div className="text-slate-500 text-[11.5px]">Одоогоор бүртгэл алга.</div>
                  ) : (
                    <div className="space-y-0.5">
                      {[...substitutions]
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .slice(0, 30)
                        .map((d) => (
                          <button
                            key={d.date}
                            onClick={() => setDate(d.date)}
                            className={`w-full flex justify-between px-2 py-1 rounded-md text-left ${d.date === date ? 'bg-amber-100' : 'hover:bg-slate-100'}`}
                          >
                            <span>
                              {d.date} <span className="text-slate-500">{settings.dayNames[d.dayIndex]?.slice(0, 2)}</span>
                            </span>
                            <span className="text-slate-500">
                              {d.absences.length} багш · {d.actions.length} цаг
                            </span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </aside>

            {/* Баруун: нөлөөлөлд орсон хичээлүүд */}
            <main className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-200 bg-white flex flex-wrap items-center gap-2 text-[12.5px] shrink-0 [&_button]:whitespace-nowrap">
                {computed && day ? (
                  <span className="text-slate-700">
                    <b>{computed.affected.length}</b> хичээл зохицуулах
                    {stats && (
                      <span className="block text-[11.5px] text-slate-500">
                        {Object.entries(stats)
                          .map(([k, v]) => `${KIND_LABEL[k as keyof typeof KIND_LABEL]} ${v}`)
                          .join(', ')}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-slate-500">Хичээлийн өдөр сонгоно уу</span>
                )}
                <div className="ml-auto flex items-center gap-1.5">
                  <button
                    onClick={runAuto}
                    disabled={!day || day.absences.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-700 text-white font-semibold disabled:opacity-40"
                    title="Гараар сонгосныг хадгалж бусдыг дахин зохицуулна"
                  >
                    <Wand2 className="w-4 h-4" /> Автоматаар
                  </button>
                  <button
                    onClick={resetAll}
                    disabled={!day || day.actions.length === 0}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-300 bg-white disabled:opacity-40"
                    title="Гараар сонгосныг ч арилгаж бүгдийг шинээр зохицуулна"
                  >
                    <Trash2 className="w-4 h-4" /> Шинээр
                  </button>
                  <button
                    onClick={copyNotice}
                    disabled={!day || day.actions.length === 0}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-300 bg-white disabled:opacity-40"
                    title="Багш бүрт хамаарах зохицуулалтыг мессеж болгон хуулна"
                  >
                    <Copy className="w-4 h-4" /> Мэдэгдэл
                  </button>
                  <button
                    onClick={printDay}
                    disabled={!day || day.actions.length === 0}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-300 bg-white disabled:opacity-40"
                  >
                    <Printer className="w-4 h-4" /> Хэвлэх
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-3 space-y-3">
                {staleCount > 0 && (
                  <div className="px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-[12.5px]">
                    Суурь хуваарь өөрчлөгдсөн тул {staleCount} зохицуулалт хуучирсан байна. "Автоматаар зохицуулах"-ыг дарна уу.
                  </div>
                )}
                {computed && computed.validation.issues.length > 0 && staleCount === 0 && (
                  <div className="px-3 py-2 rounded-md bg-rose-50 border border-rose-200 text-rose-900 text-[12.5px]">
                    {computed.validation.issues.slice(0, 3).map((i, k) => (
                      <div key={k}>{i.message}</div>
                    ))}
                  </div>
                )}

                {!day || day.absences.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 gap-2 py-16">
                    <ClipboardList className="w-10 h-10 text-slate-400" />
                    <div className="text-[14px] text-slate-700 font-medium">Чөлөөтэй багшаа нэмнэ үү</div>
                    <div className="max-w-md text-[12.5px]">
                      Программ тухайн өдрийн хичээлүүдийг нь олж, орлон заах сул багш, дэд бүлэг нийлүүлэх, цаг солих, 2 анги нийлүүлэх
                      зэрэг шийдлийг санал болгоно. Санал болгосныг хүссэнээрээ сольж болно.
                    </div>
                  </div>
                ) : (
                  <>
                    <table className="w-full bg-white border border-slate-200 rounded-lg overflow-hidden text-[12.5px]">
                      <thead className="bg-slate-100 text-slate-700">
                        <tr>
                          <th className="text-left px-3 py-2 font-semibold w-[112px]">Цаг</th>
                          <th className="text-left px-3 py-2 font-semibold w-[96px]">Анги</th>
                          <th className="text-left px-3 py-2 font-semibold w-[150px]">Хичээл</th>
                          <th className="text-left px-3 py-2 font-semibold w-[120px]">Чөлөөтэй</th>
                          <th className="text-left px-3 py-2 font-semibold">Шийдэл</th>
                        </tr>
                      </thead>
                      <tbody>
                        {computed!.affected.map((c) => {
                          const a = day.actions.find((x) => x.cardId === c.id);
                          const opts = computed!.options.get(c.id) || [];
                          const current = a ? opts.find((o) => optKey(o) === optKey(a)) : undefined;
                          const stale = a && isActionStale(a, computed!.dayCards, day.absences);
                          const absentHere = teachersOf(c).filter((t) => day.absences.some((x) => x.teacherId === t));
                          return (
                            <tr key={c.id} className={`border-t border-slate-100 align-top ${!a ? 'bg-rose-50/40' : ''}`}>
                              <td className="px-3 py-2 whitespace-nowrap">
                                <div className="font-medium text-slate-900">{c.periodIndex + 1}-р цаг</div>
                                <div className="text-[11px] text-slate-500">
                                  {settings.shiftsCount > 1 ? `${c.shift}-р ээлж · ` : ''}
                                  {timeOf(c.shift, c.periodIndex)}
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <div className="font-medium">{cName(c.classId)}</div>
                                {c.subgroupName && <div className="text-[11px] text-slate-500">{c.subgroupName}</div>}
                                {c.jointClassIds?.length ? <div className="text-[11px] text-slate-500">+ {c.jointClassIds.map(cName).join(', ')}</div> : null}
                              </td>
                              <td className="px-3 py-2">
                                <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: subjectMap.get(c.subjectId)?.color }} />
                                {sName(c.subjectId)}
                                {c.linkedCardId && <div className="text-[11px] text-slate-500">хос цаг</div>}
                              </td>
                              <td className="px-3 py-2 text-slate-700">{absentHere.map(tName).join(', ')}</td>
                              <td className="px-3 py-1.5">
                                <div className="flex items-center gap-2">
                                  {a && (
                                    <span className={`shrink-0 px-1.5 py-0.5 rounded border text-[10.5px] font-medium ${KIND_TONE[a.kind]}`}>
                                      {KIND_LABEL[a.kind]}
                                    </span>
                                  )}
                                  <select
                                    value={a ? optKey(a) : ''}
                                    onChange={(e) => chooseOption(c, e.target.value)}
                                    className={`flex-1 min-w-0 px-2 py-1 border rounded-md bg-white ${!a ? 'border-rose-300 text-rose-800' : 'border-slate-300'}`}
                                  >
                                    {!a && <option value="">Шийдэл сонгох…</option>}
                                    {a && !current && <option value={optKey(a)}>{a.kind === 'substitute' ? `${tName(a.teacherId)} орлон заана` : KIND_LABEL[a.kind]} (одоогийн)</option>}
                                    {opts.map((o) => (
                                      <option key={optKey(o)} value={optKey(o)}>
                                        {o.label}
                                      </option>
                                    ))}
                                  </select>
                                  {a?.manual && <span className="text-[10.5px] text-slate-500 shrink-0" title="Гараар сонгосон">гараар</span>}
                                </div>
                                {(current || stale) && (
                                  <div className={`mt-1 text-[11px] ${stale ? 'text-amber-800' : 'text-slate-500'}`}>
                                    {stale ? 'Хуучирсан зохицуулалт' : current!.reasons.join(' · ')}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {changedClasses.length > 0 && (
                      <details className="bg-white border border-slate-200 rounded-lg" open={changedClasses.length <= 6}>
                        <summary className="px-3 py-2 cursor-pointer text-[12.5px] font-semibold text-slate-800">
                          Ангиудын өдрийн хуваарь: өмнө ба дараа ({changedClasses.length})
                        </summary>
                        <div className="p-3 pt-1 overflow-x-auto">
                          <table className="text-[11.5px] border-separate border-spacing-0">
                            <tbody>
                              {changedClasses.map((cid) => {
                                const sh = classMap.get(cid)?.shift || 1;
                                const per = shiftConf(sh)?.periodsCount || 6;
                                const before = computed!.dayCards as EffectiveCard[];
                                const after = computed!.validation.effective;
                                return (
                                  <React.Fragment key={cid}>
                                    {(['Өмнө', 'Дараа'] as const).map((label, li) => (
                                      <tr key={label}>
                                        {li === 0 && (
                                          <td rowSpan={2} className="pr-3 py-0.5 font-semibold text-slate-800 align-middle whitespace-nowrap border-b border-slate-200">
                                            {cName(cid)}
                                          </td>
                                        )}
                                        <td className={`pr-2 text-slate-500 ${li === 1 ? 'border-b border-slate-200 pb-1' : ''}`}>{label}</td>
                                        {Array.from({ length: per }, (_, p) => {
                                          const cards = dayView(li === 0 ? before : after, cid, p);
                                          const changed = li === 1 && cards.some((x) => x.subKind);
                                          const vanished = li === 1 && cards.length === 0 && dayView(before, cid, p).length > 0;
                                          return (
                                            <td key={p} className={`px-0.5 py-0.5 ${li === 1 ? 'border-b border-slate-200 pb-1' : ''}`}>
                                              <div
                                                className={`w-[86px] h-[34px] rounded border px-1 flex flex-col justify-center leading-tight ${
                                                  vanished
                                                    ? 'border-dashed border-rose-300 bg-rose-50 text-rose-700'
                                                    : changed
                                                      ? 'border-blue-300 bg-blue-50'
                                                      : cards.length
                                                        ? 'border-slate-200 bg-slate-50'
                                                        : 'border-transparent'
                                                }`}
                                              >
                                                {vanished ? (
                                                  <span className="text-[10.5px]">орохгүй</span>
                                                ) : (
                                                  cards.slice(0, 2).map((x) => (
                                                    <span key={x.id} className="truncate">
                                                      <b className="font-semibold">{subjectMap.get(x.subjectId)?.shortName}</b>{' '}
                                                      <span className="text-slate-500">{(teacherMap.get(x.teacherId)?.shortName || '').slice(0, 9)}</span>
                                                    </span>
                                                  ))
                                                )}
                                              </div>
                                            </td>
                                          );
                                        })}
                                      </tr>
                                    ))}
                                  </React.Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    )}
                  </>
                )}
              </div>
            </main>
          </div>
        )}
      </div>
    </div>
  );
};
