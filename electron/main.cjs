/**
 * School Timetable 2027 — Windows десктоп программ (Electron үндсэн процесс).
 *
 *  - Программын файлуудыг app://local/ хаягаар үйлчилнэ (Web Worker, localStorage, фонт хэвийн ажиллана)
 *  - Лиценз идэвхгүй бол зөвхөн идэвхжүүлэх цонх нээгдэнэ
 *  - Автомат нөөц хуулбар: Documents\School Timetable 2027\backups
 */
const { app, BrowserWindow, protocol, ipcMain, dialog, shell, net, clipboard, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { LicenseStore } = require('./license.cjs');

const APP_ID = 'mn.schooltimetable.app2027';
const PRODUCT_NAME = 'School Timetable 2027';
const ORIGIN = 'app://local';
const APP_URL = `${ORIGIN}/index.html`;
const ACTIVATION_URL = `${ORIGIN}/__activation.html`;
const DIST_DIR = path.join(__dirname, '..', 'dist-desktop');
const BACKUP_KEEP = 300;

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

app.setAppUserModelId(APP_ID);
// Автомат тестэд тусдаа өгөгдлийн хавтас ашиглах
if (process.env.STT_USER_DATA) app.setPath('userData', process.env.STT_USER_DATA);
if (process.env.STT_DOCUMENTS) app.setPath('documents', process.env.STT_DOCUMENTS);

/** @type {BrowserWindow | null} */
let win = null;
/** @type {LicenseStore} */
let store;

const backupsDir = () => path.join(app.getPath('documents'), PRODUCT_NAME, 'backups');

function resolveAsset(urlPath) {
  const p = decodeURIComponent(urlPath);
  if (p === '/__activation.html' || p === '/__activation.js' || p === '/__activation.css') {
    return path.join(__dirname, p.slice(3));
  }
  const rel = p === '/' ? 'index.html' : p.replace(/^\/+/, '');
  const file = path.normalize(path.join(DIST_DIR, rel));
  if (!file.startsWith(DIST_DIR)) return null; // хавтасаас гадагш гарахгүй
  return file;
}

function registerProtocol() {
  protocol.handle('app', async (request) => {
    const url = new URL(request.url);
    const file = resolveAsset(url.pathname);
    if (!file || !fs.existsSync(file)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 680,
    show: false,
    backgroundColor: '#ecebe5',
    title: PRODUCT_NAME,
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  win.removeMenu();

  const status = store.status();
  win.loadURL(status.state === 'active' ? APP_URL : ACTIVATION_URL);

  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
  });

  // Программаас гадагш шилжихгүй; гадаад холбоосыг хөтчөөр нээнэ
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(ORIGIN)) {
      e.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    // Хэвлэх цонх (about:blank) — зөвшөөрнө
    if (!url || url === 'about:blank') {
      return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, backgroundColor: '#ffffff', icon: path.join(__dirname, '..', 'build', 'icon.ico') } };
    }
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.on('closed', () => {
    win = null;
  });
}

// --------------------------------------------------------------------------
// IPC
// --------------------------------------------------------------------------

function registerIpc() {
  ipcMain.handle('license:status', () => store.status());

  ipcMain.handle('license:activate', (_e, key) => {
    const r = store.activate(key);
    if (r.ok && win) setTimeout(() => win && win.loadURL(APP_URL), 900);
    return r;
  });

  ipcMain.handle('license:importFile', async () => {
    const res = await dialog.showOpenDialog(win, {
      title: 'Лицензийн файл сонгох',
      filters: [{ name: 'Лиценз', extensions: ['lic', 'txt'] }],
      properties: ['openFile'],
    });
    if (res.canceled || !res.filePaths[0]) return { ok: false, canceled: true };
    const key = fs.readFileSync(res.filePaths[0], 'utf8');
    const r = store.activate(key);
    if (r.ok && win) setTimeout(() => win && win.loadURL(APP_URL), 900);
    return r;
  });

  ipcMain.handle('license:deactivate', async () => {
    const res = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['Лицензийг хасах', 'Болих'],
      defaultId: 1,
      cancelId: 1,
      title: 'Лиценз хасах',
      message: 'Энэ компьютерээс лицензийг хасах уу?',
      detail: 'Хуваарийн өгөгдөл устахгүй. Дахин ашиглахын тулд лицензийн түлхүүрээ дахин оруулна.',
    });
    if (res.response !== 0) return { ok: false };
    store.deactivate();
    if (win) win.loadURL(ACTIVATION_URL);
    return { ok: true };
  });

  ipcMain.handle('backup:save', (_e, json) => {
    if (store.status().state !== 'active') return { success: false };
    const dir = backupsDir();
    fs.mkdirSync(dir, { recursive: true });
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    let name = 'timetable';
    try {
      const d = JSON.parse(json);
      name = String(d.projectName || d.settings?.schoolName || name);
    } catch {
      return { success: false };
    }
    const clean = name.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40);
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    const filename = `backup_${stamp}_${clean}.json`;
    fs.writeFileSync(path.join(dir, filename), json, 'utf8');
    fs.writeFileSync(path.join(dir, 'latest_backup.json'), json, 'utf8');
    // Хуучин хуулбаруудыг цэвэрлэнэ
    const files = fs.readdirSync(dir).filter((f) => f.startsWith('backup_') && f.endsWith('.json')).sort();
    for (const f of files.slice(0, Math.max(0, files.length - BACKUP_KEEP))) {
      try {
        fs.unlinkSync(path.join(dir, f));
      } catch {
        /* */
      }
    }
    return {
      success: true,
      filename,
      displayTime: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
    };
  });

  ipcMain.handle('backup:list', () => {
    const dir = backupsDir();
    if (!fs.existsSync(dir)) return [];
    const pad = (n) => String(n).padStart(2, '0');
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((filename) => {
        const st = fs.statSync(path.join(dir, filename));
        const d = st.mtime;
        return {
          filename,
          size: st.size,
          mtime: d.toISOString(),
          displayTime: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
        };
      })
      .sort((a, b) => b.mtime.localeCompare(a.mtime));
  });

  ipcMain.handle('backup:load', (_e, filename) => {
    const file = path.join(backupsDir(), path.basename(String(filename)));
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  });

  ipcMain.handle('backup:openFolder', () => {
    fs.mkdirSync(backupsDir(), { recursive: true });
    return shell.openPath(backupsDir());
  });

  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    name: PRODUCT_NAME,
    backupsDir: backupsDir(),
    userData: app.getPath('userData'),
  }));

  ipcMain.handle('app:saveFile', async (_e, defaultName, content) => {
    const res = await dialog.showSaveDialog(win, {
      defaultPath: path.join(app.getPath('documents'), String(defaultName || 'timetable.json')),
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (res.canceled || !res.filePath) return { ok: false };
    fs.writeFileSync(res.filePath, String(content), 'utf8');
    return { ok: true, path: res.filePath };
  });

  ipcMain.handle('app:copy', (_e, text) => {
    clipboard.writeText(String(text));
    return true;
  });
}

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.whenReady().then(() => {
  store = new LicenseStore(app.getPath('userData'), __dirname);
  registerProtocol();
  registerIpc();
  // Татаж авах файлуудыг (Excel, JSON) "Documents" руу санал болгоно
  session.defaultSession.on('will-download', (_e, item) => {
    item.setSaveDialogOptions({ defaultPath: path.join(app.getPath('documents'), item.getFilename()) });
  });
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
