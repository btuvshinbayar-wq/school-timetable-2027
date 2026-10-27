import {
  Subject,
  Teacher,
  ClassGroup,
  Classroom,
  Building,
  LessonContract,
  ScheduledCard,
  SchoolSettings,
  CardRelationship,
  ConflictIssue,
  GenerationStats,
  WeekCycle,
} from '../types/timetable';

export interface CardToPlace {
  id: string;
  contractId: string;
  subjectId: string;
  teacherId: string;
  classId: string;
  subgroupId?: string;
  subgroupName?: string;
  classroomId?: string;
  shift: number;
  weekCycle: WeekCycle;
  isDouble: boolean;
  partnerCardId?: string;
}

/**
 * Feasibility test before generator run
 */
export function testTimetableFeasibility(
  subjects: Subject[],
  teachers: Teacher[],
  classes: ClassGroup[],
  classrooms: Classroom[],
  contracts: LessonContract[],
  settings: SchoolSettings
): { passed: boolean; messages: string[] } {
  const messages: string[] = [];

  // Check each class
  for (const c of classes) {
    const classLessons = contracts.filter((ct) => ct.classId === c.id);
    const totalPeriods = classLessons.reduce((sum, ct) => sum + ct.totalPeriods, 0);

    const shiftConf = settings.shifts.find((s) => s.shiftNumber === c.shift) || settings.shifts[0];
    const maxWeekly = settings.daysPerWeek * (shiftConf?.periodsCount || 6);

    if (totalPeriods > maxWeekly) {
      messages.push(
        `❌ [Анги: ${c.name}] 7 хоногт нийт ${totalPeriods} цаг хичээлтэй байгаа нь тухайн ${c.shift}-р ээлжийн дээд хязгаар ${maxWeekly} цагаас давж байна.`
      );
    }
  }

  // Check teachers
  for (const t of teachers) {
    const teacherLessons = contracts.filter((ct) => ct.teacherId === t.id);
    const totalPeriods = teacherLessons.reduce((sum, ct) => sum + ct.totalPeriods, 0);

    // Approximate weekly capacity (all shifts teacher teaches)
    const totalAvailableSlots = settings.daysPerWeek * 6 * (settings.shiftsCount || 2);
    if (totalPeriods > totalAvailableSlots) {
      messages.push(
        `❌ [Багш: ${t.name}] Заах нийт ${totalPeriods} цаг байгаа нь сургуулийн боломжит цагаас давсан байна.`
      );
    }
  }

  const passed = messages.filter((m) => m.startsWith('❌')).length === 0;
  if (passed && messages.length === 0) {
    messages.push('✅ Хүчин чадлын шалгалт амжилттай! Бүх анги, багш нарын цаг багтаж байна.');
  }

  return { passed, messages };
}

/**
 * Expands contracts into schedulable cards
 */
export function expandContractsToCards(
  contracts: LessonContract[],
  classes: ClassGroup[],
  existingScheduled: ScheduledCard[] = []
): { cardsToPlace: CardToPlace[]; lockedCards: ScheduledCard[] } {
  const lockedCards = existingScheduled.filter((c) => c.isLocked);
  const lockedUsage: Record<string, number> = {};

  for (const c of lockedCards) {
    lockedUsage[c.contractId] = (lockedUsage[c.contractId] || 0) + 1;
  }

  const cardsToPlace: CardToPlace[] = [];

  for (const ct of contracts) {
    const cls = classes.find((c) => c.id === ct.classId);
    const shift = cls?.shift || 1;
    const alreadyLocked = lockedUsage[ct.id] || 0;
    let remaining = Math.max(0, ct.totalPeriods - alreadyLocked);

    let doublePairs = ct.doubleLessons;
    while (doublePairs > 0 && remaining >= 2) {
      const card1Id = `${ct.id}_dbl1_${doublePairs}`;
      const card2Id = `${ct.id}_dbl2_${doublePairs}`;
      cardsToPlace.push({
        id: card1Id,
        contractId: ct.id,
        subjectId: ct.subjectId,
        teacherId: ct.teacherId,
        classId: ct.classId,
        subgroupId: ct.subgroupId,
        subgroupName: ct.subgroupName,
        classroomId: ct.classroomId,
        shift,
        weekCycle: ct.weekCycle || 'all',
        isDouble: true,
        partnerCardId: card2Id,
      });
      cardsToPlace.push({
        id: card2Id,
        contractId: ct.id,
        subjectId: ct.subjectId,
        teacherId: ct.teacherId,
        classId: ct.classId,
        subgroupId: ct.subgroupId,
        subgroupName: ct.subgroupName,
        classroomId: ct.classroomId,
        shift,
        weekCycle: ct.weekCycle || 'all',
        isDouble: true,
        partnerCardId: card1Id,
      });
      doublePairs--;
      remaining -= 2;
    }

    let singleIdx = 1;
    while (remaining > 0) {
      cardsToPlace.push({
        id: `${ct.id}_sgl_${singleIdx++}`,
        contractId: ct.id,
        subjectId: ct.subjectId,
        teacherId: ct.teacherId,
        classId: ct.classId,
        subgroupId: ct.subgroupId,
        subgroupName: ct.subgroupName,
        classroomId: ct.classroomId,
        shift,
        weekCycle: ct.weekCycle || 'all',
        isDouble: false,
      });
      remaining--;
    }
  }

  return { cardsToPlace, lockedCards };
}

/**
 * Slot reservation state tracking for classes, supporting subgroups
 */
export interface ClassSlotState {
  hasWholeClass: boolean;
  subgroups: Set<string>;
}

/**
 * Checks placement validity with Subgroup and Relations constraints
 */
