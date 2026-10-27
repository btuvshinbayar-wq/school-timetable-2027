import React, { useState } from 'react';
import {
  FileText,
  FolderOpen,
  Save,
  Printer,
  Search,
  BookOpen,
  Users,
  DoorOpen,
  GraduationCap,
  Network,
  CheckCircle2,
  Siren,
  Gavel,
  School,
  FileSpreadsheet,
  Download,
  HelpCircle,
  Maximize2,
  Minimize2,
  Monitor,
  Bell,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface RibbonProps {
  currentTab: 'main' | 'file' | 'specification' | 'view' | 'timetable' | 'options' | 'help';
  onSelectTab: (tab: any) => void;
  viewMode: 'whole_classes' | 'whole_teachers' | 'single_class' | 'single_teacher' | 'single_room';
  onChangeViewMode: (mode: any) => void;
  activeEntityId: string;
  onChangeActiveEntityId: (id: string) => void;
  classes: { id: string; name: string }[];
  teachers: { id: string; name: string }[];
  classrooms: { id: string; name: string }[];
  onOpenSubjects: () => void;
  onOpenClasses: () => void;
  onOpenClassrooms: () => void;
  onOpenTeachers: () => void;
  onOpenRelations: () => void;
  onOpenSchoolSettings: () => void;
  onOpenGenerator: () => void;
  onOpenVerification: () => void;
  onOpenExcel: () => void;
  onOpenPrintPreview: () => void;
  onNewProject: () => void;
  onOpenProjectFile: () => void;
  onSaveProjectFile: () => void;
  isDesktopFrame: boolean;
  onToggleDesktopFrame: () => void;
}

export const Ribbon: React.FC<RibbonProps> = ({
  currentTab,
  onSelectTab,
  viewMode,
  onChangeViewMode,
  activeEntityId,
  onChangeActiveEntityId,
  classes,
  teachers,
  classrooms,
  onOpenSubjects,
  onOpenClasses,
  onOpenClassrooms,
  onOpenTeachers,
  onOpenRelations,
  onOpenSchoolSettings,
  onOpenGenerator,
  onOpenVerification,
  onOpenExcel,
  onOpenPrintPreview,
  onNewProject,
  onOpenProjectFile,
  onSaveProjectFile,
  isDesktopFrame,
  onToggleDesktopFrame,
}) => {
  const tabs = [
    { id: 'main', label: 'Main' },
    { id: 'file', label: 'File' },
    { id: 'specification', label: 'Specification' },
    { id: 'view', label: 'View' },
    { id: 'timetable', label: 'Timetable' },
    { id: 'options', label: 'Options' },
    { id: 'help', label: 'Help' },
  ];

  return (
    <div className="bg-gradient-to-b from-[#e3edf8] to-[#c9dcf0] border-b border-[#8faecf] shadow-sm select-none flex flex-col">
      {/* Ribbon Tabs bar */}
      <div className="flex items-center px-2 pt-1 border-b border-[#a9c3de] text-xs">
        {/* Bell Mascot Icon */}
        <div className="flex items-center gap-1.5 mr-3 pr-2 border-r border-[#a9c3de]">
          <div className="w-5 h-5 rounded-xs bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center shadow-xs border border-amber-600">
            <Bell className="w-3.5 h-3.5 text-amber-950 fill-amber-900/60" />
          </div>
          <span className="font-extrabold text-[#1e4368] text-xs tracking-tight">School timetable 2027</span>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-0.5">
          {tabs.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id as any)}
                className={`px-3 py-1 font-semibold rounded-t transition-colors ${
                  isActive
                    ? 'bg-gradient-to-b from-white to-[#e3edf8] text-[#1b3e64] border-t border-x border-[#8faecf] shadow-xs'
                    : 'text-[#2a5078] hover:bg-white/40'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Top Right Desktop / PWA tools */}
        <div className="ml-auto flex items-center gap-2 pb-0.5">
          <PWAInstallButton />
          <button
            onClick={onToggleDesktopFrame}
            className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-[#1e4368] hover:bg-white/50 rounded border border-[#a9c3de]"
            title="Десктоп цонх / Бүрэн дэлгэцийн горим солих"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>{isDesktopFrame ? 'Бүтэн дэлгэц' : 'Десктоп цонх'}</span>
          </button>
        </div>
      </div>

      {/* Ribbon Action Buttons Area (Classic aSc Timetables Image 2 Layout) */}
      <div className="p-1.5 flex items-center gap-3 overflow-x-auto min-h-[5.5rem] bg-gradient-to-b from-[#eef4fa] to-[#d6e5f5]">
        {/* Group 1: File Actions */}
        <div className="flex items-center gap-1 pr-2 border-r border-[#afc7de]">
          <button
            onClick={onNewProject}
            className="flex flex-col items-center justify-center w-14 h-16 rounded hover:bg-white/70 hover:border hover:border-[#9ec1e6] active:bg-[#c6def8] transition text-[#1e4368] group"
            title="Шинэ хуваарь үүсгэх"
          >
            <div className="w-8 h-8 rounded bg-gradient-to-b from-white to-slate-100 border border-slate-300 shadow-2xs flex items-center justify-center text-emerald-600 group-hover:scale-105 transition">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-medium mt-1 leading-none">New</span>
          </button>

          <button
            onClick={onOpenProjectFile}
            className="flex flex-col items-center justify-center w-14 h-16 rounded hover:bg-white/70 hover:border hover:border-[#9ec1e6] active:bg-[#c6def8] transition text-[#1e4368] group"
            title="Төсөл нээх (.roz / .json)"
          >
            <div className="w-8 h-8 rounded bg-gradient-to-b from-amber-100 to-amber-200 border border-amber-300 shadow-2xs flex items-center justify-center text-amber-700 group-hover:scale-105 transition">
              <FolderOpen className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-medium mt-1 leading-none">Open</span>
          </button>

          <button
            onClick={onSaveProjectFile}
            className="flex flex-col items-center justify-center w-14 h-16 rounded hover:bg-white/70 hover:border hover:border-[#9ec1e6] active:bg-[#c6def8] transition text-[#1e4368] group"
            title="Төсөл хадгалах (.roz файл татах)"
          >
            <div className="w-8 h-8 rounded bg-gradient-to-b from-blue-100 to-blue-200 border border-blue-300 shadow-2xs flex items-center justify-center text-blue-700 group-hover:scale-105 transition">
              <Save className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-medium mt-1 leading-none">Save</span>
          </button>

          <button
            onClick={onOpenPrintPreview}
            className="flex flex-col items-center justify-center w-14 h-16 rounded hover:bg-white/70 hover:border hover:border-[#9ec1e6] active:bg-[#c6def8] transition text-[#1e4368] group"
            title="Хэвлэх харагдац"
          >
            <div className="w-8 h-8 rounded bg-gradient-to-b from-slate-100 to-slate-200 border border-slate-300 shadow-2xs flex items-center justify-center text-slate-700 group-hover:scale-105 transition">
              <Printer className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-medium mt-1 leading-none">Print</span>
          </button>
        </div>

        {/* Group 2: View Switcher */}
        <div className="flex flex-col justify-center gap-1 pr-2 border-r border-[#afc7de]">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Харагдац (View)</span>
          <select
            value={viewMode}
            onChange={(e) => {
              const val = e.target.value as any;
              onChangeViewMode(val);
              if (val === 'single_class' && !activeEntityId) onChangeActiveEntityId(classes[0]?.id || '');
              if (val === 'single_teacher' && !activeEntityId) onChangeActiveEntityId(teachers[0]?.id || '');
              if (val === 'single_room' && !activeEntityId) onChangeActiveEntityId(classrooms[0]?.id || '');
            }}
            className="px-2 py-1 bg-white border border-[#96b4d3] rounded text-xs font-semibold text-[#1e4368] shadow-xs"
          >
            <option value="whole_classes">Whole (Бүх ангиуд)</option>
            <option value="whole_teachers">Whole (Бүх багш нар)</option>
            <option value="single_class">Анги тус бүрээр</option>
            <option value="single_teacher">Багш тус бүрээр</option>
            <option value="single_room">Танхим тус бүрээр</option>
          </select>

          {/* Sub-selector for single views */}
          {viewMode === 'single_class' && (
            <select
              value={activeEntityId}
              onChange={(e) => onChangeActiveEntityId(e.target.value)}
              className="px-2 py-0.5 bg-amber-50 border border-amber-300 rounded text-[11px] font-bold text-amber-900"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          {viewMode === 'single_teacher' && (
            <select
              value={activeEntityId}
              onChange={(e) => onChangeActiveEntityId(e.target.value)}
              className="px-2 py-0.5 bg-indigo-50 border border-indigo-300 rounded text-[11px] font-bold text-indigo-900"
            >
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}

          {viewMode === 'single_room' && (
            <select
              value={activeEntityId}
              onChange={(e) => onChangeActiveEntityId(e.target.value)}
              className="px-2 py-0.5 bg-emerald-50 border border-emerald-300 rounded text-[11px] font-bold text-emerald-900"
            >
              {classrooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Group 3: Entity Specifications (Image 2 - Subjects, Classes, Classrooms, Teachers, Relations) */}
        <div className="flex items-center gap-1 pr-2 border-r border-[#afc7de]">
          <button
            onClick={onOpenSubjects}
            className="flex flex-col items-center justify-center w-15 h-16 rounded hover:bg-white/70 hover:border hover:border-[#9ec1e6] active:bg-[#c6def8] transition text-[#1e4368] group"
            title="Хичээлүүдийн цонх"
          >
            <div className="w-8 h-8 rounded bg-gradient-to-b from-blue-400 to-blue-600 border border-blue-700 shadow-xs flex items-center justify-center text-white group-hover:scale-105 transition">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-medium mt-1 leading-none">Subjects</span>
          </button>

          <button
            onClick={onOpenClasses}
            className="flex flex-col items-center justify-center w-15 h-16 rounded hover:bg-white/70 hover:border hover:border-[#9ec1e6] active:bg-[#c6def8] transition text-[#1e4368] group"
            title="Анги бүлгүүдийн цонх"
          >
            <div className="w-8 h-8 rounded bg-gradient-to-b from-amber-400 to-amber-600 border border-amber-700 shadow-xs flex items-center justify-center text-white group-hover:scale-105 transition">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-medium mt-1 leading-none">Classes</span>
          </button>

          <button
            onClick={onOpenClassrooms}
            className="flex flex-col items-center justify-center w-16 h-16 rounded hover:bg-white/70 hover:border hover:border-[#9ec1e6] active:bg-[#c6def8] transition text-[#1e4368] group"
            title="Анги танхимын цонх"
          >
            <div className="w-8 h-8 rounded bg-gradient-to-b from-amber-600 to-amber-800 border border-amber-900 shadow-xs flex items-center justify-center text-white group-hover:scale-105 transition">
              <DoorOpen className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-medium mt-1 leading-none">Classrooms</span>
          </button>

          <button
            onClick={onOpenTeachers}
            className="flex flex-col items-center justify-center w-15 h-16 rounded hover:bg-white/70 hover:border hover:border-[#9ec1e6] active:bg-[#c6def8] transition text-[#1e4368] group"
            title="Багш нарын цонх"
          >
            <div className="w-8 h-8 rounded bg-gradient-to-b from-indigo-500 to-indigo-700 border border-indigo-800 shadow-xs flex items-center justify-center text-white group-hover:scale-105 transition">
              <GraduationCap className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-medium mt-1 leading-none">Teachers</span>
          </button>

          <button
            onClick={onOpenRelations}
            className="flex flex-col items-center justify-center w-15 h-16 rounded hover:bg-white/70 hover:border hover:border-[#9ec1e6] active:bg-[#c6def8] transition text-[#1e4368] group"
            title="Хичээлийн хамаарал & Хязгаарлалтууд"
          >
            <div className="w-8 h-8 rounded bg-gradient-to-b from-sky-400 to-sky-600 border border-sky-700 shadow-xs flex items-center justify-center text-white group-hover:scale-105 transition">
              <Network className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-medium mt-1 leading-none">Relations</span>
          </button>
        </div>

        {/* Group 4: Generator & Verification (Image 2 - Test, Generate new, Verification) */}
        <div className="flex items-center gap-1.5 pr-2 border-r border-[#afc7de]">
          <button
            onClick={onOpenGenerator}
            className="flex flex-col items-center justify-center w-18 h-16 rounded bg-gradient-to-b from-red-500/10 to-red-600/20 border border-red-300 hover:border-red-500 shadow-xs transition group cursor-pointer"
            title="Хичээлийн хуваарь бодуулах"
          >
            <div className="w-8 h-8 rounded bg-gradient-to-b from-red-500 to-rose-700 border border-red-800 shadow-xs flex items-center justify-center text-white group-hover:scale-110 transition animate-pulse">
              <Siren className="w-5 h-5 text-white" />
            </div>
            <span className="text-[11px] font-bold mt-1 text-red-900 leading-none">Generate new</span>
          </button>

          <button
            onClick={onOpenVerification}
            className="flex flex-col items-center justify-center w-16 h-16 rounded hover:bg-white/70 hover:border hover:border-[#9ec1e6] active:bg-[#c6def8] transition text-[#1e4368] group"
            title="Шалгалт & Зөрчил илрүүлэлт"
          >
            <div className="w-8 h-8 rounded bg-gradient-to-b from-amber-500 to-amber-700 border border-amber-800 shadow-xs flex items-center justify-center text-white group-hover:scale-105 transition">
              <Gavel className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-medium mt-1 leading-none">Verification</span>
          </button>
        </div>

        {/* Group 5: School Settings & Excel */}
        <div className="flex items-center gap-1">
          <button
            onClick={onOpenSchoolSettings}
            className="flex flex-col items-center justify-center w-15 h-16 rounded hover:bg-white/70 hover:border hover:border-[#9ec1e6] active:bg-[#c6def8] transition text-[#1e4368] group"
            title="Хонхны цаг, хичээлийн хугацаа, завсарлага, хооллох цаг"
          >
            <div className="w-8 h-8 rounded bg-gradient-to-b from-slate-600 to-slate-800 border border-slate-900 shadow-xs flex items-center justify-center text-white group-hover:scale-105 transition">
              <School className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-medium mt-1 leading-none">School</span>
          </button>

          <button
            onClick={onOpenExcel}
            className="flex flex-col items-center justify-center w-16 h-16 rounded hover:bg-white/70 hover:border hover:border-[#9ec1e6] active:bg-[#c6def8] transition text-emerald-800 group"
            title="Excel импорт экспорт"
          >
            <div className="w-8 h-8 rounded bg-gradient-to-b from-emerald-500 to-emerald-700 border border-emerald-800 shadow-xs flex items-center justify-center text-white group-hover:scale-105 transition">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold mt-1 leading-none">Excel I/O</span>
          </button>
        </div>
      </div>
    </div>
  );
};
