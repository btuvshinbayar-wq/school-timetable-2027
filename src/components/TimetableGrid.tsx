import React, { useMemo, useState } from 'react';
import {
  Subject,
  Teacher,
  ClassGroup,
  Classroom,
  Building,
  ScheduledCard,
  SchoolSettings,
  ConflictIssue,
  WeekCycle,
  ManagerProfile,
  LessonContract,
} from '../types/timetable';
import { Lock, Unlock, Trash2, X } from 'lucide-react';
import { getTimeOffStatus } from '../utils/constraints';
import { EditContext, evaluateMove, evaluateNew, MoveStatus, newCardsFromContract } from '../utils/manualEdit';

type ViewMode = 'whole_classes' | 'whole_teachers' | 'single_class' | 'single_teacher' | 'single_room';

interface TimetableGridProps {
  viewMode: ViewMode;
  onChangeViewMode?: (mode: any) => void;
  activeEntityId: string;
  onChangeActiveEntityId?: (id: string) => void;
  activeManagerId?: string;
  managers?: ManagerProfile[];
  activeShift: number; // 0 = бүх ээлж
  activeWeekCycle: WeekCycle;
  scheduledCards: ScheduledCard[];
  subjects: Subject[];
  teachers: Teacher[];
  classes: ClassGroup[];
  classrooms: Classroom[];
  buildings: Building[];
  lessons: LessonContract[];
  settings: SchoolSettings;
  conflicts: ConflictIssue[];
  /** Тавиураас чирж буй гэрээ (тавиур дээр dragstart-аар тохируулна) */
  dockDragContractId?: string | null;
  onMoveCard: (cardId: string, targetDay: number, targetPeriod: number) => void;
  onRemoveCard: (cardId: string) => void;
  onToggleLock: (cardId: string) => void;
  onDropNewCard: (contractId: string, day: number, period: number) => void;
  onNotify?: (message: string) => void;
}

/** Нэг баганын (цаг) тодорхойлолт */
interface Col {
  shift: number;
  period: number;
  label: string;
  time: string;
}

const PAPER = '#fffdf9';

function cardStyle(color: string | undefined): React.CSSProperties {
  const c = color || '#857d70';
  return {
    background: `color-mix(in srgb, ${c} 15%, ${PAPER})`,
    borderColor: `color-mix(in srgb, ${c} 42%, #d6d1c6)`,
    boxShadow: `inset 2px 0 0 color-mix(in srgb, ${c} 55%, #fffdf9)`,
  };
}

