/**
 * 画布渲染：把状态渲染成品书 DOM
 *
 * 占位提示规则（对应"默认值不含具体素材"的约束）：
 * - 文档级结构字段（活动名 / 社团名 / 摊位号 / 作品区为空）始终显示淡灰占位。
 * - 作品卡只有在"整张卡都还空着"时才显示占位；一旦有内容，空的可选字段直接不显示，
 *   避免成品预览里到处都是"备注""副标题"这类噪声。
 * - 所有占位都带 .ph 类，导出时统一隐藏，不会进入图片。
 */
import { td } from './i18n.js';

export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/* ---------------- 价格 ---------------- */

const FREE_WORD = /^(無料|無償|免费|免費|free|0)$/i;

/**
 * 价格格式化（跟随内容语言）
 * - 纯数字 → 日本語：1,000円 ／ 简体中文：¥1,000
 * - 無料 / 免费 / 0 → 对应语言的"免费"用词
 * - 其他文字（応相談 等）→ 原样显示
 */
export function formatPrice(raw, docLang) {
  const s = String(raw == null ? '' : raw).trim();
  if (!s) return { text: '', empty: true };
  if (FREE_WORD.test(s)) return { text: td('doc.free'), free: true };
  const m = s.match(/\d[\d,.]*/);
  if (!m) return { text: s };
  const n = Math.round(parseFloat(m[0].replace(/,/g, '')));
  if (!n) return { text: td('doc.free'), free: true };
  const grouped = n.toLocaleString(docLang === 'zh' ? 'zh-CN' : 'ja-JP');
  return { text: td('doc.currencyPrefix') + grouped + td('doc.currencySuffix') };
}

/* ---------------- 角标 ---------------- */

