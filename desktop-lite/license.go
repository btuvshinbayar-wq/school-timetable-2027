package main

// Лиценз — Electron хувилбарын electron/license.cjs-тэй яг ижил:
//   түлхүүр:   STT1.<payload base64url>.<Ed25519 гарын үсэг base64url>
//   машин код: SHA-256("STT2027|" + rawMachineId) → 16 тэмдэгт (XXXX-XXXX-XXXX-XXXX)
// Тиймээс өмнө олгосон лицензүүд, `npm run license:issue` хэрэгсэл хэвээр ажиллана.

import (
	"crypto/ed25519"
	"crypto/sha256"
	"crypto/x509"
	_ "embed"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

const (
	product          = "STT2027"
	keyPrefix        = "STT1"
	clockToleranceMs = 2 * 24 * 3600 * 1000
	b32              = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
)

//go:embed license-public.pem
var publicKeyPEM []byte

func loadPublicKey(pemBytes []byte) (ed25519.PublicKey, error) {
	block, _ := pem.Decode(pemBytes)
	if block == nil {
		return nil, errors.New("license-public.pem уншигдсангүй")
	}
	k, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, err
	}
	pk, ok := k.(ed25519.PublicKey)
	if !ok {
		return nil, errors.New("Ed25519 түлхүүр биш")
	}
	return pk, nil
}

// machineCodeFrom — rawMachineId-ээс хэрэглэгчид харуулах код
func machineCodeFrom(raw string) string {
	h := sha256.Sum256([]byte(product + "|" + raw))
	var sb strings.Builder
	for i := 0; i < 16; i++ {
		if i > 0 && i%4 == 0 {
			sb.WriteByte('-')
		}
		sb.WriteByte(b32[h[i]%32])
	}
	return sb.String()
}

func machineCode() string { return machineCodeFrom(rawMachineID()) }

var wsRe = regexp.MustCompile(`\s+`)

func fromB64url(s string) ([]byte, error) {
	s = strings.TrimRight(strings.NewReplacer("+", "-", "/", "_").Replace(s), "=")
	return base64.RawURLEncoding.DecodeString(s)
}

type verifyResult struct {
	Payload map[string]any
	Key     string
	Error   string // format | signature | product | machine | expired
	Message string
}

// expiryEnd — "YYYY-MM-DD" өдрийн 23:59:59 (орон нутгийн цаг), Node-ийн new Date(`${d}T23:59:59`)-тэй адил
func expiryEnd(d string) (time.Time, bool) {
	t, err := time.ParseInLocation("2006-01-02T15:04:05", d+"T23:59:59", time.Local)
	return t, err == nil
}

func verifyKey(key string, pk ed25519.PublicKey, code string, now time.Time) verifyResult {
	clean := wsRe.ReplaceAllString(key, "")
	parts := strings.Split(clean, ".")
	if len(parts) != 3 || parts[0] != keyPrefix {
		return verifyResult{Error: "format", Message: "Лицензийн түлхүүрийн хэлбэр буруу байна"}
	}
	bad := verifyResult{Error: "signature", Message: "Лицензийн түлхүүр хүчингүй байна"}
	sig, err := fromB64url(parts[2])
	if err != nil || len(sig) != ed25519.SignatureSize || !ed25519.Verify(pk, []byte(parts[0]+"."+parts[1]), sig) {
		return bad
	}
	raw, err := fromB64url(parts[1])
	if err != nil {
		return bad
	}
	var payload map[string]any
	if json.Unmarshal(raw, &payload) != nil {
		return bad
	}
	str := func(k string) string { s, _ := payload[k].(string); return s }
	if str("product") != product {
		return verifyResult{Error: "product", Message: "Энэ түлхүүр өөр программынх байна"}
	}
	if m := str("machine"); m != "*" && m != code {
		return verifyResult{Error: "machine", Message: "Энэ түлхүүр өөр компьютерт (" + m + ") олгогдсон байна", Payload: payload}
	}
	if exp := str("expires"); exp != "" {
		if end, ok := expiryEnd(exp); !ok || now.After(end) {
			return verifyResult{Error: "expired", Message: "Лицензийн хугацаа " + exp + "-нд дууссан", Payload: payload}
		}
	}
	return verifyResult{Payload: payload, Key: clean}
}

