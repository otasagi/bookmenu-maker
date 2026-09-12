/**
 * 应用主控：装配状态、存储、渲染、编辑器与导出
 */
import { detectUiLang, setUiLang, setDocLang, t, applyI18n, checkKeys } from './i18n.js';
import { createDefaultState, newItem, uid, defaultFontsFor } from './state.js';
import {
  createHistory, saveLocal, loadLocal, clearLocal,
  exportProjectFile, readProjectFile,
} from './store.js';
import { renderCanvas } from './render.js';
import { applyTheme, drawDecor } from './theme.js';
import {
  applyLayout, applyViewport, fitZoom, overflowAmount, autoFit, naturalSize,
} from './layout.js';
import { renderOutline, renderInspector, refreshExportInfo, findItem } from './editor.js';
import { applyFontVars, restoreLocalFont, loadLocalFontFile, removeLocalFont } from './fonts.js';
import { convertStateItems } from './convert.js';
import { exportPng, exportPlan, collectWarnings, projectFileName } from './export.js';
import { fileToOptimizedDataUrl, COVER_MAX_DIM, BANNER_MAX_DIM } from './image.js';

const $ = id => document.getElementById(id);

const els = {
  stage: $('stage'),
  canvas: $('canvas'),
  stack: $('canvas-stack'),
  decor: $('decor'),
  pane: $('canvas-pane'),
  outline: $('outline'),
  inspector: $('inspector'),
  inspectorHead: $('inspector-head'),
  saveStatus: $('save-status'),
  overflowChip: $('overflow-chip'),
  fitBtn: $('btn-fit'),
  gridBtn: $('btn-grid'),
  zoomSelect: $('zoom-select'),
  busy: $('busy'),
  busyText: $('busy-text'),
  busyBar: $('busy-bar'),
  toast: $('toast'),
  modal: $('modal'),
  modalTitle: $('modal-title'),
  modalList: $('modal-list'),
  modalOk: $('modal-ok'),
  modalCancel: $('modal-cancel'),
};

/* ---------------- 状态与历史 ---------------- */

const history = createHistory(80);
let state;
let lastHistoryKey = null;
let lastHistoryTime = 0;

const app = {
  state: null,
  sel: null,
  tab: 'layout',
  els,
  localFontName: '',
  toast,
  select,
  commit,
  renderInspector: () => renderInspector(app, els.inspector),
  addItem,
  removeItem,
  duplicateItem,
  moveItem,
  moveItemToSection,
  reorderItem,
  reorderBlock,
  setBlockVisible,
  setDocLang: changeDocLang,
  setItemCover,
  setBanner,
  loadLocalFont,
  removeLocalFont: clearLocalFont,
  convertJpToSc,
  exportImage,
  exportProject,
  importProject,
  resetAll,
};

function pushHistory(snapshot, key) {
  const now = Date.now();
  // 连续输入合并成一次历史记录，避免每敲一个字都占一格
  if (key && key === lastHistoryKey && now - lastHistoryTime < 800) {
    lastHistoryTime = now;
    return;
  }
  history.push(snapshot);
  lastHistoryKey = key;
  lastHistoryTime = now;
}

/**
 * 提交一次状态变更。
 * opts.history   是否记录历史（默认 true）
 * opts.key       历史合并键，连续同类输入会合并
 * opts.outline   是否重建左侧大纲
 * opts.inspector 是否重建右侧面板（会丢失输入焦点，输入类改动应传 false）
 */
function commit(mutator, opts) {
  const o = opts || {};
  const snapshot = o.history === false ? null : JSON.stringify(state);
  mutator(state);
  if (snapshot) pushHistory(snapshot, o.key);
  afterChange(o);
}

/* ---------------- 变更后的统一刷新 ---------------- */

let rafPending = false;
let pendingOpts = {};

function afterChange(opts) {
  pendingOpts = Object.assign(pendingOpts, opts || {});
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    const o = pendingOpts;
    pendingOpts = {};
    applyNow(o);
  });
}

/** 立即刷新（导出等需要同步拿到最新 DOM 的场景） */
function applyNow(opts) {
  const o = opts || {};
  applyFontVars(state);
  applyTheme(els.canvas, state);
  applyLayout(els.canvas, state);
  renderCanvas(state, els.stack);
  const size = naturalSize(els.canvas);
  drawDecor(els.decor, state.theme, size.w, size.h, 2);
  // 走 refreshViewport 而不是直接 applyViewport：改版心宽度、栏数、字号后
  // 「适应宽度」需要重算，顶部的缩放比例也要跟着刷新，否则会停在旧数值上。
  refreshViewport();
  updateOverflow();
  if (o.outline) renderOutline(app, els.outline);
  if (o.inspector) renderInspector(app, els.inspector);
  else refreshExportInfo(app, els.inspector);
  syncCanvasSelection();
  schedulePersist();
}

