/**
 * Лиценз: Ed25519 гарын үсэгтэй, машинд холбогдсон идэвхжүүлэх түлхүүр.
 *
 * Түлхүүрийн хэлбэр:  STT1.<payload base64url>.<signature base64url>
 *   payload (JSON): { v, id, product, licensee, edition, machine, issued, expires, maxClasses? }
 *   machine: "XXXX-XXXX-XXXX-XXXX" (энэ компьютерын код) эсвэл "*" (сургуулийн бүх компьютер)
 *
 * Гарын үсгийг зөвхөн нийлүүлэгчийн хувийн түлхүүрээр (tools/license) үүсгэнэ;
 * программд зөвхөн нийтийн түлхүүр (license-public.pem) байна.
 */
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const PRODUCT = 'STT2027';
const PREFIX = 'STT1';
const CLOCK_TOLERANCE_MS = 2 * 24 * 3600 * 1000;

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

/** Windows-ийн MachineGuid (дахин суулгахад ч өөрчлөгдөхгүй), бусад үйлдлийн системд hostname + MAC */
function rawMachineId() {
  if (process.platform === 'win32') {
    try {
      const out = execFileSync('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid', '/reg:64'], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 5000,
      });
      const m = /MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]+)/.exec(out);
      if (m) return `win:${m[1].toLowerCase()}`;
    } catch {
      /* доорх нөөц арга */
    }
  }
  if (process.platform === 'linux') {
    for (const f of ['/etc/machine-id', '/var/lib/dbus/machine-id']) {
      try {
        const v = fs.readFileSync(f, 'utf8').trim();
        if (v) return `linux:${v}`;
      } catch {
        /* */
      }
    }
  }
  const macs = Object.values(os.networkInterfaces())
    .flat()
    .filter((n) => n && !n.internal && n.mac && n.mac !== '00:00:00:00:00:00')
    .map((n) => n.mac)
    .sort();
  return `host:${os.hostname()}|${macs[0] || ''}`;
}

const B32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 0/O, 1/I хольдохгүй

/** Хэрэглэгчид харуулах машины код: XXXX-XXXX-XXXX-XXXX */
function machineCode() {
  const h = crypto.createHash('sha256').update(`${PRODUCT}|${rawMachineId()}`).digest();
  let out = '';
  for (let i = 0; i < 16; i++) out += B32[h[i] % 32];
  return out.match(/.{4}/g).join('-');
}

function loadPublicKey(dir) {
  const pem = fs.readFileSync(path.join(dir, 'license-public.pem'), 'utf8');
  return crypto.createPublicKey(pem);
}

/** Түлхүүрийг шалгаж, payload буцаана. Алдаатай бол { error } */
function verifyKey(key, publicKey, code = machineCode(), now = new Date()) {
  const clean = String(key || '').replace(/\s+/g, '');
  const parts = clean.split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX) return { error: 'format', message: 'Лицензийн түлхүүрийн хэлбэр буруу байна' };
  let payload;
  try {
    const ok = crypto.verify(null, Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, fromB64url(parts[2]));
    if (!ok) return { error: 'signature', message: 'Лицензийн түлхүүр хүчингүй байна' };
    payload = JSON.parse(fromB64url(parts[1]).toString('utf8'));
  } catch {
    return { error: 'signature', message: 'Лицензийн түлхүүр хүчингүй байна' };
  }
  if (payload.product !== PRODUCT) return { error: 'product', message: 'Энэ түлхүүр өөр программынх байна' };
  if (payload.machine !== '*' && payload.machine !== code)
    return { error: 'machine', message: `Энэ түлхүүр өөр компьютерт (${payload.machine}) олгогдсон байна`, payload };
  if (payload.expires) {
    const end = new Date(`${payload.expires}T23:59:59`);
    if (now > end) return { error: 'expired', message: `Лицензийн хугацаа ${payload.expires}-нд дууссан`, payload };
  }
  return { payload, key: clean };
}

/** Лицензийн хадгалалт (хэрэглэгчийн өгөгдлийн хавтаст) */
class LicenseStore {
  constructor(userDataDir, keyDir) {
    this.file = path.join(userDataDir, 'license.lic');
    this.stateFile = path.join(userDataDir, 'license-state.json');
    this.publicKey = loadPublicKey(keyDir);
  }

  readState() {
    try {
      return JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
    } catch {
      return {};
    }
  }

  writeState(s) {
    try {
      fs.writeFileSync(this.stateFile, JSON.stringify(s));
    } catch {
      /* */
    }
  }

  /** Одоогийн төлөв: active | missing | invalid | expired | machine | clock */
  status(now = new Date()) {
    const code = machineCode();
    const base = { machineCode: code };
    // Цаг ухраасан эсэх (хугацаатай лицензийг тойрох оролдлого)
    const st = this.readState();
    if (st.lastSeen && now.getTime() < st.lastSeen - CLOCK_TOLERANCE_MS) {
      return { ...base, state: 'clock', message: 'Компьютерын огноо буруу байна. Огноо, цагаа засаад дахин нээнэ үү.' };
    }
    let key;
    try {
      key = fs.readFileSync(this.file, 'utf8').trim();
    } catch {
      return { ...base, state: 'missing' };
    }
    const r = verifyKey(key, this.publicKey, code, now);
    if (r.error) {
      const state = r.error === 'expired' ? 'expired' : r.error === 'machine' ? 'machine' : 'invalid';
      return { ...base, state, message: r.message, license: r.payload };
    }
    this.writeState({ ...st, lastSeen: Math.max(st.lastSeen || 0, now.getTime()) });
    const daysLeft = r.payload.expires ? Math.ceil((new Date(`${r.payload.expires}T23:59:59`) - now) / 864e5) : null;
    return { ...base, state: 'active', license: r.payload, daysLeft };
  }

  activate(key, now = new Date()) {
    const r = verifyKey(key, this.publicKey, machineCode(), now);
    if (r.error) return { ok: false, message: r.message };
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, r.key, 'utf8');
    const st = this.readState();
    this.writeState({ ...st, lastSeen: Math.max(st.lastSeen || 0, now.getTime()), activatedAt: now.toISOString() });
    return { ok: true, license: r.payload };
  }

  deactivate() {
    try {
      fs.unlinkSync(this.file);
    } catch {
      /* */
    }
    return { ok: true };
  }
}

module.exports = { machineCode, verifyKey, LicenseStore, PRODUCT, PREFIX, b64url, fromB64url };
