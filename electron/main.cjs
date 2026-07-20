// Electron main（設計書 §2/§9/§12。contextIsolation + 最小 IPC）
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fsp = require('node:fs/promises');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFile, spawn } = require('node:child_process');

// 関連付け/右クリック/二重起動から渡されるパスを argv から拾う
function pathFromArgv(argv) {
  for (const a of argv.slice(1)) {
    if (a.startsWith('-')) continue;
    if (/\.(tenji\.json|tenji|json|pptx|md)$/i.test(a)) return a;
    try { if (fs.statSync(a).isDirectory()) return a; } catch { /* ignore */ }
  }
  return null;
}

const APP_ROOT = path.join(__dirname, '..');
const resolvePath = (p) => (path.isAbsolute(p) ? p : path.join(APP_ROOT, p));
const cacheRoot = () =>
  path.join(process.env.LOCALAPPDATA || app.getPath('userData'), 'KKTenji', 'cache');

// System32 のフルパスで PowerShell を起動する（CWD/PATH 経由の差し替えを防ぐ）
const POWERSHELL = path.join(
  process.env.SystemRoot || 'C:\\Windows',
  'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');

// ── IPC パス白名单（設計書 §12）──
// read-file/list-dir/export-pptx はユーザーが明示的に開いた場所（ダイアログ/argv/
// ドロップ/履歴）+ 同梱資源 + キャッシュのみ読める。悪意 sidecar の ../ 遡上を遮断する。
const grantedRoots = new Set();
const normRoot = (p) => {
  const r = path.resolve(p).toLowerCase();
  return r.endsWith(path.sep) ? r : r + path.sep;
};
function grantPath(p) {
  if (!p || typeof p !== 'string') return;
  try {
    const st = fs.statSync(p);
    grantedRoots.add(normRoot(st.isDirectory() ? p : path.dirname(p)));
  } catch {
    grantedRoots.add(normRoot(path.dirname(p)));
  }
}
grantedRoots.add(normRoot(APP_ROOT));
grantedRoots.add(normRoot(cacheRoot()));
function guardPath(p) {
  const abs = resolvePath(String(p));
  const key = normRoot(abs);
  for (const root of grantedRoots) {
    if (key.startsWith(root)) return abs;
  }
  throw new Error('PATH_DENIED');
}

// ── 障害ログ（%LOCALAPPDATA%/KKTenji/logs/error.log。肥大時は後半のみ残す）──
const logDir = () => path.join(process.env.LOCALAPPDATA || app.getPath('userData'), 'KKTenji', 'logs');
function logError(tag, msg) {
  try {
    fs.mkdirSync(logDir(), { recursive: true });
    const f = path.join(logDir(), 'error.log');
    const line = `[${new Date().toISOString()}] ${tag}: ${String(msg).slice(0, 4000)}\n`;
    let prev = '';
    try { prev = fs.readFileSync(f, 'utf8'); } catch { /* ignore */ }
    if (prev.length > 512 * 1024) prev = prev.slice(prev.length - 256 * 1024);
    fs.writeFileSync(f, prev + line);
  } catch { /* ログ失敗で本体は落とさない */ }
}
process.on('uncaughtException', (e) => logError('main-uncaught', (e && e.stack) || e));
process.on('unhandledRejection', (e) => logError('main-unhandled', (e && e.stack) || e));

// ── キャッシュ統計と LRU 掃除（設計書 §8。キャッシュは派生物 = いつ消しても安全）──
const CACHE_LIMIT_BYTES = 1.5 * 1024 * 1024 * 1024;
const exportingDirs = new Set(); // 書き出し進行中の outDir は掃除・クリアの対象外
async function scanCache() {
  const root = cacheRoot();
  const entries = [];
  for (const name of await fsp.readdir(root).catch(() => [])) {
    const p = path.join(root, name);
    if (exportingDirs.has(p)) continue;
    const st = await fsp.stat(p).catch(() => null);
    if (!st || !st.isDirectory()) continue;
    let size = 0;
    for (const fn of await fsp.readdir(p).catch(() => [])) {
      const fst = await fsp.stat(path.join(p, fn)).catch(() => null);
      if (fst && fst.isFile()) size += fst.size;
    }
    entries.push({ p, mtimeMs: st.mtimeMs, size });
  }
  return entries;
}
async function sweepCache() {
  try {
    const entries = await scanCache();
    let total = entries.reduce((a, e) => a + e.size, 0);
    entries.sort((a, b) => a.mtimeMs - b.mtimeMs); // 古い順に削る
    for (const e of entries) {
      if (total <= CACHE_LIMIT_BYTES) break;
      await fsp.rm(e.p, { recursive: true, force: true });
      total -= e.size;
    }
  } catch (e) { logError('cache-sweep', e.message); }
}