/* ---------------- 预览缩放 / 网格 / 溢出 ---------------- */

let zoomMode = 'fit';

function currentZoom() {
  if (zoomMode === 'fit') return fitZoom(els.pane, els.canvas, 56);
  return Math.max(0.1, Number(zoomMode) / 100);
}

function refreshViewport() {
  const z = applyViewport(els.stage, els.canvas, currentZoom());
  const info = $('zoom-info');
  if (info) info.textContent = Math.round(z * 100) + '%';
}

function updateOverflow() {
  const over = overflowAmount(els.canvas, state);
  const locked = state.layout.height !== 'auto';
  if (!locked) {
    els.overflowChip.textContent = '';
    els.overflowChip.hidden = true;
    els.fitBtn.hidden = true;
    return;
  }
  els.overflowChip.hidden = false;
  els.fitBtn.hidden = false;
  if (over > 0) {
    els.overflowChip.textContent = t('top.overflow', { px: over });
    els.overflowChip.classList.add('warn');
    els.fitBtn.disabled = false;
  } else {
    els.overflowChip.textContent = t('top.overflowOk');
    els.overflowChip.classList.remove('warn');
    els.fitBtn.disabled = true;
  }
}

/* ---------------- 选择 ---------------- */

function cssEscape(value) {
  if (window.CSS && CSS.escape) return CSS.escape(value);
  return String(value).replace(/["\\]/g, '\\$&');
}

function select(sel) {
  app.sel = sel || null;
  renderOutline(app, els.outline);
  renderInspector(app, els.inspector);
  syncCanvasSelection();
}

function syncCanvasSelection() {
  els.canvas.querySelectorAll('.is-selected').forEach(n => n.classList.remove('is-selected'));
  const sel = app.sel;
  if (!sel) return;
  let target = null;
  if (sel.type === 'item') {
    target = els.canvas.querySelector('[data-item-id="' + cssEscape(sel.id) + '"]');
  } else if (sel.type === 'section') {
    target = els.canvas.querySelector('[data-section-id="' + cssEscape(sel.id) + '"]');
  } else if (sel.type === 'header') {
    target = els.canvas.querySelector('[data-block-id="b-header"]');
  } else if (sel.type === 'footer') {
    target = els.canvas.querySelector('[data-block-id="b-footer"]');
  }
  if (target) target.classList.add('is-selected');
}

/* ---------------- 结构操作 ---------------- */

function addItem(sectionId) {
  const item = newItem(1);
  commit(s => {
    const sec = s.sections.find(x => x.id === sectionId);
    if (sec) sec.items.push(item);
  }, { outline: true, inspector: true });
  select({ type: 'item', id: item.id, sectionId });
}

function removeItem(sectionId, itemId) {
  commit(s => {
    const sec = s.sections.find(x => x.id === sectionId);
    if (sec) sec.items = sec.items.filter(i => i.id !== itemId);
  }, { outline: true, inspector: true });
  if (app.sel && app.sel.type === 'item' && app.sel.id === itemId) select(null);
  else select(app.sel);
}

function duplicateItem(sectionId, itemId) {
  const copy = { id: uid('item') };
  commit(s => {
    const sec = s.sections.find(x => x.id === sectionId);
    if (!sec) return;
    const idx = sec.items.findIndex(i => i.id === itemId);
    if (idx < 0) return;
    const clone = JSON.parse(JSON.stringify(sec.items[idx]));
    clone.id = copy.id;
    sec.items.splice(idx + 1, 0, clone);
  }, { outline: true, inspector: true });
  select({ type: 'item', id: copy.id, sectionId });
}

function moveItem(sectionId, itemId, dir) {
  commit(s => {
    const sec = s.sections.find(x => x.id === sectionId);
    if (!sec) return;
    const idx = sec.items.findIndex(i => i.id === itemId);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= sec.items.length) return;
    const tmp = sec.items[idx];
    sec.items[idx] = sec.items[next];
    sec.items[next] = tmp;
  }, { outline: true, inspector: true });
}

function moveItemToSection(itemId, targetSectionId) {
  let moved = false;
  commit(s => {
    const found = findItem(s, itemId);
    if (!found) return;
    const target = s.sections.find(x => x.id === targetSectionId);
    if (!target || target.id === found.section.id) return;
    found.section.items = found.section.items.filter(i => i.id !== itemId);
    target.items.push(found.item);
    moved = true;
  }, { outline: true, inspector: true });
  if (moved) select({ type: 'item', id: itemId, sectionId: targetSectionId });
}

function reorderItem(sectionId, fromId, toId) {
  if (fromId === toId) return;
  commit(s => {
    const sec = s.sections.find(x => x.id === sectionId);
    if (!sec) return;
    const from = sec.items.findIndex(i => i.id === fromId);
    const to = sec.items.findIndex(i => i.id === toId);
    if (from < 0 || to < 0) return;
    const [card] = sec.items.splice(from, 1);
    sec.items.splice(to, 0, card);
  }, { outline: true, inspector: true });
}

function reorderBlock(fromId, toId) {
  if (fromId === toId) return;
  commit(s => {
    const from = s.blocks.findIndex(b => b.id === fromId);
    const to = s.blocks.findIndex(b => b.id === toId);
    if (from < 0 || to < 0) return;
    const [block] = s.blocks.splice(from, 1);
    s.blocks.splice(to, 0, block);
  }, { outline: true, inspector: true });
}

function setBlockVisible(kind, visible, sectionId) {
  commit(s => {
    const block = s.blocks.find(b => b.kind === kind &&
      (kind === 'section' ? b.sectionId === sectionId : true));
    if (block) block.visible = visible;
  }, { outline: true, inspector: true });
}

/* ---------------- 图片 ---------------- */

function setItemCover(itemId, file) {
  fileToOptimizedDataUrl(file, COVER_MAX_DIM).then(url => {
    commit(s => {
      const found = findItem(s, itemId);
      if (found) found.item.cover = url;
    }, { outline: true, inspector: true });
    toast(t('toast.coverSet'));
  }).catch(() => toast(t('toast.imageFail')));
}

function setBanner(file) {
  fileToOptimizedDataUrl(file, BANNER_MAX_DIM).then(url => {
    commit(s => { s.header.banner = url; }, { inspector: true });
  }).catch(() => toast(t('toast.imageFail')));
}

/* ---------------- 字体 / 语言 ---------------- */

function loadLocalFont(file) {
  loadLocalFontFile(file).then(res => {
    app.localFontName = res.name;
    if (!res.persisted) toast(t('fonts.localStorageFail'));
    commit(s => {
      s.fonts.base = 'local';
      s.fonts.localName = res.name;
    }, { inspector: true });
  }).catch(() => toast(t('fonts.localFail')));
}

function clearLocalFont() {
  removeLocalFont().then(() => {
    app.localFontName = '';
    commit(s => {
      s.fonts.localName = '';
      if (s.fonts.base === 'local') s.fonts.base = defaultFontsFor(s.docLang).base;
      if (s.fonts.display === 'local') s.fonts.display = defaultFontsFor(s.docLang).display;
    }, { inspector: true });
  });
}

function changeDocLang(lang) {
  if (state.docLang === lang) return;
  if (!confirm(t('lang.docSwitchConfirm'))) {
    renderInspector(app, els.inspector);
    return;
  }
  const beforePair = defaultFontsFor(state.docLang);
  commit(s => {
    // 字体还停留在上一个内容语言的默认配对时，跟进切换；用户手动改过则不打扰
    if (s.fonts.base === beforePair.base && s.fonts.display === beforePair.display) {
      const next = defaultFontsFor(lang);
      s.fonts.base = next.base;
      s.fonts.display = next.display;
    }
    s.docLang = lang;
  }, { outline: true, inspector: true });
  setDocLang(lang);
  applyI18n(document);
  app.renderInspector();
}

function convertJpToSc() {
  if (state.docLang !== 'zh') { toast(t('fonts.convertDisabled')); return; }
  let count = 0;
  commit(s => { count = convertStateItems(s); }, { outline: true, inspector: true, key: null });
  if (count > 0) toast(t('fonts.convertDone', { n: count }));
  else toast(t('fonts.convertNone'));
}

/* ---------------- 撤销 / 重做 ---------------- */

function undo() {
  const snap = history.undo(JSON.stringify(state));
  if (!snap) { toast(t('toast.nothingUndo')); return; }
  state = JSON.parse(snap);
  if (state.uiLang) { setUiLang(state.uiLang); applyI18n(document); }
  setDocLang(state.docLang);
  app.state = state;
  lastHistoryKey = null;
  applyNow({ outline: true, inspector: true });
  toast(t('toast.undone'));
}

function redo() {
  const snap = history.redo(JSON.stringify(state));
  if (!snap) { toast(t('toast.nothingRedo')); return; }
  state = JSON.parse(snap);
  if (state.uiLang) { setUiLang(state.uiLang); applyI18n(document); }
  setDocLang(state.docLang);
  app.state = state;
  lastHistoryKey = null;
  applyNow({ outline: true, inspector: true });
  toast(t('toast.redone'));
}

/* ---------------- 自动保存 ---------------- */

let saveTimer = null;

function schedulePersist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 600);
}

