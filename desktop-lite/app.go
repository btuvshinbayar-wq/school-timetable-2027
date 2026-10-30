package main

// Программын цөм (үйлдлийн системээс хамааралгүй): лиценз, нөөц хуулбар, window.desktop API.
// Цонх/харилцах цонхыг UI интерфейсээр (Windows: main_windows.go) хэрэгжүүлнэ.

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
)

const (
	productName = "School Timetable 2027"
	backupKeep  = 300
	appHost     = "stt.app"
	appOrigin   = "https://" + appHost
	appURL      = appOrigin + "/index.html"
	activateURL = appOrigin + "/__activation.html"
)

var version = "dev" // -ldflags "-X main.version=1.0.0"

//go:embed bridge.js
var bridgeJS string

// UI — цонхны үйлдлүүд (Windows-д Win32, тестэд хуурмаг)
type UI interface {
	Navigate(url string)
	NavigateLater(url string, d time.Duration)
	OpenFileDialog(title string) (string, bool)
	SaveFileDialog(defaultPath string) (string, bool)
	Confirm(title, text string) bool
	OpenPath(p string)
}

type App struct {
	ui        UI
	license   *LicenseStore
	userData  string
	documents string
	appDir    string
}

func fallbackMachineID() string {
	host, _ := os.Hostname()
	var macs []string
	if ifs, err := net.Interfaces(); err == nil {
		for _, i := range ifs {
			if i.Flags&net.FlagLoopback != 0 || len(i.HardwareAddr) == 0 {
				continue
			}
			if m := i.HardwareAddr.String(); m != "00:00:00:00:00:00" {
				macs = append(macs, m)
			}
		}
	}
	sort.Strings(macs)
	first := ""
	if len(macs) > 0 {
		first = macs[0]
	}
	return "host:" + host + "|" + first
}

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func newApp(ui UI, userData, documents, appDir string) (*App, error) {
	ls, err := newLicenseStore(userData)
	if err != nil {
		return nil, err
	}
	return &App{ui: ui, license: ls, userData: userData, documents: documents, appDir: appDir}, nil
}

func (a *App) startURL() string {
	if a.license.Active() {
		return appURL
	}
	return activateURL
}

func (a *App) backupsDir() string { return filepath.Join(a.documents, productName, "backups") }

func pad2(n int) string { return fmt.Sprintf("%02d", n) }

func displayTime(t time.Time) string {
	return fmt.Sprintf("%d-%s-%s %s:%s:%s", t.Year(), pad2(int(t.Month())), pad2(t.Day()), pad2(t.Hour()), pad2(t.Minute()), pad2(t.Second()))
}

var unsafeName = regexp.MustCompile(`[\\/:*?"<>|\s]+`)

