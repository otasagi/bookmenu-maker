/**
 * 导出：单张 PNG（分块渲染再拼合）
 *
 * 分块不是把画布切成多张下载，而是为了绕开浏览器对单张画布面积的限制：
 * 每一块渲染完成就画进同一张输出画布，用户拿到的始终是一张完整的长图。
 */
import { td } from './i18n.js';
import { ensureFontsLoaded } from './fonts.js';
import { naturalSize, setExportWindow } from './layout.js';
import { setPlaceholdersHidden } from './render.js';
import { drawDecor } from './theme.js';
import { downloadBlob } from './store.js';

/** 单块渲染的像素面积上限（偏保守，兼顾 Safari） */
const TILE_MAX_AREA = 12000000;
/** 输出画布总像素上限，超过则直接劝退，避免浏览器崩溃 */
const TOTAL_MAX_AREA = 140000000;
const MAX_DIM = 16384;

export function exportPlan(state, canvasEl) {
  const size = naturalSize(canvasEl);
  const cssW = Math.max(1, size.w);
  const cssH = Math.max(1, size.h);
  let scale;
  if (state.export.mode === 'width') {
    scale = Number(state.export.targetWidth) / cssW;
  } else {
    scale = Number(state.export.scale) || 3;
  }
  scale = Math.max(0.1, Math.min(8, scale));
  const outW = Math.round(cssW * scale);
  const outH = Math.round(cssH * scale);
  const tooBig = outW * outH > TOTAL_MAX_AREA || outW > MAX_DIM || outH > MAX_DIM;
  const tiled = outW * outH > TILE_MAX_AREA;
  return { cssW, cssH, scale, outW, outH, tiled, tooBig };
}

function pad2(n) { return String(n).padStart(2, '0'); }

/** 文件名日期：优先取活动名里的日期，否则用今天 */
function exportDate(state) {
  const m = String(state.header.event || '').match(/\d{4}[./-]\d{1,2}[./-]\d{1,2}/);
  if (m) return m[0].replace(/[-/]/g, '.');
  const d = new Date();
  return d.getFullYear() + '.' + pad2(d.getMonth() + 1) + '.' + pad2(d.getDate());
}

function scaleLabel(scale) {
  const rounded = Math.round(scale * 100) / 100;
  return String(rounded).replace(/\.0+$/, '');
}

export function exportFileName(state, plan) {
  const prefix = String(state.export.prefix || '').trim();
  const base = prefix || td('doc.fileLabel');
  return base + '_' + exportDate(state) + '_' + scaleLabel(plan.scale) + 'x.png';
}

export function projectFileName(state) {
  const prefix = String(state.export.prefix || '').trim();
  const base = prefix || td('doc.projectLabel');
  return base + '_' + exportDate(state) + '.json';
}

/** 导出前检查：返回需要提醒的 i18n 键 */
export function collectWarnings(state) {
  const out = [];
  if (!String(state.header.circle || '').trim()) out.push('check.circle');
  if (!String(state.header.booth || '').trim()) out.push('check.booth');
  const total = (state.sections || []).reduce((n, s) => n + ((s.items || []).length), 0);
  if (!total) out.push('check.items');
  return out;
}

function renderStage(stageEl, pxScale) {
  return window.html2canvas(stageEl, {
    scale: pxScale,        // 每一块都按导出倍率渲染，拼合时不再缩放，保证清晰
    backgroundColor: null,
    useCORS: true,
    logging: false,
  });
}

/**
 * 执行导出。
 * @param {object} state
 * @param {{stage:HTMLElement, canvas:HTMLElement, decor:HTMLCanvasElement}} els
 * @param {{onProgress?:Function}} hooks
 * @returns {Promise<{name:string, outW:number, outH:number}>}
 */
export async function exportPng(state, els, hooks) {
  const opts = hooks || {};
  const plan = exportPlan(state, els.canvas);
  if (plan.tooBig) {
    throw new Error('输出尺寸过大（' + plan.outW + '×' + plan.outH + '），请降低倍率或目标宽度');
  }

  await ensureFontsLoaded(state);
  setPlaceholdersHidden(els.canvas, true);
  // 装饰按导出倍率重绘，细线在高倍率下依然锐利
  drawDecor(els.decor, state.theme, plan.cssW, plan.cssH, plan.scale);

  try {
    const out = document.createElement('canvas');
    out.width = plan.outW;
    out.height = plan.outH;
    const ctx = out.getContext('2d');
    ctx.fillStyle = state.theme.bg;
    ctx.fillRect(0, 0, plan.outW, plan.outH);

    // 一次渲染能装下就直接渲染，装不下才分块。
    // 分块高度按"渲染后的像素面积"来算，而不是 CSS 高度。
    const pxScale = plan.scale;
    const tileCssH = plan.tiled
      ? Math.max(200, Math.floor(TILE_MAX_AREA / (plan.cssW * pxScale * pxScale)))
      : plan.cssH;

    let drawn = 0;
    for (let y = 0; y < plan.cssH; y += tileCssH) {
      const h = Math.min(tileCssH, plan.cssH - y);
      setExportWindow(els.stage, els.canvas, y, h);
      const piece = await renderStage(els.stage, pxScale);
      ctx.drawImage(piece, 0, Math.round(y * pxScale));
      drawn += h;
      if (opts.onProgress) opts.onProgress(Math.min(1, drawn / plan.cssH));
    }

    const name = exportFileName(state, plan);
    const blob = await new Promise((resolve, reject) => {
      out.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
    });
    downloadBlob(blob, name);
    return { name, outW: plan.outW, outH: plan.outH, bytes: blob.size };
  } finally {
    setPlaceholdersHidden(els.canvas, false);
    drawDecor(els.decor, state.theme, plan.cssW, plan.cssH, 2);
  }
}