function persist() {
  const res = saveLocal(state);
  if (res.ok) {
    const time = res.time.toLocaleTimeString(state.uiLang === 'ja' ? 'ja-JP' : 'zh-CN',
      { hour: '2-digit', minute: '2-digit' });
    setSaveStatus(t('status.saved', { time }), '');
    return;
  }
  if (res.reason === 'quota') {
    setSaveStatus(t('status.quota'), 'warn');
  } else {
    setSaveStatus(t('status.fail'), 'warn');
  }
}

function setSaveStatus(text, cls) {
  if (!els.saveStatus) return;
  els.saveStatus.textContent = text;
  els.saveStatus.className = 'save-status' + (cls ? ' ' + cls : '');
}

/* ---------------- 工程文件 ---------------- */

function exportProject() {
  exportProjectFile(state, projectFileName(state));
  toast(t('project.exported'));
}

function importProject(file) {
  readProjectFile(file).then(next => {
    state = next;
    app.state = state;
    history.clear();
    lastHistoryKey = null;
    if (state.uiLang) { setUiLang(state.uiLang); }
    setDocLang(state.docLang);
    applyI18n(document);
    select(null);
    applyNow({ outline: true, inspector: true });
    toast(t('project.imported'));
  }).catch(() => toast(t('project.importFail')));
}

