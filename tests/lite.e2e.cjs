/**
 * Хөнгөн (Go + WebView2) хувилбарын цөмийн тест — Linux дээр Go туршилтын сервер + Chromium-оор.
 * Windows-ийн цонх (WebView2)-оос бусад бүх зүйл: лиценз, window.desktop гүүр, нөөц хуулбар, хуваарь бодох.
 * Ажиллуулах: npm run build:desktop && node tools/build-lite.mjs && node tests/lite.e2e.cjs
 */
const { chromium } = require('playwright');
const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SHOTS = process.env.SHOTS || os.tmpdir();
const PORT = 5199;
const BASE = `http://127.0.0.1:${PORT}`;
let failed = 0;
const check = (name, ok, extra = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : ` — ${extra}`}`);
  if (!ok) failed++;
};
const issueLog = path.join(os.tmpdir(), 'stt-lite-issued.csv');
const issue = (args) =>
  execFileSync('node', [path.join(ROOT, 'tools/license/issue.mjs'), ...args], { encoding: 'utf8', env: { ...process.env, STT_ISSUE_LOG: issueLog } })
    .trim()
    .split('\n')
    .pop()
    .trim();

const bin = path.join(os.tmpdir(), 'stt-lite-harness');
execFileSync('go', ['build', '-mod=vendor', '-o', bin, '.'], { cwd: path.join(ROOT, 'desktop-lite'), stdio: 'inherit' });

let server;
async function startServer(userData, docs, extraEnv = {}) {
  server = spawn(bin, [], {
    env: { ...process.env, PORT: String(PORT), STT_APP_DIR: path.join(ROOT, 'release/win-lite/app'), STT_USER_DATA: userData, STT_DOCUMENTS: docs, ...extraEnv },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(`${BASE}/__nav`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error('сервер асаагүй');
}
const stopServer = () => new Promise((r) => (server.once('exit', r), server.kill()));

(async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'stt-lite-ud-'));
  const docs = fs.mkdtempSync(path.join(os.tmpdir(), 'stt-lite-docs-'));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  let page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await startServer(userData, docs);

  console.log('1. Анх нээхэд идэвхжүүлэх цонх');
  await page.goto(`${BASE}/`);
  check('идэвхжүүлэх хуудас', page.url().endsWith('/__activation.html'), page.url());
  await page.waitForFunction(() => /[A-Z2-9]{4}-/.test(document.getElementById('machine').textContent));
  const code = (await page.textContent('#machine')).trim();
  const nodeCode = execFileSync('node', ['-e', "console.log(require('./electron/license.cjs').machineCode())"], { cwd: ROOT, encoding: 'utf8' }).trim();
  check('машины код Electron хувилбартай ижил', code === nodeCode, `${code} vs ${nodeCode}`);

  console.log('2. Лицензгүй үед программын хуудас нээгдэхгүй');
  await page.goto(`${BASE}/index.html`);
  await page.waitForURL(/__activation\.html$/, { timeout: 5000 }).catch(() => {});
  check('идэвхжүүлэх рүү буцаасан', page.url().endsWith('/__activation.html'), page.url());

  console.log('3. Буруу ба өөр компьютерын түлхүүр');
  await page.fill('#key', 'STT1.abc.def');
  await page.click('#activate');
  await page.waitForTimeout(400);
  check('буруу түлхүүр', /хүчингүй|хэлбэр/.test(await page.textContent('#message')), await page.textContent('#message'));
  await page.fill('#key', issue(['--machine', 'AAAA-BBBB-CCCC-DDDD', '--licensee', 'Өөр сургууль']));
  await page.click('#activate');
  await page.waitForTimeout(400);
  check('өөр компьютерынх', /өөр компьютер/.test(await page.textContent('#message')), await page.textContent('#message'));

  console.log('4. Лицензийн файлаар идэвхжүүлэх');
  const licFile = path.join(os.tmpdir(), 'stt-lite-test.lic');
  issue(['--machine', code, '--licensee', '12-р сургууль', '--expires', '2027-08-31', '--out', licFile]);
  await stopServer();
  await startServer(userData, docs, { STT_TEST_OPEN_FILE: licFile });
  await page.click('#file');
  await page.waitForURL(/index\.html$/, { timeout: 10000 });
  await page.waitForSelector('text=Хичээлүүд', { timeout: 15000 });
  check('программ нээгдсэн', page.url().endsWith('/index.html'));
  await page.getByRole('button', { name: /Үндсэн мэдээллийг дуусгаж/ }).click();
  await page.getByRole('button', { name: 'Баталгаажуулж хадгалах' }).click();
  await page.waitForTimeout(1000);
  check('толгойд лицензийн нэр', (await page.locator('button[title="Лицензийн мэдээлэл"]').innerText()).includes('12-р сургууль'));

  console.log('5. Хуваарь бодох (Web Worker) ба нөөц хуулбар');
  await page.locator('button[title="Автоматаар шинэ хуваарь бодож зохиох"]').click();
  await page.getByRole('button', { name: 'Хурдан (~15 сек)' }).click();
  await page.locator('div.fixed').getByRole('button', { name: 'Хуваарь бодох', exact: true }).click();
  await page.getByRole('button', { name: 'Хуваарийг хэрэглэх' }).waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: 'Хуваарийг хэрэглэх' }).click();
  await page.waitForTimeout(2500);
  check('хуваарь бодогдсон', true);
  const bdir = path.join(docs, 'School Timetable 2027', 'backups');
  const backups = fs.existsSync(bdir) ? fs.readdirSync(bdir) : [];
  check('нөөц хуулбар Documents-д', backups.some((f) => f.startsWith('backup_')), backups.join(','));
  const listed = await page.evaluate(() => window.desktop.backup.list());
  check('backup.list ажилласан', listed.length >= 2 && listed[0].displayTime, JSON.stringify(listed[0]));
  const loaded = await page.evaluate((f) => window.desktop.backup.load(f), listed[0].filename);
  check('backup.load ажилласан', loaded && typeof loaded === 'object');
  const saved = await page.evaluate(() => window.desktop.app.saveFile('test.json', '{"a":1}'));
  check('app.saveFile', saved.ok && fs.readFileSync(saved.path, 'utf8') === '{"a":1}', JSON.stringify(saved));
  await page.screenshot({ path: path.join(SHOTS, 'lite_app.png') });
  await page.locator('button[title="Лицензийн мэдээлэл"]').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS, 'lite_license.png') });

  console.log('6. Дахин нээхэд шууд программ, өгөгдөл хадгалагдсан');
  await stopServer();
  await startServer(userData, docs);
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(800);
  check('идэвхжүүлэх цонх гарахгүй', page.url().endsWith('/index.html'), page.url());

  console.log('7. Electron хувилбарын лиценз файлыг ч уншина');
  const electronState = execFileSync(
    'node',
    ['-e', "const {LicenseStore}=require('./electron/license.cjs');console.log(new LicenseStore(process.argv[1],'electron').status().state)", userData],
    { cwd: ROOT, encoding: 'utf8' }
  ).trim();
  check('ижил license.lic', electronState === 'active', electronState);

  console.log('8. Хугацаа дууссан, хуурамч лиценз');
  const key = fs.readFileSync(path.join(userData, 'license.lic'), 'utf8');
  fs.writeFileSync(path.join(userData, 'license.lic'), issue(['--machine', code, '--licensee', '12-р сургууль', '--expires', '2025-01-31']));
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(600);
  check('хугацаа дууссан → идэвхжүүлэх', page.url().endsWith('/__activation.html'));
  check('мэдэгдэл', /дууссан/.test(await page.textContent('#state')), await page.textContent('#state'));
  check('өгөгдлөө хадгалах товч', await page.isVisible('#export'));
  await page.screenshot({ path: path.join(SHOTS, 'lite_expired.png') });
  const parts = key.split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  payload.expires = '2099-12-31';
  fs.writeFileSync(path.join(userData, 'license.lic'), `${parts[0]}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${parts[2]}`);
  await page.goto(`${BASE}/index.html`);
  await page.waitForURL(/__activation\.html$/, { timeout: 5000 }).catch(() => {});
  check('хуурамч лиценз татгалзсан', page.url().endsWith('/__activation.html'));

  console.log('9. Түлхүүр буулгаж идэвхжүүлэх');
  await page.fill('#key', key);
  await page.click('#activate');
  await page.waitForURL(/index\.html$/, { timeout: 10000 });
  check('буулгасан түлхүүрээр нээгдсэн', true);

  check('JavaScript алдаагүй', errors.length === 0, errors.join(' | '));
  await browser.close();
  await stopServer();
  console.log(`\n${failed === 0 ? 'Бүгд амжилттай' : `${failed} алдаа`}`);
  process.exit(failed ? 1 : 0);
})().catch(async (e) => {
  console.error(e);
  if (server) server.kill();
  process.exit(1);
});
