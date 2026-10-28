#!/usr/bin/env node
/**
 * Лиценз олгох.
 *   npm run license:issue -- --machine ABCD-EFGH-JKLM-NPQR --licensee "12-р сургууль" --expires 2027-08-31
 * Сонголтууд:
 *   --machine   Хэрэглэгчийн идэвхжүүлэх цонхонд харагдах машины код ("*" = аль ч компьютер)
 *   --licensee  Сургууль/байгууллагын нэр (программд харагдана)
 *   --expires   Дуусах огноо YYYY-MM-DD (хоосон бол хугацаагүй)
 *   --edition   standard | pro (анхдагч: standard)
 *   --note      Дотоод тэмдэглэл
 *   --key       Хувийн түлхүүрийн зам (анхдагч: license-keys/private.pem)
 *   --out       .lic файл болгож хадгалах зам
 * Олгосон бүх лиценз license-keys/issued.csv-д бүртгэгдэнэ.
 */
import { createPrivateKey, randomBytes, sign } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) args[a.slice(2)] = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : 'true';
}
const fail = (m) => {
  console.error(`Алдаа: ${m}`);
  process.exit(1);
};
const machine = String(args.machine || '').trim().toUpperCase();
if (!machine) fail('--machine заавал (хэрэглэгчийн машины код, эсвэл "*")');
if (machine !== '*' && !/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(machine)) fail('Машины код XXXX-XXXX-XXXX-XXXX хэлбэртэй байна');
if (!args.licensee) fail('--licensee заавал (сургуулийн нэр)');
if (args.expires && !/^\d{4}-\d{2}-\d{2}$/.test(args.expires)) fail('--expires YYYY-MM-DD хэлбэртэй');
const keyPath = args.key || join(root, 'license-keys', 'private.pem');
if (!existsSync(keyPath)) fail(`Хувийн түлхүүр олдсонгүй: ${keyPath} (эхлээд npm run license:keygen)`);

const b64url = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const today = new Date().toISOString().slice(0, 10);
const payload = {
  v: 1,
  id: b64url(randomBytes(6)),
  product: 'STT2027',
  licensee: String(args.licensee),
  edition: args.edition || 'standard',
  machine,
  issued: today,
  expires: args.expires || null,
};
const head = `STT1.${b64url(JSON.stringify(payload))}`;
const sig = sign(null, Buffer.from(head), createPrivateKey(readFileSync(keyPath)));
const key = `${head}.${b64url(sig)}`;

const logPath = join(root, 'license-keys', 'issued.csv');
mkdirSync(dirname(logPath), { recursive: true });
if (!existsSync(logPath)) appendFileSync(logPath, '﻿id,issued,licensee,machine,expires,edition,note\n');
const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
appendFileSync(logPath, [payload.id, today, q(payload.licensee), machine, payload.expires || '', payload.edition, q(args.note)].join(',') + '\n');

if (args.out) {
  writeFileSync(args.out, key + '\n');
  console.log(`Лицензийн файл: ${args.out}`);
}
console.log(`\nЛиценз: ${payload.licensee} · ${machine === '*' ? 'бүх компьютер' : machine} · ${payload.expires ? `${payload.expires} хүртэл` : 'хугацаагүй'}\n\n${key}\n`);
