// Electron main（設計書 §2/§9/§12。contextIsolation + 最小 IPC）
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fsp = require('node:fs/promises');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');

const APP_ROOT = path.join(__dirname, '..');
const resolvePath = (p) => (path.isAbsolute(p) ? p : path.join(APP_ROOT, p));
const cacheRoot = () =>
  path.join(process.env.LOCALAPPDATA || app.getPath('userData'), 'KKTenji', 'cache');

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#202020',
    title: 'KKTenji',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  const hash = process.env.KK_SHOT ? (process.env.KK_SHOT_MODE === 'pres' ? '#sample-pres' : '#sample') : '';
  win.loadFile(path.join(APP_ROOT, 'dist-web', 'index.html'), { hash });

  // 検証用スクリーンショット（KK_SHOT=出力パス で起動 → 撮影して終了）
  if (process.env.KK_SHOT) {
    win.webContents.on('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const img = await win.webContents.capturePage();
          await fsp.writeFile(process.env.KK_SHOT, img.toPNG());
        } finally {
          app.quit();
        }
      }, Number(process.env.KK_SHOT_DELAY || 4000));
    });
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

ipcMain.handle('open-file', async () => {
  const r = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [
      { name: 'KKTenji deck', extensions: ['json', 'md', 'pptx'] },
      { name: 'すべて', extensions: ['*'] },
    ],
  });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('open-folder', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('read-file', (_e, p) => fsp.readFile(resolvePath(p), 'utf8'));
ipcMain.handle('list-dir', (_e, d) => fsp.readdir(resolvePath(d)));
ipcMain.handle('cache-dir', async () => {
  const d = cacheRoot();
  await fsp.mkdir(d, { recursive: true });
  return d;
});

ipcMain.handle('has-office', () => new Promise((resolve) => {
  execFile('powershell', [
    '-NoProfile', '-Command',
    "Test-Path 'Registry::HKEY_CLASSES_ROOT\\PowerPoint.Application'",
  ], { timeout: 15000 }, (err, stdout) => {
    resolve(!err && String(stdout).trim().toLowerCase() === 'true');
  });
}));

ipcMain.handle('export-pptx', async (_e, pptxPath) => {
  try {
    const abs = resolvePath(pptxPath);
    const buf = await fsp.readFile(abs);
    const hash8 = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8);
    const outDir = path.join(cacheRoot(), hash8);
    const manifestPath = path.join(outDir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      const m = JSON.parse(await fsp.readFile(manifestPath, 'utf8'));
      return { pages: m.pages, dir: outDir };
    }
    await fsp.mkdir(outDir, { recursive: true });
    const script = path.join(APP_ROOT, 'scripts', 'export-pptx.ps1');
    return await new Promise((resolve) => {
      execFile('powershell', [
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script,
        '-Pptx', abs, '-OutDir', outDir,
      ], { timeout: 300000 }, async (err, stdout) => {
        const out = String(stdout);
        const done = out.match(/DONE (\d+)/);
        if (done) {
          const pages = Number(done[1]);
          await fsp.writeFile(manifestPath, JSON.stringify({ schema: 1, pages, source: hash8 }));
          resolve({ pages, dir: outDir });
        } else {
          const em = out.match(/ERROR (.+)/);
          resolve({ error: em ? em[1].trim() : (err ? err.message : 'UNKNOWN') });
        }
      });
    });
  } catch (e) {
    return { error: e.message };
  }
});
