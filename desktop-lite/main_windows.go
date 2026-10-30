//go:build windows

// School Timetable 2027 — хөнгөн Windows программ (Electron-гүй).
// Цонхыг Windows 10/11-д суусан Microsoft Edge WebView2 зурна; программын файлууд суулгасан
// хавтасны app\ дотор байх ба https://stt.app/ хаягаар (virtual host) нээгдэнэ.
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
	"unsafe"

	webview2 "github.com/jchv/go-webview2"
	"github.com/jchv/go-webview2/pkg/edge"
	"github.com/jchv/go-webview2/webviewloader"
	"golang.org/x/sys/windows"
)

const webView2Download = "https://go.microsoft.com/fwlink/p/?LinkId=2124703"

type winUI struct {
	w webview2.WebView
}

func (u *winUI) hwnd() uintptr { return uintptr(u.w.Window()) }

func (u *winUI) Navigate(url string) { u.w.Navigate(url) }

func (u *winUI) NavigateLater(url string, d time.Duration) {
	go func() {
		time.Sleep(d)
		u.w.Dispatch(func() { u.w.Navigate(url) })
	}()
}

func (u *winUI) OpenFileDialog(title string) (string, bool) {
	return fileDialog(false, u.hwnd(), title, "Лицензийн файл (*.lic; *.txt)\x00*.lic;*.txt\x00Бүх файл\x00*.*\x00", "", "", "")
}

func (u *winUI) SaveFileDialog(defaultPath string) (string, bool) {
	return fileDialog(true, u.hwnd(), "Хадгалах", "JSON файл (*.json)\x00*.json\x00", filepath.Dir(defaultPath), filepath.Base(defaultPath), "json")
}

func (u *winUI) Confirm(title, text string) bool {
	return messageBox(u.hwnd(), title, text, mbYesNo|mbIconWarning|mbDefButton2) == idYes
}

func (u *winUI) OpenPath(p string) { shellOpen(p) }

func fatal(text string) {
	messageBox(0, productName, text, mbOK|mbIconError)
	os.Exit(1)
}

func documentsDir() string {
	if p, err := windows.KnownFolderPath(windows.FOLDERID_Documents, 0); err == nil && p != "" {
		return p
	}
	return filepath.Join(os.Getenv("USERPROFILE"), "Documents")
}

func jsString(v any) string { b, _ := json.Marshal(v); return string(b) }

func main() {
	if !singleInstance() {
		return
	}

	// WebView2 (Microsoft Edge-ийн хөдөлгүүр) — Windows 11-д суусан, Windows 10-д ихэвчлэн суусан байдаг
	if v, err := webviewloader.GetInstalledVersion(); err != nil || v == "" {
		if messageBox(0, productName,
			"Программ ажиллахад Microsoft Edge WebView2 шаардлагатай бөгөөд энэ компьютерт суугаагүй байна.\n\n"+
				"Microsoft-ийн албан ёсны татах хуудсыг нээх үү? Суулгасны дараа программаа дахин нээнэ үү.",
			mbYesNo|mbIconWarning) == idYes {
			shellOpen(webView2Download)
		}
		return
	}

	exe, _ := os.Executable()
	appDir := envOr("STT_APP_DIR", filepath.Join(filepath.Dir(exe), "app"))
	if _, err := os.Stat(filepath.Join(appDir, "index.html")); err != nil {
		fatal("Программын файлууд олдсонгүй (" + appDir + ").\nПрограммаа дахин суулгана уу.")
	}
	appData, _ := os.UserConfigDir() // %APPDATA%
	userData := envOr("STT_USER_DATA", filepath.Join(appData, productName))
	localData, _ := os.UserCacheDir() // %LOCALAPPDATA%
	webData := filepath.Join(localData, productName, "WebView2")
	_ = os.MkdirAll(userData, 0o755)

	w := webview2.NewWithOptions(webview2.WebViewOptions{
		DataPath:  webData,
		AutoFocus: true,
		WindowOptions: webview2.WindowOptions{
			Title:  productName,
			Width:  1440,
			Height: 900,
			IconId: 1,
			Center: true,
		},
	})
	if w == nil {
		fatal("Цонх үүсгэж чадсангүй (WebView2). Компьютераа дахин асаагаад оролдоно уу.")
	}
	defer w.Destroy()
	w.SetSize(1100, 680, webview2.HintMin)

	ui := &winUI{w: w}
	app, err := newApp(ui, userData, envOr("STT_DOCUMENTS", documentsDir()), appDir)
	if err != nil {
		fatal("Лицензийн модуль ачаалагдсангүй: " + err.Error())
	}

	ch := webview2.Chromium(w)
	if ch == nil {
		fatal("WebView2 эхлүүлж чадсангүй.")
	}
	wv3 := ch.GetICoreWebView2_3()
	if wv3 == nil {
		fatal("WebView2-ийн хувилбар хэт хуучин байна. Microsoft Edge WebView2-ийг шинэчилнэ үү.")
	}
	if err := wv3.SetVirtualHostNameToFolderMapping(appHost, appDir, edge.COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_DENY_CORS); err != nil {
		fatal("Программын хавтсыг холбож чадсангүй: " + err.Error())
	}
	if s, err := ch.GetSettings(); err == nil {
		_ = s.PutAreDefaultContextMenusEnabled(true) // хуулах/буулгах цэс
		_ = s.PutIsStatusBarEnabled(false)
	}

	// JavaScript → Go: дуудлагыг WebView2-ийн үйл явдлаас гадуур (Dispatch) гүйцэтгэнэ
	ch.MessageCallback = func(msg string) {
		var m struct {
			ID     int               `json:"id"`
			Method string            `json:"method"`
			Params []json.RawMessage `json:"params"`
		}
		if json.Unmarshal([]byte(msg), &m) != nil || m.ID == 0 {
			return
		}
		w.Dispatch(func() {
			res, err := app.Call(m.Method, m.Params)
			if err != nil {
				w.Eval(fmt.Sprintf("window.__stt_resolve(%d,false,%s)", m.ID, jsString(err.Error())))
				return
			}
			b, err := json.Marshal(res)
			if err != nil {
				w.Eval(fmt.Sprintf("window.__stt_resolve(%d,false,%s)", m.ID, jsString(err.Error())))
				return
			}
			w.Eval(fmt.Sprintf("window.__stt_resolve(%d,true,%s)", m.ID, b))
		})
	}
	w.Init(bridgeJS)

	procShowWindow.Call(uintptr(unsafe.Pointer(w.Window())), swMaximize)
	w.Navigate(app.startURL())
	w.Run()
}
