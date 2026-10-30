//go:build windows

package main

import (
	"syscall"
	"unicode/utf16"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	user32   = windows.NewLazySystemDLL("user32.dll")
	comdlg32 = windows.NewLazySystemDLL("comdlg32.dll")
	shell32  = windows.NewLazySystemDLL("shell32.dll")
	kernel32 = windows.NewLazySystemDLL("kernel32.dll")

	procMessageBoxW         = user32.NewProc("MessageBoxW")
	procShowWindow          = user32.NewProc("ShowWindow")
	procFindWindowW         = user32.NewProc("FindWindowW")
	procSetForegroundWindow = user32.NewProc("SetForegroundWindow")
	procIsIconic            = user32.NewProc("IsIconic")
	procGetOpenFileNameW    = comdlg32.NewProc("GetOpenFileNameW")
	procGetSaveFileNameW    = comdlg32.NewProc("GetSaveFileNameW")
	procShellExecuteW       = shell32.NewProc("ShellExecuteW")
	procCreateMutexW        = kernel32.NewProc("CreateMutexW")
)

const (
	mbOK          = 0x0
	mbYesNo       = 0x4
	mbIconError   = 0x10
	mbIconWarning = 0x30
	mbIconInfo    = 0x40
	mbDefButton2  = 0x100
	idYes         = 6

	swRestore  = 9
	swMaximize = 3

	ofnOverwritePrompt = 0x2
	ofnNoChangeDir     = 0x8
	ofnPathMustExist   = 0x800
	ofnFileMustExist   = 0x1000
	ofnExplorer        = 0x80000
)

func u16(s string) *uint16 {
	p, _ := windows.UTF16PtrFromString(s)
	return p
}

// u16z — NUL тэмдэгт агуулсан мөрийг (шүүлтүүр) UTF-16 болгоно
func u16z(s string) *uint16 {
	b := utf16.Encode([]rune(s + "\x00"))
	return &b[0]
}

func messageBox(hwnd uintptr, title, text string, flags uintptr) int {
	r, _, _ := procMessageBoxW.Call(hwnd, uintptr(unsafe.Pointer(u16(text))), uintptr(unsafe.Pointer(u16(title))), flags)
	return int(r)
}

func shellOpen(target string) {
	procShellExecuteW.Call(0, uintptr(unsafe.Pointer(u16("open"))), uintptr(unsafe.Pointer(u16(target))), 0, 0, 1)
}

type openFileName struct {
	lStructSize       uint32
	hwndOwner         uintptr
	hInstance         uintptr
	lpstrFilter       *uint16
	lpstrCustomFilter *uint16
	nMaxCustFilter    uint32
	nFilterIndex      uint32
	lpstrFile         *uint16
	nMaxFile          uint32
	lpstrFileTitle    *uint16
	nMaxFileTitle     uint32
	lpstrInitialDir   *uint16
	lpstrTitle        *uint16
	flags             uint32
	nFileOffset       uint16
	nFileExtension    uint16
	lpstrDefExt       *uint16
	lCustData         uintptr
	lpfnHook          uintptr
	lpTemplateName    *uint16
	pvReserved        uintptr
	dwReserved        uint32
	flagsEx           uint32
}

func fileDialog(save bool, owner uintptr, title, filter, initialDir, initialName, defExt string) (string, bool) {
	buf := make([]uint16, 4096)
	copy(buf, utf16.Encode([]rune(initialName)))
	ofn := openFileName{
		hwndOwner:   owner,
		lpstrFilter: u16z(filter),
		lpstrFile:   &buf[0],
		nMaxFile:    uint32(len(buf)),
		lpstrTitle:  u16(title),
		flags:       ofnExplorer | ofnNoChangeDir | ofnPathMustExist,
	}
	ofn.lStructSize = uint32(unsafe.Sizeof(ofn))
	if initialDir != "" {
		ofn.lpstrInitialDir = u16(initialDir)
	}
	if defExt != "" {
		ofn.lpstrDefExt = u16(defExt)
	}
	proc := procGetOpenFileNameW
	if save {
		ofn.flags |= ofnOverwritePrompt
		proc = procGetSaveFileNameW
	} else {
		ofn.flags |= ofnFileMustExist
	}
	r, _, _ := proc.Call(uintptr(unsafe.Pointer(&ofn)))
	if r == 0 {
		return "", false
	}
	return windows.UTF16ToString(buf), true
}

// singleInstance — программ аль хэдийн нээлттэй бол тэр цонхыг урд гаргаад false буцаана
func singleInstance() bool {
	_, _, err := procCreateMutexW.Call(0, 0, uintptr(unsafe.Pointer(u16("Local\\SchoolTimetable2027.Lite"))))
	if err == syscall.Errno(windows.ERROR_ALREADY_EXISTS) {
		if h, _, _ := procFindWindowW.Call(uintptr(unsafe.Pointer(u16("webview"))), uintptr(unsafe.Pointer(u16(productName)))); h != 0 {
			if ic, _, _ := procIsIconic.Call(h); ic != 0 {
				procShowWindow.Call(h, swRestore)
			}
			procSetForegroundWindow.Call(h)
		}
		return false
	}
	return true
}