function resetAll() {
  if (!confirm(t('project.resetConfirm'))) return;
  const docLang = state.docLang;
  const uiLang = state.uiLang;
  state = createDefaultState(docLang);
  state.uiLang = uiLang;
  app.state = state;
  history.clear();
  lastHistoryKey = null;
  clearLocal();
  select(null);
  applyNow({ outline: true, inspector: true });
  toast(t('project.resetDone'));
}

/* ---------------- 导出 ---------------- */

function showBusy(text) {
  els.busyText.textContent = text || '';
  els.busyBar.style.width = '0%';
  els.busy.hidden = false;
}

function setBusyProgress(p) {
  els.busyBar.style.width = Math.round(Math.max(0, Math.min(1, p)) * 100) + '%';
}

function hideBusy() {
  els.busy.hidden = true;
}

function askWarnings(keys) {
  return new Promise(resolve => {
    els.modalTitle.textContent = t('check.title');
    els.modalList.replaceChildren();
    keys.forEach(k => {
      const li = document.createElement('li');
      li.textContent = t(k);
      els.modalList.appendChild(li);
    });
    els.modalOk.textContent = t('check.continue');
    els.modalCancel.textContent = t('check.back');
    els.modal.hidden = false;
    const done = value => {
      els.modal.hidden = true;
      els.modalOk.removeEventListener('click', onOk);
      els.modalCancel.removeEventListener('click', onCancel);
      resolve(value);
    };
    const onOk = () => done(true);
    const onCancel = () => done(false);
    els.modalOk.addEventListener('click', onOk);
    els.modalCancel.addEventListener('click', onCancel);
  });
}

async function exportImage() {
  applyNow({});
  const warnings = collectWarnings(state);
  if (warnings.length) {
    const go = await askWarnings(warnings);
    if (!go) return;
  }
  const plan = exportPlan(state, els.canvas);
  showBusy(plan.tiled ? t('export.tiling') : t('export.rendering'));
  try {
    const res = await exportPng(state, els, { onProgress: setBusyProgress });
    toast(t('export.done', { name: res.name }));
  } catch (err) {
    toast(t('export.fail', { msg: (err && err.message) || 'unknown' }));
  } finally {
    hideBusy();
    applyNow({});
  }
}

/* ---------------- 提示条 ---------------- */

function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => els.toast.classList.remove('show'), 3200);
}

/* ---------------- 画布交互 ---------------- */

