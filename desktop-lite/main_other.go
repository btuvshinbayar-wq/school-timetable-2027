//go:build !windows

// Linux/macOS дээрх туршилтын сервер: Windows программтай ижил цөм (лиценз, нөөц, window.desktop API)-ийг
// HTTP-ээр ажиллуулж, хөтчөөр (Playwright) шалгах боломж олгоно. Худалдаанд ашиглахгүй.
//
//	STT_APP_DIR=release/win-lite/app STT_USER_DATA=… STT_DOCUMENTS=… PORT=5199 go run .
package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type testUI struct {
	mu  sync.Mutex
	nav string
}

func (u *testUI) Navigate(url string) { u.NavigateLater(url, 0) }
func (u *testUI) NavigateLater(url string, d time.Duration) {
	go func() {
		time.Sleep(d)
		u.mu.Lock()
		u.nav = strings.TrimPrefix(url, appOrigin)
		u.mu.Unlock()
	}()
}
func (u *testUI) OpenFileDialog(string) (string, bool) {
	p := os.Getenv("STT_TEST_OPEN_FILE")
	return p, p != ""
}
func (u *testUI) SaveFileDialog(p string) (string, bool) { return p, true }
func (u *testUI) Confirm(string, string) bool             { return true }
func (u *testUI) OpenPath(string)                         {}

// Туршилтын орчинд chrome.webview-ийн оронд fetch, Go-ийн Navigate-ийн оронд хүлээлгэ
const shim = `window.__stt_call=function(m,a){return fetch('/__rpc',{method:'POST',body:JSON.stringify({method:m,params:a})}).then(function(r){return r.json()}).then(function(r){if(r.error)throw new Error(r.error);return r.result})};
setInterval(function(){fetch('/__nav').then(function(r){return r.text()}).then(function(u){if(u)location.replace(u)})},250);`

func main() {
	home, _ := os.UserHomeDir()
	ui := &testUI{}
	appDir := envOr("STT_APP_DIR", "app")
	app, err := newApp(ui, envOr("STT_USER_DATA", filepath.Join(home, ".config", productName)), envOr("STT_DOCUMENTS", filepath.Join(home, "Documents")), appDir)
	if err != nil {
		log.Fatal(err)
	}
	http.HandleFunc("/__rpc", func(w http.ResponseWriter, r *http.Request) {
		var m struct {
			Method string            `json:"method"`
			Params []json.RawMessage `json:"params"`
		}
		_ = json.NewDecoder(r.Body).Decode(&m)
		res, err := app.Call(m.Method, m.Params)
		out := map[string]any{"result": res}
		if err != nil {
			out = map[string]any{"error": err.Error()}
		}
		_ = json.NewEncoder(w).Encode(out)
	})
	http.HandleFunc("/__nav", func(w http.ResponseWriter, r *http.Request) {
		ui.mu.Lock()
		_, _ = w.Write([]byte(ui.nav))
		ui.nav = ""
		ui.mu.Unlock()
	})
	http.HandleFunc("/__shim.js", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/javascript")
		_, _ = w.Write([]byte(shim + "\n" + bridgeJS))
	})
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		p := path.Clean(r.URL.Path)
		if p == "/" {
			http.Redirect(w, r, strings.TrimPrefix(app.startURL(), appOrigin), http.StatusFound)
			return
		}
		file := filepath.Join(appDir, filepath.FromSlash(p))
		if strings.HasSuffix(p, ".html") {
			b, err := os.ReadFile(file)
			if err != nil {
				http.NotFound(w, r)
				return
			}
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_, _ = w.Write([]byte(strings.Replace(string(b), "<head>", `<head><script src="/__shim.js"></script>`, 1)))
			return
		}
		http.ServeFile(w, r, file)
	})
	addr := "127.0.0.1:" + envOr("PORT", "5199")
	log.Printf("туршилтын сервер: http://%s/", addr)
	log.Fatal(http.ListenAndServe(addr, nil))
}
