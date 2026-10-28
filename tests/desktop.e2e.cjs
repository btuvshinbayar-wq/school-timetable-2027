/**
 * Десктоп программын (Electron) идэвхжүүлэх урсгалын тест.
 * Ажиллуулах (Linux): npm run build:desktop && xvfb-run -a node tests/desktop.e2e.cjs
 */
const { _electron: electron } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SHOTS = process.env.SHOTS || os.tmpdir();
let failed = 0;
const check = (name, ok, extra = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : ` — ${extra}`}`);
  if (!ok) failed++;
};

const issue = (args) =>
  execFileSync('node', [path.join(ROOT, 'tools/license/issue.mjs'), ...args], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .pop()
    .trim();

async function launch(userData, docs) {
  const app = await electron.launch({
    executablePath: require(path.join(ROOT, 'node_modules/electron')),
    args: [ROOT, '--no-sandbox'],
    env: { ...process.env, STT_USER_DATA: userData, STT_DOCUMENTS: docs, ELECTRON_DISABLE_SECURITY_WARNINGS: '1' },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(800);
  return { app, page };
}

(async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'stt-ud-'));
  const docs = fs.mkdtempSync(path.join(os.tmpdir(), 'stt-docs-'));

  console.log('1. Анх нээхэд идэвхжүүлэх цонх');
  let { app, page } = await launch(userData, docs);
  check('идэвхжүүлэх хуудас', page.url().endsWith('/__activation.html'), page.url());
  await page.waitForFunction(() => /[A-Z2-9]{4}-/.test(document.getElementById('machine').textContent));
  const code = (await page.textContent('#machine')).trim();
  check('машины код харагдсан', /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code), code);
  await page.screenshot({ path: path.join(SHOTS, 'desk_activation.png') });

  console.log('2. Буруу түлхүүр');
  await page.fill('#key', 'STT1.abc.def');
  await page.click('#activate');
  await page.waitForTimeout(400);
  check('алдааны мэдэгдэл', /хүчингүй|хэлбэр/.test(await page.textContent('#message')), await page.textContent('#message'));

  console.log('3. Өөр компьютерын түлхүүр');
  const other = issue(['--machine', 'AAAA-BBBB-CCCC-DDDD', '--licensee', 'Өөр сургууль']);
  await page.fill('#key', other);
  await page.click('#activate');
  await page.waitForTimeout(400);
  check('өөр компьютерынх гэж татгалзсан', /өөр компьютер/.test(await page.textContent('#message')), await page.textContent('#message'));

  console.log('4. Зөв түлхүүрээр идэвхжүүлэх');
  const key = issue(['--machine', code, '--licensee', '12-р сургууль', '--expires', '2027-08-31']);
  await page.fill('#key', key);
  await page.click('#activate');
  await page.waitForURL(/index\.html$/, { timeout: 10000 });
  await page.waitForSelector('text=Хичээлүүд', { timeout: 15000 });
  await page.waitForTimeout(1000);
  // Анхны тохиргоо: сургуулийн нэр өгч хадгална
  await page.screenshot({ path: path.join(SHOTS, 'desk_firstrun.png') });
  await page.getByRole('button', { name: /Үндсэн мэдээллийг дуусгаж/ }).click();
  await page.getByRole('button', { name: 'Баталгаажуулж хадгалах' }).click();
  await page.waitForTimeout(1200);
  check('программ нээгдсэн', page.url().endsWith('/index.html'));
  check('толгойд лицензийн нэр', (await page.locator('button[title="Лицензийн мэдээлэл"]').innerText()).includes('12-р сургууль'));
  // Хуваарийн Web Worker ажиллаж байгаа эсэх: хуваарь бодох
  await page.locator('button[title="Автоматаар шинэ хуваарь бодож зохиох"]').click();
  await page.getByRole('button', { name: 'Хурдан (~15 сек)' }).click();
  await page.locator('div.fixed').getByRole('button', { name: 'Хуваарь бодох', exact: true }).click();
  await page.getByRole('button', { name: 'Хуваарийг хэрэглэх' }).waitFor({ timeout: 60000 });
  check('Web Worker-ээр хуваарь бодогдсон', true);
  await page.getByRole('button', { name: 'Хуваарийг хэрэглэх' }).click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(SHOTS, 'desk_app.png') });
  const backups = fs.existsSync(path.join(docs, 'School Timetable 2027', 'backups'))
    ? fs.readdirSync(path.join(docs, 'School Timetable 2027', 'backups'))
    : [];
  check('нөөц хуулбар Documents-д', backups.some((f) => f.startsWith('backup_')), backups.join(','));
  await page.locator('button[title="Лицензийн мэдээлэл"]').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS, 'desk_license.png') });
  await app.close();

  console.log('5. Дахин нээхэд шууд программ');
  ({ app, page } = await launch(userData, docs));
  await page.waitForTimeout(800);
  check('идэвхжүүлэх цонх гарахгүй', page.url().endsWith('/index.html'), page.url());
  await app.close();

  console.log('6. Хугацаа дууссан лиценз');
  const expired = issue(['--machine', code, '--licensee', '12-р сургууль', '--expires', '2025-01-31']);
  fs.writeFileSync(path.join(userData, 'license.lic'), expired);
  ({ app, page } = await launch(userData, docs));
  check('идэвхжүүлэх цонх', page.url().endsWith('/__activation.html'));
  await page.waitForTimeout(500);
  check('хугацаа дууссан гэж мэдэгдсэн', /дууссан/.test(await page.textContent('#state')), await page.textContent('#state'));
  check('өгөгдлөө хадгалах товч', await page.isVisible('#export'));
  await page.screenshot({ path: path.join(SHOTS, 'desk_expired.png') });
  await app.close();

  console.log('7. Лицензийн файлыг гараар засах (гарын үсэг эвдрэх)');
  const parts = key.split('.');
  const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
  payload.expires = '2099-12-31';
  const forged = `${parts[0]}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${parts[2]}`;
  fs.writeFileSync(path.join(userData, 'license.lic'), forged);
  ({ app, page } = await launch(userData, docs));
  check('хуурамч лиценз татгалзсан', page.url().endsWith('/__activation.html'));
  await app.close();

  console.log(`\n${failed === 0 ? 'Бүгд амжилттай' : `${failed} алдаа`}`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
