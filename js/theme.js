/**
 * 外观：配色变量、背景装饰、我的配色
 *
 * 装饰用真实 <canvas> 绘制（而不是 CSS 渐变），这样导出时可以按导出倍率重绘，
 * 细线不会因为放大而发虚。
 */
import { PALETTE_KEYS } from './state.js';
import { resolvePackFonts } from './palettes.js';

const CSS_VAR = {
  bg: '--c-bg',
  cardBg: '--c-card-bg',
  cardBorder: '--c-card-border',
  title: '--c-title',
  body: '--c-body',
  muted: '--c-muted',
  accent: '--c-accent',
  headerBg: '--c-header-bg',
  headerText: '--c-header-text',
  footerBg: '--c-footer-bg',
  footerText: '--c-footer-text',
};

const PALETTE_STORE = 'bookmenu-palettes-v1';

/** 把配色写进画布的 CSS 变量 */
export function applyTheme(canvasEl, state) {
  const style = canvasEl.style;
  PALETTE_KEYS.forEach(key => {
    style.setProperty(CSS_VAR[key], state.theme[key]);
  });
  style.setProperty('--decor-opacity', String(state.theme.decor.opacity));
  canvasEl.dataset.decor = state.theme.decor.type;
}

/* ---------------- 背景装饰绘制 ---------------- */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgba(hex, alpha) {
  let h = String(hex || '').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length !== 6) return 'rgba(0,0,0,' + alpha + ')';
  const n = parseInt(h, 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
}

/**
 * 重绘装饰层。
 * @param {HTMLCanvasElement} layer 装饰画布
 * @param {object} theme 状态里的 theme
 * @param {number} cssWidth  画布 CSS 宽度
 * @param {number} cssHeight 画布 CSS 高度
 * @param {number} scale     绘制倍率（导出时传导出倍率，平时传 2）
 */
export function drawDecor(layer, theme, cssWidth, cssHeight, scale) {
  if (!layer) return;
  const dpr = Math.max(1, scale || 1);
  const w = Math.max(1, Math.round(cssWidth));
  const h = Math.max(1, Math.round(cssHeight));
  layer.width = Math.round(w * dpr);
  layer.height = Math.round(h * dpr);
  layer.style.width = w + 'px';
  layer.style.height = h + 'px';

  const ctx = layer.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const type = theme.decor.type;
  if (!type || type === 'none') return;

  const opacity = Math.max(0, Math.min(1, Number(theme.decor.opacity)));
  const density = Math.max(0.5, Math.min(3, Number(theme.decor.density) || 1));
  if (opacity <= 0) return;

  if (type === 'grid') drawGrid(ctx, w, h, theme, opacity, density);
  else if (type === 'diagonal') drawDiagonal(ctx, w, h, theme, opacity, density);
  else if (type === 'constellation') drawConstellation(ctx, w, h, theme, opacity, density);
}

function drawGrid(ctx, w, h, theme, opacity, density) {
  const step = Math.max(8, 34 / density);
  ctx.save();
  ctx.strokeStyle = hexToRgba(theme.muted, 0.28 * opacity);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = step; x < w; x += step) {
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, h);
  }
  for (let y = step; y < h; y += step) {
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(w, Math.round(y) + 0.5);
  }
  ctx.stroke();
  ctx.restore();
}

function drawDiagonal(ctx, w, h, theme, opacity, density) {
  const step = Math.max(6, 22 / density);
  ctx.save();
  ctx.strokeStyle = hexToRgba(theme.muted, 0.24 * opacity);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = -h; x < w + h; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x + h, h);
  }
  ctx.stroke();
  ctx.restore();
}

