/**
 * 字体：可用字体表、本地字体文件（IndexedDB 持久化）、字体变量应用
 *
 * 字体来源分三层：
 * 1. 项目自带 woff2（assets/fonts/fonts.css，许可允许再分发的部分）
 * 2. 系统已安装字体（按家族名引用，零下载）
 * 3. 用户自行载入的字体文件（存进 IndexedDB，跨会话保留）
 */
import { t } from './i18n.js';

export const LOCAL_FAMILY = 'UserLocalFont';

export const FONT_OPTIONS = [
  {
    key: 'sans-jp',
    labelKey: 'font.sans-jp',
    stack: "'Noto Sans JP','Hiragino Sans','Hiragino Kaku Gothic ProN','Yu Gothic',system-ui,sans-serif",
  },
  {
    key: 'serif-jp',
    labelKey: 'font.serif-jp',
    stack: "'Noto Serif JP','Hiragino Mincho ProN','Yu Mincho','Aozora Mincho','Shippori Mincho',serif",
  },
  {
    key: 'maru-jp',
    labelKey: 'font.maru-jp',
    stack: "'Hiragino Maru Gothic ProN','Zen Maru Gothic','Yu Gothic UI','Noto Sans JP',sans-serif",
  },
  {
    key: 'sans-sc',
    labelKey: 'font.sans-sc',
    stack: "'Noto Sans SC','PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif",
  },
  {
    key: 'serif-sc',
    labelKey: 'font.serif-sc',
    stack: "'Noto Serif SC','Songti SC','SimSun','Noto Serif JP',serif",
  },
  {
    key: 'local',
    labelKey: 'font.local',
    stack: null, // 运行时拼接
  },
];

const LOCAL_FALLBACK = "'Noto Sans JP','Hiragino Sans','PingFang SC',sans-serif";

export function fontStack(key) {
  const opt = FONT_OPTIONS.find(f => f.key === key);
  if (!opt) return FONT_OPTIONS[0].stack;
  if (key === 'local') return "'" + LOCAL_FAMILY + "'," + LOCAL_FALLBACK;
  return opt.stack;
}

export function fontLabel(key) {
  const opt = FONT_OPTIONS.find(f => f.key === key);
  return opt ? t(opt.labelKey) : key;
}

/** 编辑器界面字体：跟随界面语言（中文界面用中文字体、日文界面用日文字体） */
export function uiFontStack(uiLang) {
  return uiLang === 'ja'
    ? "'Noto Sans JP','Hiragino Sans','Hiragino Kaku Gothic ProN',system-ui,sans-serif"
    : "'Noto Sans SC','PingFang SC','Hiragino Sans GB',system-ui,sans-serif";
}

/**
 * 把字体设置写进 CSS 变量。
 * --font-base / --font-display 供画布使用，--ui-font 供编辑器界面使用。
 */
export function applyFontVars(state) {
  const root = document.documentElement.style;
  root.setProperty('--font-base', fontStack(state.fonts.base));
  root.setProperty('--font-display', fontStack(state.fonts.display));
  root.setProperty('--font-scale', String((Number(state.fonts.scale) || 100) / 100));
  root.setProperty('--ui-font', uiFontStack(state.uiLang === 'ja' ? 'ja' : 'zh'));
}

/** 提取字体栈里的家族名，逐个预加载，保证导出时字形已经就位 */
export async function ensureFontsLoaded(state) {
  const stacks = [fontStack(state.fonts.base), fontStack(state.fonts.display)];
  const families = new Set();
  stacks.forEach(s => {
    const matches = String(s).match(/'([^']+)'/g) || [];
    matches.forEach(m => families.add(m.replace(/'/g, '')));
  });
  const jobs = [];
  families.forEach(f => {
    try { jobs.push(document.fonts.load('700 16px "' + f + '"')); } catch (e) { /* 忽略 */ }
    try { jobs.push(document.fonts.load('400 16px "' + f + '"')); } catch (e) { /* 忽略 */ }
  });
  try { await Promise.all(jobs); } catch (e) { /* 忽略 */ }
  try { await document.fonts.ready; } catch (e) { /* 忽略 */ }
}

/* ---------------- 本地字体文件：存进 IndexedDB ---------------- */

const DB_NAME = 'bookmenu-fonts';
const STORE = 'files';
const RECORD_KEY = 'local';

function openDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('no-indexeddb')); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(record) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record, RECORD_KEY);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  }));
}

function idbGet() {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(RECORD_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  }));
}

function idbDelete() {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(RECORD_KEY);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  }));
}

function readAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error || new Error('read-failed'));
    r.readAsArrayBuffer(file);
  });
}

/** 注册一个字体文件为可用家族，返回是否成功 */
export async function registerLocalFont(buffer) {
  if (typeof FontFace === 'undefined') return false;
  const face = new FontFace(LOCAL_FAMILY, buffer, { style: 'normal', weight: '100 900' });
  await face.load();
  document.fonts.add(face);
  return true;
}

/**
 * 用户选择字体文件：注册 + 持久化。
 * 持久化失败（配额等）时退化为"仅本次会话有效"。
 */
export async function loadLocalFontFile(file) {
  const buffer = await readAsArrayBuffer(file);
  await registerLocalFont(buffer);
  let persisted = true;
  try {
    await idbPut({ name: file.name, buffer, savedAt: Date.now() });
  } catch (e) {
    persisted = false;
  }
  return { name: file.name, persisted };
}

/** 启动时恢复已保存的本地字体 */
export async function restoreLocalFont() {
  try {
    const rec = await idbGet();
    if (!rec || !rec.buffer) return null;
    await registerLocalFont(rec.buffer);
    return { name: rec.name || '' };
  } catch (e) {
    return null;
  }
}

export async function removeLocalFont() {
  try { await idbDelete(); } catch (e) { /* 忽略 */ }
}
