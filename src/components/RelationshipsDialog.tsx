import React, { useState } from 'react';
import {
  CardRelationship,
  Subject,
  ClassGroup,
  Teacher,
  RelationshipCondition,
  ParallelSubjectSubgroupConfig,
} from '../types/timetable';
import {
  Network,
  Users,
  Layers,
  ArrowRightLeft,
  Calendar,
  Clock,
  Sliders,
  CheckCircle2,
  XCircle,
  Building2,
  ShieldAlert,
  Save,
  Check,
} from 'lucide-react';

interface RelationshipsDialogProps {
  relationships: CardRelationship[];
  subjects: Subject[];
  classes: ClassGroup[];
  teachers?: Teacher[];
  isOpen: boolean;
  onClose: () => void;
  onUpdateRelationships: (rels: CardRelationship[]) => void;
}

export const RelationshipsDialog: React.FC<RelationshipsDialogProps> = ({
  relationships,
  subjects,
  classes,
  teachers = [],
  isOpen,
  onClose,
  onUpdateRelationships,
}) => {
  // Filter out any "Математик өдөрт 1-с илүүгүй удаа орох"
  const cleanRelationships = relationships.filter(
    (r) => r.id !== 'rel-1' && !r.name?.includes('Математик өдөрт 1')
  );

  const [localRelationships, setLocalRelationships] = useState<CardRelationship[]>(cleanRelationships);
  const [selectedRelId, setSelectedRelId] = useState<string>(
    cleanRelationships[0]?.id || 'rel-cannot-same-day'
  );
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen) return null;

  const activeRel = localRelationships.find((r) => r.id === selectedRelId) || localRelationships[0];

  const updateActiveRel = (updated: Partial<CardRelationship>) => {
    if (!activeRel) return;
    setLocalRelationships((prev) =>
      prev.map((r) => (r.id === activeRel.id ? { ...r, ...updated } : r))
    );
  };

  const handleToggleActive = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setLocalRelationships((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isActive: !r.isActive } : r))
    );
  };

  const handleToggleAll = (active: boolean) => {
    setLocalRelationships((prev) => prev.map((r) => ({ ...r, isActive: active })));
  };

  const handleSaveAll = () => {
    onUpdateRelationships(localRelationships);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 400);
  };

  const toggleSubjectForActive = (subId: string) => {
    if (!activeRel) return;
    const exists = activeRel.subjectIds.includes(subId);
    const next = exists
      ? activeRel.subjectIds.filter((id) => id !== subId)
      : [...activeRel.subjectIds, subId];
    updateActiveRel({ subjectIds: next });
  };

  const toggleClassForActive = (classId: string) => {
    if (!activeRel) return;
    const exists = activeRel.classIds.includes(classId);
    const next = exists
      ? activeRel.classIds.filter((id) => id !== classId)
      : [...activeRel.classIds, classId];
    updateActiveRel({ classIds: next });
  };

  const toggleTeacherForActive = (teacherId: string) => {
    if (!activeRel) return;
    const list = activeRel.teacherIds || [];
    const exists = list.includes(teacherId);
    const next = exists ? list.filter((id) => id !== teacherId) : [...list, teacherId];
    updateActiveRel({ teacherIds: next });
  };

  const togglePeriodForActive = (periodIndex: number) => {
    if (!activeRel) return;
    const current = activeRel.allowedPeriods || [];
    const exists = current.includes(periodIndex);
    const next = exists ? current.filter((p) => p !== periodIndex) : [...current, periodIndex].sort((a, b) => a - b);
    updateActiveRel({ allowedPeriods: next });
  };

  // Helper for cross-subgroup pairs
  const currentPairClass = classes.find((c) => c.id === activeRel?.classIds[0]) || classes[0];
  const availableSubgroupsForPair =
    currentPairClass?.subgroups && currentPairClass.subgroups.length > 0
      ? currentPairClass.subgroups.map((s) => s.name)
      : ['Охид', 'Хөвгүүд', '1-р дэд бүлэг', '2-р дэд бүлэг'];

  const getTwoPairs = (): ParallelSubjectSubgroupConfig[] => {
    const existing = activeRel?.parallelPairs || [];
    const pair1 = existing[0] || {
      subjectId: subjects[0]?.id || '',
      subgroupName: availableSubgroupsForPair[0] || '1-р бүлэг',
    };
    const pair2 = existing[1] || {
      subjectId: subjects[1]?.id || subjects[0]?.id || '',
      subgroupName: availableSubgroupsForPair[1] || '2-р бүлэг',
    };
    return [pair1, pair2];
  };

  const updateCrossPair = (index: number, field: keyof ParallelSubjectSubgroupConfig, value: string) => {
    const pairs = [...getTwoPairs()];
    pairs[index] = { ...pairs[index], [field]: value };
    const s1 = subjects.find((s) => s.id === pairs[0].subjectId)?.name || 'Хичээл 1';
    const s2 = subjects.find((s) => s.id === pairs[1].subjectId)?.name || 'Хичээл 2';
    const autoName = `${currentPairClass?.name || 'Анги'}: ${s1} (${pairs[0].subgroupName}) ∥ ${s2} (${pairs[1].subgroupName}) зэрэгцэн орох`;

    updateActiveRel({
      parallelPairs: pairs,
      subjectIds: [pairs[0].subjectId, pairs[1].subjectId].filter(Boolean),
      name: autoName,
    });
  };

  const getConditionIcon = (cond: RelationshipCondition) => {
    switch (cond) {
      case 'cannot_same_day':
        return <XCircle className="w-4 h-4 text-rose-600" />;
      case 'cannot_consecutive':
        return <ArrowRightLeft className="w-4 h-4 text-amber-600" />;
      case 'first_or_last':
        return <Clock className="w-4 h-4 text-blue-600" />;
      case 'allowed_periods_only':
        return <Calendar className="w-4 h-4 text-indigo-600" />;
      case 'daily_hours_limit':
        return <Sliders className="w-4 h-4 text-teal-600" />;
      case 'max_consecutive_periods':
        return <Clock className="w-4 h-4 text-orange-600" />;
      case 'teacher_max_once_per_day':
        return <Users className="w-4 h-4 text-blue-600" />;
      case 'same_subject_subgroups_simultaneous':
        return <Layers className="w-4 h-4 text-emerald-600" />;
      case 'different_subjects_subgroups_simultaneous':
        return <ArrowRightLeft className="w-4 h-4 text-purple-600" />;
      case 'max_gaps_daily_weekly':
        return <Clock className="w-4 h-4 text-sky-600" />;
      case 'teaching_days_limit':
        return <Calendar className="w-4 h-4 text-emerald-600" />;
      case 'minimize_shift_crossing_gap':
        return <ArrowRightLeft className="w-4 h-4 text-indigo-600" />;
      case 'building_transfer_buffer':
        return <Building2 className="w-4 h-4 text-slate-600" />;
      default:
        return <Network className="w-4 h-4 text-blue-600" />;
    }
  };

  const activeCount = localRelationships.filter((r) => r.isActive).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 select-none">
      <div className="bg-slate-50 rounded-lg shadow-2xl border border-slate-300 w-full max-w-6xl overflow-hidden flex flex-col h-[90vh]">
        {/* Title bar - Classic aSc Windows Header */}
        <div className="dialog-titlebar text-white px-4 py-2.5 flex items-center justify-between select-none shrink-0">
          <div className="flex items-center gap-2">
            <Network className="w-4 h-4 text-sky-200" />
            <span className="font-bold text-sm tracking-wide">
              Хичээлийн хамаарал & Нэмэлт хязгаарлалтын тохиргоо (Relations)
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-red-600 rounded px-2 py-0.5 text-xs font-bold transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Sub-header status bar */}
        <div className="bg-[#f3f1ec] px-4 py-2 border-b border-slate-300 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2 text-slate-700">
            <span className="font-bold text-slate-900">Бүх хамаарлын дүрмүүд:</span>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-mono text-[11px] font-bold">
              Нийт {localRelationships.length} дүрэм ({activeCount} идэвхтэй)
            </span>
            <span className="text-[11px] text-slate-500 hidden md:inline">
              — Зүүн талаас дүрмийг сонгож, баруун талын самбарт шууд тохируулна
            </span>
          </div>

          <button
            onClick={handleSaveAll}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 shadow-xs transition cursor-pointer text-xs"
          >
            {saveSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-white animate-bounce" />
                <span>Хадгалагдлаа!</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Тохиргоог хадгалах</span>
              </>
            )}
          </button>
        </div>

        {/* Main Content Area: Split View (Rules List on Left, Direct Inspector on Right) */}
        <div className="flex flex-1 overflow-hidden p-3 gap-3 bg-[#f3f1ec]">
          {/* LEFT: Rules Navigation List */}
          <div className="w-80 md:w-96 flex flex-col bg-white rounded border border-slate-300 overflow-hidden shadow-inner shrink-0">
            <div className="bg-slate-100 px-3 py-2 border-b border-slate-300 text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>Дүрмийн жагсаалт:</span>
              <div className="flex items-center gap-1.5 font-normal">
                <button
                  type="button"
                  onClick={() => handleToggleAll(true)}
                  className="text-[10px] text-blue-700 hover:underline font-semibold cursor-pointer"
                  title="Бүх дүрмийг идэвхжүүлэх"
                >
                  Бүгдийг асаах
                </button>
                <span className="text-slate-300 text-[10px]">|</span>
                <button
                  type="button"
                  onClick={() => handleToggleAll(false)}
                  className="text-[10px] text-slate-500 hover:underline font-semibold cursor-pointer"
                  title="Бүх дүрмийг идэвхгүй болгох"
                >
                  Унтраах
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 text-xs">
              {localRelationships.map((rel, index) => {
                const isSelected = rel.id === (activeRel?.id || selectedRelId);
                return (
                  <div
                    key={rel.id}
                    onClick={() => setSelectedRelId(rel.id)}
                    className={`p-2.5 cursor-pointer flex items-center justify-between transition ${
                      isSelected
                        ? 'bg-blue-50 border-l-4 border-blue-600 text-blue-950 shadow-2xs'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 pr-2 overflow-hidden">
                      <div className="mt-0.5 shrink-0">{getConditionIcon(rel.condition)}</div>
                      <div className="overflow-hidden">
                        <div className="font-bold text-xs truncate leading-snug">
                          <span className="text-slate-400 font-mono text-[10px] mr-1">{index + 1}.</span>
                          {rel.name}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">
                          {rel.condition === 'cannot_same_day' && '2 хичээл нэг өдөр орохгүй'}
                          {rel.condition === 'cannot_consecutive' && '2 хичээл дараалласан цагт орохгүй'}
                          {rel.condition === 'first_or_last' && 'Зөвхөн 1-р эсвэл сүүлчийн цагт'}
                          {rel.condition === 'allowed_periods_only' &&
                            `Зөвшөөрөгдөх цаг: ${rel.allowedPeriods?.map((p) => p + 1).join(', ') || 'Бүгд'}-р цаг`}
                          {rel.condition === 'daily_hours_limit' &&
                            `Өдөрт ${rel.minPeriodsPerDay || 2} - ${rel.maxPeriodsPerDay || 5} цаг`}
                          {rel.condition === 'max_consecutive_periods' &&
                            `Залгаа дээд тал нь ${rel.maxConsecutive || 3} цаг`}
                          {rel.condition === 'teacher_max_once_per_day' && 'Өдөрт хамгийн ихдээ 1 удаа орох'}
                          {rel.condition === 'same_subject_subgroups_simultaneous' && 'Дэд бүлгүүд ижил цагт зэрэгцэх'}
                          {rel.condition === 'different_subjects_subgroups_simultaneous' && '2 өөр хичээлийн дэд бүлэг зэрэгцэх'}
                          {rel.condition === 'max_gaps_daily_weekly' &&
                            `Өдөрт max ${rel.maxGapsPerDay ?? 1}, 7 хоногт max ${rel.maxGapsPerWeek ?? 3} цонх`}
                          {rel.condition === 'teaching_days_limit' &&
                            `7 хоногт ${rel.minDaysPerWeek ?? 3} - ${rel.maxDaysPerWeek ?? 5} өдөр заах`}
                          {rel.condition === 'minimize_shift_crossing_gap' &&
                            `Ээлж дамжих цонх дээд тал нь ${rel.maxCrossShiftGap ?? 1} цаг`}
                          {rel.condition === 'building_transfer_buffer' && 'Байр солигдох завсар'}
                          {rel.condition === 'ideal_distribution' && '7 хоногт жигд тархах'}
                        </div>
                      </div>
                    </div>

                    {/* Active toggle button */}
                    <button
                      type="button"
                      onClick={(e) => handleToggleActive(rel.id, e)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border transition shrink-0 cursor-pointer ${
                        rel.isActive
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                          : 'bg-slate-100 text-slate-400 border-slate-300 hover:bg-slate-200'
                      }`}
                      title={rel.isActive ? 'Идэвхтэй байна (товшиж идэвхгүй болгох)' : 'Идэвхгүй (товшиж асаах)'}
                    >
                      {rel.isActive ? 'Идэвхтэй' : 'Идэвхгүй'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: Selected Rule Inspector & Direct Configuration */}
          <div className="flex-1 bg-white rounded border border-slate-300 shadow-xs flex flex-col overflow-hidden">
            {activeRel ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Rule Title & State Header */}
                <div className="bg-[#dce8e2] p-3.5 border-b border-slate-200 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-white rounded border border-slate-300 shadow-2xs">
                      {getConditionIcon(activeRel.condition)}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{activeRel.name}</h3>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {activeRel.note || 'Хамаарлын дүрмийн тохиргоог доорх талбаруудаас тохируулна уу'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-slate-600">Ач холбогдол:</span>
                      <select
                        value={activeRel.importance}
                        onChange={(e) => updateActiveRel({ importance: e.target.value as any })}
                        className="px-2 py-1 border border-slate-300 rounded font-bold text-blue-700 bg-white text-xs"
                      >
                        <option value="strict">Strict (Заавал биелэх - Алдаа заана)</option>
                        <option value="high">High (Өндөр - Зөрчвөл сануулна)</option>
                        <option value="normal">Normal (Ердийн)</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => updateActiveRel({ isActive: !activeRel.isActive })}
                      className={`px-3 py-1 rounded font-bold text-xs border transition cursor-pointer flex items-center gap-1.5 ${
                        activeRel.isActive
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                          : 'bg-slate-200 text-slate-600 border-slate-300'
                      }`}
                    >
                      {activeRel.isActive ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      <span>{activeRel.isActive ? 'Идэвхтэй байна' : 'Идэвхгүй болгосон'}</span>
                    </button>
                  </div>
                </div>

                {/* Direct Inspector Body */}
                <div className="p-4 overflow-y-auto flex-1 space-y-4 text-xs">
                  {/* RULE 1: 2 ХИЧЭЭЛ НЭГ ӨДӨРТ ОРОХГҮЙ (cannot_same_day) */}
                  {activeRel.condition === 'cannot_same_day' && (
                    <div className="space-y-4">
                      <div className="p-3 bg-rose-50/80 rounded border border-rose-200 text-rose-900 leading-relaxed">
                        <strong className="block mb-1">Дүрмийн тайлбар:</strong>
                        Сонгосон хоёр (эсвэл түүнээс олон) хичээлүүд нэг ангид нэг өдөр хамт орохгүй, өөр өөр өдрүүдэд хуваарилагдана. (Жишээ: Физик ба Хими).
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Subjects selection */}
                        <div className="border border-slate-200 rounded p-3 bg-slate-50">
                          <label className="block font-bold text-slate-800 mb-2">
                            Хамт орж болохгүй хичээлүүдийг сонгох: <span className="text-red-500">*</span>
                          </label>
                          <div className="max-h-56 overflow-y-auto border border-slate-200 rounded p-1.5 bg-white divide-y divide-slate-100">
                            {subjects.map((sub) => {
                              const checked = activeRel.subjectIds.includes(sub.id);
                              return (
                                <label
                                  key={sub.id}
                                  className="flex items-center gap-2 py-1 px-1.5 hover:bg-slate-50 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleSubjectForActive(sub.id)}
                                  />
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: sub.color }}
                                  />
                                  <span className="font-semibold text-slate-800">{sub.name}</span>
                                  <span className="text-slate-400 font-mono text-[10px] ml-auto">
                                    {sub.shortName}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        {/* Classes selection */}
                        <div className="border border-slate-200 rounded p-3 bg-slate-50">
                          <label className="block font-bold text-slate-800 mb-2">Хамаарах ангиуд:</label>
                          <div className="space-y-1.5 mb-2">
                            <label className="flex items-center gap-2 cursor-pointer font-medium">
                              <input
                                type="radio"
                                name="c_same_day"
                                checked={activeRel.classIds.length === 0}
                                onChange={() => updateActiveRel({ classIds: [] })}
                              />
                              <span>Бүх ангиудад хамаарна</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer font-medium">
                              <input
                                type="radio"
                                name="c_same_day"
                                checked={activeRel.classIds.length > 0}
                                onChange={() => updateActiveRel({ classIds: [classes[0]?.id || ''] })}
                              />
                              <span>Сонгосон ангиуд</span>
                            </label>
                          </div>

                          {activeRel.classIds.length > 0 && (
                            <div className="max-h-40 overflow-y-auto border border-slate-200 rounded p-1.5 bg-white divide-y divide-slate-100">
                              {classes.map((cls) => {
                                const checked = activeRel.classIds.includes(cls.id);
                                return (
                                  <label
                                    key={cls.id}
                                    className="flex items-center gap-2 py-0.5 px-1 hover:bg-slate-50 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleClassForActive(cls.id)}
                                    />
                                    <span>{cls.name}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* RULE 2: 2 ХИЧЭЭЛ ДАРААЛЛАСАН ЦАГТ ОРОХГҮЙ (cannot_consecutive) */}
                  {activeRel.condition === 'cannot_consecutive' && (
                    <div className="space-y-4">
                      <div className="p-3 bg-amber-50/80 rounded border border-amber-200 text-amber-900 leading-relaxed">
                        <strong className="block mb-1">Дүрмийн тайлбар:</strong>
                        Сонгосон хоёр хичээл нэг өдөр залгаа дараалсан цагуудад орохгүй (Жишээ нь: Математик ба Физик дараалж орохгүй, дунд нь өөр хичээл завсарлана).
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="border border-slate-200 rounded p-3 bg-slate-50">
                          <label className="block font-bold text-slate-800 mb-2">
                            Дараалж орохгүй хичээлүүд: <span className="text-red-500">*</span>
                          </label>
                          <div className="max-h-56 overflow-y-auto border border-slate-200 rounded p-1.5 bg-white divide-y divide-slate-100">
                            {subjects.map((sub) => {
                              const checked = activeRel.subjectIds.includes(sub.id);
                              return (
                                <label
                                  key={sub.id}
                                  className="flex items-center gap-2 py-1 px-1.5 hover:bg-slate-50 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleSubjectForActive(sub.id)}
                                  />
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: sub.color }}
                                  />
                                  <span className="font-semibold text-slate-800">{sub.name}</span>
                                  <span className="text-slate-400 font-mono text-[10px] ml-auto">
                                    {sub.shortName}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        <div className="border border-slate-200 rounded p-3 bg-slate-50">
                          <label className="block font-bold text-slate-800 mb-2">Хамаарах ангиуд:</label>
                          <div className="space-y-1.5 mb-2">
                            <label className="flex items-center gap-2 cursor-pointer font-medium">
                              <input
                                type="radio"
                                name="c_consec"
                                checked={activeRel.classIds.length === 0}
                                onChange={() => updateActiveRel({ classIds: [] })}
                              />
                              <span>Бүх ангиудад</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer font-medium">
                              <input
                                type="radio"
                                name="c_consec"
                                checked={activeRel.classIds.length > 0}
                                onChange={() => updateActiveRel({ classIds: [classes[0]?.id || ''] })}
                              />
                              <span>Сонгосон ангиуд</span>
                            </label>
                          </div>

                          {activeRel.classIds.length > 0 && (
                            <div className="max-h-40 overflow-y-auto border border-slate-200 rounded p-1.5 bg-white divide-y divide-slate-100">
                              {classes.map((cls) => {
                                const checked = activeRel.classIds.includes(cls.id);
                                return (
                                  <label
                                    key={cls.id}
                                    className="flex items-center gap-2 py-0.5 px-1 hover:bg-slate-50 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleClassForActive(cls.id)}
                                    />
                                    <span>{cls.name}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* RULE 3: СОНГОСОН ХИЧЭЭЛ ЭХНИЙ ЮМ УУ СҮҮЛИЙН ЦАГТ ОРОХ (first_or_last) */}
                  {activeRel.condition === 'first_or_last' && (
                    <div className="space-y-4">
                      <div className="p-3 bg-blue-50/80 rounded border border-blue-200 text-blue-900 leading-relaxed">
                        <strong className="block mb-1">Дүрмийн тайлбар:</strong>
                        Сонгосон хичээл өдрийн зөвхөн 1-р цагт эсвэл сүүлчийн цагт (өдрийн төгсгөлд) хуваарилагдана. (Жишээ нь: Биеийн тамир, Технологи, Дүрслэх урлаг).
                      </div>

                      {/* Placement Mode */}
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <label className="block font-bold text-slate-800 mb-2">Цагийн байрлалын сонголт:</label>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <label className={`flex items-center gap-1.5 px-3 py-1.5 border rounded cursor-pointer font-medium transition ${
                            !activeRel.firstOrLastMode || activeRel.firstOrLastMode === 'first_or_last'
                              ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}>
                            <input
                              type="radio"
                              name="fol_mode"
                              className="hidden"
                              checked={!activeRel.firstOrLastMode || activeRel.firstOrLastMode === 'first_or_last'}
                              onChange={() => updateActiveRel({ firstOrLastMode: 'first_or_last' })}
                            />
                            <span>1-р эсвэл сүүлчийн цагт (Аль алинд зөвшөөрөгдөнө)</span>
                          </label>

                          <label className={`flex items-center gap-1.5 px-3 py-1.5 border rounded cursor-pointer font-medium transition ${
                            activeRel.firstOrLastMode === 'first_only'
                              ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}>
                            <input
                              type="radio"
                              name="fol_mode"
                              className="hidden"
                              checked={activeRel.firstOrLastMode === 'first_only'}
                              onChange={() => updateActiveRel({ firstOrLastMode: 'first_only' })}
                            />
                            <span>Зөвхөн 1-р цагт (Өдрийн эхэнд)</span>
                          </label>

                          <label className={`flex items-center gap-1.5 px-3 py-1.5 border rounded cursor-pointer font-medium transition ${
                            activeRel.firstOrLastMode === 'last_only'
                              ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}>
                            <input
                              type="radio"
                              name="fol_mode"
                              className="hidden"
                              checked={activeRel.firstOrLastMode === 'last_only'}
                              onChange={() => updateActiveRel({ firstOrLastMode: 'last_only' })}
                            />
                            <span>Зөвхөн сүүлчийн цагт (Өдрийн төгсгөлд)</span>
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="border border-slate-200 rounded p-3 bg-slate-50">
                          <label className="block font-bold text-slate-800 mb-2">
                            Эхний/сүүлчийн цагт орох хичээлүүд:
                          </label>
                          <div className="max-h-56 overflow-y-auto border border-slate-200 rounded p-1.5 bg-white divide-y divide-slate-100">
                            {subjects.map((sub) => {
                              const checked = activeRel.subjectIds.includes(sub.id);
                              return (
                                <label
                                  key={sub.id}
                                  className="flex items-center gap-2 py-1 px-1.5 hover:bg-slate-50 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleSubjectForActive(sub.id)}
                                  />
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: sub.color }}
                                  />
                                  <span className="font-semibold text-slate-800">{sub.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        <div className="border border-slate-200 rounded p-3 bg-slate-50">
                          <label className="block font-bold text-slate-800 mb-2">Хамаарах ангиуд:</label>
                          <div className="space-y-1.5 mb-2">
                            <label className="flex items-center gap-2 cursor-pointer font-medium">
                              <input
                                type="radio"
                                name="c_fol"
                                checked={activeRel.classIds.length === 0}
                                onChange={() => updateActiveRel({ classIds: [] })}
                              />
                              <span>Бүх ангиудад</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer font-medium">
                              <input
                                type="radio"
                                name="c_fol"
                                checked={activeRel.classIds.length > 0}
                                onChange={() => updateActiveRel({ classIds: [classes[0]?.id || ''] })}
                              />
                              <span>Сонгосон ангиуд</span>
                            </label>
                          </div>

                          {activeRel.classIds.length > 0 && (
                            <div className="max-h-40 overflow-y-auto border border-slate-200 rounded p-1.5 bg-white divide-y divide-slate-100">
                              {classes.map((cls) => {
                                const checked = activeRel.classIds.includes(cls.id);
                                return (
                                  <label
                                    key={cls.id}
                                    className="flex items-center gap-2 py-0.5 px-1 hover:bg-slate-50 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleClassForActive(cls.id)}
                                    />
                                    <span>{cls.name}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* RULE 4: СОНГОСОН ХИЧЭЭЛ ЗӨВХӨН БОЛОМЖТОЙ ЦАГ ДЭЭР ХУВААРИЛАХ (allowed_periods_only) */}
                  {activeRel.condition === 'allowed_periods_only' && (
                    <div className="space-y-4">
                      <div className="p-3 bg-indigo-50/80 rounded border border-indigo-200 text-indigo-900 leading-relaxed">
                        <strong className="block mb-1">Дүрмийн тайлбар:</strong>
                        Сонгосон хичээлийг зөвхөн доор тэмдэглэсэн зөвшөөрөгдөх цагуудад хуваарилна (Жишээ: Математик зөвхөн 1, 2, 3-р цагт орох).
                      </div>

                      {/* Selectable Periods Chips with quick buttons */}
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2.5">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <label className="font-bold text-slate-800">
                            Зөвшөөрөгдөх цагуудыг сонгох: <span className="text-red-500">*</span>
                          </label>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateActiveRel({ allowedPeriods: [0, 1, 2] })}
                              className="px-2 py-0.5 text-[10px] font-bold bg-white border border-slate-300 rounded hover:bg-indigo-50 hover:text-indigo-700 transition cursor-pointer"
                            >
                              Өглөө (1-3)
                            </button>
                            <button
                              type="button"
                              onClick={() => updateActiveRel({ allowedPeriods: [3, 4, 5] })}
                              className="px-2 py-0.5 text-[10px] font-bold bg-white border border-slate-300 rounded hover:bg-indigo-50 hover:text-indigo-700 transition cursor-pointer"
                            >
                              Үдээс хойш (4-6)
                            </button>
                            <button
                              type="button"
                              onClick={() => updateActiveRel({ allowedPeriods: [0, 1, 2, 3, 4, 5, 6] })}
                              className="px-2 py-0.5 text-[10px] font-bold bg-white border border-slate-300 rounded hover:bg-indigo-50 hover:text-indigo-700 transition cursor-pointer"
                            >
                              Бүх цагууд
                            </button>
                            <button
                              type="button"
                              onClick={() => updateActiveRel({ allowedPeriods: [] })}
                              className="px-2 py-0.5 text-[10px] font-bold bg-white border border-slate-300 rounded hover:bg-rose-50 text-rose-600 transition cursor-pointer"
                            >
                              Цэвэрлэх
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {Array.from({ length: 7 }).map((_, pIdx) => {
                            const isSelected = (activeRel.allowedPeriods || []).includes(pIdx);
                            return (
                              <button
                                key={pIdx}
                                type="button"
                                onClick={() => togglePeriodForActive(pIdx)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                                }`}
                              >
                                <span>{pIdx + 1}-р цаг</span>
                                {isSelected ? '✓' : ''}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="border border-slate-200 rounded p-3 bg-slate-50">
                          <label className="block font-bold text-slate-800 mb-2">Хамаарах хичээлүүд:</label>
                          <div className="max-h-48 overflow-y-auto border border-slate-200 rounded p-1.5 bg-white divide-y divide-slate-100">
                            {subjects.map((sub) => {
                              const checked = activeRel.subjectIds.includes(sub.id);
                              return (
                                <label
                                  key={sub.id}
                                  className="flex items-center gap-2 py-1 px-1.5 hover:bg-slate-50 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleSubjectForActive(sub.id)}
                                  />
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: sub.color }}
                                  />
                                  <span className="font-semibold text-slate-800">{sub.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        <div className="border border-slate-200 rounded p-3 bg-slate-50">
                          <label className="block font-bold text-slate-800 mb-2">Хамаарах ангиуд:</label>
                          <div className="space-y-1.5 mb-2">
                            <label className="flex items-center gap-2 cursor-pointer font-medium">
                              <input
                                type="radio"
                                name="c_allowed_p"
                                checked={activeRel.classIds.length === 0}
                                onChange={() => updateActiveRel({ classIds: [] })}
                              />
                              <span>Бүх ангиудад</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer font-medium">
                              <input
                                type="radio"
                                name="c_allowed_p"
                                checked={activeRel.classIds.length > 0}
                                onChange={() => updateActiveRel({ classIds: [classes[0]?.id || ''] })}
                              />
                              <span>Сонгосон ангиуд</span>
                            </label>
                          </div>

                          {activeRel.classIds.length > 0 && (
                            <div className="max-h-36 overflow-y-auto border border-slate-200 rounded p-1.5 bg-white divide-y divide-slate-100">
                              {classes.map((cls) => {
                                const checked = activeRel.classIds.includes(cls.id);
                                return (
                                  <label
                                    key={cls.id}
                                    className="flex items-center gap-2 py-0.5 px-1 hover:bg-slate-50 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleClassForActive(cls.id)}
                                    />
                                    <span>{cls.name}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* RULE 5: ӨДӨРТ ЗААХ ЦАГИЙН ХАМГИЙН ИХ/БАГА ХЯЗГААР (daily_hours_limit) */}
                  {activeRel.condition === 'daily_hours_limit' && (
                    <div className="space-y-4">
                      <div className="p-3 bg-teal-50/80 rounded border border-teal-200 text-teal-900 leading-relaxed">
                        <strong className="block mb-1">Дүрмийн тайлбар:</strong>
                        Нэг өдөрт заах/орох цагийн хамгийн бага (Min) ба хамгийн их (Max) цагийн хязгаарыг заана. (Жишээ: Өдөрт 2-оос багагүй, 5-аас ихгүй цаг заах).
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                        <div>
                          <label className="block font-bold text-slate-800 mb-1">Хамаарах субъект:</label>
                          <select
                            value={activeRel.targetEntity || 'teachers'}
                            onChange={(e) => updateActiveRel({ targetEntity: e.target.value as any })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-bold bg-white text-slate-800"
                          >
                            <option value="teachers">Багш нарт хамаарна</option>
                            <option value="classes">Ангиудад хамаарна</option>
                          </select>
                        </div>

                        <div>
                          <label className="block font-bold text-slate-800 mb-1">
                            Өдөрт орох хамгийн бага (Min) цаг:
                          </label>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateActiveRel({ minPeriodsPerDay: Math.max(1, (activeRel.minPeriodsPerDay ?? 2) - 1) })}
                              className="w-7 h-7 bg-white border border-slate-300 rounded font-bold hover:bg-slate-100 cursor-pointer"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              max="8"
                              value={activeRel.minPeriodsPerDay ?? 2}
                              onChange={(e) => updateActiveRel({ minPeriodsPerDay: Number(e.target.value) })}
                              className="w-16 px-2 py-1 border border-slate-300 rounded font-bold text-center bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => updateActiveRel({ minPeriodsPerDay: Math.min(8, (activeRel.minPeriodsPerDay ?? 2) + 1) })}
                              className="w-7 h-7 bg-white border border-slate-300 rounded font-bold hover:bg-slate-100 cursor-pointer"
                            >
                              +
                            </button>
                            <span className="font-semibold text-slate-600">цаг</span>
                          </div>
                        </div>

                        <div>
                          <label className="block font-bold text-slate-800 mb-1">
                            Өдөрт орох хамгийн их (Max) цаг:
                          </label>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateActiveRel({ maxPeriodsPerDay: Math.max(1, (activeRel.maxPeriodsPerDay ?? 5) - 1) })}
                              className="w-7 h-7 bg-white border border-slate-300 rounded font-bold hover:bg-slate-100 cursor-pointer"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              max="9"
                              value={activeRel.maxPeriodsPerDay ?? 5}
                              onChange={(e) => updateActiveRel({ maxPeriodsPerDay: Number(e.target.value) })}
                              className="w-16 px-2 py-1 border border-slate-300 rounded font-bold text-center bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => updateActiveRel({ maxPeriodsPerDay: Math.min(9, (activeRel.maxPeriodsPerDay ?? 5) + 1) })}
                              className="w-7 h-7 bg-white border border-slate-300 rounded font-bold hover:bg-slate-100 cursor-pointer"
                            >
                              +
                            </button>
                            <span className="font-semibold text-slate-600">цаг</span>
                          </div>
                        </div>
                      </div>

                      {/* Target Entity Scope Filter (All vs Selected) */}
                      <div className="border border-slate-200 rounded p-3 bg-slate-50">
                        <label className="block font-bold text-slate-800 mb-2">
                          Хамаарах {activeRel.targetEntity === 'classes' ? 'ангиуд' : 'багш нар'}:
                        </label>
                        {activeRel.targetEntity === 'classes' ? (
                          <div>
                            <div className="space-y-1.5 mb-2">
                              <label className="flex items-center gap-2 cursor-pointer font-medium">
                                <input
                                  type="radio"
                                  name="c_daily_hrs_scope"
                                  checked={!activeRel.classIds || activeRel.classIds.length === 0}
                                  onChange={() => updateActiveRel({ classIds: [] })}
                                />
                                <span>Бүх ангиудад</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer font-medium">
                                <input
                                  type="radio"
                                  name="c_daily_hrs_scope"
                                  checked={Boolean(activeRel.classIds && activeRel.classIds.length > 0)}
                                  onChange={() => updateActiveRel({ classIds: [classes[0]?.id || ''] })}
                                />
                                <span>Сонгосон ангиуд ({activeRel.classIds?.length || 0})</span>
                              </label>
                            </div>
                            {activeRel.classIds && activeRel.classIds.length > 0 && (
                              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded p-1.5 bg-white divide-y divide-slate-100">
                                {classes.map((cls) => (
                                  <label key={cls.id} className="flex items-center gap-2 py-0.5 px-1 hover:bg-slate-50 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={activeRel.classIds?.includes(cls.id)}
                                      onChange={() => toggleClassForActive(cls.id)}
                                    />
                                    <span>{cls.name}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div className="space-y-1.5 mb-2">
                              <label className="flex items-center gap-2 cursor-pointer font-medium">
                                <input
                                  type="radio"
                                  name="t_daily_hrs_scope"
                                  checked={!activeRel.teacherIds || activeRel.teacherIds.length === 0}
                                  onChange={() => updateActiveRel({ teacherIds: [] })}
                                />
                                <span>Бүх багш нарт</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer font-medium">
                                <input
                                  type="radio"
                                  name="t_daily_hrs_scope"
                                  checked={Boolean(activeRel.teacherIds && activeRel.teacherIds.length > 0)}
                                  onChange={() => updateActiveRel({ teacherIds: [teachers[0]?.id || ''] })}
                                />
                                <span>Сонгосон багш нар ({activeRel.teacherIds?.length || 0})</span>
                              </label>
                            </div>
                            {activeRel.teacherIds && activeRel.teacherIds.length > 0 && (
                              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded p-1.5 bg-white divide-y divide-slate-100">
                                {teachers.map((t) => (
                                  <label key={t.id} className="flex items-center gap-2 py-1 px-1.5 hover:bg-slate-50 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={activeRel.teacherIds?.includes(t.id)}
                                      onChange={() => toggleTeacherForActive(t.id)}
                                    />
                                    <span>{t.name}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* RULE 6: ДАРААЛЛАСАН ЦАГИЙН ХАМГИЙН ИХ ХЯЗГААР (max_consecutive_periods) */}
                  {activeRel.condition === 'max_consecutive_periods' && (
                    <div className="space-y-4">
                      <div className="p-3 bg-orange-50/80 rounded border border-orange-200 text-orange-900 leading-relaxed">
                        <strong className="block mb-1">Дүрмийн тайлбар:</strong>
                        Багш эсвэл анги завсаргүй дараалан заах хичээлийн дээд хязгаар (Жишээ: Залгаа 3 цаг заагаад заавал 1 цаг завсарлах).
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                        <div>
                          <label className="block font-bold text-slate-800 mb-1">Хамаарах субъект:</label>
                          <select
                            value={activeRel.targetEntity || 'teachers'}
                            onChange={(e) => updateActiveRel({ targetEntity: e.target.value as any })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-bold bg-white text-slate-800"
                          >
                            <option value="teachers">Багш нарт хамаарна</option>
                            <option value="classes">Ангиудад хамаарна</option>
                          </select>
                        </div>

                        <div>
                          <label className="block font-bold text-slate-800 mb-1">
                            Дарааллан орох хамгийн их цаг:
                          </label>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateActiveRel({ maxConsecutive: Math.max(1, (activeRel.maxConsecutive ?? 3) - 1) })}
                              className="w-7 h-7 bg-white border border-slate-300 rounded font-bold hover:bg-slate-100 cursor-pointer"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              max="6"
                              value={activeRel.maxConsecutive ?? 3}
                              onChange={(e) => updateActiveRel({ maxConsecutive: Number(e.target.value) })}
                              className="w-16 px-2 py-1 border border-slate-300 rounded font-bold text-center bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => updateActiveRel({ maxConsecutive: Math.min(6, (activeRel.maxConsecutive ?? 3) + 1) })}
                              className="w-7 h-7 bg-white border border-slate-300 rounded font-bold hover:bg-slate-100 cursor-pointer"
                            >
                              +
                            </button>
                            <span className="font-semibold text-slate-600">цаг (хэтрэхгүй)</span>
                          </div>
                        </div>
                      </div>

                      {/* Target Entity Scope Filter (All vs Selected) */}
                      <div className="border border-slate-200 rounded p-3 bg-slate-50">
                        <label className="block font-bold text-slate-800 mb-2">
                          Хамаарах {activeRel.targetEntity === 'classes' ? 'ангиуд' : 'багш нар'}:
                        </label>
                        {activeRel.targetEntity === 'classes' ? (
                          <div>
                            <div className="space-y-1.5 mb-2">
                              <label className="flex items-center gap-2 cursor-pointer font-medium">
                                <input
                                  type="radio"
                                  name="c_max_consec_scope"
                                  checked={!activeRel.classIds || activeRel.classIds.length === 0}
                                  onChange={() => updateActiveRel({ classIds: [] })}
                                />
                                <span>Бүх ангиудад</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer font-medium">
                                <input
                                  type="radio"
                                  name="c_max_consec_scope"
                                  checked={Boolean(activeRel.classIds && activeRel.classIds.length > 0)}
                                  onChange={() => updateActiveRel({ classIds: [classes[0]?.id || ''] })}
                                />
                                <span>Сонгосон ангиуд ({activeRel.classIds?.length || 0})</span>
                              </label>
                            </div>
                            {activeRel.classIds && activeRel.classIds.length > 0 && (
                              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded p-1.5 bg-white divide-y divide-slate-100">
                                {classes.map((cls) => (
                                  <label key={cls.id} className="flex items-center gap-2 py-0.5 px-1 hover:bg-slate-50 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={activeRel.classIds?.includes(cls.id)}
                                      onChange={() => toggleClassForActive(cls.id)}
                                    />
                                    <span>{cls.name}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div className="space-y-1.5 mb-2">
                              <label className="flex items-center gap-2 cursor-pointer font-medium">
                                <input
                                  type="radio"
                                  name="t_max_consec_scope"
                                  checked={!activeRel.teacherIds || activeRel.teacherIds.length === 0}
                                  onChange={() => updateActiveRel({ teacherIds: [] })}
                                />
                                <span>Бүх багш нарт</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer font-medium">
                                <input
                                  type="radio"
                                  name="t_max_consec_scope"
                                  checked={Boolean(activeRel.teacherIds && activeRel.teacherIds.length > 0)}
                                  onChange={() => updateActiveRel({ teacherIds: [teachers[0]?.id || ''] })}
                                />
                                <span>Сонгосон багш нар ({activeRel.teacherIds?.length || 0})</span>
                              </label>
                            </div>
                            {activeRel.teacherIds && activeRel.teacherIds.length > 0 && (
                              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded p-1.5 bg-white divide-y divide-slate-100">
                                {teachers.map((t) => (
                                  <label key={t.id} className="flex items-center gap-2 py-1 px-1.5 hover:bg-slate-50 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={activeRel.teacherIds?.includes(t.id)}
                                      onChange={() => toggleTeacherForActive(t.id)}
                                    />
                                    <span>{t.name}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* RULE 7: 1 БАГШ 1 АНГИ БҮЛЭГТ ӨДӨРТ 1-С ИЛҮҮГҮЙ УДАА ОРОХ (teacher_max_once_per_day) */}
                  {activeRel.condition === 'teacher_max_once_per_day' && (
                    <div className="space-y-4">
                      <div className="p-3 bg-blue-50/80 rounded border border-blue-200 text-blue-900 leading-relaxed">
                        <strong className="block mb-1">Дүрмийн тайлбар:</strong>
                        1 багш 1 ангид өдөрт салангид олон дахин орохоос сэргийлж, хамгийн ихдээ 1 удаа орно.
                      </div>

                      <div className="p-3 bg-white rounded border border-slate-200">
                        <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={activeRel.allowDoubleConsecutive !== false}
                            onChange={(e) => updateActiveRel({ allowDoubleConsecutive: e.target.checked })}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                          />
                          <span>Хос цаг (2 цаг залгаж орох)-ийг 1 удаагийн оролт гэж тооцох</span>
                        </label>
                        <p className="text-[11px] text-slate-500 ml-6 mt-1">
                          Залгаа хос хичээлийг зөвшөөрөх бөгөөд өдрийн өөр салангид цагт дахин орохыг хориглоно.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="border border-slate-200 rounded p-3 bg-slate-50">
                          <label className="block font-bold text-slate-800 mb-2">Хамаарах багш нар:</label>
                          <div className="space-y-1.5 mb-2">
                            <label className="flex items-center gap-2 cursor-pointer font-medium">
                              <input
                                type="radio"
                                name="t_daily_scope"
                                checked={!activeRel.teacherIds || activeRel.teacherIds.length === 0}
                                onChange={() => updateActiveRel({ teacherIds: [] })}
                              />
                              <span>Бүх багш нарт</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer font-medium">
                              <input
                                type="radio"
                                name="t_daily_scope"
                                checked={Boolean(activeRel.teacherIds && activeRel.teacherIds.length > 0)}
                                onChange={() => updateActiveRel({ teacherIds: [teachers[0]?.id || ''] })}
                              />
                              <span>Сонгосон багш нар ({activeRel.teacherIds?.length || 0})</span>
                            </label>
                          </div>

                          {activeRel.teacherIds && activeRel.teacherIds.length > 0 && (
                            <div className="max-h-40 overflow-y-auto border border-slate-200 rounded p-1.5 bg-white divide-y divide-slate-100">
                              {teachers.map((t) => (
                                <label key={t.id} className="flex items-center gap-2 py-1 px-1.5 hover:bg-slate-50 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={activeRel.teacherIds?.includes(t.id)}
                                    onChange={() => toggleTeacherForActive(t.id)}
                                  />
                                  <span>{t.name}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="border border-slate-200 rounded p-3 bg-slate-50">
                          <label className="block font-bold text-slate-800 mb-2">Хамаарах ангиуд:</label>
                          <div className="space-y-1.5 mb-2">
                            <label className="flex items-center gap-2 cursor-pointer font-medium">
                              <input
                                type="radio"
                                name="c_daily_scope"
                                checked={!activeRel.classIds || activeRel.classIds.length === 0}
                                onChange={() => updateActiveRel({ classIds: [] })}
                              />
                              <span>Бүх ангиудад</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer font-medium">
                              <input
                                type="radio"
                                name="c_daily_scope"
                                checked={Boolean(activeRel.classIds && activeRel.classIds.length > 0)}
                                onChange={() => updateActiveRel({ classIds: [classes[0]?.id || ''] })}
                              />
                              <span>Сонгосон ангиуд ({activeRel.classIds?.length || 0})</span>
                            </label>
                          </div>

                          {activeRel.classIds && activeRel.classIds.length > 0 && (
                            <div className="max-h-40 overflow-y-auto border border-slate-200 rounded p-1.5 bg-white divide-y divide-slate-100">
                              {classes.map((cls) => (
                                <label key={cls.id} className="flex items-center gap-2 py-1 px-1.5 hover:bg-slate-50 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={activeRel.classIds?.includes(cls.id)}
                                    onChange={() => toggleClassForActive(cls.id)}
                                  />
                                  <span>{cls.name}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* RULE 8: 1 АНГИЙН 1 ХИЧЭЭЛИЙН ДЭД БҮЛГҮҮД ИЖИЛ ЦАГТ ХИЧЭЭЛЛЭХ (same_subject_subgroups_simultaneous) */}
                  {activeRel.condition === 'same_subject_subgroups_simultaneous' && (
                    <div className="space-y-4">
                      <div className="p-3 bg-emerald-50/80 rounded border border-emerald-200 text-emerald-900 leading-relaxed">
                        <strong className="block mb-1">Дүрмийн тайлбар:</strong>
                        Нэг хичээлийг дэд бүлгүүдэд хувааж заах үед дэд бүлгүүд нэг өдөр, яг ижил цагт зэрэгцэн орно. (Жишээ нь: Англи хэлний 1 ба 2-р бүлэг).
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="border border-slate-200 rounded p-3 bg-slate-50">
                          <label className="block font-bold text-slate-800 mb-2">Зэрэгцэх хичээлүүд:</label>
                          <div className="max-h-56 overflow-y-auto border border-slate-200 rounded p-1.5 bg-white divide-y divide-slate-100">
                            {subjects.map((sub) => {
                              const checked = activeRel.subjectIds.includes(sub.id);
                              return (
                                <label key={sub.id} className="flex items-center gap-2 py-1 px-1.5 hover:bg-slate-50 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleSubjectForActive(sub.id)}
                                  />
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: sub.color }}
                                  />
                                  <span className="font-semibold text-slate-800">{sub.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        <div className="border border-slate-200 rounded p-3 bg-slate-50">
                          <label className="block font-bold text-slate-800 mb-2">Хамаарах ангиуд:</label>
                          <div className="space-y-1.5 mb-2">
                            <label className="flex items-center gap-2 cursor-pointer font-medium">
                              <input
                                type="radio"
                                name="c_sub_same"
                                checked={activeRel.classIds.length === 0}
                                onChange={() => updateActiveRel({ classIds: [] })}
                              />
                              <span>Бүх ангиудад</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer font-medium">
                              <input
                                type="radio"
                                name="c_sub_same"
                                checked={activeRel.classIds.length > 0}
                                onChange={() => updateActiveRel({ classIds: [classes[0]?.id || ''] })}
                              />
                              <span>Сонгосон ангиуд</span>
                            </label>
                          </div>

                          {activeRel.classIds.length > 0 && (
                            <div className="max-h-40 overflow-y-auto border border-slate-200 rounded p-1.5 bg-white divide-y divide-slate-100">
                              {classes.map((cls) => (
                                <label key={cls.id} className="flex items-center gap-2 py-1 px-1.5 hover:bg-slate-50 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={activeRel.classIds.includes(cls.id)}
                                    onChange={() => toggleClassForActive(cls.id)}
                                  />
                                  <span>{cls.name}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* RULE 9: 2 ӨӨР ХИЧЭЭЛИЙН ДЭД БҮЛГҮҮД ЗЭРЭГЦЭХ (different_subjects_subgroups_simultaneous) */}
                  {activeRel.condition === 'different_subjects_subgroups_simultaneous' && (
                    <div className="space-y-4">
                      <div className="p-3 bg-purple-50/80 rounded border border-purple-200 text-purple-900 leading-relaxed">
                        <strong className="block mb-1">Дүрмийн тайлбар:</strong>
                        Ангийн сурагчид 2 өөр хичээлийн дэд бүлэгт хуваагдаж, нэгэн зэрэг зэрэгцэн хичээллэнэ. (Жишээ: 10А ангийн Хөвгүүд: Технологи, Охид: Мэдээлэл зүй).
                      </div>

                      {/* Select Class */}
                      <div className="bg-purple-50/50 p-3 rounded-lg border border-purple-200">
                        <label className="block text-slate-800 font-bold mb-1.5">
                          Хамаарах анги бүлгийг сонгох: <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={activeRel.classIds[0] || classes[0]?.id || ''}
                          onChange={(e) => {
                            const newClassId = e.target.value;
                            const clsObj = classes.find((c) => c.id === newClassId);
                            const pairs = getTwoPairs();
                            const s1 = subjects.find((s) => s.id === pairs[0].subjectId)?.name || 'Хичээл 1';
                            const s2 = subjects.find((s) => s.id === pairs[1].subjectId)?.name || 'Хичээл 2';
                            const autoName = `${clsObj?.name || 'Анги'}: ${s1} (${pairs[0].subgroupName}) ∥ ${s2} (${pairs[1].subgroupName}) зэрэгцэн орох`;

                            updateActiveRel({
                              classIds: [newClassId],
                              name: autoName,
                            });
                          }}
                          className="px-3 py-1.5 border border-purple-300 rounded font-bold text-purple-900 bg-white"
                        >
                          {classes.map((cls) => (
                            <option key={cls.id} value={cls.id}>
                              {cls.name} ({cls.shift}-р ээлж)
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* 2 Parallel Pairs */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Pair 1 */}
                        <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-300 space-y-3">
                          <span className="font-bold text-blue-700 flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</span>
                            1-р Хичээл & Дэд бүлэг:
                          </span>

                          <div>
                            <label className="block text-slate-600 mb-1 font-semibold text-[11px]">Хичээл:</label>
                            <select
                              value={getTwoPairs()[0].subjectId}
                              onChange={(e) => updateCrossPair(0, 'subjectId', e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-bold bg-white"
                            >
                              {subjects.map((sub) => (
                                <option key={sub.id} value={sub.id}>
                                  {sub.name} ({sub.shortName})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-slate-600 mb-1 font-semibold text-[11px]">Дэд бүлэг:</label>
                            <select
                              value={getTwoPairs()[0].subgroupName || ''}
                              onChange={(e) => updateCrossPair(0, 'subgroupName', e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-semibold bg-white"
                            >
                              {availableSubgroupsForPair.map((sgName) => (
                                <option key={sgName} value={sgName}>
                                  {sgName}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Pair 2 */}
                        <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-300 space-y-3">
                          <span className="font-bold text-purple-700 flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px]">2</span>
                            2-р Хичээл & Дэд бүлэг:
                          </span>

                          <div>
                            <label className="block text-slate-600 mb-1 font-semibold text-[11px]">Хичээл:</label>
                            <select
                              value={getTwoPairs()[1].subjectId}
                              onChange={(e) => updateCrossPair(1, 'subjectId', e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-bold bg-white"
                            >
                              {subjects.map((sub) => (
                                <option key={sub.id} value={sub.id}>
                                  {sub.name} ({sub.shortName})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-slate-600 mb-1 font-semibold text-[11px]">Дэд бүлэг:</label>
                            <select
                              value={getTwoPairs()[1].subgroupName || ''}
                              onChange={(e) => updateCrossPair(1, 'subgroupName', e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-semibold bg-white"
                            >
                              {availableSubgroupsForPair.map((sgName) => (
                                <option key={sgName} value={sgName}>
                                  {sgName}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* RULE 10: ӨДРИЙН БОЛОН 7 ХОНОГИЙН ЦОНХТОЙ ЦАГИЙН ДЭЭД ХЯЗГААРЫГ ТОГТООХ (max_gaps_daily_weekly) */}
                  {activeRel.condition === 'max_gaps_daily_weekly' && (
                    <div className="space-y-4">
                      <div className="p-3 bg-sky-50/80 rounded border border-sky-200 text-sky-950 leading-relaxed">
                        <strong className="block mb-1">Дүрмийн тайлбар:</strong>
                        Хичээл хоорондын сул завсар буюу "цонх"-той цагийн өдрийн болон 7 хоногийн дээд хязгаарыг хянаж, багш нарын цагийн нягтралыг хангана. (Жишээ: Өдөрт 1-ээс илүүгүй цонх, 7 хоногт нийт 3-аас хэтрэхгүй цонх).
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                        <div>
                          <label className="block font-bold text-slate-800 mb-1">Хамаарах субъект:</label>
                          <select
                            value={activeRel.targetEntity || 'teachers'}
                            onChange={(e) => updateActiveRel({ targetEntity: e.target.value as any })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-bold bg-white text-slate-800"
                          >
                            <option value="teachers">Багш нарт хамаарна</option>
                            <option value="classes">Ангиудад хамаарна</option>
                          </select>
                        </div>

                        <div>
                          <label className="block font-bold text-slate-800 mb-1">
                            Өдрийн цонхны дээд хязгаар:
                          </label>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateActiveRel({ maxGapsPerDay: Math.max(0, (activeRel.maxGapsPerDay ?? 1) - 1) })}
                              className="w-7 h-7 bg-white border border-slate-300 rounded font-bold hover:bg-slate-100 cursor-pointer"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              max="5"
                              value={activeRel.maxGapsPerDay ?? 1}
                              onChange={(e) => updateActiveRel({ maxGapsPerDay: Math.max(0, Number(e.target.value)) })}
                              className="w-16 px-2 py-1 border border-slate-300 rounded font-bold text-center bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => updateActiveRel({ maxGapsPerDay: Math.min(5, (activeRel.maxGapsPerDay ?? 1) + 1) })}
                              className="w-7 h-7 bg-white border border-slate-300 rounded font-bold hover:bg-slate-100 cursor-pointer"
                            >
                              +
                            </button>
                            <span className="font-semibold text-slate-600">цонх / өдөрт</span>
                          </div>
                        </div>

                        <div>
                          <label className="block font-bold text-slate-800 mb-1">
                            7 хоногийн нийт цонхны дээд:
                          </label>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateActiveRel({ maxGapsPerWeek: Math.max(0, (activeRel.maxGapsPerWeek ?? 3) - 1) })}
                              className="w-7 h-7 bg-white border border-slate-300 rounded font-bold hover:bg-slate-100 cursor-pointer"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              max="15"
                              value={activeRel.maxGapsPerWeek ?? 3}
                              onChange={(e) => updateActiveRel({ maxGapsPerWeek: Math.max(0, Number(e.target.value)) })}
                              className="w-16 px-2 py-1 border border-slate-300 rounded font-bold text-center bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => updateActiveRel({ maxGapsPerWeek: Math.min(15, (activeRel.maxGapsPerWeek ?? 3) + 1) })}
                              className="w-7 h-7 bg-white border border-slate-300 rounded font-bold hover:bg-slate-100 cursor-pointer"
                            >
                              +
                            </button>
                            <span className="font-semibold text-slate-600">цонх / 7 хоногт</span>
                          </div>
                        </div>
                      </div>

                      {/* Target Selection (All vs Selected) */}
                      <div className="border border-slate-200 rounded p-3 bg-slate-50">
                        <label className="block font-bold text-slate-800 mb-2">
                          Хамаарах {activeRel.targetEntity === 'classes' ? 'ангиуд' : 'багш нар'}:
                        </label>
                        {activeRel.targetEntity === 'classes' ? (
                          <div>
                            <div className="space-y-1.5 mb-2">
                              <label className="flex items-center gap-2 cursor-pointer font-medium">
                                <input
                                  type="radio"
                                  name="c_max_gaps_scope"
                                  checked={!activeRel.classIds || activeRel.classIds.length === 0}
                                  onChange={() => updateActiveRel({ classIds: [] })}
                                />
                                <span>Бүх ангиудад</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer font-medium">
                                <input
                                  type="radio"
                                  name="c_max_gaps_scope"
                                  checked={Boolean(activeRel.classIds && activeRel.classIds.length > 0)}
                                  onChange={() => updateActiveRel({ classIds: [classes[0]?.id || ''] })}
                                />
                                <span>Сонгосон ангиуд ({activeRel.classIds?.length || 0})</span>
                              </label>
                            </div>
                            {activeRel.classIds && activeRel.classIds.length > 0 && (
                              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded p-1.5 bg-white divide-y divide-slate-100">
                                {classes.map((cls) => (
                                  <label key={cls.id} className="flex items-center gap-2 py-0.5 px-1 hover:bg-slate-50 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={activeRel.classIds?.includes(cls.id)}
                                      onChange={() => toggleClassForActive(cls.id)}
                                    />
                                    <span>{cls.name}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div className="space-y-1.5 mb-2">
                              <label className="flex items-center gap-2 cursor-pointer font-medium">
                                <input
                                  type="radio"
                                  name="t_max_gaps_scope"
                                  checked={!activeRel.teacherIds || activeRel.teacherIds.length === 0}
                                  onChange={() => updateActiveRel({ teacherIds: [] })}
                                />
                                <span>Бүх багш нарт</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer font-medium">
                                <input
                                  type="radio"
                                  name="t_max_gaps_scope"
                                  checked={Boolean(activeRel.teacherIds && activeRel.teacherIds.length > 0)}
                                  onChange={() => updateActiveRel({ teacherIds: [teachers[0]?.id || ''] })}
                                />
                                <span>Сонгосон багш нар ({activeRel.teacherIds?.length || 0})</span>
                              </label>
                            </div>
                            {activeRel.teacherIds && activeRel.teacherIds.length > 0 && (
                              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded p-1.5 bg-white divide-y divide-slate-100">
                                {teachers.map((t) => (
                                  <label key={t.id} className="flex items-center gap-2 py-1 px-1.5 hover:bg-slate-50 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={activeRel.teacherIds?.includes(t.id)}
                                      onChange={() => toggleTeacherForActive(t.id)}
                                    />
                                    <span>{t.name}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* RULE 11: 7 ХОНОГТ ХИЧЭЭЛ ЗААХ ӨДРИЙН ДЭЭД / ДООД ХЯЗГААР (teaching_days_limit) */}
                  {activeRel.condition === 'teaching_days_limit' && (
                    <div className="space-y-4">
                      <div className="p-3 bg-emerald-50/80 rounded border border-emerald-200 text-emerald-950 leading-relaxed">
                        <strong className="block mb-1">Дүрмийн тайлбар:</strong>
                        Багш 7 хоногт нийт хэдэн өдөр хичээл заах хамгийн бага (Min) ба хамгийн их (Max) өдрийн тоог заана. (Жишээ: Цагийн багш 7 хоногт хамгийн ихдээ 3 өдөр зааж, бусад өдөр чөлөөтэй байх).
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                        <div>
                          <label className="block font-bold text-slate-800 mb-1">Хамаарах субъект:</label>
                          <select
                            value={activeRel.targetEntity || 'teachers'}
                            onChange={(e) => updateActiveRel({ targetEntity: e.target.value as any })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-bold bg-white text-slate-800"
                          >
                            <option value="teachers">Багш нарт хамаарна</option>
                            <option value="classes">Ангиудад хамаарна</option>
                          </select>
                        </div>

                        <div>
                          <label className="block font-bold text-slate-800 mb-1">
                            Хамгийн бага (Min) өдөр:
                          </label>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateActiveRel({ minDaysPerWeek: Math.max(1, (activeRel.minDaysPerWeek ?? 3) - 1) })}
                              className="w-7 h-7 bg-white border border-slate-300 rounded font-bold hover:bg-slate-100 cursor-pointer"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              max="5"
                              value={activeRel.minDaysPerWeek ?? 3}
                              onChange={(e) => updateActiveRel({ minDaysPerWeek: Math.max(1, Math.min(5, Number(e.target.value))) })}
                              className="w-16 px-2 py-1 border border-slate-300 rounded font-bold text-center bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => updateActiveRel({ minDaysPerWeek: Math.min(5, (activeRel.minDaysPerWeek ?? 3) + 1) })}
                              className="w-7 h-7 bg-white border border-slate-300 rounded font-bold hover:bg-slate-100 cursor-pointer"
                            >
                              +
                            </button>
                            <span className="font-semibold text-slate-600">өдөр</span>
                          </div>
                        </div>

                        <div>
                          <label className="block font-bold text-slate-800 mb-1">
                            Хамгийн их (Max) өдөр:
                          </label>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateActiveRel({ maxDaysPerWeek: Math.max(1, (activeRel.maxDaysPerWeek ?? 5) - 1) })}
                              className="w-7 h-7 bg-white border border-slate-300 rounded font-bold hover:bg-slate-100 cursor-pointer"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              max="5"
                              value={activeRel.maxDaysPerWeek ?? 5}
                              onChange={(e) => updateActiveRel({ maxDaysPerWeek: Math.max(1, Math.min(5, Number(e.target.value))) })}
                              className="w-16 px-2 py-1 border border-slate-300 rounded font-bold text-center bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => updateActiveRel({ maxDaysPerWeek: Math.min(5, (activeRel.maxDaysPerWeek ?? 5) + 1) })}
                              className="w-7 h-7 bg-white border border-slate-300 rounded font-bold hover:bg-slate-100 cursor-pointer"
                            >
                              +
                            </button>
                            <span className="font-semibold text-slate-600">өдөр</span>
                          </div>
                        </div>
                      </div>

                      {/* Target Selection */}
                      <div className="border border-slate-200 rounded p-3 bg-slate-50">
                        <label className="block font-bold text-slate-800 mb-2">
                          Хамаарах {activeRel.targetEntity === 'classes' ? 'ангиуд' : 'багш нар'}:
                        </label>
                        {activeRel.targetEntity === 'classes' ? (
                          <div>
                            <div className="space-y-1.5 mb-2">
                              <label className="flex items-center gap-2 cursor-pointer font-medium">
                                <input
                                  type="radio"
                                  name="c_teaching_days_scope"
                                  checked={!activeRel.classIds || activeRel.classIds.length === 0}
                                  onChange={() => updateActiveRel({ classIds: [] })}
                                />
                                <span>Бүх ангиудад</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer font-medium">
                                <input
                                  type="radio"
                                  name="c_teaching_days_scope"
                                  checked={Boolean(activeRel.classIds && activeRel.classIds.length > 0)}
                                  onChange={() => updateActiveRel({ classIds: [classes[0]?.id || ''] })}
                                />
                                <span>Сонгосон ангиуд ({activeRel.classIds?.length || 0})</span>
                              </label>
                            </div>
                            {activeRel.classIds && activeRel.classIds.length > 0 && (
                              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded p-1.5 bg-white divide-y divide-slate-100">
                                {classes.map((cls) => (
                                  <label key={cls.id} className="flex items-center gap-2 py-0.5 px-1 hover:bg-slate-50 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={activeRel.classIds?.includes(cls.id)}
                                      onChange={() => toggleClassForActive(cls.id)}
                                    />
                                    <span>{cls.name}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div className="space-y-1.5 mb-2">
                              <label className="flex items-center gap-2 cursor-pointer font-medium">
                                <input
                                  type="radio"
                                  name="t_teaching_days_scope"
                                  checked={!activeRel.teacherIds || activeRel.teacherIds.length === 0}
                                  onChange={() => updateActiveRel({ teacherIds: [] })}
                                />
                                <span>Бүх багш нарт</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer font-medium">
                                <input
                                  type="radio"
                                  name="t_teaching_days_scope"
                                  checked={Boolean(activeRel.teacherIds && activeRel.teacherIds.length > 0)}
                                  onChange={() => updateActiveRel({ teacherIds: [teachers[0]?.id || ''] })}
                                />
                                <span>Сонгосон багш нар ({activeRel.teacherIds?.length || 0})</span>
                              </label>
                            </div>
                            {activeRel.teacherIds && activeRel.teacherIds.length > 0 && (
                              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded p-1.5 bg-white divide-y divide-slate-100">
                                {teachers.map((t) => (
                                  <label key={t.id} className="flex items-center gap-2 py-1 px-1.5 hover:bg-slate-50 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={activeRel.teacherIds?.includes(t.id)}
                                      onChange={() => toggleTeacherForActive(t.id)}
                                    />
                                    <span>{t.name}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* RULE 12: 2 БУЮУ 3 ЭЭЛЖИНД ХИЧЭЭЛ ЗААДАГ БОЛ АЛЬ БОЛОХ 2 ЭЭЛЖИЙГ ДАМЖИХ ЦОНХ БАГА БАЙЛГАХ (minimize_shift_crossing_gap) */}
                  {activeRel.condition === 'minimize_shift_crossing_gap' && (
                    <div className="space-y-4">
                      <div className="p-3 bg-indigo-50/80 rounded border border-indigo-200 text-indigo-950 leading-relaxed">
                        <strong className="block mb-1">Дүрмийн тайлбар:</strong>
                        Сургууль олон ээлжтэй үед нэг өдөр 1-р ээлж (өглөө) ба 2-р ээлж (үдээс хойш)-нд аль алинд нь хичээл заадаг багш нарын ээлж хоорондын шилжилтийн сул хүлээлтийн цонхыг хамгийн бага байлгаж, залгаа эсвэл нягт хуваарилна.
                      </div>

                      <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-3">
                        <div>
                          <label className="block font-bold text-slate-800 mb-1.5">
                            Ээлж дамжих цонхны зөвшөөрөгдөх дээд хязгаар:
                          </label>
                          <div className="flex items-center gap-2 flex-wrap">
                            {[
                              { gap: 0, label: 'Цонхгүй, шууд залгаа (0 цаг)' },
                              { gap: 1, label: 'Хамгийн ихдээ 1 цагийн завсар' },
                              { gap: 2, label: 'Хамгийн ихдээ 2 цагийн завсар' },
                            ].map((item) => {
                              const isSelected = (activeRel.maxCrossShiftGap ?? 1) === item.gap;
                              return (
                                <button
                                  key={item.gap}
                                  type="button"
                                  onClick={() => updateActiveRel({ maxCrossShiftGap: item.gap })}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                                    isSelected
                                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                                  }`}
                                >
                                  <span>{item.label}</span>
                                  {isSelected ? '✓' : ''}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Target Selection for Teachers */}
                      <div className="border border-slate-200 rounded p-3 bg-slate-50">
                        <label className="block font-bold text-slate-800 mb-2">Хамаарах багш нар:</label>
                        <div className="space-y-1.5 mb-2">
                          <label className="flex items-center gap-2 cursor-pointer font-medium">
                            <input
                              type="radio"
                              name="t_shift_cross_scope"
                              checked={!activeRel.teacherIds || activeRel.teacherIds.length === 0}
                              onChange={() => updateActiveRel({ teacherIds: [] })}
                            />
                            <span>Бүх багш нарт (Олон ээлж дамжин заадаг бүх багш)</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer font-medium">
                            <input
                              type="radio"
                              name="t_shift_cross_scope"
                              checked={Boolean(activeRel.teacherIds && activeRel.teacherIds.length > 0)}
                              onChange={() => updateActiveRel({ teacherIds: [teachers[0]?.id || ''] })}
                            />
                            <span>Сонгосон багш нар ({activeRel.teacherIds?.length || 0})</span>
                          </label>
                        </div>

                        {activeRel.teacherIds && activeRel.teacherIds.length > 0 && (
                          <div className="max-h-40 overflow-y-auto border border-slate-200 rounded p-1.5 bg-white divide-y divide-slate-100">
                            {teachers.map((t) => (
                              <label key={t.id} className="flex items-center gap-2 py-1 px-1.5 hover:bg-slate-50 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={activeRel.teacherIds?.includes(t.id)}
                                  onChange={() => toggleTeacherForActive(t.id)}
                                />
                                <span>{t.name}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* OTHER RULES (Ideal distribution, building buffer, etc.) */}
                  {activeRel.condition === 'building_transfer_buffer' && (
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                      <div className="font-bold text-slate-800 text-sm">
                        Байр солигдох завсарлага (Building transfer buffer):
                      </div>
                      <p className="text-slate-600 leading-relaxed">
                        Багш 1-р байрнаас 2-р байр луу залгаа цагт шууд шилжиж орохгүй байхаар завсар цаг автоматаар хангана.
                      </p>
                    </div>
                  )}

                  {activeRel.condition === 'ideal_distribution' && (
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                      <div className="font-bold text-slate-800 text-sm">
                        7 хоногт жигд тархах (Ideal distribution):
                      </div>
                      <p className="text-slate-600 leading-relaxed">
                        Хичээлүүд нэг өдөр шахагдахгүйгээр долоо хоногийн ажлын өдрүүдэд тэнцвэртэй жигд тархаж хуваарилагдана.
                      </p>
                    </div>
                  )}

                  {/* Note input field for any rule */}
                  <div className="pt-2 border-t border-slate-200">
                    <label className="block font-bold text-slate-700 mb-1">
                      Тэмдэглэл / Тайлбар (Сонголтоор):
                    </label>
                    <input
                      type="text"
                      value={activeRel.note || ''}
                      onChange={(e) => updateActiveRel({ note: e.target.value })}
                      placeholder="Жишээ: 10А ангийн лабораторийн тусгай шаардлага"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-slate-800"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-400">Дүрмийг зүүн жагсаалтаас сонгоно уу.</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-200/90 px-4 py-2.5 border-t border-slate-300 flex justify-between items-center text-xs shrink-0">
          <span className="text-slate-600 font-medium">
            💡 Дүрмийн тохиргоог хийгээд <strong>"Тохиргоог хадгалах"</strong> товчийг дарна уу. Хуваарь зохиогч автоматаар тооцоолно.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-white border border-slate-300 rounded text-slate-700 font-bold hover:bg-slate-100 shadow-xs cursor-pointer"
            >
              Хаах
            </button>
            <button
              onClick={handleSaveAll}
              className="px-5 py-1.5 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Тохиргоог хадгалах</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
