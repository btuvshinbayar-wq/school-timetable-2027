package main

// Go лицензийн шалгалт Node хувилбартай (electron/license.cjs, tools/license/issue.mjs) яг ижил ажиллаж буйг шалгана.
// Ажиллуулах: go test ./...   (Node.js ба license-keys/private.pem шаардлагатай)

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func node(t *testing.T, args ...string) string {
	t.Helper()
	if _, err := exec.LookPath("node"); err != nil {
		t.Skip("node байхгүй")
	}
	cmd := exec.Command("node", args...)
	cmd.Dir = ".."
	cmd.Env = append(os.Environ(), "STT_ISSUE_LOG="+filepath.Join(os.TempDir(), "stt-test-issued.csv"))
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("node %v: %v\n%s", args, err, out)
	}
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	return strings.TrimSpace(lines[len(lines)-1])
}

func issue(t *testing.T, args ...string) string {
	if _, err := os.Stat("../license-keys/private.pem"); err != nil {
		t.Skip("license-keys/private.pem байхгүй")
	}
	return node(t, append([]string{"tools/license/issue.mjs"}, args...)...)
}

func TestMachineCodeMatchesNode(t *testing.T) {
	for _, raw := range []string{"win:6f1c2a7e-3b0d-4c55-9a1e-0d2f6b7c8e90", "linux:abc", "host:PC|aa:bb:cc:dd:ee:ff"} {
		want := node(t, "-e", `const c=require('crypto');const B='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const h=c.createHash('sha256').update('STT2027|'+process.argv[1]).digest();let o='';for(let i=0;i<16;i++)o+=B[h[i]%32];console.log(o.match(/.{4}/g).join('-'))`, raw)
		if got := machineCodeFrom(raw); got != want {
			t.Errorf("%s: got %s want %s", raw, got, want)
		}
	}
	want := node(t, "-e", `console.log(require('./electron/license.cjs').machineCode())`)
	if got := machineCode(); got != want {
		t.Errorf("энэ компьютерын код: got %s want %s", got, want)
	}
}

func TestVerifyAndStore(t *testing.T) {
	pk, err := loadPublicKey(publicKeyPEM)
	if err != nil {
		t.Fatal(err)
	}
	code := "ZXJ6-XE6T-RGHQ-S87F"
	now := time.Now()
	good := issue(t, "--machine", code, "--licensee", "12-р сургууль", "--expires", "2027-08-31")
	if r := verifyKey(good, pk, code, now); r.Error != "" || r.Payload["licensee"] != "12-р сургууль" {
		t.Fatalf("зөв түлхүүр татгалзсан: %+v", r)
	}
	// мөр таслалт, зай орсон ч хүлээн авна
	if r := verifyKey(good[:20]+"\r\n  "+good[20:], pk, code, now); r.Error != "" {
		t.Fatalf("зайтай түлхүүр: %+v", r)
	}
	if r := verifyKey(good, pk, "AAAA-BBBB-CCCC-DDDD", now); r.Error != "machine" {
		t.Fatalf("өөр компьютер: %+v", r)
	}
	if r := verifyKey(good, pk, code, time.Date(2027, 9, 1, 0, 0, 1, 0, time.Local)); r.Error != "expired" {
		t.Fatalf("хугацаа: %+v", r)
	}
	if r := verifyKey(good, pk, code, time.Date(2027, 8, 31, 23, 0, 0, 0, time.Local)); r.Error != "" {
		t.Fatalf("сүүлийн өдөр хүчинтэй байх ёстой: %+v", r)
	}
	parts := strings.Split(good, ".")
	forged := parts[0] + "." + parts[1][:len(parts[1])-2] + "AA." + parts[2]
	if r := verifyKey(forged, pk, code, now); r.Error != "signature" {
		t.Fatalf("хуурамч: %+v", r)
	}
	if r := verifyKey("abc", pk, code, now); r.Error != "format" {
		t.Fatalf("хэлбэр: %+v", r)
	}
	any := issue(t, "--machine", "*", "--licensee", "Бүх компьютер")
	if r := verifyKey(any, pk, code, now); r.Error != "" {
		t.Fatalf("* машин: %+v", r)
	}

	// Store: энэ компьютерын код дээр
	dir := t.TempDir()
	s, err := newLicenseStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	if st := s.Status(now)["state"]; st != "missing" {
		t.Fatalf("missing: %v", st)
	}
	mine := issue(t, "--machine", machineCode(), "--licensee", "Миний сургууль", "--expires", "2099-01-01")
	if r := s.Activate(mine, now); r["ok"] != true {
		t.Fatalf("activate: %v", r)
	}
	st := s.Status(now)
	if st["state"] != "active" || st["daysLeft"].(int) < 1000 {
		t.Fatalf("active: %v", st)
	}
	// Цаг ухраасан
	if st := s.Status(now.Add(-72 * time.Hour))["state"]; st != "clock" {
		t.Fatalf("clock: %v", st)
	}
	// Electron хувилбар энэ файлыг уншиж чадах ёстой (ижил хэлбэр)
	got := node(t, "-e", `const {LicenseStore}=require('./electron/license.cjs');console.log(new LicenseStore(process.argv[1], 'electron').status().state)`, dir)
	if got != "active" {
		t.Fatalf("Electron хувилбар уншсан төлөв: %s", got)
	}
	s.Deactivate()
	if _, err := os.Stat(filepath.Join(dir, "license.lic")); !os.IsNotExist(err) {
		t.Fatal("deactivate")
	}
}
