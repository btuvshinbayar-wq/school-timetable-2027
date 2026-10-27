import React, { useState } from 'react';
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
} from '../types/timetable';
import { Lock, Unlock, Trash2 } from 'lucide-react';

interface TimetableGridProps {
  viewMode: 'whole_classes' | 'whole_teachers' | 'single_class' | 'single_teacher' | 'single_room';
  onChangeViewMode?: (mode: any) => void;
  activeEntityId: string;
  onChangeActiveEntityId?: (id: string) => void;
  activeManagerId?: string;
  managers?: ManagerProfile[];
  activeShift: number; // 0 = all, 1, 2, 3
  activeWeekCycle: WeekCycle; // all, week_a, week_b
  scheduledCards: ScheduledCard[];
  subjects: Subject[];
  teachers: Teacher[];
  classes: ClassGroup[];
  classrooms: Classroom[];
  buildings: Building[];
  settings: SchoolSettings;
  conflicts: ConflictIssue[];
  onMoveCard: (cardId: string, targetDay: number, targetPeriod: number, targetClassId?: string) => void;
  onRemoveCard: (cardId: string) => void;
  onToggleLock: (cardId: string) => void;
  onDropNewCard: (contractId: string, day: number, period: number, classId?: string) => void;
}

export const TimetableGrid: React.FC<TimetableGridProps> = ({
  viewMode,
  onChangeViewMode,
  activeEntityId,
  onChangeActiveEntityId,
  activeManagerId,
  managers,
  activeShift,
  activeWeekCycle,
  scheduledCards,
  subjects,
  teachers,
  classes,
  classrooms,
  buildings,
  settings,
  conflicts,
  onMoveCard,
  onRemoveCard,
  onToggleLock,
  onDropNewCard,
}) => {
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<{ day: number; period: number; entityId?: string } | null>(null);
  const [selectedRowEntityId, setSelectedRowEntityId] = useState<string | null>(
    viewMode === 'whole_teachers' ? (teachers[6]?.id || teachers[0]?.id || null) : (classes[0]?.id || null)
  );
  const [selectedPeriodCol, setSelectedPeriodCol] = useState<{ day: number; period: number } | null>({ day: 1, period: 3 });
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const subMap = new Map(subjects.map((s) => [s.id, s]));
  const teachMap = new Map(teachers.map((t) => [t.id, t]));
  const clsMap = new Map(classes.map((c) => [c.id, c]));
  const roomMap = new Map(classrooms.map((r) => [r.id, r]));
  const bldMap = new Map(buildings.map((b) => [b.id, b]));

  // Shift config for periods & bells
  const shiftConfig = settings.shifts.find((s) => s.shiftNumber === (activeShift || 1)) || settings.shifts[0];
  const bells = shiftConfig?.bells || [];
  const periodsCount = shiftConfig?.periodsCount || 7;

  // Filter scheduled cards based on week cycle
  const filteredCards = scheduledCards.filter((c) => {
    if (activeWeekCycle === 'week_a') {
      return c.weekCycle === 'all' || c.weekCycle === 'week_a';
    }
    if (activeWeekCycle === 'week_b') {
      return c.weekCycle === 'all' || c.weekCycle === 'week_b';
    }
    return true;
  });

  const handleDragOver = (e: React.DragEvent, day: number, period: number, entityId?: string) => {
    e.preventDefault();
    setHoveredSlot({ day, period, entityId });
  };

  const handleDragLeave = () => {
    setHoveredSlot(null);
  };

  const handleDrop = (e: React.DragEvent, day: number, period: number, targetClassId?: string) => {
    e.preventDefault();
    setHoveredSlot(null);

    const contractIdFromDock = e.dataTransfer.getData('text/plain');

    if (draggedCardId) {
      onMoveCard(draggedCardId, day, period, targetClassId);
      setDraggedCardId(null);
    } else if (contractIdFromDock) {
      onDropNewCard(contractIdFromDock, day, period, targetClassId);
    }
  };

  const isWholeClasses = viewMode === 'whole_classes';
  const isWholeTeachers = viewMode === 'whole_teachers';
  const isMasterGrid = isWholeClasses || isWholeTeachers;

  const currentMgr = managers?.find((m) => m.id === activeManagerId);
  const filteredTeachers = teachers.filter((t) => {
    if (activeManagerId && activeManagerId !== 'all') {
      return t.managerId === activeManagerId;
    }
    return true;
  });

  // Filter classes by activeShift and activeManagerId if specified
  const filteredClasses = classes.filter((c) => {
    if (activeShift !== 0 && c.shift !== activeShift) return false;
    if (activeManagerId && activeManagerId !== 'all') {
      if (c.managerId === activeManagerId) return true;
      if (currentMgr?.assignedGrades && currentMgr.assignedGrades.includes(c.grade)) return true;
      return false;
    }
    return true;
  });

  const rowEntities = isWholeClasses ? filteredClasses : filteredTeachers;

  return (
    <div className="flex-1 flex flex-col overflow-hidden select-none bg-[#dfe4eb] font-sans">
      {/* If Single View is Active */}
      {!isMasterGrid ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top entity status */}
            <div className="bg-[#e7edf4] border-b border-[#b5c2d1] px-4 py-1.5 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 text-[12px] flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-xs bg-blue-600"></span>
                {viewMode === 'single_class' && `${clsMap.get(activeEntityId)?.name || 'Анги'} (${clsMap.get(activeEntityId)?.shift || 1}-р ээлж)`}
                {viewMode === 'single_teacher' && `${teachMap.get(activeEntityId)?.name || 'Багш'} багшийн хуваарь`}
                {viewMode === 'single_room' && `${roomMap.get(activeEntityId)?.name || 'Танхим'} танхимын хуваарь`}
              </span>
              <button
                onClick={() => onChangeViewMode?.('whole_teachers')}
                className="px-2 py-0.5 bg-white border border-[#b5c2d1] rounded text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                ← Бүх хуваарь харах
              </button>
            </div>

            {/* Single Grid Table */}
            <div className="flex-1 overflow-auto p-2 bg-[#dbe1e9]">
              <div className="border border-[#9ba9ba] bg-[#dbe1e9] shadow-xs overflow-hidden min-w-[700px]">
                <table className="w-full text-center border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#dce4ed] border-b border-[#a0aec0]">
                      <th className="p-1.5 border-r border-[#a0aec0] w-28 text-slate-800 font-bold text-left bg-[#d2dce7]">
                        Цаг / Гараг
                      </th>
                      {settings.dayNames.map((dName, d) => (
                        <th key={d} className="p-1.5 border-r border-[#a0aec0] font-bold text-slate-800">
                          {dName}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#b8c5d3]">
                    {Array.from({ length: periodsCount }).map((_, p) => {
                      const bell = bells[p];
                      return (
                        <tr key={p} className="h-14">
                          <td className="p-1 border-r border-[#a0aec0] bg-[#e9eef5] text-left align-middle font-bold text-slate-800">
                            <div>{p + 1}-р цаг</div>
                            {bell && (
                              <div className="font-mono text-[10px] text-slate-500 font-normal">
                                {bell.startTime} - {bell.endTime}
                              </div>
                            )}
                          </td>
                          {settings.dayNames.map((_, d) => {
                            const isHovered = hoveredSlot?.day === d && hoveredSlot?.period === p;
                            const card = filteredCards.find((c) => {
                              if (viewMode === 'single_class') return c.classId === activeEntityId && c.dayIndex === d && c.periodIndex === p;
                              if (viewMode === 'single_teacher') return c.teacherId === activeEntityId && c.dayIndex === d && c.periodIndex === p;
                              return c.classroomId === activeEntityId && c.dayIndex === d && c.periodIndex === p;
                            });

                            const sub = card ? subMap.get(card.subjectId) : undefined;
                            const teacher = card ? teachMap.get(card.teacherId) : undefined;
                            const cls = card ? clsMap.get(card.classId) : undefined;
                            const room = card?.classroomId ? roomMap.get(card.classroomId) : undefined;

                            return (
                              <td
                                key={d}
                                onDragOver={(e) => handleDragOver(e, d, p, activeEntityId)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, d, p, activeEntityId)}
                                className={`p-1 border-r border-[#b8c5d3] relative transition-colors ${
                                  isHovered ? 'bg-blue-100 ring-2 ring-blue-500 ring-inset' : 'bg-[#dfe4ec]'
                                }`}
                              >
                                {card ? (
                                  <div
                                    draggable
                                    onDragStart={() => setDraggedCardId(card.id)}
                                    className="h-full min-h-[3rem] bg-white rounded-xs p-1 flex flex-col justify-between text-left cursor-grab active:cursor-grabbing border border-[#9aa6b6] shadow-xs"
                                  >
                                    <div className="flex items-center justify-between font-bold text-slate-900 text-[11px] truncate">
                                      <span>{sub?.shortName || sub?.name || 'Хичээл'}</span>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <button onClick={() => onToggleLock(card.id)} className="text-slate-400 hover:text-slate-700">
                                          {card.isLocked ? <Lock className="w-3 h-3 text-amber-600" /> : <Unlock className="w-3 h-3 opacity-20 hover:opacity-100" />}
                                        </button>
                                        <button onClick={() => onRemoveCard(card.id)} className="text-slate-400 hover:text-rose-600 opacity-40 hover:opacity-100">
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                    <div className="text-[10px] text-slate-600 font-semibold truncate">
                                      {viewMode === 'single_class' ? teacher?.name : cls?.name}
                                    </div>
                                    <div className="text-[9px] text-slate-400 truncate">
                                      {room?.shortName || 'Үндсэн'}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="h-full min-h-[3rem] flex items-center justify-center text-slate-400 text-xs font-mono">
                                    –
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* Master Whole Grid (Whole Teachers or Whole Classes matching uploaded image) */
          <div className="flex-1 flex flex-col overflow-hidden bg-[#dfe4eb]">
            <div className="flex-1 overflow-auto bg-[#dfe4eb]">
              <table className="w-full text-center border-collapse text-xs min-w-[1280px]">
                {/* Header 1: Гарагууд (Даваа, Мягмар, Лхагва, Пүрэв, Баасан) */}
                <thead className="sticky top-0 z-20 shadow-xs">
                  <tr className="bg-[#dce4ed] border-b border-[#a0aec0]">
                    {/* Top Left Corner */}
                    <th className="p-1 border-r-2 border-[#8b9aa9] w-36 bg-[#d2dce7] text-slate-800 font-bold sticky left-0 z-30 text-left pl-2">
                      {isWholeTeachers ? 'Багш нар' : 'Анги бүлэг'}
                    </th>
                    {settings.dayNames.map((dName, d) => (
                      <th
                        key={d}
                        colSpan={periodsCount}
                        className="py-1 px-2 border-r-2 border-[#8b9aa9] bg-[#dce4ed] font-bold text-slate-800 border-b border-[#a0aec0] text-center tracking-tight text-[11px]"
                      >
                        <span className="font-bold">{dName}</span>
                      </th>
                    ))}
                  </tr>

                  {/* Header 2: Period Numbers (1, 2, 3, 4, 5, 6, 7 or Shift prefix like 2-1, 2-2, 2-4 in yellow) */}
                  <tr className="bg-[#ebf0f5] border-b-2 border-[#8b9aa9] text-[10px]">
                    <th className="p-1 border-r-2 border-[#8b9aa9] bg-[#dce4ed] sticky left-0 z-30 text-slate-500 font-medium text-left pl-2">
                      {rowEntities.length} {isWholeTeachers ? 'багш' : 'анги'}
                    </th>
                    {settings.dayNames.flatMap((_, d) =>
                      Array.from({ length: periodsCount }).map((_, p) => {
                        const isSelectedCol = selectedPeriodCol?.day === d && selectedPeriodCol?.period === p;
                        const periodLabel = activeShift === 2 ? `2-${p + 1}` : `${p + 1}`;
                        const isDayEnd = p === periodsCount - 1;

                        return (
                          <th
                            key={`${d}_${p}`}
                            onClick={() => setSelectedPeriodCol({ day: d, period: p })}
                            className={`py-0.5 px-1 border-r text-slate-800 font-bold w-12 cursor-pointer transition select-none ${
                              isDayEnd ? 'border-r-2 border-[#8b9aa9]' : 'border-r-[#b8c4d2]'
                            } ${
                              isSelectedCol
                                ? 'bg-[#ffff00] text-black font-extrabold shadow-inner'
                                : 'bg-[#edf1f6] hover:bg-slate-200'
                            }`}
                            title={`Гараг: ${settings.dayNames[d] || ''}, Цаг: ${p + 1}`}
                          >
                            {periodLabel}
                          </th>
                        );
                      })
                    )}
                  </tr>
                </thead>

                {/* Grid Body */}
                <tbody className="divide-y divide-[#b8c5d3]">
                  {rowEntities.map((entity: any) => {
                    const isSelectedRow = selectedRowEntityId === entity.id;

                    return (
                      <tr
                        key={entity.id}
                        onClick={() => setSelectedRowEntityId(entity.id)}
                        className={`h-9 transition-colors ${
                          isSelectedRow ? 'bg-[#fffa94]/40' : 'hover:bg-slate-100/50'
                        }`}
                      >
                        {/* Left Column: Entity Name (Highlighted in Yellow if active like Нямцогт Т) */}
                        <td
                          onClick={() => setSelectedRowEntityId(entity.id)}
                          className={`px-2 py-1 border-r-2 border-[#8b9aa9] sticky left-0 z-10 text-left truncate cursor-pointer transition shadow-xs ${
                            isSelectedRow
                              ? 'bg-[#ffff00] text-black font-extrabold border-y border-amber-500'
                              : 'bg-[#edf1f6] text-slate-900 font-semibold border-b border-[#c8d4e2]'
                          }`}
                          title={entity.name}
                        >
                          <div className="flex items-center gap-1.5 leading-none">
                            {isWholeTeachers && entity.managerId && (
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: managers?.find((m) => m.id === entity.managerId)?.color || '#6366f1' }}
                                title={managers?.find((m) => m.id === entity.managerId)?.title || 'Менежер'}
                              />
                            )}
                            <span className="truncate text-[11px]">{entity.name}</span>
                            {isWholeClasses && entity.shift && (
                              <span className="text-[9px] text-slate-500 font-mono">
                                ({entity.shift}э)
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Schedule Cells across all days and periods */}
                        {settings.dayNames.flatMap((_, d) =>
                          Array.from({ length: periodsCount }).map((_, p) => {
                            const isHovered =
                              hoveredSlot?.day === d &&
                              hoveredSlot?.period === p &&
                              hoveredSlot?.entityId === entity.id;

                            const isDayEnd = p === periodsCount - 1;

                            // Check time off (forbidden/unavailable slot)
                            const isForbidden = entity.timeOff && entity.timeOff[`${d}_${p}`] === 'forbidden';

                            // Find all cards in this slot (supporting parallel subgroups!)
                            const cellCards = filteredCards.filter((c) => {
                              if (isWholeClasses) {
                                return c.classId === entity.id && c.dayIndex === d && c.periodIndex === p;
                              } else {
                                return c.teacherId === entity.id && c.dayIndex === d && c.periodIndex === p;
                              }
                            });

                            return (
                              <td
                                key={`${d}_${p}`}
                                onDragOver={(e) => handleDragOver(e, d, p, entity.id)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) =>
                                  handleDrop(e, d, p, isWholeClasses ? entity.id : undefined)
                                }
                                className={`p-0.5 align-middle relative transition-colors ${
                                  isDayEnd ? 'border-r-2 border-[#8b9aa9]' : 'border-r border-[#b8c5d3]'
                                } ${
                                  isForbidden
                                    ? 'bg-[#d2dbe5]'
                                    : isSelectedRow
                                    ? 'bg-[#fffed0]'
                                    : 'bg-[#dfe4ec]'
                                } ${
                                  isHovered ? 'bg-blue-200 ring-2 ring-blue-500 ring-inset' : ''
                                }`}
                              >
                                {cellCards.length > 1 ? (
                                  /* Split Parallel Cards Cell (Simultaneous Subgroups!) */
                                  <div className="flex flex-col gap-0.5 h-full w-full justify-center">
                                    {cellCards.map((cCard) => {
                                      const cSub = subMap.get(cCard.subjectId);
                                      const cTeacher = teachMap.get(cCard.teacherId);
                                      const cCls = clsMap.get(cCard.classId);
                                      const isCSelected = selectedCardId === cCard.id;
                                      const cText = isWholeTeachers
                                        ? `${cCls?.name || ''}${cCard.subgroupName ? ` (${cCard.subgroupName.slice(0, 3)})` : ''}`
                                        : `${cSub?.shortName || cSub?.name?.slice(0, 3) || ''}${
                                            cCard.subgroupName ? ` (${cCard.subgroupName.slice(0, 3)})` : ''
                                          }`;

                                      return (
                                        <div
                                          key={cCard.id}
                                          draggable
                                          onDragStart={() => setDraggedCardId(cCard.id)}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedCardId(cCard.id);
                                          }}
                                          className={`py-0.5 px-1 rounded-xs bg-white text-slate-900 border border-[#9aa6b6] flex items-center justify-between text-[9px] font-bold cursor-grab active:cursor-grabbing shadow-2xs hover:border-blue-600 transition ${
                                            isCSelected ? 'ring-2 ring-red-600' : ''
                                          }`}
                                          style={{
                                            borderLeftWidth: '3px',
                                            borderLeftColor: cSub?.color || '#3b82f6',
                                          }}
                                          title={`${cCls?.name || ''} - ${cSub?.name || ''} [${cCard.subgroupName || 'Дэд бүлэг'}] (${cTeacher?.name || ''})`}
                                        >
                                          <span className="truncate">{cText}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : cellCards.length === 1 ? (
                                  /* Single Card */
                                  (() => {
                                    const card = cellCards[0];
                                    const isCardSelected = selectedCardId === card.id;
                                    const sub = subMap.get(card.subjectId);
                                    const teacher = teachMap.get(card.teacherId);
                                    const cls = clsMap.get(card.classId);
                                    const primaryCardText = isWholeTeachers
                                      ? cls?.name || '–'
                                      : sub?.shortName || sub?.name?.slice(0, 3) || '–';

                                    return (
                                      <div
                                        draggable
                                        onDragStart={() => setDraggedCardId(card.id)}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedCardId(card.id);
                                        }}
                                        className={`h-full min-h-[1.75rem] w-full rounded-xs px-1 py-0.5 bg-white text-slate-900 border border-[#9aa6b6] flex flex-col items-center justify-center text-center cursor-grab active:cursor-grabbing shadow-[0_1px_1px_rgba(0,0,0,0.06)] hover:border-slate-600 transition ${
                                          isCardSelected ? 'ring-2 ring-red-600 font-extrabold' : 'font-bold'
                                        }`}
                                        title={`${cls?.name || ''} - ${sub?.name || ''} ${
                                          card.subgroupName ? `[${card.subgroupName}]` : ''
                                        } (${teacher?.name || ''})`}
                                      >
                                        <div className="flex items-center gap-1 leading-tight justify-center max-w-full">
                                          <span className="text-[11px] leading-tight font-bold text-slate-900 truncate">
                                            {primaryCardText}
                                          </span>
                                          {card.subgroupName && (
                                            <span className="text-[8px] bg-slate-100 text-slate-600 px-0.5 rounded font-normal shrink-0">
                                              {card.subgroupName.slice(0, 3)}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })()
                                ) : isForbidden ? (
                                  /* Unavailable Cross Marker matching screenshot */
                                  <div className="h-full w-full flex items-center justify-center text-slate-500 text-[10px] font-mono leading-none">
                                    ×
                                  </div>
                                ) : (
                                  /* Empty available cell */
                                  <div className="h-full w-full hover:bg-white/40 transition rounded-xs" />
                                )}
                              </td>
                            );
                          })
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
    </div>
  );
};
