#!/usr/bin/env node
/**
 * Хөнгөн Windows программ (Electron-гүй, Go + WebView2) бүтээнэ:
 *   dist-desktop/ + electron/activation.* → release/win-lite/app/
 *   desktop-lite/ (Go)                    → release/win-lite/SchoolTimetable2027.exe
 * Дараа нь: node tools/build-installer.mjs --lite
 * Бүгдийг нэг дор: npm run dist:win:lite
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const dist = join(root, 'dist-desktop');
const out = join(root, 'release', 'win-lite');
const appDir = join(out, 'app');

if (!existsSync(join(dist, 'index.html'))) {
  console.error('dist-desktop олдсонгүй. Эхлээд: npm run build:desktop');
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(appDir, { recursive: true });
cpSync(dist, appDir, { recursive: true });
for (const f of ['activation.html', 'activation.css', 'activation.js']) {
  copyFileSync(join(root, 'electron', f), join(appDir, `__${f}`));
}

// Нийтийн түлхүүрийг Go программд шингээнэ (license:keygen-ээр солигдвол дахин бүтээхэд л хангалттай)
copyFileSync(join(root, 'electron', 'license-public.pem'), join(root, 'desktop-lite', 'license-public.pem'));

const exe = join(out, 'SchoolTimetable2027.exe');
console.log('go build (windows/amd64)…');
execFileSync(
  'go',
  ['build', '-mod=vendor', '-trimpath', '-ldflags', `-s -w -H windowsgui -X main.version=${pkg.version}`, '-o', exe, '.'],
  { cwd: join(root, 'desktop-lite'), stdio: 'inherit', env: { ...process.env, GOOS: 'windows', GOARCH: 'amd64', CGO_ENABLED: '0' } }
);
execFileSync('node', [join(root, 'tools', 'win-resources.mjs'), exe, pkg.version, '--manifest'], { stdio: 'inherit' });

const size = (p) => (statSync(p).size / 1024 / 1024).toFixed(1);
console.log(`\nПрограмм: ${exe} (${size(exe)} MB)`);