function bindCanvas() {
  els.canvas.addEventListener('click', e => {
    const card = e.target.closest('.card');
    if (card) { select({ type: 'item', id: card.dataset.itemId }); return; }
    const section = e.target.closest('.block-section');
    if (section) { select({ type: 'section', id: section.dataset.sectionId }); return; }
    if (e.target.closest('.block-header')) { select({ type: 'header' }); return; }
    if (e.target.closest('.block-footer')) { select({ type: 'footer' }); return; }
    select(null);
  });

  // 拖入图片 → 设置封面 / 横幅
  els.canvas.addEventListener('dragover', e => {
    const card = e.target.closest('.card');
    const header = e.target.closest('.block-header');
    if (card || header) {
      e.preventDefault();
      (card || header).classList.add('drop-target');
    }
  });
  els.canvas.addEventListener('dragleave', e => {
    const node = e.target.closest('.card, .block-header');
    if (node) node.classList.remove('drop-target');
  });
  els.canvas.addEventListener('drop', e => {
    const card = e.target.closest('.card');
    const header = e.target.closest('.block-header');
    const node = card || header;
    if (!node) return;
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file || !/^image\//.test(file.type)) return;
    e.preventDefault();
    node.classList.remove('drop-target');
    if (card) setItemCover(card.dataset.itemId, file);
    else setBanner(file);
  });
}

function bindPaste() {
  document.addEventListener('paste', e => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (const item of items) {
      if (item.type && item.type.indexOf('image/') === 0) {
        const file = item.getAsFile();
        if (!file) continue;
        e.preventDefault();
        if (app.sel && app.sel.type === 'item') setItemCover(app.sel.id, file);
        else if (app.sel && app.sel.type === 'header') setBanner(file);
        else toast(t('toast.pasteNoTarget'));
        return;
      }
    }
  });
}

/* ---------------- 键盘 ---------------- */

function bindKeys() {
  document.addEventListener('keydown', e => {
    const meta = e.metaKey || e.ctrlKey;
    if (!meta) return;
    const key = e.key.toLowerCase();
    if (key === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    } else if (key === 'y') {
      e.preventDefault();
      redo();
    } else if (key === 's') {
      e.preventDefault();
      exportProject();
    } else if (key === 'e') {
      e.preventDefault();
      exportImage();
    }
  });
}

/* ---------------- 顶栏 ---------------- */

function bindToolbar() {
  $('btn-undo').addEventListener('click', undo);
  $('btn-redo').addEventListener('click', redo);
  $('btn-lang').addEventListener('click', () => {
    const next = (state.uiLang === 'ja') ? 'zh' : 'ja';
    commit(s => { s.uiLang = next; }, { inspector: true });
    setUiLang(next);
    applyI18n(document);
    app.renderInspector();
    renderOutline(app, els.outline);
  });
  els.zoomSelect.addEventListener('change', () => {
    zoomMode = els.zoomSelect.value;
    refreshViewport();
  });
  els.gridBtn.addEventListener('click', () => {
    const on = els.gridBtn.getAttribute('aria-pressed') !== 'true';
    els.gridBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    els.canvas.classList.toggle('show-grid', on);
  });
  els.fitBtn.addEventListener('click', () => {
    const res = autoFit(els.canvas, state);
    if (!res.changed) return;
    if (res.ok) {
      toast(t('toast.fitDone'));
      applyNow({ outline: true, inspector: true });
    } else {
      toast(t('toast.fitFailed'));
      applyNow({ outline: true, inspector: true });
    }
  });
  $('btn-export').addEventListener('click', exportImage);
  window.addEventListener('resize', () => { refreshViewport(); });
}

/* ---------------- 启动 ---------------- */

async function boot() {
  checkKeys();

  const loaded = loadLocal();
  state = loaded ? loaded.state : createDefaultState('ja');
  if (!state.uiLang) state.uiLang = detectUiLang();
  setUiLang(state.uiLang);
  setDocLang(state.docLang);
  app.state = state;

  applyI18n(document);
  $('btn-lang').setAttribute('title', t('lang.switchTo'));

  // 恢复本机保存的字体文件（如有）
  const local = await restoreLocalFont();
  if (local) {
    app.localFontName = local.name;
  }

  // 网页字体加载完成后文字度量会变，画布高度随之变化。
  // 这里等字体就位后重新量一次，否则预览框会停在按回退字体算出的高度上，
  // 底部留出空隙或把内容裁掉几个像素。
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { applyNow({}); });
  }

  bindToolbar();
  bindCanvas();
  bindPaste();
  bindKeys();

  select(null);
  applyNow({ outline: true, inspector: true });
  setSaveStatus('', '');

  if (loaded && loaded.migrated) {
    // 旧版存档已原样迁移过来
    toast(t('toast.migrated'));
  }

  window.addEventListener('beforeunload', () => {
    clearTimeout(saveTimer);
    saveLocal(state);
  });
}

boot();