function isValidPlacement(
  card: CardToPlace,
  day: number,
  period: number,
  classes: ClassGroup[],
  teachers: Teacher[],
  subjects: Subject[],
  classrooms: Classroom[],
  settings: SchoolSettings,
  teacherSchedule: Map<string, Set<string>>,
  roomSchedule: Map<string, Set<string>>,
  classSchedule: Map<string, ClassSlotState>,
  relationships: CardRelationship[] = [],
  currentScheduledCards: ScheduledCard[] = []
): boolean {
  const classSlotKey = `${card.classId}_${day}_${period}`;
  const teacherSlotKey = `${card.shift}_${day}_${period}`;
  const roomSlotKey = `${card.shift}_${day}_${period}`;

  // 1. Class conflict with Subgroup handling
  const clsSlot = classSchedule.get(classSlotKey);
  if (clsSlot) {
    if (!card.subgroupName) {
      // Whole class lesson requires completely empty slot
      return false;
    } else {
      // Card has subgroup
      if (clsSlot.hasWholeClass) return false;
      // Cannot share slot with the SAME subgroup
      if (clsSlot.subgroups.has(card.subgroupName)) return false;
    }
  }

  // 2. Teacher conflict
  if (teacherSchedule.get(card.teacherId)?.has(teacherSlotKey)) {
    return false;
  }

  // 3. Room conflict
  if (card.classroomId) {
    const room = classrooms.find((r) => r.id === card.classroomId);
    if (room && !room.isShared) {
      if (roomSchedule.get(card.classroomId)?.has(roomSlotKey)) {
        return false;
      }
    }
  }

  // 4. Time off checks
  const teacher = teachers.find((t) => t.id === card.teacherId);
  if (teacher?.timeOff[`${day}_${period}`] === 'forbidden') return false;

  const classObj = classes.find((c) => c.id === card.classId);
  if (classObj?.timeOff[`${day}_${period}`] === 'forbidden') return false;

  const subjectObj = subjects.find((s) => s.id === card.subjectId);
  if (subjectObj?.timeOff[`${day}_${period}`] === 'forbidden') return false;

  const shiftConf =
    settings.shifts.find((s) => s.shiftNumber === card.shift) || settings.shifts[0];
  const periodsCount = shiftConf?.periodsCount || 6;

  // 5. Relationship Constraint 1: 2 хичээл нэг өдөрт орохгүй (cannot_same_day)
  for (const r of relationships) {
    if (!r.isActive || r.condition !== 'cannot_same_day') continue;
    if (r.classIds && r.classIds.length > 0 && !r.classIds.includes(card.classId)) continue;

    if (r.subjectIds.includes(card.subjectId)) {
      // Check if another subject in r.subjectIds is already on this day for this class
      const otherSubjects = r.subjectIds.filter((sId) => sId !== card.subjectId);
      const hasOther = currentScheduledCards.some(
        (c) =>
          c.classId === card.classId &&
          c.dayIndex === day &&
          otherSubjects.includes(c.subjectId)
      );
      if (hasOther) {
        if (r.importance === 'strict') return false;
      }
    }
  }

  // 6. Relationship Constraint 2: 2 хичээл дараалласан цагт орохгүй (cannot_consecutive)
  for (const r of relationships) {
    if (!r.isActive || r.condition !== 'cannot_consecutive') continue;
    if (r.classIds && r.classIds.length > 0 && !r.classIds.includes(card.classId)) continue;

    if (r.subjectIds.includes(card.subjectId)) {
      const otherSubjects = r.subjectIds.filter((sId) => sId !== card.subjectId);
      const hasConsecutive = currentScheduledCards.some(
        (c) =>
          c.classId === card.classId &&
          c.dayIndex === day &&
          Math.abs(c.periodIndex - period) === 1 &&
          otherSubjects.includes(c.subjectId)
      );
      if (hasConsecutive) {
        if (r.importance === 'strict') return false;
      }
    }
  }

  // 7. Relationship Constraint 3: Сонгосон хичээл эхний юм уу сүүлийн цагт орох (first_or_last)
  for (const r of relationships) {
    if (!r.isActive || r.condition !== 'first_or_last') continue;
    if (r.classIds && r.classIds.length > 0 && !r.classIds.includes(card.classId)) continue;

    if (r.subjectIds.includes(card.subjectId)) {
      const mode = r.firstOrLastMode || 'first_or_last';
      const isFirst = period === 0;
      const isLast = period === periodsCount - 1 || (card.isDouble && period === periodsCount - 2);
      const isOk = mode === 'first_only' ? isFirst : mode === 'last_only' ? isLast : (isFirst || isLast);
      if (!isOk) {
        if (r.importance === 'strict') return false;
      }
    }
  }

  // 8. Relationship Constraint 4: Сонгосон хичээл зөвхөн боломжтой цаг дээр хуваарилах (allowed_periods_only)
  for (const r of relationships) {
    if (!r.isActive || r.condition !== 'allowed_periods_only') continue;
    if (r.classIds && r.classIds.length > 0 && !r.classIds.includes(card.classId)) continue;

    if (r.subjectIds.includes(card.subjectId) && r.allowedPeriods && r.allowedPeriods.length > 0) {
      if (!r.allowedPeriods.includes(period)) {
        if (r.importance === 'strict') return false;
      }
    }
  }

  // 9. Relationship Constraint 5: Өдөрт заах цагийн хамгийн их/бага хязгаар (daily_hours_limit)
  for (const r of relationships) {
    if (!r.isActive || r.condition !== 'daily_hours_limit') continue;
    const maxPerDay = r.maxPeriodsPerDay || 6;

    if (r.targetEntity === 'classes') {
      if (!r.classIds || r.classIds.length === 0 || r.classIds.includes(card.classId)) {
        const classDayCards = currentScheduledCards.filter(
          (c) => c.classId === card.classId && c.dayIndex === day
        );
        if (classDayCards.length >= maxPerDay) {
          if (r.importance === 'strict') return false;
        }
      }
    } else {
      // default: teachers
      if (!r.teacherIds || r.teacherIds.length === 0 || r.teacherIds.includes(card.teacherId)) {
        const teacherDayCards = currentScheduledCards.filter(
          (c) => c.teacherId === card.teacherId && c.dayIndex === day
        );
        if (teacherDayCards.length >= maxPerDay) {
          if (r.importance === 'strict') return false;
        }
      }
    }
  }

  // 10. Relationship Constraint 6: Дараалласан цагийн хамгийн их хязгаар (max_consecutive_periods)
  for (const r of relationships) {
    if (!r.isActive || r.condition !== 'max_consecutive_periods') continue;
    const maxConsec = r.maxConsecutive || 3;

    if (r.targetEntity === 'classes') {
      if (!r.classIds || r.classIds.length === 0 || r.classIds.includes(card.classId)) {
        const occupiedPeriods = new Set(
          currentScheduledCards
            .filter((c) => c.classId === card.classId && c.dayIndex === day)
            .map((c) => c.periodIndex)
        );
        occupiedPeriods.add(period);
        if (card.isDouble) occupiedPeriods.add(period + 1);

        // Check if there is a consecutive sequence longer than maxConsec
        let consecutive = 0;
        for (let p = 0; p < periodsCount; p++) {
          if (occupiedPeriods.has(p)) {
            consecutive++;
            if (consecutive > maxConsec) {
              if (r.importance === 'strict') return false;
            }
          } else {
            consecutive = 0;
          }
        }
      }
    } else {
      // default: teachers
      if (!r.teacherIds || r.teacherIds.length === 0 || r.teacherIds.includes(card.teacherId)) {
        const occupiedPeriods = new Set(
          currentScheduledCards
            .filter((c) => c.teacherId === card.teacherId && c.dayIndex === day)
            .map((c) => c.periodIndex)
        );
        occupiedPeriods.add(period);
        if (card.isDouble) occupiedPeriods.add(period + 1);

        let consecutive = 0;
        for (let p = 0; p < periodsCount; p++) {
          if (occupiedPeriods.has(p)) {
            consecutive++;
            if (consecutive > maxConsec) {
              if (r.importance === 'strict') return false;
            }
          } else {
            consecutive = 0;
          }
        }
      }
    }
  }

  // 11. Relationship Constraint 7: 1 багш 1 анги бүлэгт өдөрт 1-с илүүгүй удаа орох (teacher_max_once_per_day)
  const activeDailyRule = relationships.find(
    (r) =>
      r.isActive &&
      r.condition === 'teacher_max_once_per_day' &&
      (!r.teacherIds || r.teacherIds.length === 0 || r.teacherIds.includes(card.teacherId)) &&
      (!r.classIds || r.classIds.length === 0 || r.classIds.includes(card.classId))
  );

  if (activeDailyRule) {
    const teacherClassCardsOnDay = currentScheduledCards.filter(
      (c) => c.teacherId === card.teacherId && c.classId === card.classId && c.dayIndex === day
    );

    if (teacherClassCardsOnDay.length > 0) {
      const isConsecutive = teacherClassCardsOnDay.some(
        (c) => Math.abs(c.periodIndex - period) === 1
      );

      if (activeDailyRule.allowDoubleConsecutive !== false && isConsecutive) {
        // permitted as continuation of double lesson
      } else {
        if (activeDailyRule.importance === 'strict') {
          return false;
        }
      }
    }
  }

  // 12. Relationship Constraint 10: Өдрийн болон 7 хоногийн цонхтой цагийн дээд хязгаар (max_gaps_daily_weekly)
  for (const r of relationships) {
    if (!r.isActive || r.condition !== 'max_gaps_daily_weekly') continue;
    const maxDayGaps = r.maxGapsPerDay ?? 1;

    if (r.targetEntity === 'classes') {
      if (!r.classIds || r.classIds.length === 0 || r.classIds.includes(card.classId)) {
        const classPeriods = currentScheduledCards
          .filter((c) => c.classId === card.classId && c.dayIndex === day)
          .map((c) => c.periodIndex);
        classPeriods.push(period);
        if (card.isDouble) classPeriods.push(period + 1);

        if (classPeriods.length >= 2) {
          const minP = Math.min(...classPeriods);
          const maxP = Math.max(...classPeriods);
          const distinctP = new Set(classPeriods);
          const dailyGaps = maxP - minP + 1 - distinctP.size;
          if (dailyGaps > maxDayGaps && r.importance === 'strict') {
            return false;
          }
        }
      }
    } else {
      // Teachers
      if (!r.teacherIds || r.teacherIds.length === 0 || r.teacherIds.includes(card.teacherId)) {
        const teacherPeriods = currentScheduledCards
          .filter((c) => c.teacherId === card.teacherId && c.dayIndex === day)
          .map((c) => c.periodIndex);
        teacherPeriods.push(period);
        if (card.isDouble) teacherPeriods.push(period + 1);

        if (teacherPeriods.length >= 2) {
          const minP = Math.min(...teacherPeriods);
          const maxP = Math.max(...teacherPeriods);
          const distinctP = new Set(teacherPeriods);
          const dailyGaps = maxP - minP + 1 - distinctP.size;
          if (dailyGaps > maxDayGaps && r.importance === 'strict') {
            return false;
          }
        }
      }
    }
  }

  // 13. Relationship Constraint 11: 7 хоногт хичээл заах өдрийн дээд /доод хязгаар (teaching_days_limit)
  for (const r of relationships) {
    if (!r.isActive || r.condition !== 'teaching_days_limit') continue;
    const maxDays = r.maxDaysPerWeek ?? 5;

    if (r.targetEntity === 'classes') {
      if (!r.classIds || r.classIds.length === 0 || r.classIds.includes(card.classId)) {
        const distinctDays = new Set(
          currentScheduledCards.filter((c) => c.classId === card.classId).map((c) => c.dayIndex)
        );
        if (!distinctDays.has(day) && distinctDays.size >= maxDays) {
          if (r.importance === 'strict') return false;
        }
      }
    } else {
      if (!r.teacherIds || r.teacherIds.length === 0 || r.teacherIds.includes(card.teacherId)) {
        const distinctDays = new Set(
          currentScheduledCards.filter((c) => c.teacherId === card.teacherId).map((c) => c.dayIndex)
        );
        if (!distinctDays.has(day) && distinctDays.size >= maxDays) {
          if (r.importance === 'strict') return false;
        }
      }
    }
  }

  // 14. Relationship Constraint 12: 2 буюу 3 ээлж дамжих цонхыг бага байлгах (minimize_shift_crossing_gap)
  for (const r of relationships) {
    if (!r.isActive || r.condition !== 'minimize_shift_crossing_gap') continue;
    if (r.teacherIds && r.teacherIds.length > 0 && !r.teacherIds.includes(card.teacherId)) continue;
    const maxCrossGap = r.maxCrossShiftGap ?? 1;

    const teacherDayCards = currentScheduledCards.filter(
      (c) => c.teacherId === card.teacherId && c.dayIndex === day
    );

    const shift1Cards = teacherDayCards.filter((c) => c.shift === 1);
    const shift2Cards = teacherDayCards.filter((c) => c.shift === 2);
    const s1Config = settings.shifts.find((s) => s.shiftNumber === 1);
    const s1Periods = s1Config?.periodsCount || 6;

    if (card.shift === 2 && shift1Cards.length > 0) {
      const maxP1 = Math.max(...shift1Cards.map((c) => c.periodIndex));
      const crossGap = (s1Periods - 1 - maxP1) + period;
      if (crossGap > maxCrossGap && r.importance === 'strict') {
        return false;
      }
    } else if (card.shift === 1 && shift2Cards.length > 0) {
      const minP2 = Math.min(...shift2Cards.map((c) => c.periodIndex));
      const myP = card.isDouble ? period + 1 : period;
      const crossGap = (s1Periods - 1 - myP) + minP2;
      if (crossGap > maxCrossGap && r.importance === 'strict') {
        return false;
      }
    }
  }

  return true;
}

