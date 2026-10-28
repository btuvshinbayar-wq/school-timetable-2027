; ---------------------------------------------------------------------------
; School Timetable 2027 — Windows суулгагч (NSIS, Modern UI 2)
; makensis -DVERSION=1.0.0 -DSRC_DIR=..\release\win-unpacked -DOUT_FILE=..\release\Setup.exe installer.nsi
; ---------------------------------------------------------------------------
Unicode true
ManifestDPIAware true
SetCompressor /SOLID lzma
SetCompressorDictSize 64

!ifndef VERSION
  !define VERSION "1.0.0"
!endif
!ifndef SRC_DIR
  !error "SRC_DIR (release\win-unpacked) заавал"
!endif
!ifndef OUT_FILE
  !define OUT_FILE "SchoolTimetable2027-Setup-${VERSION}.exe"
!endif

!define PRODUCT      "School Timetable 2027"
!define EXE          "SchoolTimetable2027.exe"
!define PUBLISHER    "School Timetable 2027"
!define UNINST_KEY   "Software\Microsoft\Windows\CurrentVersion\Uninstall\mn.schooltimetable.app2027"
!define APPDATA_DIR  "School Timetable 2027"

Name "${PRODUCT}"
OutFile "${OUT_FILE}"
InstallDir "$PROGRAMFILES64\${PRODUCT}"
InstallDirRegKey HKLM "${UNINST_KEY}" "InstallLocation"
RequestExecutionLevel admin
BrandingText "${PRODUCT} ${VERSION}"

VIProductVersion "${VERSION}.0"
VIAddVersionKey /LANG=1104 "ProductName" "${PRODUCT}"
VIAddVersionKey /LANG=1104 "FileDescription" "${PRODUCT} суулгагч"
VIAddVersionKey /LANG=1104 "CompanyName" "${PUBLISHER}"
VIAddVersionKey /LANG=1104 "LegalCopyright" "© 2026 ${PUBLISHER}"
VIAddVersionKey /LANG=1104 "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=1104 "ProductVersion" "${VERSION}"

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!include "WinVer.nsh"
!include "FileFunc.nsh"

; ---- Харагдах байдал ----
!define MUI_ICON   "icon.ico"
!define MUI_UNICON "icon.ico"
!define MUI_WELCOMEFINISHPAGE_BITMAP   "installer-side.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "installer-side.bmp"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_RIGHT
!define MUI_HEADERIMAGE_BITMAP   "installer-header.bmp"
!define MUI_HEADERIMAGE_UNBITMAP "installer-header.bmp"
!define MUI_ABORTWARNING

!define MUI_WELCOMEPAGE_TITLE "${PRODUCT} суулгах"
!define MUI_WELCOMEPAGE_TEXT "Энэ хөтөлбөр таны компьютерт ${PRODUCT} (хувилбар ${VERSION})-ийг суулгана.$\r$\n$\r$\nСуулгасны дараа программыг анх нээхэд лицензийн түлхүүрээр идэвхжүүлнэ.$\r$\n$\r$\nҮргэлжлүүлэхийн тулд «Дараах» товчийг дарна уу."
!define MUI_LICENSEPAGE_CHECKBOX
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "${PRODUCT}-ийг нээх"
!define MUI_FINISHPAGE_SHOWREADME ""
!define MUI_FINISHPAGE_SHOWREADME_NOTCHECKED
!define MUI_FINISHPAGE_SHOWREADME_TEXT "Ширээний компьютер дээр товчлол үүсгэх"
!define MUI_FINISHPAGE_SHOWREADME_FUNCTION CreateDesktopShortcut

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "license.txt"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "Mongolian"

; ---- Туслах ----
!macro CheckRunning MSG
  ${Do}
    nsExec::Exec 'cmd /c tasklist /FI "IMAGENAME eq ${EXE}" /NH | find /I "${EXE}" >nul'
    Pop $0
    ${If} $0 != 0
      ${Break}
    ${EndIf}
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "${MSG}" /SD IDCANCEL IDRETRY +2
    Abort
  ${Loop}