// LicenseStore — userData\license.lic, userData\license-state.json (Electron хувилбартай ижил файлууд)
type LicenseStore struct {
	file, stateFile string
	pk              ed25519.PublicKey
	code            string
}

func newLicenseStore(userData string) (*LicenseStore, error) {
	pk, err := loadPublicKey(publicKeyPEM)
	if err != nil {
		return nil, err
	}
	return &LicenseStore{
		file:      filepath.Join(userData, "license.lic"),
		stateFile: filepath.Join(userData, "license-state.json"),
		pk:        pk,
		code:      machineCode(),
	}, nil
}

func (s *LicenseStore) readState() map[string]any {
	st := map[string]any{}
	if b, err := os.ReadFile(s.stateFile); err == nil {
		_ = json.Unmarshal(b, &st)
	}
	return st
}

func (s *LicenseStore) writeState(st map[string]any) {
	if b, err := json.Marshal(st); err == nil {
		_ = os.MkdirAll(filepath.Dir(s.stateFile), 0o755)
		_ = os.WriteFile(s.stateFile, b, 0o644)
	}
}

func lastSeen(st map[string]any) float64 { v, _ := st["lastSeen"].(float64); return v }

// Status — active | missing | invalid | expired | machine | clock
func (s *LicenseStore) Status(now time.Time) map[string]any {
	res := map[string]any{"machineCode": s.code}
	st := s.readState()
	nowMs := float64(now.UnixMilli())
	if ls := lastSeen(st); ls > 0 && nowMs < ls-clockToleranceMs {
		res["state"] = "clock"
		res["message"] = "Компьютерын огноо буруу байна. Огноо, цагаа засаад дахин нээнэ үү."
		return res
	}
	b, err := os.ReadFile(s.file)
	if err != nil {
		res["state"] = "missing"
		return res
	}
	r := verifyKey(strings.TrimSpace(string(b)), s.pk, s.code, now)
	if r.Error != "" {
		state := "invalid"
		if r.Error == "expired" || r.Error == "machine" {
			state = r.Error
		}
		res["state"] = state
		res["message"] = r.Message
		if r.Payload != nil {
			res["license"] = r.Payload
		}
		return res
	}
	st["lastSeen"] = math.Max(lastSeen(st), nowMs)
	s.writeState(st)
	res["state"] = "active"
	res["license"] = r.Payload
	res["daysLeft"] = nil
	if exp, _ := r.Payload["expires"].(string); exp != "" {
		if end, ok := expiryEnd(exp); ok {
			res["daysLeft"] = int(math.Ceil(float64(end.Sub(now).Milliseconds()) / 864e5))
		}
	}
	return res
}

func (s *LicenseStore) Active() bool { return s.Status(time.Now())["state"] == "active" }

func (s *LicenseStore) Activate(key string, now time.Time) map[string]any {
	r := verifyKey(key, s.pk, s.code, now)
	if r.Error != "" {
		return map[string]any{"ok": false, "message": r.Message}
	}
	if err := os.MkdirAll(filepath.Dir(s.file), 0o755); err != nil {
		return map[string]any{"ok": false, "message": err.Error()}
	}
	if err := os.WriteFile(s.file, []byte(r.Key), 0o644); err != nil {
		return map[string]any{"ok": false, "message": err.Error()}
	}
	st := s.readState()
	st["lastSeen"] = math.Max(lastSeen(st), float64(now.UnixMilli()))
	st["activatedAt"] = now.UTC().Format("2006-01-02T15:04:05.000Z")
	s.writeState(st)
	return map[string]any{"ok": true, "license": r.Payload}
}

func (s *LicenseStore) Deactivate() { _ = os.Remove(s.file) }
