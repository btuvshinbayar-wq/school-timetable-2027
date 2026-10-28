#!/usr/bin/env node
/**
 * Нийлүүлэгчийн түлхүүрийн хос үүсгэнэ (НЭГ УДАА).
 *   license-keys/private.pem  — НУУЦ. Хэнд ч өгөхгүй, git-д оруулахгүй, нөөцлөөд хадгална.
 *   electron/license-public.pem — программд суугдана.
 * Хувийн түлхүүрээ алдвал өмнө нь олгосон лицензүүд хүчинтэй хэвээр боловч шинээр олгох боломжгүй болно.
 * Ажиллуулах: npm run license:keygen   (дахин үүсгэх бол --force)
 */
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const privPath = join(root, 'license-keys', 'private.pem');
const pubPath = join(root, 'electron', 'license-public.pem');

if (existsSync(privPath) && !process.argv.includes('--force')) {
  console.error(`Хувийн түлхүүр аль хэдийн байна: ${privPath}\nДахин үүсгэвэл өмнөх лицензүүдийг шинэ хувилбар хүлээн авахгүй. Итгэлтэй бол --force нэмнэ үү.`);
  process.exit(1);
}
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
mkdirSync(dirname(privPath), { recursive: true });
writeFileSync(privPath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
writeFileSync(pubPath, publicKey.export({ type: 'spki', format: 'pem' }));
console.log(`Хувийн түлхүүр: ${privPath}\nНийтийн түлхүүр: ${pubPath}\nОдоо программыг дахин бүтээнэ үү (npm run dist:win).`);