/**
 * Main Timetable Generator
 */
export async function generateTimetable(
  subjects: Subject[],
  teachers: Teacher[],
  classes: ClassGroup[],
  classrooms: Classroom[],
  contracts: LessonContract[],
  relationships: CardRelationship[],
  settings: SchoolSettings,
  existingCards: ScheduledCard[] = [],
  onProgress?: (progress: number, message: string) => void
): Promise<{
  scheduledCards: ScheduledCard[];
  stats: GenerationStats;
  conflicts: ConflictIssue[];
}> {
  const startTime = Date.now();
  const { cardsToPlace, lockedCards } = expandContractsToCards(contracts, classes, existingCards);

  const teacherSchedule = new Map<string, Set<string>>();
  const roomSchedule = new Map<string, Set<string>>();
  const classSchedule = new Map<string, ClassSlotState>();

  const resultCards: ScheduledCard[] = [...lockedCards];

  const recordSlotUsage = (
    classId: string,
    teacherId: string,
    shift: number,
    day: number,
    period: number,
    subgroupName?: string,
    classroomId?: string
  ) => {
    const classKey = `${classId}_${day}_${period}`;
    const teacherKey = `${shift}_${day}_${period}`;
    const roomKey = `${shift}_${day}_${period}`;

    // Teacher
    if (!teacherSchedule.has(teacherId)) teacherSchedule.set(teacherId, new Set());
    teacherSchedule.get(teacherId)!.add(teacherKey);

    // Class
    let clsState = classSchedule.get(classKey);
    if (!clsState) {
      clsState = { hasWholeClass: false, subgroups: new Set() };
      classSchedule.set(classKey, clsState);
    }
    if (subgroupName) {
      clsState.subgroups.add(subgroupName);
    } else {
      clsState.hasWholeClass = true;
    }

    // Room
    if (classroomId) {
      if (!roomSchedule.has(classroomId)) roomSchedule.set(classroomId, new Set());
      roomSchedule.get(classroomId)!.add(roomKey);
    }
  };

  // Populate locked usage
  for (const card of lockedCards) {
    recordSlotUsage(
      card.classId,
      card.teacherId,
      card.shift,
      card.dayIndex,
      card.periodIndex,
      card.subgroupName,
      card.classroomId
    );
  }

  // Pre-process bundles:
  const crossSubgroupRules = relationships.filter(
    (r) =>
      r.isActive &&
      r.condition === 'different_subjects_subgroups_simultaneous' &&
      r.parallelPairs &&
      r.parallelPairs.length >= 2
  );

  const sameSubgroupRules = relationships.filter(
    (r) => r.isActive && r.condition === 'same_subject_subgroups_simultaneous'
  );

  const parallelBundles: CardToPlace[][] = [];
  const processedCardIds = new Set<string>();

  // A) Form cross-subject parallel bundles (Rule 2b)
  for (const rule of crossSubgroupRules) {
    const targetClasses =
      rule.classIds && rule.classIds.length > 0
        ? classes.filter((c) => rule.classIds.includes(c.id))
        : classes;

    for (const cls of targetClasses) {
      const pair1 = rule.parallelPairs![0];
      const pair2 = rule.parallelPairs![1];

      const cards1 = cardsToPlace.filter(
        (c) =>
          !processedCardIds.has(c.id) &&
          c.classId === cls.id &&
          c.subjectId === pair1.subjectId &&
          (!pair1.subgroupName || c.subgroupName === pair1.subgroupName)
      );
      const cards2 = cardsToPlace.filter(
        (c) =>
          !processedCardIds.has(c.id) &&
          c.classId === cls.id &&
          c.subjectId === pair2.subjectId &&
          (!pair2.subgroupName || c.subgroupName === pair2.subgroupName)
      );

      const minLen = Math.min(cards1.length, cards2.length);
      for (let i = 0; i < minLen; i++) {
        const c1 = cards1[i];
        const c2 = cards2[i];
        parallelBundles.push([c1, c2]);
        processedCardIds.add(c1.id);
        processedCardIds.add(c2.id);
      }
    }
  }

  // B) Form same-subject parallel bundles (Rule 2a)
  for (const cls of classes) {
    for (const sub of subjects) {
      const isRuleActive =
        sameSubgroupRules.length === 0 ||
        sameSubgroupRules.some(
          (r) =>
            (!r.classIds || r.classIds.length === 0 || r.classIds.includes(cls.id)) &&
            (!r.subjectIds || r.subjectIds.length === 0 || r.subjectIds.includes(sub.id))
        );

      if (isRuleActive) {
        const subCards = cardsToPlace.filter(
          (c) =>
            !processedCardIds.has(c.id) &&
            c.classId === cls.id &&
            c.subjectId === sub.id &&
            Boolean(c.subgroupName)
        );

        if (subCards.length >= 2) {
          const groupMap = new Map<string, CardToPlace[]>();
          for (const c of subCards) {
            const sg = c.subgroupName!;
            if (!groupMap.has(sg)) groupMap.set(sg, []);
            groupMap.get(sg)!.push(c);
          }

          const distinctGroups = Array.from(groupMap.keys());
          if (distinctGroups.length >= 2) {
            const minCount = Math.min(
              ...distinctGroups.map((g) => groupMap.get(g)!.length)
            );
            for (let i = 0; i < minCount; i++) {
              const bundle: CardToPlace[] = [];
              for (const g of distinctGroups) {
                const card = groupMap.get(g)![i];
                bundle.push(card);
                processedCardIds.add(card.id);
              }
              parallelBundles.push(bundle);
            }
          }
        }
      }
    }
  }

  // C) Double pairs
  const doublePairs: { card1: CardToPlace; card2: CardToPlace }[] = [];
  const singleCards: CardToPlace[] = [];

  for (const card of cardsToPlace) {
    if (processedCardIds.has(card.id)) continue;

    if (card.isDouble && card.partnerCardId) {
      const partner = cardsToPlace.find(
        (c) => c.id === card.partnerCardId && !processedCardIds.has(c.id)
      );
      if (partner) {
        doublePairs.push({ card1: card, card2: partner });
        processedCardIds.add(card.id);
        processedCardIds.add(partner.id);
      } else {
        singleCards.push(card);
      }
    } else {
      singleCards.push(card);
    }
  }

  // --- Step 1: Place Parallel Subgroup Bundles ---
  onProgress?.(10, 'Зэрэгцээ дэд бүлгүүдийн хичээлүүдийг ижил цагт хуваарилж байна...');

  for (const bundle of parallelBundles) {
    const shiftConf =
      settings.shifts.find((s) => s.shiftNumber === bundle[0].shift) || settings.shifts[0];
    const periodsCount = shiftConf?.periodsCount || 6;

    const candidates: { day: number; period: number; penalty: number }[] = [];

    for (let day = 0; day < settings.daysPerWeek; day++) {
      for (let period = 0; period < periodsCount; period++) {
        let allValid = true;
        for (const bCard of bundle) {
          if (
            !isValidPlacement(
              bCard,
              day,
              period,
              classes,
              teachers,
              subjects,
              classrooms,
              settings,
              teacherSchedule,
              roomSchedule,
              classSchedule,
              relationships,
              resultCards
            )
          ) {
            allValid = false;
            break;
          }
        }

        if (allValid) {
          const penalty = Math.abs(period - 2.5) * 5;
          candidates.push({ day, period, penalty });
        }
      }
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => a.penalty - b.penalty);
      const best = candidates[0];

      for (const bCard of bundle) {
        recordSlotUsage(
          bCard.classId,
          bCard.teacherId,
          bCard.shift,
          best.day,
          best.period,
          bCard.subgroupName,
          bCard.classroomId
        );

        resultCards.push({
          id: bCard.id,
          contractId: bCard.contractId,
          subjectId: bCard.subjectId,
          teacherId: bCard.teacherId,
          classId: bCard.classId,
          subgroupName: bCard.subgroupName,
          classroomId: bCard.classroomId,
          shift: bCard.shift,
          weekCycle: bCard.weekCycle,
          dayIndex: best.day,
          periodIndex: best.period,
        });
      }
    }
  }

  // --- Step 2: Place Double Pairs ---
  onProgress?.(35, 'Хос цагийн хичээлүүдийг байршуулж байна...');

  for (let idx = 0; idx < doublePairs.length; idx++) {
    const { card1, card2 } = doublePairs[idx];
    const shiftConf =
      settings.shifts.find((s) => s.shiftNumber === card1.shift) || settings.shifts[0];
    const periodsCount = shiftConf?.periodsCount || 6;

    const candidates: { day: number; period: number; penalty: number }[] = [];

    for (let day = 0; day < settings.daysPerWeek; day++) {
      for (let period = 0; period < periodsCount - 1; period++) {
        const v1 = isValidPlacement(
          card1,
          day,
          period,
          classes,
          teachers,
          subjects,
          classrooms,
          settings,
          teacherSchedule,
          roomSchedule,
          classSchedule,
          relationships,
          resultCards
        );
        const v2 = isValidPlacement(
          card2,
          day,
          period + 1,
          classes,
          teachers,
          subjects,
          classrooms,
          settings,
          teacherSchedule,
          roomSchedule,
          classSchedule,
          relationships,
          resultCards
        );

        if (v1 && v2) {
          candidates.push({ day, period, penalty: period * 2 });
        }
      }
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => a.penalty - b.penalty);
      const best = candidates[0];

      recordSlotUsage(
        card1.classId,
        card1.teacherId,
        card1.shift,
        best.day,
        best.period,
        card1.subgroupName,
        card1.classroomId
      );
      recordSlotUsage(
        card2.classId,
        card2.teacherId,
        card2.shift,
        best.day,
        best.period + 1,
        card2.subgroupName,
        card2.classroomId
      );

      resultCards.push({
        id: card1.id,
        contractId: card1.contractId,
        subjectId: card1.subjectId,
        teacherId: card1.teacherId,
        classId: card1.classId,
        subgroupName: card1.subgroupName,
        classroomId: card1.classroomId,
        shift: card1.shift,
        weekCycle: card1.weekCycle,
        dayIndex: best.day,
        periodIndex: best.period,
        isDoublePart: 'first',
        linkedCardId: card2.id,
      });

      resultCards.push({
        id: card2.id,
        contractId: card2.contractId,
        subjectId: card2.subjectId,
        teacherId: card2.teacherId,
        classId: card2.classId,
        subgroupName: card2.subgroupName,
        classroomId: card2.classroomId,
        shift: card2.shift,
        weekCycle: card2.weekCycle,
        dayIndex: best.day,
        periodIndex: best.period + 1,
        isDoublePart: 'second',
        linkedCardId: card1.id,
      });
    }
  }

  // --- Step 3: Place Single Cards ---
  onProgress?.(65, 'Дан хичээлүүдийг хуваарилж байна...');

  for (let i = 0; i < singleCards.length; i++) {
    const card = singleCards[i];
    const shiftConf =
      settings.shifts.find((s) => s.shiftNumber === card.shift) || settings.shifts[0];
    const periodsCount = shiftConf?.periodsCount || 6;

    const candidates: { day: number; period: number; penalty: number }[] = [];

    for (let day = 0; day < settings.daysPerWeek; day++) {
      for (let period = 0; period < periodsCount; period++) {
        if (
          isValidPlacement(
            card,
            day,
            period,
            classes,
            teachers,
            subjects,
            classrooms,
            settings,
            teacherSchedule,
            roomSchedule,
            classSchedule,
            relationships,
            resultCards
          )
        ) {
          let penalty = 0;

          // Subject spread
          const alreadyHasSubjectOnDay = resultCards.some(
            (rc) =>
              rc.classId === card.classId &&
              rc.subjectId === card.subjectId &&
              rc.dayIndex === day
          );
          if (alreadyHasSubjectOnDay) penalty += 100;

          // Prefer morning for math
          const sub = subjects.find((s) => s.id === card.subjectId);
          if (sub?.shortName === 'Мат' && period <= 2) penalty -= 20;

          candidates.push({ day, period, penalty });
        }
      }
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => a.penalty - b.penalty);
      const best = candidates[0];

      recordSlotUsage(
        card.classId,
        card.teacherId,
        card.shift,
        best.day,
        best.period,
        card.subgroupName,
        card.classroomId
      );

      resultCards.push({
        id: card.id,
        contractId: card.contractId,
        subjectId: card.subjectId,
        teacherId: card.teacherId,
        classId: card.classId,
        subgroupName: card.subgroupName,
        classroomId: card.classroomId,
        shift: card.shift,
        weekCycle: card.weekCycle,
        dayIndex: best.day,
        periodIndex: best.period,
      });
    }
  }

  onProgress?.(90, 'Зөрчил, хамаарлууд болон бүх дүрмүүдийг шалгаж байна...');
  const conflicts = verifyTimetable(
    resultCards,
    subjects,
    teachers,
    classes,
    classrooms,
    settings,
    relationships
  );

  const hardConflicts = conflicts.filter((c) => c.severity === 'error').length;
  const softConflicts = conflicts.filter((c) => c.severity === 'warning').length;

  onProgress?.(100, 'Амжилттай дууслаа!');

  const generationTimeMs = Date.now() - startTime;
  const totalCardsCount = cardsToPlace.length + lockedCards.length;
  const placedPercentage =
    totalCardsCount > 0 ? (resultCards.length / totalCardsCount) * 100 : 100;
  const fitnessScore = Math.max(
    0,
    Math.round(placedPercentage - hardConflicts * 20 - softConflicts * 2)
  );

  return {
    scheduledCards: resultCards,
    stats: {
      totalCards: totalCardsCount,
      placedCards: resultCards.length,
      unplacedCards: totalCardsCount - resultCards.length,
      hardConflicts,
      softConflicts,
      generationTimeMs,
      fitnessScore,
    },
    conflicts,
  };
}

