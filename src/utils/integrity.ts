/**
 * Өгөгдлийн холбоосын бүрэн бүтэн байдал.
 * Хичээл, багш, анги, танхим устгагдахад түүнд хамаарах хичээлийн гэрээ, хуваарийн карт
 * "өнчирч" үлдэхгүй байхаар цэвэрлэнэ.
 */
import type { ProjectState } from './storage';

export interface IntegrityReport {
  removedLessons: number;
  removedCards: number;
}

export function ensureIntegrity(p: ProjectState): { project: ProjectState; report: IntegrityReport } {
  const subjectIds = new Set(p.subjects.map((s) => s.id));
  const teacherIds = new Set(p.teachers.map((t) => t.id));
  const classIds = new Set(p.classes.map((c) => c.id));
  const roomIds = new Set(p.classrooms.map((r) => r.id));

  let lessonsChanged = false;
  const lessons = [];
  for (const l of p.lessons) {
    if (!subjectIds.has(l.subjectId) || !teacherIds.has(l.teacherId) || !classIds.has(l.classId)) {
      lessonsChanged = true;
      continue;
    }
    const co = l.coTeacherIds?.filter((t) => teacherIds.has(t));
    const joint = l.jointClassIds?.filter((c) => classIds.has(c));
    const room = l.classroomId && !roomIds.has(l.classroomId) ? undefined : l.classroomId;
    if (
      (co && co.length !== l.coTeacherIds!.length) ||
      (joint && joint.length !== l.jointClassIds!.length) ||
      room !== l.classroomId
    ) {
      lessonsChanged = true;
      lessons.push({ ...l, coTeacherIds: co, jointClassIds: joint, classroomId: room });
    } else lessons.push(l);
  }

  const lessonIds = new Set(lessons.map((l) => l.id));
  let cardsChanged = false;
  const cards = [];
  for (const c of p.scheduledCards) {
    if (!lessonIds.has(c.contractId) || !classIds.has(c.classId) || !teacherIds.has(c.teacherId)) {
      cardsChanged = true;
      continue;
    }
    const co = c.coTeacherIds?.filter((t) => teacherIds.has(t));
    const joint = c.jointClassIds?.filter((x) => classIds.has(x));
    const room = c.classroomId && !roomIds.has(c.classroomId) ? undefined : c.classroomId;
    if (
      (co && co.length !== c.coTeacherIds!.length) ||
      (joint && joint.length !== c.jointClassIds!.length) ||
      room !== c.classroomId
    ) {
      cardsChanged = true;
      cards.push({ ...c, coTeacherIds: co, jointClassIds: joint, classroomId: room });
    } else cards.push(c);
  }
  // Хамтрагчгүй болсон хос цагийн хагас — дан болгоно
  const cardIds = new Set(cards.map((c) => c.id));
  const fixed = cards.map((c) => {
    if (c.linkedCardId && !cardIds.has(c.linkedCardId)) {
      cardsChanged = true;
      const { linkedCardId: _l, isDoublePart: _d, ...rest } = c;
      return rest;
    }
    return c;
  });

  const report = {
    removedLessons: p.lessons.length - lessons.length,
    removedCards: p.scheduledCards.length - fixed.length,
  };
  if (!lessonsChanged && !cardsChanged) return { project: p, report };
  return {
    project: { ...p, lessons: lessonsChanged ? lessons : p.lessons, scheduledCards: cardsChanged ? fixed : p.scheduledCards },
    report,
  };
}