// ── 最近開いた deck（userData/recent.json。パスは白名单通過済みのもののみ）──
const recentFile = () => path.join(app.getPath('userData'), 'recent.json');
async function loadRecent() {
  try {
    const arr = JSON.parse(await fsp.readFile(recentFile(), 'utf8'));
    return Array.isArray(arr) ? arr.filter(e => e && typeof e.path === 'string') : [];
  } catch { return []; }
}
async function saveRecent(list) {
  try { await fsp.writeFile(recentFile(), JSON.stringify(list)); } catch { /* ignore */ }
}

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#202020',
    title: 'KKTenji',
    icon: path.join(APP_ROOT, 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  // drop されたファイルへのナビゲーション等を防ぐ（縦深防御）
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  // レンダラの error レベルは常に障害ログへ（現地障害の切り分け用）
  win.webContents.on('console-message', (_e, lv, msg) => {
    if (lv >= 3) logError('renderer', msg);
    if (process.env.KK_DEBUG) {
      require('node:fs').appendFileSync(
        path.join(cacheRoot(), 'console-debug.txt'), msg + '\n');
    }
  });
  win.webContents.on('render-process-gone', (_e, details) =>
    logError('renderer-gone', JSON.stringify(details)));
  const mode = process.env.KK_SHOT_MODE;
  let hash = '';
  const argvPath = pathFromArgv(process.argv);
  grantPath(argvPath);
  grantPath(process.env.KK_OPEN);
  if (process.env.KK_OPEN) {
    hash = '#open=' + encodeURIComponent(process.env.KK_OPEN) + (mode ? '&' + mode : '');
  } else if (process.env.KK_SHOT) {
    hash = mode === 'pres' ? '#sample-pres' : mode === 'sel' ? '#sample-sel'
      : mode === 'help' ? '#help' : mode === 'help-sys' ? '#help-sys' : '#sample';
  } else if (argvPath) {
    hash = '#open=' + encodeURIComponent(argvPath);
  }
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

// 単一インスタンス: 2 回目の起動はパスを既存窓へ渡す
// （KK_SHOT/KK_OPEN の検証起動はロックに参加しない = 実行中のアプリと共存）
const isVerifyRun = !!(process.env.KK_SHOT || process.env.KK_OPEN);
const gotLock = isVerifyRun ? true : app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
    const p = pathFromArgv(argv);
    if (p) { grantPath(p); win.webContents.send('open-path', p); }
  });
  app.whenReady().then(() => {
    createWindow();
    setTimeout(() => { void sweepCache(); }, 8000); // 起動を阻害しないよう遅延して LRU 掃除
  });
}
app.on('window-all-closed', () => app.quit());

ipcMain.handle('open-file', async () => {
  const r = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [
      { name: 'KKTenji deck', extensions: ['json', 'md', 'pptx'] },
      { name: 'すべて', extensions: ['*'] },
    ],
  });
  if (r.canceled) return null;
  grantPath(r.filePaths[0]);
  return r.filePaths[0];
});

ipcMain.handle('open-folder', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
  if (r.canceled) return null;
  grantPath(r.filePaths[0]);
  return r.filePaths[0];
});

ipcMain.handle('read-file', (_e, p) => fsp.readFile(guardPath(p), 'utf8'));
ipcMain.handle('list-dir', (_e, d) => fsp.readdir(guardPath(d)));
// preload の webUtils.getPathForFile 経由（= 実際にドロップされた File）のみが呼ぶ
ipcMain.handle('grant-path', (_e, p) => { grantPath(p); });

ipcMain.handle('recent-list', async () => {
  const list = await loadRecent();
  for (const e of list) grantPath(e.path); // 過去に正規経路で開いた場所を再許可
  return list;
});
ipcMain.handle('recent-add', async (_e, p, title) => {
  try { guardPath(p); } catch { return; } // 白名单外は記録しない
  const key = String(p).toLowerCase();
  const list = (await loadRecent()).filter(x => x.path.toLowerCase() !== key);
  list.unshift({ path: String(p), title: String(title || '').slice(0, 80), ts: Date.now() });
  await saveRecent(list.slice(0, 8));
});
ipcMain.handle('recent-remove', async (_e, p) => {
  const key = String(p).toLowerCase();
  await saveRecent((await loadRecent()).filter(x => x.path.toLowerCase() !== key));
});