/**
 * Verification Engine
 */
export function verifyTimetable(
  cards: ScheduledCard[],
  subjects: Subject[],
  teachers: Teacher[],
  classes: ClassGroup[],
  classrooms: Classroom[],
  settings: SchoolSettings,
  relationships: CardRelationship[] = []
): ConflictIssue[] {
  const issues: ConflictIssue[] = [];

  const teacherSlots = new Map<string, ScheduledCard[]>();
  const classSlots = new Map<string, ScheduledCard[]>();
  const roomSlots = new Map<string, ScheduledCard[]>();

  for (const card of cards) {
    const classSlotKey = `${card.classId}_${card.dayIndex}_${card.periodIndex}`;
    const teacherSlotKey = `${card.teacherId}_${card.shift}_${card.dayIndex}_${card.periodIndex}`;

    // Teacher check
    if (!teacherSlots.has(teacherSlotKey)) teacherSlots.set(teacherSlotKey, []);
    teacherSlots.get(teacherSlotKey)!.push(card);

    // Class check
    if (!classSlots.has(classSlotKey)) classSlots.set(classSlotKey, []);
    classSlots.get(classSlotKey)!.push(card);

    // Room check
    if (card.classroomId) {
      const room = classrooms.find((r) => r.id === card.classroomId);
      if (room && !room.isShared) {
        const roomKey = `${card.classroomId}_${card.shift}_${card.dayIndex}_${card.periodIndex}`;
        if (!roomSlots.has(roomKey)) roomSlots.set(roomKey, []);
        roomSlots.get(roomKey)!.push(card);
      }
    }
  }

  // 1. Teacher clashes
  for (const [, group] of teacherSlots.entries()) {
    if (group.length > 1) {
      const hasConflict = group.some((c1, i) =>
        group.some((c2, j) => {
          if (i === j) return false;
          if (c1.weekCycle === 'week_a' && c2.weekCycle === 'week_b') return false;
          if (c1.weekCycle === 'week_b' && c2.weekCycle === 'week_a') return false;
          return true;
        })
      );

      if (hasConflict) {
        const teacher = teachers.find((t) => t.id === group[0].teacherId);
        const dayName = settings.dayNames[group[0].dayIndex] || `${group[0].dayIndex + 1}-р өдөр`;
        issues.push({
          id: `clash_t_${group[0].id}`,
          type: 'clash_teacher',
          severity: 'error',
          title: 'Багшийн цагийн давхардал',
          description: `${teacher?.name || 'Багш'} ${dayName} гарагийн ${
            group[0].periodIndex + 1
          }-р цагт (${group[0].shift}-р ээлж) олон ангид зэрэг орохоор байна.`,
          dayIndex: group[0].dayIndex,
          periodIndex: group[0].periodIndex,
          shift: group[0].shift,
          entityType: 'teacher',
          entityId: group[0].teacherId,
        });
      }
    }
  }

  // 2. Class clashes (with subgroup support)
  for (const [, group] of classSlots.entries()) {
    if (group.length > 1) {
      const sameWeekCards = group.filter((c1, i) =>
        group.some((c2, j) => {
          if (i === j) return false;
          if (c1.weekCycle === 'week_a' && c2.weekCycle === 'week_b') return false;
          if (c1.weekCycle === 'week_b' && c2.weekCycle === 'week_a') return false;
          return true;
        })
      );

      if (sameWeekCards.length > 1) {
        const subgroups = sameWeekCards.map((c) => c.subgroupName?.trim());
        const hasWholeClassLesson = subgroups.some((s) => !s);
        const uniqueSubgroups = new Set(subgroups);
        const hasDuplicateSubgroups = subgroups.length !== uniqueSubgroups.size;

        if (hasWholeClassLesson || hasDuplicateSubgroups) {
          const cls = classes.find((c) => c.id === group[0].classId);
          const dayName = settings.dayNames[group[0].dayIndex] || `${group[0].dayIndex + 1}-р өдөр`;
          issues.push({
            id: `clash_c_${group[0].id}`,
            type: 'clash_class',
            severity: 'error',
            title: 'Ангийн хичээлийн давхардал',
            description: `${cls?.name || 'Анги'} ${dayName} гарагийн ${
              group[0].periodIndex + 1
            }-р цагт нэгэн зэрэг давхардсан хичээл тавигдсан байна.`,
            dayIndex: group[0].dayIndex,
            periodIndex: group[0].periodIndex,
            entityType: 'class',
            entityId: group[0].classId,
          });
        }
      }
    }
  }

  // 3. Rule 1: 2 хичээл нэг өдөрт орохгүй (cannot_same_day)
  for (const r of relationships) {
    if (!r.isActive || r.condition !== 'cannot_same_day' || r.subjectIds.length < 2) continue;
    const targetClasses =
      r.classIds && r.classIds.length > 0
        ? classes.filter((c) => r.classIds.includes(c.id))
        : classes;

    for (const cls of targetClasses) {
      for (let d = 0; d < settings.daysPerWeek; d++) {
        const dayCards = cards.filter((c) => c.classId === cls.id && c.dayIndex === d);
        const presentSubjects = Array.from(
          new Set(
            dayCards.map((c) => c.subjectId).filter((sId) => r.subjectIds.includes(sId))
          )
        );

        if (presentSubjects.length >= 2) {
          const names = presentSubjects
            .map((sId) => subjects.find((s) => s.id === sId)?.name || sId)
            .join(', ');
          const dayName = settings.dayNames[d] || `${d + 1}-р өдөр`;
          issues.push({
            id: `rule_same_day_${cls.id}_${d}`,
            type: 'custom_constraint',
            severity: r.importance === 'strict' ? 'error' : 'warning',
            title: '2 хичээл нэг өдөрт орсон байна',
            description: `${cls.name} ангид ${dayName} гарагт ${names} хичээлүүд нэг өдөр зэрэг тавигдсан байна. (Дүрэм: 2 хичээл нэг өдөрт орохгүй)`,
            dayIndex: d,
            entityType: 'class',
            entityId: cls.id,
          });
        }
      }
    }
  }

  // 4. Rule 2: 2 хичээл дараалласан цагт орохгүй (cannot_consecutive)
  for (const r of relationships) {
    if (!r.isActive || r.condition !== 'cannot_consecutive' || r.subjectIds.length < 2) continue;
    const targetClasses =
      r.classIds && r.classIds.length > 0
        ? classes.filter((c) => r.classIds.includes(c.id))
        : classes;

    for (const cls of targetClasses) {
      for (let d = 0; d < settings.daysPerWeek; d++) {
        const dayCards = cards.filter((c) => c.classId === cls.id && c.dayIndex === d);
        for (const c1 of dayCards) {
          if (!r.subjectIds.includes(c1.subjectId)) continue;
          const otherSubjects = r.subjectIds.filter((sId) => sId !== c1.subjectId);

          const consecutiveCard = dayCards.find(
            (c2) =>
              c2.periodIndex === c1.periodIndex + 1 && otherSubjects.includes(c2.subjectId)
          );

          if (consecutiveCard) {
            const s1Name = subjects.find((s) => s.id === c1.subjectId)?.name || c1.subjectId;
            const s2Name =
              subjects.find((s) => s.id === consecutiveCard.subjectId)?.name ||
              consecutiveCard.subjectId;
            const dayName = settings.dayNames[d] || `${d + 1}-р өдөр`;

            issues.push({
              id: `rule_consec_${cls.id}_${d}_${c1.periodIndex}`,
              type: 'custom_constraint',
              severity: r.importance === 'strict' ? 'error' : 'warning',
              title: '2 хичээл дараалласан цагт орсон байна',
              description: `${cls.name} ангид ${dayName} гарагийн ${c1.periodIndex + 1} ба ${
                c1.periodIndex + 2
              }-р цагт ${s1Name} ба ${s2Name} дараалан тавигдсан байна. (Дүрэм: 2 хичээл дараалласан цагт орохгүй)`,
              dayIndex: d,
              periodIndex: c1.periodIndex,
              entityType: 'class',
              entityId: cls.id,
            });
          }
        }
      }
    }
  }

  // 5. Rule 3: Сонгосон хичээл эхний юм уу сүүлийн цагт орох (first_or_last)
  for (const r of relationships) {
    if (!r.isActive || r.condition !== 'first_or_last') continue;
    const targetClasses =
      r.classIds && r.classIds.length > 0
        ? classes.filter((c) => r.classIds.includes(c.id))
        : classes;

    for (const cls of targetClasses) {
      const shiftConf =
        settings.shifts.find((s) => s.shiftNumber === cls.shift) || settings.shifts[0];
      const periodsCount = shiftConf?.periodsCount || 6;

      const matchCards = cards.filter(
        (c) => c.classId === cls.id && r.subjectIds.includes(c.subjectId)
      );

      for (const card of matchCards) {
        const mode = r.firstOrLastMode || 'first_or_last';
        const isFirst = card.periodIndex === 0;
        const isLast =
          card.periodIndex === periodsCount - 1 ||
          (card.isDoublePart === 'first' && card.periodIndex === periodsCount - 2);

        const isOk = mode === 'first_only' ? isFirst : mode === 'last_only' ? isLast : (isFirst || isLast);

        if (!isOk) {
          const sub = subjects.find((s) => s.id === card.subjectId);
          const dayName = settings.dayNames[card.dayIndex] || `${card.dayIndex + 1}-р өдөр`;
          const modeLabel =
            mode === 'first_only'
              ? 'Зөвхөн 1-р цагт'
              : mode === 'last_only'
              ? 'Зөвхөн сүүлчийн цагт'
              : '1-р эсвэл сүүлчийн цагт';

          issues.push({
            id: `rule_first_last_${card.id}`,
            type: 'custom_constraint',
            severity: r.importance === 'strict' ? 'error' : 'warning',
            title: 'Эхний эсвэл сүүлчийн цагт ороогүй байна',
            description: `${cls.name} ангийн ${sub?.name || 'Хичээл'} ${dayName} гарагийн ${
              card.periodIndex + 1
            }-р цагт тавигдсан байна. (Дүрэм: ${modeLabel} орох)`,
            dayIndex: card.dayIndex,
            periodIndex: card.periodIndex,
            entityType: 'class',
            entityId: cls.id,
          });
        }
      }
    }
  }

  // 6. Rule 4: Сонгосон хичээл зөвхөн боломжтой цаг дээр хуваарилах (allowed_periods_only)
  for (const r of relationships) {
    if (
      !r.isActive ||
      r.condition !== 'allowed_periods_only' ||
      !r.allowedPeriods ||
      r.allowedPeriods.length === 0
    )
      continue;

    const targetClasses =
      r.classIds && r.classIds.length > 0
        ? classes.filter((c) => r.classIds.includes(c.id))
        : classes;

    for (const cls of targetClasses) {
      const matchCards = cards.filter(
        (c) => c.classId === cls.id && r.subjectIds.includes(c.subjectId)
      );

      for (const card of matchCards) {
        if (!r.allowedPeriods.includes(card.periodIndex)) {
          const sub = subjects.find((s) => s.id === card.subjectId);
          const dayName = settings.dayNames[card.dayIndex] || `${card.dayIndex + 1}-р өдөр`;
          const allowedNames = r.allowedPeriods.map((p) => p + 1).join(', ');

          issues.push({
            id: `rule_allowed_p_${card.id}`,
            type: 'custom_constraint',
            severity: r.importance === 'strict' ? 'error' : 'warning',
            title: 'Хичээл зөвшөөрөгдөөгүй цагт тавигдсан байна',
            description: `${cls.name} ангийн ${sub?.name || 'Хичээл'} ${dayName} гарагийн ${
              card.periodIndex + 1
            }-р цагт орсон байна. (Зөвшөөрөгдөх цагууд: ${allowedNames}-р цаг)`,
            dayIndex: card.dayIndex,
            periodIndex: card.periodIndex,
            entityType: 'class',
            entityId: cls.id,
          });
        }
      }
    }
  }

  // 7. Rule 5: Өдөрт заах цагийн хамгийн их/бага хязгаар (daily_hours_limit)
  for (const r of relationships) {
    if (!r.isActive || r.condition !== 'daily_hours_limit') continue;
    const minP = r.minPeriodsPerDay ?? 2;
    const maxP = r.maxPeriodsPerDay ?? 5;

    if (r.targetEntity === 'classes') {
      const targetClasses =
        r.classIds && r.classIds.length > 0
          ? classes.filter((c) => r.classIds.includes(c.id))
          : classes;

      for (const cls of targetClasses) {
        for (let d = 0; d < settings.daysPerWeek; d++) {
          const count = cards.filter((c) => c.classId === cls.id && c.dayIndex === d).length;
          if (count > maxP || (count > 0 && count < minP)) {
            const dayName = settings.dayNames[d] || `${d + 1}-р өдөр`;
            issues.push({
              id: `rule_daily_hrs_c_${cls.id}_${d}`,
              type: 'custom_constraint',
              severity: r.importance === 'strict' ? 'error' : 'warning',
              title: 'Ангийн өдрийн цагийн хязгаар зөрчигдсөн',
              description: `${cls.name} анги ${dayName} гарагт нийт ${count} цаг орж байна. (Зөвшөөрөгдөх: ${minP}-${maxP} цаг)`,
              dayIndex: d,
              entityType: 'class',
              entityId: cls.id,
            });
          }
        }
      }
    } else {
      // Teachers
      const targetTeachers =
        r.teacherIds && r.teacherIds.length > 0
          ? teachers.filter((t) => r.teacherIds!.includes(t.id))
          : teachers;

      for (const t of targetTeachers) {
        for (let d = 0; d < settings.daysPerWeek; d++) {
          const count = cards.filter((c) => c.teacherId === t.id && c.dayIndex === d).length;
          if (count > maxP || (count > 0 && count < minP)) {
            const dayName = settings.dayNames[d] || `${d + 1}-р өдөр`;
            issues.push({
              id: `rule_daily_hrs_t_${t.id}_${d}`,
              type: 'custom_constraint',
              severity: r.importance === 'strict' ? 'error' : 'warning',
              title: 'Багшийн өдөрт заах цагийн хязгаар зөрчигдсөн',
              description: `${t.name} багш ${dayName} гарагт нийт ${count} цаг орж байна. (Зөвшөөрөгдөх: ${minP}-${maxP} цаг)`,
              dayIndex: d,
              entityType: 'teacher',
              entityId: t.id,
            });
          }
        }
      }
    }
  }

  // 8. Rule 6: Дараалласан цагийн хамгийн их хязгаар (max_consecutive_periods)
  for (const r of relationships) {
    if (!r.isActive || r.condition !== 'max_consecutive_periods') continue;
    const maxConsec = r.maxConsecutive ?? 3;

    if (r.targetEntity === 'classes') {
      const targetClasses =
        r.classIds && r.classIds.length > 0
          ? classes.filter((c) => r.classIds.includes(c.id))
          : classes;

      for (const cls of targetClasses) {
        for (let d = 0; d < settings.daysPerWeek; d++) {
          const periods = cards
            .filter((c) => c.classId === cls.id && c.dayIndex === d)
            .map((c) => c.periodIndex)
            .sort((a, b) => a - b);

          let consec = 1;
          for (let i = 1; i < periods.length; i++) {
            if (periods[i] === periods[i - 1] + 1) {
              consec++;
              if (consec > maxConsec) {
                const dayName = settings.dayNames[d] || `${d + 1}-р өдөр`;
                issues.push({
                  id: `rule_consec_c_${cls.id}_${d}_${i}`,
                  type: 'custom_constraint',
                  severity: r.importance === 'strict' ? 'error' : 'warning',
                  title: 'Ангийн дараалласан цагийн хязгаар хэтэрсэн',
                  description: `${cls.name} анги ${dayName} гарагт завсаргүй ${consec} цаг дараалан хичээлтэй байна. (Дээд хязгаар: ${maxConsec} цаг)`,
                  dayIndex: d,
                  entityType: 'class',
                  entityId: cls.id,
                });
                break;
              }
            } else if (periods[i] > periods[i - 1] + 1) {
              consec = 1;
            }
          }
        }
      }
    } else {
      // Teachers
      const targetTeachers =
        r.teacherIds && r.teacherIds.length > 0
          ? teachers.filter((t) => r.teacherIds!.includes(t.id))
          : teachers;

      for (const t of targetTeachers) {
        for (let d = 0; d < settings.daysPerWeek; d++) {
          const periods = cards
            .filter((c) => c.teacherId === t.id && c.dayIndex === d)
            .map((c) => c.periodIndex)
            .sort((a, b) => a - b);

          let consec = 1;
          for (let i = 1; i < periods.length; i++) {
            if (periods[i] === periods[i - 1] + 1) {
              consec++;
              if (consec > maxConsec) {
                const dayName = settings.dayNames[d] || `${d + 1}-р өдөр`;
                issues.push({
                  id: `rule_consec_t_${t.id}_${d}_${i}`,
                  type: 'custom_constraint',
                  severity: r.importance === 'strict' ? 'error' : 'warning',
                  title: 'Багшийн дараалласан цагийн хязгаар хэтэрсэн',
                  description: `${t.name} багш ${dayName} гарагт завсаргүй ${consec} цаг дараалан хичээлтэй байна. (Дээд хязгаар: ${maxConsec} цаг)`,
                  dayIndex: d,
                  entityType: 'teacher',
                  entityId: t.id,
                });
                break;
              }
            } else if (periods[i] > periods[i - 1] + 1) {
              consec = 1;
            }
          }
        }
      }
    }
  }

  // 9. Rule 7: 1 багш 1 анги бүлэгт өдөрт 1-с илүүгүй удаа орох (teacher_max_once_per_day)
  const teacherDailyRules = relationships.filter(
    (r) => r.isActive && r.condition === 'teacher_max_once_per_day'
  );

  const teacherClassDays = new Map<string, ScheduledCard[]>();
  for (const card of cards) {
    const key = `${card.teacherId}_${card.classId}_${card.dayIndex}`;
    if (!teacherClassDays.has(key)) teacherClassDays.set(key, []);
    teacherClassDays.get(key)!.push(card);
  }

  for (const [key, dayCards] of teacherClassDays.entries()) {
    const [teacherId, classId, dayStr] = key.split('_');
    const dayIndex = Number(dayStr);
    const teacher = teachers.find((t) => t.id === teacherId);
    const cls = classes.find((c) => c.id === classId);
    const dayName = settings.dayNames[dayIndex] || `${dayIndex + 1}-р өдөр`;

    const matchingRule = teacherDailyRules.find((r) => {
      const matchTeacher =
        !r.teacherIds || r.teacherIds.length === 0 || r.teacherIds.includes(teacherId);
      const matchClass =
        !r.classIds || r.classIds.length === 0 || r.classIds.includes(classId);
      return matchTeacher && matchClass;
    });

    if (matchingRule) {
      const sortedCards = [...dayCards].sort((a, b) => a.periodIndex - b.periodIndex);
      let visitCount = 0;
      let lastPeriod = -99;

      for (const c of sortedCards) {
        if (matchingRule.allowDoubleConsecutive !== false) {
          if (c.periodIndex === lastPeriod + 1) {
            lastPeriod = c.periodIndex;
            continue;
          }
        }
        visitCount++;
        lastPeriod = c.periodIndex;
      }

      const maxAllowed = matchingRule.value || 1;
      if (visitCount > maxAllowed) {
        issues.push({
          id: `rule_t_daily_${key}`,
          type: 'custom_constraint',
          severity: matchingRule.importance === 'strict' ? 'error' : 'warning',
          title: 'Багшийн өдрийн оролтын хязгаарлалт хэтэрсэн',
          description: `${teacher?.name || 'Багш'} ${cls?.name || 'Анги'}-д ${dayName} гарагт өдөрт ${visitCount} удаа (зөвшөөрөгдөх: ${maxAllowed} удаа) хичээл орохоор байна. (Дүрэм: Өдөрт 1-с илүүгүй удаа орох)`,
          dayIndex,
          entityType: 'teacher',
          entityId: teacherId,
        });
      }
    }
  }

  // 10. Rule 8: 1 ангийн 1 хичээлийн дэд бүлгүүд ижил цагт хичээллэх (same_subject_subgroups_simultaneous)
  const sameSubgroupRules = relationships.filter(
    (r) => r.isActive && r.condition === 'same_subject_subgroups_simultaneous'
  );

  for (const rule of sameSubgroupRules) {
    const targetClasses =
      rule.classIds && rule.classIds.length > 0
        ? classes.filter((c) => rule.classIds.includes(c.id))
        : classes;

    for (const cls of targetClasses) {
      const targetSubjects =
        rule.subjectIds && rule.subjectIds.length > 0
          ? subjects.filter((s) => rule.subjectIds.includes(s.id))
          : subjects;

      for (const sub of targetSubjects) {
        const classSubCards = cards.filter(
          (c) => c.classId === cls.id && c.subjectId === sub.id && Boolean(c.subgroupName)
        );

        if (classSubCards.length > 1) {
          const distinctSubgroups = Array.from(new Set(classSubCards.map((c) => c.subgroupName!)));
          if (distinctSubgroups.length > 1) {
            const timeSlots = new Set(classSubCards.map((c) => `${c.dayIndex}_${c.periodIndex}`));
            for (const slotKey of timeSlots) {
              const [dStr, pStr] = slotKey.split('_');
              const d = Number(dStr);
              const p = Number(pStr);
              const cardsInSlot = classSubCards.filter(
                (c) => c.dayIndex === d && c.periodIndex === p
              );
              const subgroupsInSlot = new Set(cardsInSlot.map((c) => c.subgroupName));

              if (subgroupsInSlot.size < distinctSubgroups.length) {
                const missing = distinctSubgroups.filter((s) => !subgroupsInSlot.has(s));
                const dayName = settings.dayNames[d] || `${d + 1}-р өдөр`;
                issues.push({
                  id: `rule_subgroup_sync_${cls.id}_${sub.id}_${slotKey}`,
                  type: 'custom_constraint',
                  severity: rule.importance === 'strict' ? 'error' : 'warning',
                  title: 'Ижил хичээлийн дэд бүлгүүд зэрэгцэн ороогүй байна',
                  description: `${cls.name} ангийн ${sub.name} хичээл ${dayName} гарагийн ${
                    p + 1
                  }-р цагт бүх дэд бүлгээр зэрэгцэн ижил цагт хичээллээгүй байна (Үлдсэн: ${missing.join(', ')}).`,
                  dayIndex: d,
                  periodIndex: p,
                  entityType: 'class',
                  entityId: cls.id,
                });
              }
            }
          }
        }
      }
    }
  }

  // 11. Rule 9: 2 өөр хичээлийн дэд бүлгүүд зэрэгцэн ижил цагт хичээллэх (different_subjects_subgroups_simultaneous)
  const crossSubgroupRules = relationships.filter(
    (r) =>
      r.isActive &&
      r.condition === 'different_subjects_subgroups_simultaneous' &&
      r.parallelPairs &&
      r.parallelPairs.length >= 2
  );

  for (const rule of crossSubgroupRules) {
    const targetClasses =
      rule.classIds && rule.classIds.length > 0
        ? classes.filter((c) => rule.classIds.includes(c.id))
        : classes;

    for (const cls of targetClasses) {
      const pair1 = rule.parallelPairs![0];
      const pair2 = rule.parallelPairs![1];

      const cards1 = cards.filter(
        (c) =>
          c.classId === cls.id &&
          c.subjectId === pair1.subjectId &&
          (!pair1.subgroupName || c.subgroupName === pair1.subgroupName)
      );
      const cards2 = cards.filter(
        (c) =>
          c.classId === cls.id &&
          c.subjectId === pair2.subjectId &&
          (!pair2.subgroupName || c.subgroupName === pair2.subgroupName)
      );

      const sub1 = subjects.find((s) => s.id === pair1.subjectId);
      const sub2 = subjects.find((s) => s.id === pair2.subjectId);

      for (const c1 of cards1) {
        const matchingCard2 = cards2.find(
          (c2) => c2.dayIndex === c1.dayIndex && c2.periodIndex === c1.periodIndex
        );
        if (!matchingCard2) {
          const dayName = settings.dayNames[c1.dayIndex] || `${c1.dayIndex + 1}-р өдөр`;
          issues.push({
            id: `rule_cross_sub_missing_${cls.id}_${c1.id}`,
            type: 'custom_constraint',
            severity: rule.importance === 'strict' ? 'error' : 'warning',
            title: 'Зэрэгцээ дэд бүлгийн зөрүү',
            description: `${cls.name} ангийн ${sub1?.name || 'Хичээл 1'} (${
              pair1.subgroupName || '1-р бүлэг'
            }) хичээл ${dayName} гарагийн ${c1.periodIndex + 1}-р цагт ${sub2?.name || 'Хичээл 2'} (${
              pair2.subgroupName || '2-р бүлэг'
            })-тойгоо зэрэгцэн ороогүй байна.`,
            dayIndex: c1.dayIndex,
            periodIndex: c1.periodIndex,
            entityType: 'class',
            entityId: cls.id,
          });
        }
      }
    }
  }

  // 12. Rule 10: Өдрийн болон 7 хоногийн цонхтой цагийн дээд хязгаар (max_gaps_daily_weekly)
  for (const r of relationships) {
    if (!r.isActive || r.condition !== 'max_gaps_daily_weekly') continue;
    const maxDayGaps = r.maxGapsPerDay ?? 1;
    const maxWeekGaps = r.maxGapsPerWeek ?? 3;

    if (r.targetEntity === 'classes') {
      const targetClasses =
        r.classIds && r.classIds.length > 0
          ? classes.filter((c) => r.classIds.includes(c.id))
          : classes;

      for (const cls of targetClasses) {
        let weeklyGaps = 0;
        for (let d = 0; d < settings.daysPerWeek; d++) {
          const periods = cards
            .filter((c) => c.classId === cls.id && c.dayIndex === d)
            .map((c) => c.periodIndex)
            .sort((a, b) => a - b);

          if (periods.length >= 2) {
            const minP = periods[0];
            const maxP = periods[periods.length - 1];
            const uniquePeriods = new Set(periods);
            const dailyGaps = maxP - minP + 1 - uniquePeriods.size;
            weeklyGaps += dailyGaps;

            if (dailyGaps > maxDayGaps) {
              const dayName = settings.dayNames[d] || `${d + 1}-р өдөр`;
              issues.push({
                id: `rule_gaps_day_c_${cls.id}_${d}`,
                type: 'gap_excess',
                severity: r.importance === 'strict' ? 'error' : 'warning',
                title: 'Ангийн өдрийн цонх хэтэрсэн',
                description: `${cls.name} анги ${dayName} гарагт нийт ${dailyGaps} цонхтой байна. (Дээд хязгаар: ${maxDayGaps} цонх)`,
                dayIndex: d,
                entityType: 'class',
                entityId: cls.id,
              });
            }
          }
        }

        if (weeklyGaps > maxWeekGaps) {
          issues.push({
            id: `rule_gaps_week_c_${cls.id}`,
            type: 'gap_excess',
            severity: r.importance === 'strict' ? 'error' : 'warning',
            title: 'Ангийн 7 хоногийн нийт цонх хэтэрсэн',
            description: `${cls.name} анги 7 хоногт нийт ${weeklyGaps} цонхтой байна. (Дээд хязгаар: ${maxWeekGaps} цонх)`,
            entityType: 'class',
            entityId: cls.id,
          });
        }
      }
    } else {
      // Teachers
      const targetTeachers =
        r.teacherIds && r.teacherIds.length > 0
          ? teachers.filter((t) => r.teacherIds!.includes(t.id))
          : teachers;

      for (const t of targetTeachers) {
        let weeklyGaps = 0;
        for (let d = 0; d < settings.daysPerWeek; d++) {
          const periods = cards
            .filter((c) => c.teacherId === t.id && c.dayIndex === d)
            .map((c) => c.periodIndex)
            .sort((a, b) => a - b);

          if (periods.length >= 2) {
            const minP = periods[0];
            const maxP = periods[periods.length - 1];
            const uniquePeriods = new Set(periods);
            const dailyGaps = maxP - minP + 1 - uniquePeriods.size;
            weeklyGaps += dailyGaps;

            if (dailyGaps > maxDayGaps) {
              const dayName = settings.dayNames[d] || `${d + 1}-р өдөр`;
              issues.push({
                id: `rule_gaps_day_t_${t.id}_${d}`,
                type: 'gap_excess',
                severity: r.importance === 'strict' ? 'error' : 'warning',
                title: 'Багшийн өдрийн цонх хэтэрсэн',
                description: `${t.name} багш ${dayName} гарагт нийт ${dailyGaps} цонхтой байна. (Дээд хязгаар: ${maxDayGaps} цонх)`,
                dayIndex: d,
                entityType: 'teacher',
                entityId: t.id,
              });
            }
          }
        }

        if (weeklyGaps > maxWeekGaps) {
          issues.push({
            id: `rule_gaps_week_t_${t.id}`,
            type: 'gap_excess',
            severity: r.importance === 'strict' ? 'error' : 'warning',
            title: 'Багшийн 7 хоногийн нийт цонх хэтэрсэн',
            description: `${t.name} багш 7 хоногт нийт ${weeklyGaps} цонхтой байна. (Дээд хязгаар: ${maxWeekGaps} цонх)`,
            entityType: 'teacher',
            entityId: t.id,
          });
        }
      }
    }
  }

  // 13. Rule 11: 7 хоногт хичээл заах өдрийн дээд /доод хязгаар (teaching_days_limit)
  for (const r of relationships) {
    if (!r.isActive || r.condition !== 'teaching_days_limit') continue;
    const minDays = r.minDaysPerWeek ?? 3;
    const maxDays = r.maxDaysPerWeek ?? 5;

    if (r.targetEntity === 'classes') {
      const targetClasses =
        r.classIds && r.classIds.length > 0
          ? classes.filter((c) => r.classIds.includes(c.id))
          : classes;

      for (const cls of targetClasses) {
        const distinctDays = new Set(
          cards.filter((c) => c.classId === cls.id).map((c) => c.dayIndex)
        );
        if (distinctDays.size > 0 && (distinctDays.size < minDays || distinctDays.size > maxDays)) {
          issues.push({
            id: `rule_days_limit_c_${cls.id}`,
            type: 'custom_constraint',
            severity: r.importance === 'strict' ? 'error' : 'warning',
            title: 'Ангийн 7 хоногт хичээллэх өдрийн тоо зөрчигдсөн',
            description: `${cls.name} анги 7 хоногт ${distinctDays.size} өдөр хичээлтэй байна. (Зөвшөөрөгдөх: ${minDays} - ${maxDays} өдөр)`,
            entityType: 'class',
            entityId: cls.id,
          });
        }
      }
    } else {
      // Teachers
      const targetTeachers =
        r.teacherIds && r.teacherIds.length > 0
          ? teachers.filter((t) => r.teacherIds!.includes(t.id))
          : teachers;

      for (const t of targetTeachers) {
        const distinctDays = new Set(
          cards.filter((c) => c.teacherId === t.id).map((c) => c.dayIndex)
        );
        if (distinctDays.size > 0 && (distinctDays.size < minDays || distinctDays.size > maxDays)) {
          issues.push({
            id: `rule_days_limit_t_${t.id}`,
            type: 'custom_constraint',
            severity: r.importance === 'strict' ? 'error' : 'warning',
            title: 'Багшийн 7 хоногт хичээл заах өдрийн тоо зөрчигдсөн',
            description: `${t.name} багш 7 хоногт ${distinctDays.size} өдөр хичээл зааж байна. (Зөвшөөрөгдөх: ${minDays} - ${maxDays} өдөр)`,
            entityType: 'teacher',
            entityId: t.id,
          });
        }
      }
    }
  }

  // 14. Rule 12: 2 буюу 3 ээлжинд хичээл заадаг бол аль болох 2 ээлжийг дамжих цонх бага байлгах (minimize_shift_crossing_gap)
  for (const r of relationships) {
    if (!r.isActive || r.condition !== 'minimize_shift_crossing_gap') continue;
    const maxCrossGap = r.maxCrossShiftGap ?? 1;

    const targetTeachers =
      r.teacherIds && r.teacherIds.length > 0
        ? teachers.filter((t) => r.teacherIds!.includes(t.id))
        : teachers;

    for (const t of targetTeachers) {
      for (let d = 0; d < settings.daysPerWeek; d++) {
        const dayCards = cards.filter((c) => c.teacherId === t.id && c.dayIndex === d);
        const shift1Cards = dayCards.filter((c) => c.shift === 1);
        const shift2Cards = dayCards.filter((c) => c.shift === 2);
        const shift3Cards = dayCards.filter((c) => c.shift === 3);

        // Check Shift 1 -> Shift 2
        if (shift1Cards.length > 0 && shift2Cards.length > 0) {
          const maxP1 = Math.max(...shift1Cards.map((c) => c.periodIndex));
          const minP2 = Math.min(...shift2Cards.map((c) => c.periodIndex));
          const s1Config = settings.shifts.find((s) => s.shiftNumber === 1);
          const s1Periods = s1Config?.periodsCount || 6;
          const crossGap = (s1Periods - 1 - maxP1) + minP2;

          if (crossGap > maxCrossGap) {
            const dayName = settings.dayNames[d] || `${d + 1}-р өдөр`;
            issues.push({
              id: `rule_shift_cross_t_${t.id}_${d}_1_2`,
              type: 'shift_mismatch',
              severity: r.importance === 'strict' ? 'error' : 'warning',
              title: 'Ээлж хоорондын дамжих цонх хэт урт байна',
              description: `${t.name} багш ${dayName} гарагт 1 ба 2-р ээлж хооронд ${crossGap} цагийн хэт урт завсартай байна. (Дээд хязгаар: ${maxCrossGap} цаг)`,
              dayIndex: d,
              entityType: 'teacher',
              entityId: t.id,
            });
          }
        }

        // Check Shift 2 -> Shift 3
        if (shift2Cards.length > 0 && shift3Cards.length > 0) {
          const maxP2 = Math.max(...shift2Cards.map((c) => c.periodIndex));
          const minP3 = Math.min(...shift3Cards.map((c) => c.periodIndex));
          const s2Config = settings.shifts.find((s) => s.shiftNumber === 2);
          const s2Periods = s2Config?.periodsCount || 6;
          const crossGap = (s2Periods - 1 - maxP2) + minP3;

          if (crossGap > maxCrossGap) {
            const dayName = settings.dayNames[d] || `${d + 1}-р өдөр`;
            issues.push({
              id: `rule_shift_cross_t_${t.id}_${d}_2_3`,
              type: 'shift_mismatch',
              severity: r.importance === 'strict' ? 'error' : 'warning',
              title: 'Ээлж хоорондын дамжих цонх хэт урт байна',
              description: `${t.name} багш ${dayName} гарагт 2 ба 3-р ээлж хооронд ${crossGap} цагийн хэт урт завсартай байна. (Дээд хязгаар: ${maxCrossGap} цаг)`,
              dayIndex: d,
              entityType: 'teacher',
              entityId: t.id,
            });
          }
        }
      }
    }
  }

  return issues;
}