!macroend

Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "${PRODUCT} нь 64 битийн Windows 10 эсвэл түүнээс шинэ хувилбар шаардана."
    Abort
  ${EndIf}
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_ICONSTOP "${PRODUCT} нь Windows 10 эсвэл түүнээс шинэ хувилбар шаардана."
    Abort
  ${EndIf}
  SetRegView 64
  !insertmacro CheckRunning "${PRODUCT} ажиллаж байна. Программаа хаагаад «Дахин оролдох» товчийг дарна уу."
FunctionEnd

Function CreateDesktopShortcut
  SetShellVarContext all
  CreateShortCut "$DESKTOP\${PRODUCT}.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\${EXE}" 0
FunctionEnd

; ---- Суулгах ----
Section "Install"
  SetRegView 64
  SetShellVarContext all

  ; Өмнөх хувилбарын программын файлуудыг цэвэрлэнэ (хэрэглэгчийн өгөгдөл AppData-д тул хөндөгдөхгүй)
  ReadRegStr $0 HKLM "${UNINST_KEY}" "InstallLocation"
  ${If} $0 != ""
  ${AndIf} ${FileExists} "$0\${EXE}"
    RMDir /r "$0\resources"
    RMDir /r "$0\locales"
  ${EndIf}

  SetOutPath "$INSTDIR"
  File /r "${SRC_DIR}\*.*"

  WriteUninstaller "$INSTDIR\Uninstall.exe"

  CreateDirectory "$SMPROGRAMS\${PRODUCT}"
  CreateShortCut "$SMPROGRAMS\${PRODUCT}\${PRODUCT}.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\${EXE}" 0
  CreateShortCut "$SMPROGRAMS\${PRODUCT}\${PRODUCT} устгах.lnk" "$INSTDIR\Uninstall.exe"

  WriteRegStr HKLM "${UNINST_KEY}" "DisplayName" "${PRODUCT}"
  WriteRegStr HKLM "${UNINST_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKLM "${UNINST_KEY}" "Publisher" "${PUBLISHER}"
  WriteRegStr HKLM "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\${EXE},0"
  WriteRegStr HKLM "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "${UNINST_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKLM "${UNINST_KEY}" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /S'
  WriteRegDWORD HKLM "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKLM "${UNINST_KEY}" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKLM "${UNINST_KEY}" "EstimatedSize" "$0"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\App Paths\${EXE}" "" "$INSTDIR\${EXE}"
SectionEnd

; ---- Устгах ----
Function un.onInit
  SetRegView 64
  !insertmacro CheckRunning "${PRODUCT} ажиллаж байна. Программаа хаагаад «Дахин оролдох» товчийг дарна уу."
FunctionEnd

Section "Uninstall"
  SetRegView 64
  SetShellVarContext all
  Delete "$DESKTOP\${PRODUCT}.lnk"
  RMDir /r "$SMPROGRAMS\${PRODUCT}"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKLM "${UNINST_KEY}"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\App Paths\${EXE}"

  ; Хэрэглэгчийн өгөгдөл (лиценз, хуваарь) — анхдагчаар үлдээнэ
  SetShellVarContext current
  ${IfNot} ${Silent}
    MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "Энэ хэрэглэгчийн хуваарийн өгөгдөл болон лицензийг мөн устгах уу?$\r$\n$\r$\n«Үгүй» гэвэл дахин суулгахад бүх зүйл хэвээр үлдэнэ. Documents\School Timetable 2027\backups хавтас дахь хуулбарууд ямар ч тохиолдолд устахгүй." IDNO keep_data
    RMDir /r "$APPDATA\${APPDATA_DIR}"
  ${EndIf}
  keep_data:
SectionEnd