function luminance(hex) {
  let h = String(hex || '').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length !== 6) return 0;
  const n = parseInt(h, 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function renderBadges(raw, theme) {
  const named = {
    black: '#111827',
    blue: '#2563eb',
    gold: '#c2a35d',
    red: '#dc2626',
    accent: theme.accent,
    muted: theme.muted,
    title: theme.title,
  };
  return String(raw || '').split(/[,，]/).map(s => s.trim()).filter(Boolean).map(token => {
    const i = token.indexOf(':');
    const label = i >= 0 ? token.slice(0, i) : token;
    const rawColor = i >= 0 ? token.slice(i + 1).trim() : 'accent';
    const color = named[rawColor.toLowerCase()] || rawColor;
    const safe = /^#[0-9a-f]{3,8}$/i.test(color) ? color : theme.accent;
    const fg = luminance(safe) > 0.6 ? '#111827' : '#ffffff';
    return '<span class="badge" style="background:' + escapeHtml(safe) +
      ';color:' + fg + '">' + escapeHtml(label) + '</span>';
  }).join('');
}

/* ---------------- 页脚变量 ---------------- */

export function resolveFooterText(template, state) {
  const year = String(new Date().getFullYear());
  const circle = state.header.circle || '';
  const hasCircleVar = String(template || '').indexOf('{circle}') !== -1;
  const text = String(template || '')
    .split('{year}').join(year)
    .split('{circle}').join(circle)
    .trim();
  if (!text) return '';
  // 模板依赖社团名但社团名还没填 → 整行隐藏，避免出现半截版权文案
  if (hasCircleVar && !circle.trim()) return '';
  return text;
}

/* ---------------- 区块渲染 ---------------- */

function ph(text, extraClass) {
  return '<span class="ph' + (extraClass ? ' ' + extraClass : '') + '">' +
    escapeHtml(text) + '</span>';
}

function renderHeader(state) {
  const h = state.header;
  const banner = h.banner
    ? '<div class="banner"><img src="' + escapeHtml(h.banner) + '" alt=""></div>'
    : '';
  const event = h.event
    ? '<div class="header-event">' + escapeHtml(h.event) + '</div>'
    : '<div class="header-event">' + ph(td('doc.ph.event')) + '</div>';
  const circle = h.circle
    ? '<div class="header-circle">' + escapeHtml(h.circle) + '</div>'
    : '<div class="header-circle">' + ph(td('doc.ph.circle')) + '</div>';
  const booth = h.booth
    ? '<div class="header-booth">' + escapeHtml(h.booth) + '</div>'
    : '<div class="header-booth">' + ph(td('doc.ph.booth')) + '</div>';
  return '<header class="block block-header" data-block-id="b-header">' + banner +
    '<div class="header-inner">' + event +
    '<div class="header-main">' + circle + booth + '</div>' +
    '</div></header>';
}

function renderSection(state, section, block) {
  const titleParts = [];
  if (section.titleEn) titleParts.push('<span class="sec-en">' + escapeHtml(section.titleEn) + '</span>');
  if (section.titleSub) titleParts.push('<span class="sec-sub">' + escapeHtml(section.titleSub) + '</span>');
  const title = titleParts.length
    ? '<h2 class="section-title">' + titleParts.join('') + '</h2>'
    : '';

  const items = section.items || [];
  const rows = layoutRows(state, items);
  // 每一排自己是一个网格容器：最后一排不满时只需把这一排的列数改成卡片张数，
  // 卡片本身仍然只声明「跨几栏」——这样即使样式与脚本版本对不上，
  // 最坏也只是回到「留着缺口」的老样子，不会把整张画布排坏。
  const body = rows.length
    ? rows.map(row => '<div class="grid"' + rowStyle(row) + '>' +
        row.cells.map(cell => renderCard(state, cell)).join('') + '</div>').join('')
    : '<div class="grid"><div class="empty-hint">' + ph(td('doc.ph.items')) + '</div></div>';

  // is-empty：编辑器里保留虚线提示框，导出时整块略去（见 canvas.css 的 .exporting 规则）
  return '<section class="block block-section' + (items.length ? '' : ' is-empty') +
    '" data-block-id="' + escapeHtml(block.id) +
    '" data-section-id="' + escapeHtml(section.id) + '">' + title + body + '</section>';
}

/* ---------------- 卡片排布 ---------------- */

/** 只有「铺满的最后一排」需要改列数，其他排用画布本身的栏数 */
function rowStyle(row) {
  return row.cols ? ' style="--row-cols:' + row.cols + '"' : '';
}

/** 按卡片宽度分行（与 CSS 网格的自动排布规则一致） */
function packRows(items, cols) {
  const rows = [];
  let row = [];
  let used = 0;
  items.forEach((item, index) => {
    const span = Math.max(1, Math.min(Number(item.span) || 1, cols));
    if (row.length && used + span > cols) {
      rows.push({ cells: row, used });
      row = [];
      used = 0;
    }
    row.push({ item, index, span });
    used += span;
  });
  if (row.length) rows.push({ cells: row, used });
  return rows;
}

/**
 * 分成若干排，并算出每张卡的栏宽。
 * 最后一排不满、且这一排的卡片都是 1 栏宽时铺满整行：
 * 剩 1 张 → 满宽横排大卡；剩 2 / 3 张 → 平分整行。
 * 排里出现手动加宽的卡片时保持原样，避免破坏用户设定。
 */
function layoutRows(state, items) {
  const cols = Math.max(1, Number(state.layout.columns) || 1);
  const fill = state.layout.lastRowFill !== false;
  const rows = packRows(items, cols);
  return rows.map((row, ri) => {
    const stretch = fill && ri === rows.length - 1 && cols > 1 && row.used < cols &&
      row.cells.every(cell => cell.span === 1);
    if (!stretch) {
      return { cols: 0, cells: row.cells.map(cell => ({ item: cell.item, span: cell.span, wide: false })) };
    }
    const count = row.cells.length;
    return {
      cols: count,
      cells: row.cells.map(cell => ({ item: cell.item, span: 1, wide: count === 1 })),
    };
  });
}

function isItemBlank(item) {
  return !item.title && !item.subtitle && !item.desc && !item.price &&
    !item.badges && !item.note && !item.cover;
}

function renderCard(state, cell) {
  const item = cell.item;
  const blank = isItemBlank(item);
  const ratio = item.coverRatio === 'auto' ? 'auto' : item.coverRatio.replace(':', ' / ');
  const fit = item.coverFit === 'contain' ? 'contain' : 'cover';
  const focal = item.focalX + '% ' + item.focalY + '%';

  let coverInner;
  if (item.cover) {
    coverInner = '<img src="' + escapeHtml(item.cover) + '" alt="" ' +
      'style="object-fit:' + fit + ';object-position:' + focal + '">';
  } else {
    coverInner = '<div class="no-cover">' + ph(td('doc.ph.cover')) + '</div>';
  }
  const badges = item.badges ? renderBadges(item.badges, state.theme) : '';
  const cover = '<div class="cover"' + (ratio === 'auto' ? '' : ' style="aspect-ratio:' + ratio + '"') + '>' +
    (badges ? '<div class="badges">' + badges + '</div>' : '') + coverInner + '</div>';

  const price = formatPrice(item.price, state.docLang);
  const lines = [];
  if (blank) {
    lines.push('<div class="p-sub">' + ph(td('doc.ph.subtitle')) + '</div>');
    lines.push('<h3 class="p-title">' + ph(td('doc.ph.title')) + '</h3>');
    lines.push('<p class="p-desc">' + ph(td('doc.ph.desc')) + '</p>');
    lines.push('<div class="p-foot"><div class="p-price">' + ph(td('doc.ph.price')) +
      '</div><div class="p-note">' + ph(td('doc.ph.note')) + '</div></div>');
  } else {
    if (item.subtitle) lines.push('<div class="p-sub">' + escapeHtml(item.subtitle) + '</div>');
    if (item.title) lines.push('<h3 class="p-title">' + escapeHtml(item.title) + '</h3>');
    if (item.desc) {
      lines.push('<p class="p-desc">' + escapeHtml(item.desc).replace(/\n/g, '<br>') + '</p>');
    }
    const footParts = [];
    if (price.text) footParts.push('<div class="p-price' + (price.free ? ' is-free' : '') + '">' +
      escapeHtml(price.text) + '</div>');
    if (item.note) footParts.push('<div class="p-note">' + escapeHtml(item.note) + '</div>');
    // 价格行与备注行都占位：同一排里有没有备注，分隔线与价格基线都对齐
    if (footParts.length) {
      if (!price.text) footParts.unshift('<div class="p-price"></div>');
      if (!item.note) footParts.push('<div class="p-note"></div>');
    }
    if (footParts.length) lines.push('<div class="p-foot">' + footParts.join('') + '</div>');
  }

  // 栏宽由 layoutRows 算好（夹在画布栏数以内），这里只写跨几栏
  return '<article class="card' + (cell.wide ? ' card-wide' : '') + '" data-item-id="' +
    escapeHtml(item.id) + '" ' +
    'style="grid-column:span ' + cell.span + '">' + cover +
    '<div class="card-body">' + lines.join('') + '</div></article>';
}

function renderFooter(state) {
  const leftText = String(state.footer.left || '').trim();
  const rightText = resolveFooterText(state.footer.right, state);
  if (!leftText && !rightText) return '';
  const left = leftText
    ? '<div class="ft-left">' + escapeHtml(leftText) + '</div>'
    : '<div class="ft-left"></div>';
  const right = rightText
    ? '<div class="ft-right">' + escapeHtml(rightText) + '</div>'
    : '<div class="ft-right"></div>';
  return '<footer class="block block-footer" data-block-id="b-footer">' + left + right + '</footer>';
}

/**
 * 渲染整个画布内容。
 * @param {object} state
 * @param {HTMLElement} stack 画布内的内容容器
 */
export function renderCanvas(state, stack) {
  const html = (state.blocks || [])
    .filter(b => b.visible !== false)
    .map(block => {
      if (block.kind === 'header') return renderHeader(state);
      if (block.kind === 'footer') return renderFooter(state);
      if (block.kind === 'section') {
        const section = (state.sections || []).find(s => s.id === block.sectionId);
        return section ? renderSection(state, section, block) : '';
      }
      return '';
    })
    .join('');
  stack.innerHTML = html;
  return html;
}

/** 导出前隐藏所有占位提示 */
export function setPlaceholdersHidden(root, hidden) {
  root.classList.toggle('exporting', !!hidden);
}