ipcMain.handle('app-version', () => app.getVersion());
ipcMain.handle('cache-stats', async () => {
  const entries = await scanCache();
  return { bytes: entries.reduce((a, e) => a + e.size, 0), decks: entries.length };
});
ipcMain.handle('clear-cache', async () => {
  for (const e of await scanCache()) {
    await fsp.rm(e.p, { recursive: true, force: true }).catch(() => { /* ignore */ });
  }
});
ipcMain.handle('cache-dir', async () => {
  const d = cacheRoot();
  await fsp.mkdir(d, { recursive: true });
  return d;
});

ipcMain.handle('has-office', () => new Promise((resolve) => {
  execFile(POWERSHELL, [
    '-NoProfile', '-Command',
    "Test-Path 'Registry::HKEY_CLASSES_ROOT\\PowerPoint.Application'",
  ], { timeout: 15000 }, (err, stdout) => {
    if (process.env.KK_DEBUG) {
      fs.writeFileSync(path.join(cacheRoot(), 'hasoffice-debug.txt'),
        `err=${err ? err.message : 'null'}\nstdout=${JSON.stringify(String(stdout))}`);
    }
    resolve(!err && String(stdout).trim().toLowerCase() === 'true');
  });
}));

const exportInflight = new Map(); // 同一 pptx への多重エクスポート防止

ipcMain.handle('export-pptx', async (_e, pptxPath) => {
  const key = String(pptxPath);
  if (exportInflight.has(key)) return exportInflight.get(key);
  const p = doExportPptx(pptxPath).finally(() => exportInflight.delete(key));
  exportInflight.set(key, p);
  return p;
});

async function doExportPptx(pptxPath) {
  try {
    const abs = guardPath(pptxPath);
    const buf = await fsp.readFile(abs);
    const hash8 = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8);
    const outDir = path.join(cacheRoot(), hash8);
    const manifestPath = path.join(outDir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      // BOM 付きで書かれた manifest も許容する
      const raw = (await fsp.readFile(manifestPath, 'utf8')).replace(/^﻿/, '');
      const m = JSON.parse(raw);
      const now = new Date();
      await fsp.utimes(outDir, now, now).catch(() => {}); // LRU 用に「使った」印
      return { pages: m.pages, dir: outDir };
    }
    await fsp.mkdir(outDir, { recursive: true });
    const script = path.join(APP_ROOT, 'scripts', 'export-pptx.ps1');
    exportingDirs.add(outDir);
    // spawn + 行単位読取で PAGE i/N をレンダラへ増分中継（設計書 §6.9/§9）
    return await new Promise((resolve) => {
      const ps = spawn(POWERSHELL, [
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script,
        '-Pptx', abs, '-OutDir', outDir,
      ]);
      let out = '';
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        logError('export-timeout', pptxPath);
        try { ps.kill(); } catch { /* ignore */ }
      }, 300000);
      ps.stdout.on('data', (d) => {
        const s = String(d);
        out += s;
        const m = s.match(/PAGE (\d+)\/(\d+)/);
        if (m && win && !win.isDestroyed()) {
          win.webContents.send('export-progress', { i: Number(m[1]), n: Number(m[2]) });
        }
      });
      ps.on('error', (e) => {
        clearTimeout(timer);
        exportingDirs.delete(outDir);
        resolve({ error: e.message });
      });
      ps.on('close', async () => {
        clearTimeout(timer);
        exportingDirs.delete(outDir);
        const done = out.match(/DONE (\d+)/);
        if (done) {
          const pages = Number(done[1]);
          await fsp.writeFile(manifestPath, JSON.stringify({ schema: 1, pages, source: hash8 }));
          setTimeout(() => { void sweepCache(); }, 1000);
          resolve({ pages, dir: outDir });
        } else {
          const em = out.match(/ERROR (.+)/);
          const error = timedOut ? 'TIMEOUT' : em ? em[1].trim() : 'UNKNOWN';
          if (error !== 'NO_OFFICE') logError('export-failed', `${error} (${pptxPath})`);
          resolve({ error });
        }
      });
    });
  } catch (e) {
    return { error: e.message };
  }
}