// Call — JavaScript-ээс ирсэн дуудлага (window.desktop.*)
func (a *App) Call(method string, args []json.RawMessage) (any, error) {
	str := func(i int) string {
		if i >= len(args) {
			return ""
		}
		var s string
		if json.Unmarshal(args[i], &s) != nil {
			return string(args[i])
		}
		return s
	}
	switch method {
	case "license.status":
		return a.license.Status(time.Now()), nil

	case "license.activate":
		r := a.license.Activate(str(0), time.Now())
		if r["ok"] == true {
			a.ui.NavigateLater(appURL, 900*time.Millisecond)
		}
		return r, nil

	case "license.importFile":
		p, ok := a.ui.OpenFileDialog("Лицензийн файл сонгох")
		if !ok {
			return map[string]any{"ok": false, "canceled": true}, nil
		}
		b, err := os.ReadFile(p)
		if err != nil {
			return map[string]any{"ok": false, "message": "Файл уншигдсангүй"}, nil
		}
		r := a.license.Activate(strings.TrimPrefix(string(b), "\uFEFF"), time.Now())
		if r["ok"] == true {
			a.ui.NavigateLater(appURL, 900*time.Millisecond)
		}
		return r, nil

	case "license.deactivate":
		if !a.ui.Confirm("Лиценз хасах", "Энэ компьютерээс лицензийг хасах уу?\n\nХуваарийн өгөгдөл устахгүй. Дахин ашиглахын тулд лицензийн түлхүүрээ дахин оруулна.") {
			return map[string]any{"ok": false}, nil
		}
		a.license.Deactivate()
		a.ui.NavigateLater(activateURL, 0)
		return map[string]any{"ok": true}, nil

	case "backup.save":
		return a.backupSave(str(0)), nil

	case "backup.list":
		return a.backupList(), nil

	case "backup.load":
		b, err := os.ReadFile(filepath.Join(a.backupsDir(), filepath.Base(str(0))))
		if err != nil {
			return nil, err
		}
		if !json.Valid(b) {
			return nil, fmt.Errorf("JSON биш файл")
		}
		return json.RawMessage(b), nil

	case "backup.openFolder":
		_ = os.MkdirAll(a.backupsDir(), 0o755)
		a.ui.OpenPath(a.backupsDir())
		return "", nil

	case "app.info":
		return map[string]any{"version": version, "name": productName, "backupsDir": a.backupsDir(), "userData": a.userData}, nil

	case "app.saveFile":
		name := filepath.Base(str(0))
		if name == "" || name == "." {
			name = "timetable.json"
		}
		p, ok := a.ui.SaveFileDialog(filepath.Join(a.documents, name))
		if !ok {
			return map[string]any{"ok": false}, nil
		}
		if err := os.WriteFile(p, []byte(str(1)), 0o644); err != nil {
			return map[string]any{"ok": false, "message": err.Error()}, nil
		}
		return map[string]any{"ok": true, "path": p}, nil
	}
	return nil, fmt.Errorf("үл мэдэгдэх дуудлага: %s", method)
}

func (a *App) backupSave(data string) map[string]any {
	if !a.license.Active() {
		return map[string]any{"success": false}
	}
	var d struct {
		ProjectName string `json:"projectName"`
		Settings    struct {
			SchoolName string `json:"schoolName"`
		} `json:"settings"`
	}
	if json.Unmarshal([]byte(data), &d) != nil {
		return map[string]any{"success": false}
	}
	name := d.ProjectName
	if name == "" {
		name = d.Settings.SchoolName
	}
	if name == "" {
		name = "timetable"
	}
	clean := []rune(unsafeName.ReplaceAllString(name, "_"))
	if len(clean) > 40 {
		clean = clean[:40]
	}
	dir := a.backupsDir()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return map[string]any{"success": false}
	}
	now := time.Now()
	stamp := fmt.Sprintf("%d-%s-%s_%s-%s-%s", now.Year(), pad2(int(now.Month())), pad2(now.Day()), pad2(now.Hour()), pad2(now.Minute()), pad2(now.Second()))
	filename := "backup_" + stamp + "_" + string(clean) + ".json"
	if os.WriteFile(filepath.Join(dir, filename), []byte(data), 0o644) != nil {
		return map[string]any{"success": false}
	}
	_ = os.WriteFile(filepath.Join(dir, "latest_backup.json"), []byte(data), 0o644)
	// Хуучин хуулбаруудыг цэвэрлэнэ
	var files []string
	if ents, err := os.ReadDir(dir); err == nil {
		for _, e := range ents {
			if n := e.Name(); strings.HasPrefix(n, "backup_") && strings.HasSuffix(n, ".json") {
				files = append(files, n)
			}
		}
	}
	sort.Strings(files)
	for i := 0; i < len(files)-backupKeep; i++ {
		_ = os.Remove(filepath.Join(dir, files[i]))
	}
	return map[string]any{"success": true, "filename": filename, "displayTime": displayTime(now)}
}

type backupInfo struct {
	Filename    string `json:"filename"`
	Size        int64  `json:"size"`
	Mtime       string `json:"mtime"`
	DisplayTime string `json:"displayTime"`
}

func (a *App) backupList() []backupInfo {
	out := []backupInfo{}
	ents, err := os.ReadDir(a.backupsDir())
	if err != nil {
		return out
	}
	for _, e := range ents {
		if !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		fi, err := e.Info()
		if err != nil {
			continue
		}
		t := fi.ModTime()
		out = append(out, backupInfo{e.Name(), fi.Size(), t.UTC().Format("2006-01-02T15:04:05.000Z"), displayTime(t)})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Mtime > out[j].Mtime })
	return out
}
