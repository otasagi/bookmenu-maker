/**
 * 版式：画布尺寸变量、内容高度测量、溢出检测、一键适配、预览缩放
 *
 * 所有排版尺寸都通过 CSS 变量下发，所以调整版式不需要重建 DOM，
 * 可以同步测量、连续迭代 —— 这也是"一键适配"能实时收敛的前提。
 */

/** 把版式参数写进画布的 CSS 变量 */
export function applyLayout(canvasEl, state) {
  const L = state.layout;
  const style = canvasEl.style;
  style.setProperty('--w', L.width + 'px');
  style.setProperty('--cols', String(L.columns));
  style.setProperty('--gap-x', L.gapX + 'px');
  style.setProperty('--gap-y', L.gapY + 'px');
  style.setProperty('--section-gap', L.sectionGap + 'px');
  style.setProperty('--pad-t', L.padding.t + 'px');
  style.setProperty('--pad-r', L.padding.r + 'px');
  style.setProperty('--pad-b', L.padding.b + 'px');
  style.setProperty('--pad-l', L.padding.l + 'px');
  style.width = L.width + 'px';
  style.minHeight = L.height === 'auto' ? '0px' : (L.height + 'px');
  canvasEl.classList.toggle('has-fixed-height', L.height !== 'auto');
  // 基准字号 = 版式基准 × 全局字号比例
  const scale = (Number(state.fonts.scale) || 100) / 100;
  style.fontSize = (L.baseSize * scale) + 'px';
}

/** 内容真实高度（CSS 像素，含上下页边距，不含锁定高度补白） */
export function contentHeight(canvasEl) {
  const stack = canvasEl.querySelector('.canvas-stack');
  if (!stack) return 0;
  const cs = getComputedStyle(canvasEl);
  const padT = parseFloat(cs.paddingTop) || 0;
  const padB = parseFloat(cs.paddingBottom) || 0;
  return stack.getBoundingClientRect().height + padT + padB;
}

/** 溢出像素数（高度自适应时永远返回 0） */
export function overflowAmount(canvasEl, state) {
  if (state.layout.height === 'auto') return 0;
  const target = Number(state.layout.height) || 0;
  return Math.max(0, Math.round(contentHeight(canvasEl) - target));
}

const MIN_SCALE = 60;      // 字号最低缩到基准的 60%
const MIN_GAP_MUL = 0.45;  // 间距最低压到 45%

/**
 * 一键适配：把锁定高度内放不下的内容收敛进去。
 * 先缩字号，再压间距；都到下限仍放不下则完整回退，不做破坏性改动。
 */
export function autoFit(canvasEl, state) {
  const L = state.layout;
  if (L.height === 'auto') return { ok: true, changed: false, reason: 'auto' };
  const target = Number(L.height) || 0;
  if (!target) return { ok: true, changed: false, reason: 'auto' };

  const startScale = Number(state.fonts.scale) || 100;
  const startGaps = { x: L.gapX, y: L.gapY, s: L.sectionGap };
  let scale = startScale;
  let gapMul = 1;

  applyLayout(canvasEl, state);
  let guard = 0;
  for (; guard < 18; guard++) {
    const content = contentHeight(canvasEl);
    if (content <= target) break;
    const f = Math.max(0.5, Math.min(0.98, target / content));
    if (scale > MIN_SCALE + 0.5) {
      scale = Math.max(MIN_SCALE, scale * f);
    } else if (gapMul > MIN_GAP_MUL) {
      gapMul = Math.max(MIN_GAP_MUL, gapMul * f);
    } else {
      break;
    }
    state.fonts.scale = Math.round(scale * 10) / 10;
    L.gapX = Math.round(startGaps.x * gapMul);
    L.gapY = Math.round(startGaps.y * gapMul);
    L.sectionGap = Math.round(startGaps.s * gapMul);
    applyLayout(canvasEl, state);
  }

  const content = contentHeight(canvasEl);
  const ok = content <= target;
  if (!ok) {
    // 回退到操作前的版式，把决定权交还给用户
    state.fonts.scale = startScale;
    L.gapX = startGaps.x;
    L.gapY = startGaps.y;
    L.sectionGap = startGaps.s;
    applyLayout(canvasEl, state);
  }
  return { ok, changed: true };
}

/* ---------------- 预览缩放与导出裁剪窗口 ---------------- */

/**
 * 画布放在一个 overflow:hidden 的裁剪容器里，位置由 JS 控制。
 * 好处：
 * - 预览缩放只是缩放这个容器，不牵动画布自身布局；
 * - 导出分块时把容器高度设成一页的高度、画布整体上移，
 *   渲染出来的就是精确的一块，不依赖渲染库的坐标裁切，
 *   也就不会因为坐标系差异出现错位或空白。
 */

export function naturalSize(canvasEl) {
  return { w: canvasEl.offsetWidth, h: canvasEl.offsetHeight };
}

/** 计算"适应宽度"的缩放比 */
export function fitZoom(paneEl, canvasEl, reserve) {
  const avail = paneEl.clientWidth - (reserve == null ? 56 : reserve);
  const natural = canvasEl.offsetWidth || 1;
  return Math.max(0.15, Math.min(1, avail / natural));
}

/** 预览态：容器尺寸 = 画布尺寸 × 缩放比 */
export function applyViewport(stageEl, canvasEl, zoom) {
  const z = Number(zoom) || 1;
  const size = naturalSize(canvasEl);
  stageEl.style.width = Math.ceil(size.w * z) + 'px';
  stageEl.style.height = Math.ceil(size.h * z) + 'px';
  canvasEl.style.top = '0px';
  canvasEl.style.left = '0px';
  canvasEl.style.transform = z === 1 ? 'none' : 'scale(' + z + ')';
  return z;
}

/** 导出态：把画布整体上移 offsetY，容器只露出 windowH 高的一块 */
export function setExportWindow(stageEl, canvasEl, offsetY, windowH) {
  const size = naturalSize(canvasEl);
  stageEl.style.width = size.w + 'px';
  stageEl.style.height = windowH + 'px';
  canvasEl.style.transform = 'none';
  canvasEl.style.left = '0px';
  canvasEl.style.top = (-offsetY) + 'px';
}
