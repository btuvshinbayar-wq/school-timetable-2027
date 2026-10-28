import React from 'react';
import {
  Undo2,
  Redo2,
  BookOpen,
  Users,
  DoorOpen,
  GraduationCap,
  Sliders,
  School,
  Gavel,
  UserX,
  FileSpreadsheet,
  Printer,
  Save,
  FolderOpen,
  FilePlus,
  Calendar,
  RefreshCw,
  Share2,
  Bell,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { WeekCycle, ManagerProfile } from '../types/timetable';

interface SingleHeaderToolbarProps {
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  // Navigation / entity dialog triggers
  onOpenSubjects: () => void;
  onOpenTeachers: () => void;
  onOpenClasses: () => void;
  onOpenClassrooms: () => void;
  onOpenLessons?: () => void;
  onOpenRelations: () => void;
  onOpenManagerExchange?: () => void;
  onOpenSchoolSettings: () => void;
  onOpenGenerator: () => void;
  onOpenVerification: () => void;
  onOpenSubstitution?: () => void;
  onOpenExcel: () => void;
  onOpenPrintPreview: () => void;
  onNewProject: () => void;
  onOpenProjectFile: () => void;
  onSaveProjectFile: () => void;
  onOpenBackups?: () => void;
  lastBackupTime?: string;
  projectName?: string;
  schoolName?: string;
  academicYear?: string;
  enableWeekAB?: boolean;

  // View & Filter states
  viewMode: 'whole_classes' | 'whole_teachers' | 'single_class' | 'single_teacher' | 'single_room';
  onChangeViewMode: (mode: any) => void;
  activeEntityId: string;
  onChangeActiveEntityId: (id: string) => void;

  // Manager filter
  activeManagerId?: string;
  onChangeActiveManagerId?: (id: string) => void;
  managers?: ManagerProfile[];

  // Shift & Week A/B filters
  shiftsCount?: number;
  shifts?: { shiftNumber: number; name: string }[];
  activeShift: number; // 0 = all shifts, 1 = 1-р ээлж, 2 = 2-р ээлж, 3 = 3-р ээлж
  onChangeShift: (shift: number) => void;
  activeWeekCycle: WeekCycle;
  onChangeWeekCycle: (cycle: WeekCycle) => void;

  // Entities list for dropdowns
  classes: { id: string; name: string; shift: number }[];
  teachers: { id: string; name: string }[];
  classrooms: { id: string; name: string; buildingId: string }[];
  buildings: { id: string; name: string; shortName: string }[];
}

export const SingleHeaderToolbar: React.FC<SingleHeaderToolbarProps> = ({
  onOpenSubjects,
  onOpenTeachers,
  onOpenClasses,
  onOpenClassrooms,
  onOpenRelations,
  onOpenManagerExchange,
  onOpenSchoolSettings,
  onOpenGenerator,
  onOpenVerification,
  onOpenSubstitution,
  onOpenExcel,
  onOpenPrintPreview,
  onNewProject,
  onOpenProjectFile,
  onSaveProjectFile,
  onOpenBackups,
  lastBackupTime,
  projectName,
  schoolName,
  academicYear,
  enableWeekAB,
  viewMode,
  onChangeViewMode,
  activeEntityId,
  onChangeActiveEntityId,
  activeManagerId,
  onChangeActiveManagerId,
  managers,
  shiftsCount = 2,
  shifts = [],
  activeShift,
  onChangeShift,
  activeWeekCycle,
  onChangeWeekCycle,
  classes,
  teachers,
  classrooms,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}) => {
  const effectiveShiftsCount = Math.max(1, Math.min(3, shiftsCount || (shifts?.length ?? 2)));
  return (
    <header className="bg-[#ecebe5] border-b border-[#d6d1c6] select-none flex flex-col shrink-0 shadow-xs font-sans">
      {/* 1. Header Top Line: Logo, Project Name, and PWA Install */}
      <div className="asc-window-titlebar px-3 py-1.5 flex items-center justify-between border-b border-[#d6d1c6] text-xs">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-[5px] bg-[#2f5d52] flex items-center justify-center shrink-0">
            <Bell className="w-3 h-3 text-[#fdfbf6]" />
          </div>
          <span className="font-bold text-slate-800 text-xs tracking-tight">
            School timetable 2027
          </span>
          <span className="text-slate-400 text-xs select-none">•</span>
          <span className="text-[11px] text-slate-600 font-semibold truncate max-w-[320px]">
            {projectName || `${schoolName || 'Сургууль'} (${academicYear || '2026-2027'})`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <PWAInstallButton />
        </div>
      </div>

      {/* 2. Main Unified Toolbar Buttons */}
      <div className="asc-ribbon px-2 py-1.5 flex items-stretch gap-1 overflow-x-auto">
        {/* Group 1: Файл үйлдлүүд */}
        <div className="flex items-center gap-0.5 pr-2 border-r border-[#d6d1c6]">
          <button onClick={onNewProject} className="asc-ribbon-btn" title="Шинэ хуваарь үүсгэх">
            <FilePlus className="w-5 h-5 ribbon-icon" />
            <span className="mt-0.5 font-medium">Шинэ</span>
          </button>
          <button onClick={onOpenProjectFile} className="asc-ribbon-btn" title="Хадгалсан төсөл нээх (.roz / .json)">
            <FolderOpen className="w-5 h-5 ribbon-icon" />
            <span className="mt-0.5 font-medium">Нээх</span>
          </button>
          <button onClick={onSaveProjectFile} className="asc-ribbon-btn" title="Төслийг файл болгон хадгалах">
            <Save className="w-5 h-5 ribbon-icon" />
            <span className="mt-0.5 font-medium">Хадгалах</span>
          </button>
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="asc-ribbon-btn disabled:opacity-40 disabled:cursor-default"
            title="Буцаах (Ctrl+Z)"
          >
            <Undo2 className="w-5 h-5 ribbon-icon" />
            <span className="mt-0.5 font-medium">Буцаах</span>
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="asc-ribbon-btn disabled:opacity-40 disabled:cursor-default"
            title="Дахих (Ctrl+Y)"
          >
            <Redo2 className="w-5 h-5 ribbon-icon" />
            <span className="mt-0.5 font-medium">Дахих</span>
          </button>
          <button onClick={onOpenPrintPreview} className="asc-ribbon-btn" title="Хуваарийг хэвлэх">
            <Printer className="w-5 h-5 ribbon-icon" />
            <span className="mt-0.5 font-medium">Хэвлэх</span>
          </button>
        </div>

        {/* Group 2: Харах горим сонгох (Багш нар / Анги бүлгүүд / Танхим) */}
        <div className="flex flex-col justify-center px-2 border-r border-[#d6d1c6]">
          <div className="flex items-center gap-1.5 bg-white border border-[#d6d1c6] rounded px-2 py-1 shadow-xs">
            {viewMode === 'whole_teachers' || viewMode === 'single_teacher' ? (
              <GraduationCap className="w-4 h-4 text-slate-800" />
            ) : viewMode === 'single_room' ? (
              <DoorOpen className="w-4 h-4 text-slate-800" />
            ) : (
              <Users className="w-4 h-4 text-slate-800" />
            )}
            <select
              value={viewMode}
              onChange={(e) => {
                const val = e.target.value as any;
                onChangeViewMode(val);
                if (val === 'single_class' && !activeEntityId) onChangeActiveEntityId(classes[0]?.id || '');
                if (val === 'single_teacher' && !activeEntityId) onChangeActiveEntityId(teachers[0]?.id || '');
                if (val === 'single_room' && !activeEntityId) onChangeActiveEntityId(classrooms[0]?.id || '');
              }}
              className="text-[11px] font-bold text-slate-900 bg-transparent focus:outline-none cursor-pointer pr-1"
            >
              <option value="whole_teachers">Багш нараар (Бүхэлд нь)</option>
              <option value="whole_classes">Анги бүлгээр (Бүхэлд нь)</option>
              <option value="single_teacher">Багш тус бүрээр</option>
              <option value="single_class">Анги тус бүрээр</option>
              <option value="single_room">Танхим тус бүрээр</option>
            </select>
          </div>

          {/* Дэд сонгогч */}
          {(viewMode === 'single_class' || viewMode === 'single_teacher' || viewMode === 'single_room') && (
            <div className="mt-1">
              {viewMode === 'single_class' && (
                <select
                  value={activeEntityId}
                  onChange={(e) => onChangeActiveEntityId(e.target.value)}
                  className="w-full text-[10px] font-semibold text-slate-800 bg-white border border-slate-300 rounded px-1 py-0.5"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.shift}-р ээлж)</option>
                  ))}
                </select>
              )}
              {viewMode === 'single_teacher' && (
                <select
                  value={activeEntityId}
                  onChange={(e) => onChangeActiveEntityId(e.target.value)}
                  className="w-full text-[10px] font-semibold text-slate-800 bg-white border border-slate-300 rounded px-1 py-0.5"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
              {viewMode === 'single_room' && (
                <select
                  value={activeEntityId}
                  onChange={(e) => onChangeActiveEntityId(e.target.value)}
                  className="w-full text-[10px] font-semibold text-slate-800 bg-white border border-slate-300 rounded px-1 py-0.5"
                >
                  {classrooms.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        {/* Group 3: Өгөгдлийн сан */}
        <div className="flex items-center gap-0.5 px-2 border-r border-slate-300">
          <button onClick={onOpenSubjects} className="asc-ribbon-btn" title="Хичээлүүдийн бүртгэл">
            <BookOpen className="w-5 h-5 ribbon-icon" />
            <span className="mt-0.5 font-medium">Хичээлүүд</span>
          </button>
          <button onClick={onOpenClasses} className="asc-ribbon-btn" title="Анги бүлгүүдийн сан">
            <Users className="w-5 h-5 ribbon-icon" />
            <span className="mt-0.5 font-medium">Анги бүлэг</span>
          </button>
          <button onClick={onOpenClassrooms} className="asc-ribbon-btn" title="Анги танхимууд">
            <DoorOpen className="w-5 h-5 ribbon-icon" />
            <span className="mt-0.5 font-medium">Анги танхим</span>
          </button>
          <button onClick={onOpenTeachers} className="asc-ribbon-btn" title="Багш нарын бүртгэл">
            <GraduationCap className="w-5 h-5 ribbon-icon" />
            <span className="mt-0.5 font-medium">Багш нар</span>
          </button>
          <button onClick={onOpenRelations} className="asc-ribbon-btn" title="Сурагч, дэд бүлэг, хичээлийн хамаарал">
            <Sliders className="w-5 h-5 ribbon-icon" />
            <span className="mt-0.5 font-medium text-center">Хамаарал</span>
          </button>
          <button
            onClick={onOpenManagerExchange}
            className="asc-ribbon-btn hover:bg-indigo-50 hover:border-indigo-300"
            title="1 сургуулийн 2-3 менежер өөр өөрийн багш нарын цаг хуваарилалтыг оруулах, солилцох & нэгтгэх төв"
          >
            <Share2 className="w-5 h-5 ribbon-icon" />
            <span className="mt-0.5 font-medium">Менежерүүд</span>
          </button>
        </div>

        {/* Group 4: Бодолт & Шалгалт */}
        <div className="flex items-center gap-0.5 px-2 border-r border-[#d6d1c6]">
          <button onClick={onOpenVerification} className="asc-ribbon-btn" title="Хуваарийн нөхцөл, дүрэм шалгах">
            <Gavel className="w-5 h-5 ribbon-icon" />
            <span className="mt-0.5 font-medium">Шалгах</span>
          </button>
          <button onClick={onOpenSubstitution} className="asc-ribbon-btn" title="Өвчтэй, чөлөөтэй багшийн хичээлийг зохицуулах">
            <UserX className="w-5 h-5 ribbon-icon" />
            <span className="mt-0.5 font-medium">Орлон заалт</span>
          </button>
          <button
            onClick={onOpenGenerator}
            className="asc-ribbon-btn hover:bg-red-50 hover:border-red-300"
            title="Автоматаар шинэ хуваарь бодож зохиох"
          >
            <RefreshCw className="w-5 h-5 ribbon-icon-primary" />
            <span className="mt-0.5 font-semibold text-blue-700">Хуваарь бодох</span>
          </button>
        </div>

        {/* Group 5: Тохиргоо & Excel */}
        <div className="flex items-center gap-0.5 pl-2">
          <button onClick={onOpenSchoolSettings} className="asc-ribbon-btn" title="Сургууль, ээлж, хонхны тохиргоо">
            <School className="w-5 h-5 ribbon-icon" />
            <span className="mt-0.5 font-medium">Сургууль</span>
          </button>

          <button onClick={onOpenExcel} className="asc-ribbon-btn" title="Excel загвар файл импортлох">
            <FileSpreadsheet className="w-5 h-5 ribbon-icon" />
            <span className="mt-0.5 font-medium">Excel импорт</span>
          </button>
        </div>
      </div>

      {/* 3. Sub-Ribbon Filter Bar: Shifts & Week A/B Switchers */}
      <div className="bg-[#e6e2da] px-3 py-1 flex items-center justify-between text-xs border-t border-[#d6d1c6]">
        <div className="flex items-center gap-2">
          {/* Shift selector pills - only display if school has more than 1 shift, and only up to configured shiftsCount */}
          {effectiveShiftsCount > 1 ? (
            <div className="flex items-center gap-0.5 bg-white/70 p-0.5 rounded border border-[#d6d1c6] shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-600 px-1.5">Ээлж:</span>
              <button
                onClick={() => onChangeShift(0)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                  activeShift === 0 ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200'
                }`}
                title="Бүх ээлжийн хичээлүүдийг зэрэг харах"
              >
                Бүх ээлж
              </button>
              {Array.from({ length: effectiveShiftsCount }).map((_, idx) => {
                const shiftNum = idx + 1;
                const shiftObj = shifts.find((s) => s.shiftNumber === shiftNum);
                const shiftLabel =
                  shiftObj?.name ||
                  (shiftNum === 1 ? '1-р ээлж (Өглөө)' : shiftNum === 2 ? '2-р ээлж (Өдөр)' : `${shiftNum}-р ээлж (Орой)`);
                return (
                  <button
                    key={shiftNum}
                    onClick={() => onChangeShift(shiftNum)}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                      activeShift === shiftNum ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200'
                    }`}
                    title={`${shiftLabel} сонгох`}
                  >
                    {shiftLabel}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-white/60 px-2.5 py-0.5 rounded border border-[#d6d1c6] text-[11px] text-slate-700 font-medium shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-500">Ээлж:</span>
              <span className="font-bold text-blue-800">1-р ээлж</span>
            </div>
          )}

          {/* Week A/B selector if enabled */}
          {enableWeekAB && (
            <div className="flex items-center gap-0.5 bg-white/70 p-0.5 rounded border border-[#d6d1c6] shadow-xs">
              <Calendar className="w-3.5 h-3.5 text-amber-700 ml-1" />
              <span className="text-[10px] uppercase font-bold text-slate-600 px-1">7 хоног:</span>
              <button
                onClick={() => onChangeWeekCycle('all')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                  activeWeekCycle === 'all' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                Бүгд
              </button>
              <button
                onClick={() => onChangeWeekCycle('week_a')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                  activeWeekCycle === 'week_a' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                А 7 хоног
              </button>
              <button
                onClick={() => onChangeWeekCycle('week_b')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                  activeWeekCycle === 'week_b' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                Б 7 хоног
              </button>
            </div>
          )}

        </div>

        {/* Right Info Indicator */}
        <div className="flex items-center gap-2 text-slate-600 text-[11px]">
          {lastBackupTime && (
            <span className="hidden sm:inline font-mono text-[10px] bg-white/80 px-1.5 py-0.5 rounded border border-[#d6d1c6]">
              💾 Backup: {lastBackupTime.includes(' ') ? lastBackupTime.split(' ')[1] : lastBackupTime}
            </span>
          )}
        </div>
      </div>
    </header>
  );
};
