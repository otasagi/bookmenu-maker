/**
 * 存储：本机自动保存、工程文件读写、撤销 / 重做
 *
 * 与旧版的重要区别：自动保存失败时不再"悄悄丢掉图片只存文字"，
 * 而是明确告警并引导用户导出工程文件，避免内容在无声无息中损失。
 */
import {
  STORAGE_KEY, SCHEMA, findLegacyKey, migrateLegacy, normalize,
} from './state.js';

/* ---------------- 撤销 / 重做 ---------------- */

export function createHistory(limit) {
  const max = limit || 60;
  const past = [];
  const future = [];
  return {
    push(snapshot) {
      past.push(snapshot);
      if (past.length > max) past.shift();
      future.length = 0;
    },
    undo(current) {
      if (!past.length) return null;
      future.push(current);
      return past.pop();
    },
    redo(current) {
      if (!future.length) return null;
      past.push(current);
      return future.pop();
    },
    canUndo() { return past.length > 0; },
    canRedo() { return future.length > 0; },
    depth() { return past.length; },
    clear() { past.length = 0; future.length = 0; },
  };
}

/* ---------------- 本机自动保存 ---------------- */

export function saveLocal(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true, time: new Date() };
  } catch (err) {
    const quota = err && (
      err.name === 'QuotaExceededError' ||
      err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      err.code === 22 || err.code === 1014
    );
    return { ok: false, reason: quota ? 'quota' : 'error', error: err };
  }
}

/**
 * 读取本机存档。优先读新版键；若不存在，尝试识别旧版单文件的存档并迁移。
 * 返回 { state, migrated } 或 null。
 */
export function loadLocal() {
  let raw = null;
  try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.schema === SCHEMA) return { state: normalize(parsed), migrated: false };
      if (parsed && Array.isArray(parsed.products)) {
        const migrated = migrateLegacy(parsed);
        if (migrated) return { state: migrated, migrated: true };
      }
      return { state: normalize(parsed), migrated: false };
    } catch (e) {
      console.warn('[store] 本机存档解析失败，改用默认数据', e);
      return null;
    }
  }

  // 没有新版存档 → 找找旧版存档
  const legacyKey = findLegacyKey(localStorage);
  if (legacyKey) {
    try {
      const parsed = JSON.parse(localStorage.getItem(legacyKey));
      const migrated = migrateLegacy(parsed);
      if (migrated) return { state: migrated, migrated: true, fromKey: legacyKey };
    } catch (e) {
      console.warn('[store] 旧版存档迁移失败', e);
    }
  }
  return null;
}

export function clearLocal() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* 忽略 */ }
}

/* ---------------- 下载工具 ---------------- */

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function timestamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
}

/* ---------------- 工程文件 ---------------- */

export function exportProjectFile(state, fileName) {
  const trimmed = JSON.parse(JSON.stringify(state));
  trimmed.meta = Object.assign({}, trimmed.meta, { updatedAt: new Date().toISOString() });
  const blob = new Blob([JSON.stringify(trimmed, null, 2)], { type: 'application/json' });
  downloadBlob(blob, fileName);
}

export function readProjectFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (parsed && Array.isArray(parsed.products)) {
          const migrated = migrateLegacy(parsed);
          if (migrated) { resolve(migrated); return; }
        }
        if (!parsed || typeof parsed !== 'object') throw new Error('bad-json');
        resolve(normalize(parsed));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error || new Error('read-failed'));
    reader.readAsText(file);
  });
}
