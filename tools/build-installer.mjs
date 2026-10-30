#!/usr/bin/env node
/**
 * Windows суулгагч (NSIS) бүтээнэ: release/win-unpacked → release/SchoolTimetable2027-Setup-<хувилбар>.exe
 *
 * makensis-ийг дараах дарааллаар хайна:
 *   1. MAKENSIS орчны хувьсагч
 *   2. PATH дахь makensis (Windows дээр NSIS суулгасан бол)
 *   3. electron-builder-ийн кэш дэх NSIS (Linux/macOS/Windows)
 * Ажиллуулах: npm run dist:win          (Electron, release/win-unpacked)
 *             npm run dist:win:lite     (Go + WebView2, release/win-lite) — `--lite`
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const lite = process.argv.includes('--lite');
const src = join(root, 'release', lite ? 'win-lite' : 'win-unpacked');
if (!existsSync(join(src, 'SchoolTimetable2027.exe'))) {
  console.error(`${src} олдсонгүй. Эхлээд: ${lite ? 'npm run build:desktop && node tools/build-lite.mjs' : 'npm run build:desktop && npx electron-builder --win dir --x64'}`);
  process.exit(1);
}

function findCachedNsis() {
  const caches = [
    process.env.ELECTRON_BUILDER_CACHE,
    join(homedir(), '.cache', 'electron-builder'),
    join(homedir(), 'Library', 'Caches', 'electron-builder'),
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'electron-builder', 'Cache'),
  ].filter(Boolean);
  for (const c of caches) {
    if (!existsSync(c)) continue;
    for (const d of readdirSync(c).filter((x) => x.startsWith('nsis-') && !x.includes('resources'))) {
      const base = join(c, d);
      for (const inner of readdirSync(base)) {
        const dir = join(base, inner);
        if (!statSync(dir).isDirectory()) continue;
        const bin =
          platform() === 'win32' ? join(dir, 'Bin', 'makensis.exe') : platform() === 'darwin' ? join(dir, 'mac', 'makensis') : join(dir, 'linux', 'makensis');
        if (existsSync(bin)) return { bin, nsisDir: dir };
      }
    }
  }
  return null;
}

let makensis = process.env.MAKENSIS ? { bin: process.env.MAKENSIS, nsisDir: process.env.NSISDIR } : null;
if (!makensis) {
  const which = spawnSync(platform() === 'win32' ? 'where' : 'which', ['makensis'], { encoding: 'utf8' });
  if (which.status === 0 && which.stdout.trim()) makensis = { bin: which.stdout.trim().split(/\r?\n/)[0] };
}
if (!makensis) makensis = findCachedNsis();
if (!makensis) {
  console.error('makensis олдсонгүй. NSIS суулгах (https://nsis.sourceforge.io) эсвэл MAKENSIS=<зам> өгнө үү.');
  process.exit(1);
}

const out = join(root, 'release', `SchoolTimetable2027-${lite ? 'Lite-' : ''}Setup-${pkg.version}.exe`);
const sep = platform() === 'win32' ? '/' : '-';
const args = [`${sep}DVERSION=${pkg.version}`, `${sep}DSRC_DIR=${src}`, `${sep}DOUT_FILE=${out}`, ...(lite ? [`${sep}DLITE`] : []), `${sep}V2`, join(root, 'build', 'installer.nsi')];
console.log(`makensis: ${makensis.bin}`);
execFileSync(makensis.bin, args, {
  cwd: join(root, 'build'),
  stdio: 'inherit',
  env: { ...process.env, ...(makensis.nsisDir ? { NSISDIR: makensis.nsisDir } : {}) },
});
const mb = (statSync(out).size / 1024 / 1024).toFixed(1);
console.log(`\nСуулгагч: ${out} (${mb} MB)`);