function drawConstellation(ctx, w, h, theme, opacity, density) {
  const rand = mulberry32(20260426);
  const cell = Math.max(70, 190 / density);
  const cols = Math.ceil(w / cell) + 1;
  const rows = Math.ceil(h / cell) + 1;
  const nodes = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      nodes.push({
        x: c * cell + rand() * cell,
        y: r * cell + rand() * cell,
        r: rand(),
      });
    }
  }
  const idx = (c, r) => (r < 0 || c < 0 || r >= rows || c >= cols) ? null : nodes[r * cols + c];

  ctx.save();
  ctx.strokeStyle = hexToRgba(theme.muted, 0.34 * opacity);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = idx(c, r);
      if (!a) continue;
      // 每条连线的疏密稳定可复现，避免每次重绘图案跳动
      if (a.r > 0.45) {
        const b = idx(c + 1, r);
        if (b) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
      }
      if (a.r < 0.5) {
        const d = idx(c, r + 1);
        if (d) { ctx.moveTo(a.x, a.y); ctx.lineTo(d.x, d.y); }
      }
    }
  }
  ctx.stroke();

  // 星点
  ctx.fillStyle = hexToRgba(theme.accent, 0.75 * opacity);
  nodes.forEach(n => {
    if (n.r < 0.55) {
      const radius = n.r < 0.1 ? 2.2 : 1.1;
      ctx.beginPath();
      ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.restore();
}

/* ---------------- 我的配色 ---------------- */

export function listPalettes() {
  try {
    const raw = localStorage.getItem(PALETTE_STORE);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function writePalettes(list) {
  try {
    localStorage.setItem(PALETTE_STORE, JSON.stringify(list));
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 把当前观感存成「我的主题」。
 * 传整个 state：颜色在 state.theme，字体在 state.fonts，两者都存下来才算完整一套。
 */
export function savePalette(name, state) {
  const theme = (state && state.theme) || {};
  const fonts = (state && state.fonts) || {};
  const colors = {};
  PALETTE_KEYS.forEach(k => { colors[k] = theme[k]; });
  const list = listPalettes();
  const entry = {
    id: 'pal-' + Date.now().toString(36),
    name: String(name || '').slice(0, 40),
    colors,
    // 背景装饰与字体一起存下来，「我的主题」才有完整的观感
    decor: {
      type: theme.decor && theme.decor.type ? theme.decor.type : 'none',
      opacity: Number(theme.decor && theme.decor.opacity),
      density: Number(theme.decor && theme.decor.density),
    },
    fonts: {
      base: fonts.base || '',
      display: fonts.display || '',
    },
  };
  list.push(entry);
  writePalettes(list.slice(-30));
  return entry;
}

export function deletePalette(id) {
  const list = listPalettes().filter(p => p.id !== id);
  writePalettes(list);
}

/** 把一组颜色套用到 state.theme（只覆盖颜色，不动装饰设置） */
export function applyPaletteColors(state, colors) {
  PALETTE_KEYS.forEach(k => {
    if (typeof colors[k] === 'string') state.theme[k] = colors[k];
  });
}

/**
 * 套用一套主题包（内置主题或「我的主题」）。
 *
 * pack 形状：{ colors, decor?, fonts? }
 * - colors：11 个颜色键，缺项保持原值
 * - decor ：写进 state.theme.decor（旧存档里保存的配色可能没有这一段）
 * - fonts ：opts.fonts === false 时不套用；内置主题给的是「角色」，
 *           这里按内容语言解析成具体字体键；「我的主题」存的已是字体键。
 */
export function applyThemePack(state, pack, opts) {
  if (!pack) return;
  const o = opts || {};
  if (pack.colors) applyPaletteColors(state, pack.colors);

  if (pack.decor) {
    const decor = state.theme.decor || {};
    if (typeof pack.decor.type === 'string') decor.type = pack.decor.type;
    if (isFinite(pack.decor.opacity)) decor.opacity = Math.max(0, Math.min(1, Number(pack.decor.opacity)));
    if (isFinite(pack.decor.density)) decor.density = Math.max(0.5, Math.min(3, Number(pack.decor.density)));
    state.theme.decor = decor;
  }

  if (o.fonts !== false && pack.fonts) {
    const isRole = ['sans', 'serif', 'maru'].includes(pack.fonts.base) ||
      ['sans', 'serif', 'maru'].includes(pack.fonts.display);
    const resolved = isRole ? resolvePackFonts(pack, state.docLang) : pack.fonts;
    if (resolved.base) state.fonts.base = resolved.base;
    if (resolved.display) state.fonts.display = resolved.display;
  }
}
