import React from 'react';
import { LessonContract, ScheduledCard, Subject, Teacher, ClassGroup, Classroom } from '../types/timetable';
import { Layers, ChevronUp, ChevronDown, CheckCircle2 } from 'lucide-react';

interface BottomCardsDockProps {
  lessons: LessonContract[];
  scheduledCards: ScheduledCard[];
  subjects: Subject[];
  teachers: Teacher[];
  classes: ClassGroup[];
  classrooms: Classroom[];
  selectedClassId?: string;
  selectedTeacherId?: string;
  activeManagerId?: string;
  onCardDragStart: (contractId: string) => void;
  onQuickPlaceCard: (contract: LessonContract) => void;
}

export const BottomCardsDock: React.FC<BottomCardsDockProps> = ({
  lessons,
  scheduledCards,
  subjects,
  teachers,
  classes,
  classrooms,
  selectedClassId,
  selectedTeacherId,
  activeManagerId,
  onCardDragStart,
  onQuickPlaceCard,
}) => {
  const [isExpanded, setIsExpanded] = React.useState(true);

  const subMap = new Map(subjects.map((s) => [s.id, s]));
  const teachMap = new Map(teachers.map((t) => [t.id, t]));
  const clsMap = new Map(classes.map((c) => [c.id, c]));

  // Calculate unplaced card counts per contract
  const contractStats = lessons.map((ct) => {
    const placedCount = scheduledCards.filter((sc) => sc.contractId === ct.id).length;
    const remaining = Math.max(0, ct.totalPeriods - placedCount);
    return {
      contract: ct,
      placedCount,
      remaining,
    };
  });

  // Filter cards to show: either for current view or unplaced
  const filteredContracts = contractStats.filter(({ contract, remaining }) => {
    if (selectedClassId && selectedClassId !== 'whole' && contract.classId !== selectedClassId) {
      return false;
    }
    if (selectedTeacherId && selectedTeacherId !== 'whole' && contract.teacherId !== selectedTeacherId) {
      return false;
    }
    if (activeManagerId && activeManagerId !== 'all') {
      const teach = teachMap.get(contract.teacherId);
      if (teach && teach.managerId && teach.managerId !== activeManagerId) {
        return false;
      }
    }
    return true;
  });

  const totalRemaining = contractStats.reduce((sum, c) => sum + c.remaining, 0);

  return (
    <div className="bg-[#dce4ee] border-t border-[#b0c0d2] shadow-xs flex flex-col select-none transition-all font-sans">
      {/* Top mini header bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="bg-[#d0dbe7] px-3 py-1 flex items-center justify-between text-xs cursor-pointer hover:bg-[#c8d4e2] border-b border-[#b5c5d6]"
      >
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-blue-700" />
          <span className="font-bold text-slate-800 text-[11px]">
            Хуваарилагдаагүй картуудын тавиур
          </span>
          {totalRemaining > 0 ? (
            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white font-bold text-[10px]">
              {totalRemaining} карт үлдсэн
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Бүх хичээл байршсан
            </span>
          )}
        </div>

        <button className="text-slate-600 hover:text-slate-900 cursor-pointer">
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {/* Dock cards strip */}
      {isExpanded && (
        <div className="p-2 overflow-x-auto flex items-center gap-2 max-h-24 min-h-[5.5rem] bg-[#e4ecf5] border-b border-[#c2d0df]">
          {filteredContracts.length === 0 ? (
            <div className="text-xs text-slate-500 italic px-4">
              Энэ шүүлтүүрт хамаарах хичээлийн карт байхгүй байна.
            </div>
          ) : (
            filteredContracts.map(({ contract, remaining, placedCount }) => {
              const sub = subMap.get(contract.subjectId);
              const teacher = teachMap.get(contract.teacherId);
              const cls = clsMap.get(contract.classId);
              const isAllPlaced = remaining === 0;

              return (
                <div
                  key={contract.id}
                  draggable={!isAllPlaced}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', contract.id);
                    onCardDragStart(contract.id);
                  }}
                  onClick={() => !isAllPlaced && onQuickPlaceCard(contract)}
                  className={`h-16 w-32 p-1.5 rounded border flex flex-col justify-between shrink-0 shadow-xs cursor-grab active:cursor-grabbing transition-transform hover:-translate-y-0.5 ${
                    isAllPlaced
                      ? 'bg-slate-200/80 border-slate-300 opacity-60 cursor-default'
                      : 'bg-white hover:shadow-md'
                  }`}
                  style={{
                    borderLeftWidth: '5px',
                    borderLeftColor: sub?.color || '#3b82f6',
                  }}
                  title={
                    isAllPlaced
                      ? 'Бүх цаг байршсан'
                      : 'Чирч хуваарьт тавих эсвэл товшиж хамгийн эхний боломжит зайд автоматаар тавих'
                  }
                >
                  <div className="flex items-center justify-between leading-tight">
                    <span className="font-bold text-slate-900 text-xs truncate max-w-[4.8rem]">
                      {sub?.name || 'Хичээл'}
                    </span>
                    <div className="flex items-center gap-1">
                      {contract.subgroupName && (
                        <span className="text-[9px] font-semibold text-purple-700 bg-purple-100 px-1 rounded truncate max-w-[3.5rem]" title={contract.subgroupName}>
                          {contract.subgroupName}
                        </span>
                      )}
                      <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-1 rounded">
                        {cls?.name}
                      </span>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-600 truncate">{teacher?.shortName || teacher?.name}</div>

                  <div className="flex items-center justify-between text-[9px] pt-0.5 border-t border-slate-100">
                    <span className="text-slate-400 font-mono">
                      {placedCount}/{contract.totalPeriods}
                    </span>
                    {remaining > 0 ? (
                      <span className="font-bold text-amber-700 bg-amber-100 px-1 rounded">
                        +{remaining} үлдсэн
                      </span>
                    ) : (
                      <span className="font-bold text-emerald-700 bg-emerald-100 px-1 rounded">Бүрэн</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