export const TimetableGrid: React.FC<TimetableGridProps> = ({
  viewMode,
  onChangeViewMode,
  activeEntityId,
  activeManagerId,
  managers,
  activeShift,
  activeWeekCycle,
  scheduledCards,
  subjects,
  teachers,
  classes,
  classrooms,
  lessons,
  settings,
  conflicts,
  dockDragContractId,
  onMoveCard,
  onRemoveCard,
  onToggleLock,
  onDropNewCard,
  onNotify,
}) => {
  const [dragCardId, setDragCardId] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const subMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const teachMap = useMemo(() => new Map(teachers.map((t) => [t.id, t])), [teachers]);
  const clsMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const roomMap = useMemo(() => new Map(classrooms.map((r) => [r.id, r])), [classrooms]);

  const editCtx: EditContext = useMemo(
    () => ({ settings, subjects, teachers, classes, classrooms, lessons }),
    [settings, subjects, teachers, classes, classrooms, lessons]
  );

  const errorCards = useMemo(() => {
    const s = new Set<string>();
    for (const c of conflicts) if (c.severity === 'error') c.cardIds?.forEach((id) => s.add(id));
    return s;
  }, [conflicts]);

  const shiftsInUse = useMemo(() => {
    const count = Math.max(1, settings.shiftsCount || settings.shifts.length);
    return settings.shifts.slice(0, count);
  }, [settings]);
  const shiftConf = (sh: number) => settings.shifts.find((s) => s.shiftNumber === sh) || settings.shifts[0];

  const filteredCards = useMemo(
    () =>
      scheduledCards.filter((c) =>
        activeWeekCycle === 'all' ? true : c.weekCycle === 'all' || c.weekCycle === activeWeekCycle
      ),
    [scheduledCards, activeWeekCycle]
  );

  // ---------------- Баганууд ----------------
  const multiShiftTimeline = (): Col[] => {
    const list = activeShift ? [shiftConf(activeShift)] : shiftsInUse;
    const cols: (Col & { start: string })[] = [];
    for (const sh of list) {
      for (let p = 0; p < sh.periodsCount; p++) {
        const bell = sh.bells[p];
        cols.push({
          shift: sh.shiftNumber,
          period: p,
          label: list.length > 1 ? `${sh.shiftNumber}·${p + 1}` : `${p + 1}`,
          time: bell ? `${bell.startTime}–${bell.endTime}` : '',
          start: bell?.startTime || `${sh.shiftNumber}${p}`,
        });
      }
    }
    return cols.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.shift - b.shift));
  };

  const isWholeClasses = viewMode === 'whole_classes';
  const isWholeTeachers = viewMode === 'whole_teachers';
  const isMasterGrid = isWholeClasses || isWholeTeachers;

  const masterCols: Col[] = useMemo(() => {
    if (isWholeClasses) {
      // Анги бүр нэг ээлжтэй: цагийн дугаараар зэрэгцүүлнэ
      const list = activeShift ? [shiftConf(activeShift)] : shiftsInUse;
      const max = Math.max(...list.map((s) => s.periodsCount));
      const one = list.length === 1 ? list[0] : null;
      return Array.from({ length: max }, (_, p) => ({
        shift: one?.shiftNumber || 0,
        period: p,
        label: `${p + 1}`,
        time: one?.bells[p] ? `${one.bells[p].startTime}–${one.bells[p].endTime}` : '',
      }));
    }
    return multiShiftTimeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, activeShift, settings]);

  // ---------------- Мөрүүд ----------------
  const currentMgr = managers?.find((m) => m.id === activeManagerId);
  const filteredTeachers = teachers.filter((t) =>
    activeManagerId && activeManagerId !== 'all' ? t.managerId === activeManagerId : true
  );
  const filteredClasses = classes.filter((c) => {
    if (activeShift !== 0 && c.shift !== activeShift) return false;
    if (activeManagerId && activeManagerId !== 'all') {
      if (c.managerId === activeManagerId) return true;
      if (currentMgr?.assignedGrades?.includes(c.grade)) return true;
      return false;
    }
    return true;
  });
  const rowEntities: (ClassGroup | Teacher)[] = isWholeClasses
    ? [...filteredClasses].sort((a, b) => (a.shift || 1) - (b.shift || 1))
    : filteredTeachers;

  // ---------------- Картын индекс ----------------
  const index = useMemo(() => {
    const m = new Map<string, ScheduledCard[]>();
    const push = (k: string, c: ScheduledCard) => {
      const l = m.get(k);
      if (l) l.push(c);
      else m.set(k, [c]);
    };
    const lessonById = new Map(lessons.map((l) => [l.id, l]));
    for (const c of filteredCards) {
      const l = lessonById.get(c.contractId);
      const joint = c.jointClassIds || l?.jointClassIds || [];
      const co = c.coTeacherIds || l?.coTeacherIds || [];
      for (const cl of [c.classId, ...joint]) push(`c|${cl}|${c.dayIndex}|${c.periodIndex}`, c);
      for (const t of [c.teacherId, ...co]) push(`t|${t}|${c.dayIndex}|${c.shift}|${c.periodIndex}`, c);
      if (c.classroomId) push(`r|${c.classroomId}|${c.dayIndex}|${c.shift}|${c.periodIndex}`, c);
    }
    return m;
  }, [filteredCards, lessons]);

  const classCell = (cid: string, d: number, p: number) => index.get(`c|${cid}|${d}|${p}`) || [];
  const teacherCell = (tid: string, d: number, col: Col) => index.get(`t|${tid}|${d}|${col.shift}|${col.period}`) || [];
  const roomCell = (rid: string, d: number, col: Col) => index.get(`r|${rid}|${d}|${col.shift}|${col.period}`) || [];

  // ---------------- Чирэх үеийн нүдний төлөв ----------------
  const dragCard = dragCardId ? scheduledCards.find((c) => c.id === dragCardId) : undefined;
  const dockContract = !dragCardId && dockDragContractId ? lessons.find((l) => l.id === dockDragContractId) : undefined;

  /** Чирж буй картын харьяа мөрийн нүд бүрийн төлөв (ногоон/шар/улаан) */
  const dropStatus = useMemo(() => {
    const m = new Map<string, { status: MoveStatus; reason?: string }>();
    const days = settings.daysPerWeek;
    if (dragCard) {
      const per = shiftConf(dragCard.shift).periodsCount;
      for (let d = 0; d < days; d++)
        for (let p = 0; p < per; p++) {
          const v = evaluateMove(editCtx, scheduledCards, dragCard.id, d, p);
          m.set(`${d}|${dragCard.shift}|${p}`, v);
        }
    } else if (dockContract) {
      const cls = clsMap.get(dockContract.classId);
      const sh = cls?.shift || 1;
      for (let d = 0; d < days; d++)
        for (let p = 0; p < shiftConf(sh).periodsCount; p++) {
          const v = evaluateNew(editCtx, scheduledCards, newCardsFromContract(dockContract, cls, scheduledCards, d, p));
          m.set(`${d}|${sh}|${p}`, v);
        }
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragCardId, dockContract?.id, scheduledCards, editCtx]);

  const dragOwnerRow = dragCard
    ? isWholeTeachers || viewMode === 'single_teacher'
      ? dragCard.teacherId
      : viewMode === 'single_room'
        ? dragCard.classroomId
        : dragCard.classId
    : dockContract
      ? isWholeTeachers || viewMode === 'single_teacher'
        ? dockContract.teacherId
        : dockContract.classId
      : null;
  const dragShift = dragCard?.shift ?? (dockContract ? clsMap.get(dockContract.classId)?.shift || 1 : null);

  const cellDropClass = (rowId: string | undefined, d: number, sh: number, p: number) => {
    if (!dragOwnerRow || rowId !== dragOwnerRow) return '';
    if (sh && dragShift && sh !== dragShift) return '';
    const v = dropStatus.get(`${d}|${dragShift}|${p}`);
    if (!v) return '';
    return v.status === 'ok' ? 'tt-cell-drop-ok' : v.status === 'swap' ? 'tt-cell-drop-warn' : 'tt-cell-drop-bad';
  };

  const endDrag = () => {
    setDragCardId(null);
    setHovered(null);
  };

  const handleDrop = (e: React.DragEvent, d: number, sh: number, p: number, rowId?: string) => {
    e.preventDefault();
    const fromDock = e.dataTransfer.getData('text/plain');
    if (rowId && dragOwnerRow && rowId !== dragOwnerRow) {
      onNotify?.(
        isWholeTeachers || viewMode === 'single_teacher'
          ? 'Хичээлийг өөр багшид шилжүүлэх бол "Хичээлүүд" цонхноос багшийг солино уу'
          : 'Хичээл өөр анги руу шилжихгүй — зөвхөн өөрийн мөрөнд зөөнө'
      );
      endDrag();
      return;
    }
    if (dragCardId) {
      const card = scheduledCards.find((c) => c.id === dragCardId);
      if (card && (!sh || sh === card.shift)) onMoveCard(dragCardId, d, p);
      else if (card) onNotify?.(`Энэ хичээл ${card.shift}-р ээлжийнх тул өөр ээлжийн цагт тавигдахгүй`);
    } else if (fromDock) {
      onDropNewCard(fromDock, d, p);
    }
    endDrag();
  };

  // ---------------- Карт ----------------
  const renderCard = (card: ScheduledCard, compact: boolean, perspective: 'class' | 'teacher' | 'room') => {
    const sub = subMap.get(card.subjectId);
    const teacher = teachMap.get(card.teacherId);
    const cls = clsMap.get(card.classId);
    const room = card.classroomId ? roomMap.get(card.classroomId) : undefined;
    const primary =
      perspective === 'class' ? sub?.shortName || sub?.name?.slice(0, 4) || '–' : cls?.shortName || cls?.name || '–';
    const sg = card.subgroupName ? card.subgroupName.replace(/-р дэд бүлэг$/, '').slice(0, 3) : '';
    const isSel = selectedCardId === card.id;
    const isErr = errorCards.has(card.id);
    const weekMark = card.weekCycle === 'week_a' ? 'А' : card.weekCycle === 'week_b' ? 'Б' : '';
    return (
      <div
        key={card.id}
        draggable={!card.isLocked}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('application/x-card', card.id);
          setDragCardId(card.id);
          setSelectedCardId(card.id);
        }}
        onDragEnd={endDrag}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedCardId(isSel ? null : card.id);
        }}
        className={`tt-card relative w-full flex items-center justify-center text-center leading-tight ${
          compact ? 'px-0.5 py-[1px] text-[10px]' : 'h-full min-h-[1.9rem] px-1 py-0.5 text-[11px]'
        } ${card.isLocked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'} ${isErr ? 'tt-card-conflict' : ''} ${
          isSel ? 'outline outline-2 outline-[#2f5d52] outline-offset-[-1px]' : ''
        }`}
        style={cardStyle(sub?.color)}
        title={`${sub?.name || ''} · ${cls?.name || ''}${card.subgroupName ? ` [${card.subgroupName}]` : ''}\n${teacher?.name || ''}${
          room ? ` · ${room.name}` : ''
        }${weekMark ? `\n${weekMark} 7 хоног` : ''}${card.isLocked ? '\nТүгжээтэй' : ''}`}
      >
        <span className="font-semibold text-slate-900 truncate">{primary}</span>
        {sg && <span className="ml-0.5 text-[8.5px] text-slate-600 shrink-0">{sg}</span>}
        {weekMark && <span className="ml-0.5 text-[8.5px] font-bold text-amber-700 shrink-0">{weekMark}</span>}
        {card.isLocked && <Lock className="absolute top-[1px] right-[1px] w-2.5 h-2.5 text-amber-700" />}
      </div>
    );
  };

  const selectedCard = selectedCardId ? scheduledCards.find((c) => c.id === selectedCardId) : undefined;

  // ---------------- Ганц харагдац ----------------
  const singleRows: Col[] = useMemo(() => {
    if (viewMode === 'single_class') {
      const cls = clsMap.get(activeEntityId);
      const sh = shiftConf(cls?.shift || 1);
      return Array.from({ length: sh.periodsCount }, (_, p) => ({
        shift: sh.shiftNumber,
        period: p,
        label: `${p + 1}-р цаг`,
        time: sh.bells[p] ? `${sh.bells[p].startTime}–${sh.bells[p].endTime}` : '',
      }));
    }
    return multiShiftTimeline().map((c) => ({ ...c, label: c.label.includes('·') ? `${c.label.replace('·', '-р ээлж, ')}-р цаг` : `${c.label}-р цаг` }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, activeEntityId, activeShift, settings, clsMap]);

  const singleEntity =
    viewMode === 'single_class'
      ? clsMap.get(activeEntityId)
      : viewMode === 'single_teacher'
        ? teachMap.get(activeEntityId)
        : roomMap.get(activeEntityId);

  return (
    <div className="flex-1 flex flex-col overflow-hidden select-none bg-[#ecebe5] relative" onClick={() => setSelectedCardId(null)}>
      {!isMasterGrid ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="bg-white border-b border-[#d6d1c6] px-4 py-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-900 text-[13px]">
              {viewMode === 'single_class' && `${singleEntity?.name || 'Анги'} · ${(singleEntity as ClassGroup | undefined)?.shift || 1}-р ээлж`}
              {viewMode === 'single_teacher' && `${singleEntity?.name || 'Багш'}`}
              {viewMode === 'single_room' && `${singleEntity?.name || 'Танхим'}`}
            </span>
            <button
              onClick={() => onChangeViewMode?.(viewMode === 'single_class' ? 'whole_classes' : 'whole_teachers')}
              className="px-2.5 py-1 bg-white border border-[#d6d1c6] rounded-md text-[11px] font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Бүх хуваарь руу буцах
            </button>
          </div>

          <div className="flex-1 overflow-auto p-3">
            <table className="w-full min-w-[720px] text-center border-separate border-spacing-0 text-xs bg-white rounded-lg overflow-hidden border border-[#d6d1c6]">
              <thead>
                <tr>
                  <th className="p-2 border-b border-r border-[#d6d1c6] w-36 text-left font-semibold text-slate-600 bg-slate-100">Цаг</th>
                  {settings.dayNames.map((dName, d) => (
                    <th key={d} className="p-2 border-b border-r border-[#d6d1c6] font-semibold text-slate-800 bg-slate-100">
                      {dName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {singleRows.map((col) => (
                  <tr key={`${col.shift}_${col.period}`}>
                    <td className="px-2 py-1.5 border-b border-r border-[#d6d1c6] text-left bg-slate-50 align-middle">
                      <div className="font-semibold text-slate-800">{col.label}</div>
                      {col.time && <div className="text-[10px] text-slate-500">{col.time}</div>}
                    </td>
                    {settings.dayNames.map((_, d) => {
                      const cards =
                        viewMode === 'single_class'
                          ? classCell(activeEntityId, d, col.period)
                          : viewMode === 'single_teacher'
                            ? teacherCell(activeEntityId, d, col)
                            : roomCell(activeEntityId, d, col);
                      const off =
                        singleEntity && getTimeOffStatus((singleEntity as any).timeOff, col.shift, d, col.period) === 'forbidden';
                      const key = `s|${d}|${col.shift}|${col.period}`;
                      const drop = cellDropClass(activeEntityId, d, col.shift, col.period);
                      return (
                        <td
                          key={d}
                          onDragOver={(e) => {
                            e.preventDefault();
                            if (hovered !== key) setHovered(key);
                          }}
                          onDrop={(e) => handleDrop(e, d, col.shift, col.period, activeEntityId)}
                          className={`p-1 h-14 border-b border-r border-[#e6e2da] align-middle ${off ? 'tt-cell-forbidden' : ''} ${drop} ${
                            hovered === key ? 'ring-2 ring-inset ring-[#2f5d52]' : ''
                          }`}
                        >
                          <div className="flex flex-col gap-0.5 h-full justify-center">
                            {cards.map((c) => (
                              <div key={c.id} className="flex flex-col">
                                {renderCard(c, cards.length > 1, viewMode === 'single_class' ? 'class' : 'teacher')}
                                {cards.length === 1 && (
                                  <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                                    {viewMode === 'single_class'
                                      ? teachMap.get(c.teacherId)?.name
                                      : `${subMap.get(c.subjectId)?.shortName || ''}${c.classroomId ? ` · ${roomMap.get(c.classroomId)?.shortName}` : ''}`}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="text-center border-separate border-spacing-0 text-xs" style={{ minWidth: 160 + settings.daysPerWeek * masterCols.length * 46 }}>
            <thead className="sticky top-0 z-20">
              <tr>
                <th className="sticky left-0 z-30 bg-white border-b border-r-2 border-[#d6d1c6] w-40 px-3 py-1.5 text-left font-semibold text-slate-800">
                  {isWholeTeachers ? 'Багш' : 'Анги'}
                </th>
                {settings.dayNames.map((dName, d) => (
                  <th
                    key={d}
                    colSpan={masterCols.length}
                    className="bg-white py-1.5 border-b border-r-2 border-[#d6d1c6] font-semibold text-slate-800 text-[12px]"
                  >
                    {dName}
                  </th>
                ))}
              </tr>
              <tr>
                <th className="sticky left-0 z-30 bg-slate-100 border-b border-r-2 border-[#d6d1c6] px-3 py-1 text-left font-normal text-[10.5px] text-slate-500">
                  {rowEntities.length} {isWholeTeachers ? 'багш' : 'анги'}
                </th>
                {settings.dayNames.flatMap((_, d) =>
                  masterCols.map((col, ci) => (
                    <th
                      key={`${d}_${ci}`}
                      title={col.time ? `${settings.dayNames[d]}, ${col.label}-р цаг (${col.time})` : undefined}
                      className={`bg-slate-100 py-1 border-b border-[#d6d1c6] font-medium text-[10.5px] text-slate-600 w-[46px] ${
                        ci === masterCols.length - 1 ? 'border-r-2' : 'border-r border-r-[#e6e2da]'
                      }`}
                    >
                      {col.label}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {rowEntities.map((entity, ri) => {
                const isSelRow = selectedRowId === entity.id;
                const prevShift = ri > 0 && isWholeClasses ? (rowEntities[ri - 1] as ClassGroup).shift : null;
                const showShiftHeader = isWholeClasses && !activeShift && (ri === 0 || prevShift !== (entity as ClassGroup).shift);
                const rowShift = isWholeClasses ? (entity as ClassGroup).shift || 1 : 0;
                const rowPeriods = isWholeClasses ? shiftConf(rowShift).periodsCount : 99;
                const mgr = isWholeTeachers ? managers?.find((m) => m.id === (entity as Teacher).managerId) : undefined;
                const sc = isWholeClasses ? shiftConf((entity as ClassGroup).shift || 1) : null;
                return (
                  <React.Fragment key={entity.id}>
                  {showShiftHeader && sc && (
                    <tr>
                      <td
                        colSpan={1 + settings.daysPerWeek * masterCols.length}
                        className="sticky left-0 bg-[#e2dfd7] px-3 py-1 text-left text-[11px] font-semibold text-slate-700 border-b border-[#d6d1c6]"
                      >
                        {sc.name || `${sc.shiftNumber}-р ээлж`} · {sc.bells[0]?.startTime}–{sc.bells[sc.periodsCount - 1]?.endTime}
                      </td>
                    </tr>
                  )}
                  <tr className="h-9">
                    <td
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRowId(isSelRow ? null : entity.id);
                      }}
                      className={`sticky left-0 z-10 px-3 py-1 border-b border-r-2 border-[#d6d1c6] text-left cursor-pointer ${
                        isSelRow ? 'bg-[#f3e4b9]' : 'bg-white hover:bg-slate-50'
                      }`}
                      title={entity.name}
                    >
                      <div className="flex items-center gap-1.5">
                        {mgr && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: mgr.color }} title={mgr.title} />}
                        <span className="truncate text-[11.5px] font-medium text-slate-900">{entity.name}</span>
                      </div>
                    </td>
                    {settings.dayNames.flatMap((_, d) =>
                      masterCols.map((col, ci) => {
                        const sh = isWholeClasses ? rowShift : col.shift;
                        const outside = isWholeClasses && col.period >= rowPeriods;
                        const key = `${entity.id}|${d}|${ci}`;
                        const off =
                          !outside && getTimeOffStatus((entity as any).timeOff, sh, d, col.period) === 'forbidden';
                        const cards = outside
                          ? []
                          : isWholeClasses
                            ? classCell(entity.id, d, col.period)
                            : teacherCell(entity.id, d, col);
                        const drop = outside ? '' : cellDropClass(entity.id, d, sh, col.period);
                        return (
                          <td
                            key={key}
                            onDragOver={(e) => {
                              if (outside) return;
                              e.preventDefault();
                              if (hovered !== key) setHovered(key);
                            }}
                            onDrop={(e) => !outside && handleDrop(e, d, sh, col.period, entity.id)}
                            className={`p-[2px] align-middle border-b border-[#e6e2da] ${
                              ci === masterCols.length - 1 ? 'border-r-2 border-r-[#d6d1c6]' : 'border-r border-r-[#e6e2da]'
                            } ${outside ? 'bg-[#e2dfd7]' : isSelRow ? 'tt-cell-row-selected' : 'tt-cell'} ${off ? 'tt-cell-forbidden' : ''} ${drop} ${
                              hovered === key && !drop ? 'ring-2 ring-inset ring-[#2f5d52]' : ''
                            }`}
                          >
                            {cards.length > 1 ? (
                              <div className="flex flex-col gap-[1px]">
                                {cards.map((c) => renderCard(c, true, isWholeClasses ? 'class' : 'teacher'))}
                              </div>
                            ) : cards.length === 1 ? (
                              renderCard(cards[0], false, isWholeClasses ? 'class' : 'teacher')
                            ) : null}
                          </td>
                        );
                      })
                    )}
                  </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Сонгосон картын мэдээлэл ба үйлдэл */}
      {selectedCard && (
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-3 z-40 bg-white border border-[#d6d1c6] rounded-xl shadow-[0_6px_24px_rgba(46,43,38,0.14)] px-3 py-2 flex items-center gap-3 text-[12px]"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: subMap.get(selectedCard.subjectId)?.color }} />
          <span className="font-semibold text-slate-900">{subMap.get(selectedCard.subjectId)?.name}</span>
          <span className="text-slate-600">
            {clsMap.get(selectedCard.classId)?.name}
            {selectedCard.subgroupName ? ` [${selectedCard.subgroupName}]` : ''} · {teachMap.get(selectedCard.teacherId)?.name} ·{' '}
            {settings.dayNames[selectedCard.dayIndex]}, {selectedCard.shift}-р ээлжийн {selectedCard.periodIndex + 1}-р цаг
          </span>
          <button
            onClick={() => onToggleLock(selectedCard.id)}
            className="flex items-center gap-1 px-2 py-1 rounded-md border border-[#d6d1c6] hover:bg-slate-100 cursor-pointer"
          >
            {selectedCard.isLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            {selectedCard.isLocked ? 'Түгжээ авах' : 'Түгжих'}
          </button>
          <button
            onClick={() => {
              onRemoveCard(selectedCard.id);
              setSelectedCardId(null);
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-md border border-[#ebc0b5] text-[#873a30] hover:bg-[#fbf1ee] cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Хуваариас авах
          </button>
          <button onClick={() => setSelectedCardId(null)} className="p-1 rounded-md hover:bg-slate-100 cursor-pointer" aria-label="Хаах">
            <X className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>
      )}
    </div>
  );
};
