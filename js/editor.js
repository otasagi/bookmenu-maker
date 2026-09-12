/**
 * 编辑器：左栏结构大纲 + 右栏上下文面板
 *
 * 面板按"当前选中对象"切换：
 *   未选中 → 全局设置（版式 / 外观 / 字体 / 导出 / 工程）
 *   选中作品卡 → 该卡的完整属性
 *   选中区块 → 刊头 / 页脚 / 自贩区 / 委托区的区块设置
 */
import { t, td } from './i18n.js';
import {
  PALETTE_KEYS, NEUTRAL_PALETTE, SKY_PALETTE, DEFAULT_LAYOUT,
  COVER_RATIOS, COVER_FITS, DECOR_TYPES,
  LAYOUT_LIMITS, scaleLayoutSizes, applyDesignScale,
} from './state.js';
import { FONT_OPTIONS, fontLabel } from './fonts.js';
import { listPalettes, savePalette, deletePalette, applyPaletteColors } from './theme.js';
import { exportPlan, exportFileName } from './export.js';

/* ---------------- DOM 小工具 ---------------- */

const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

/* ---------------- 图标：M3 导航那种圆形徽章里的线性图标 ---------------- */

function svgIcon(paths, extra) {
  return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" ' +
    'stroke-linecap="round" stroke-linejoin="round">' + paths + (extra || '') + '</svg>';
}

const ICONS = {
  layout: svgIcon('<rect x="2.6" y="2.6" width="4.4" height="4.4"/><rect x="9" y="2.6" width="4.4" height="4.4"/>' +
    '<rect x="2.6" y="9" width="4.4" height="4.4"/><rect x="9" y="9" width="4.4" height="4.4"/>'),
  theme: svgIcon('<circle cx="8" cy="8" r="5.1"/>',
    '<path d="M8 2.9a5.1 5.1 0 0 1 0 10.2z" fill="currentColor" stroke="none"/>'),
  fonts: svgIcon('<path d="M4 12.6 8 3.4l4 9.2"/><path d="M5.7 9.4h4.6"/>'),
  export: svgIcon('<path d="M8 2.6v7"/><path d="M5.1 6.9 8 9.8l2.9-2.9"/><path d="M3.2 12.6h9.6"/>'),
  project: svgIcon('<path d="M2.8 4.4h3.4l1.3 1.6h5.7v6.6H2.8z"/>'),
  header: svgIcon('<path d="M3.4 3.2v9.6"/><path d="M3.4 4.2h9.2l-1.7 2.1 1.7 2.1H3.4"/>'),
  section: svgIcon('<rect x="2.8" y="3.2" width="4.2" height="9.6"/><rect x="9" y="3.2" width="4.2" height="9.6"/>'),
  footer: svgIcon('<rect x="2.8" y="3.2" width="10.4" height="9.6"/><path d="M2.8 9.8h10.4"/>'),
  item: svgIcon('<rect x="2.9" y="3.2" width="10.2" height="9.6"/>' +
    '<path d="M2.9 10.4 6 8l2.4 1.9L10.2 8l2.9 2.4"/>'),
  block: svgIcon('<rect x="3" y="3" width="10" height="10"/><path d="M3 6.4h10"/>'),
};

function iconEl(name, cls) {
  const node = el('span', cls || 'rbadge');
  node.innerHTML = ICONS[name] || '';
  return node;
}

function group(titleKey, children) {
  const box = el('section', 'grp');
  if (titleKey) box.appendChild(el('h4', 'grp-title', t(titleKey)));
  children.filter(Boolean).forEach(c => box.appendChild(c));
  return box;
}

function field(labelText, control, hint) {
  const wrap = el('div', 'fld');
  if (labelText) wrap.appendChild(el('label', 'fld-label', labelText));
  if (control) wrap.appendChild(control);
  if (hint) wrap.appendChild(el('p', 'fld-hint', hint));
  return wrap;
}

function textInput(value, onInput, placeholder) {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value == null ? '' : value;
  if (placeholder) input.placeholder = placeholder;
  input.addEventListener('input', () => onInput(input.value));
  return input;
}

function textArea(value, onInput, placeholder, rows) {
  const input = document.createElement('textarea');
  input.rows = rows || 3;
  input.value = value == null ? '' : value;
  if (placeholder) input.placeholder = placeholder;
  input.addEventListener('input', () => onInput(input.value));
  return input;
}

function numberInput(value, onInput, opts) {
  const o = opts || {};
  const input = document.createElement('input');
  input.type = 'number';
  input.value = value;
  if (o.min !== undefined) input.min = o.min;
  if (o.max !== undefined) input.max = o.max;
  if (o.step !== undefined) input.step = o.step;
  if (o.suffix) input.dataset.suffix = o.suffix;
  // commitOn:'change' 用于「改一个值会连带影响其他字段」的输入框（例如画布宽度会
  // 按比例缩放字号与间距）。逐字提交会按 2 → 24 → 248 反复缩放，结果全错。
  const evt = o.commitOn === 'change' ? 'change' : 'input';
  input.addEventListener(evt, () => {
    const n = Number(input.value);
    if (!isFinite(n)) return;
    onInput(n);
  });
  return input;
}

function colorInput(value, onInput) {
  const input = document.createElement('input');
  input.type = 'color';
  input.value = value;
  input.addEventListener('input', () => onInput(input.value));
  return input;
}

function selectInput(options, value, onChange) {
  const sel = document.createElement('select');
  options.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    if (String(value) === String(opt.value)) o.selected = true;
    sel.appendChild(o);
  });
  sel.addEventListener('change', () => onChange(sel.value));
  return sel;
}

function checkbox(labelText, checked, onChange) {
  const wrap = el('label', 'chk');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = !!checked;
  input.addEventListener('change', () => onChange(input.checked));
  wrap.append(input, el('span', '', labelText));
  return wrap;
}

function button(labelText, onClick, cls) {
  const b = el('button', 'btn' + (cls ? ' ' + cls : ''), labelText);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

function row(...children) {
  const r = el('div', 'row');
  children.filter(Boolean).forEach(c => r.appendChild(c));
  return r;
}

function columnPair(a, b) {
  const w = el('div', 'pair');
  w.append(a, b);
  return w;
}

function hexField(labelKey, value, onInput) {
  const wrap = el('div', 'color-row');
  wrap.appendChild(el('span', 'color-name', t(labelKey)));
  const input = colorInput(value, onInput);
  wrap.appendChild(input);
  const hexText = el('code', 'color-hex', String(value).toUpperCase());
  wrap.appendChild(hexText);
  input.addEventListener('input', () => { hexText.textContent = input.value.toUpperCase(); });
  return wrap;
}

/* ---------------- 拖拽状态 ---------------- */

let dragPayload = null;

/* ---------------- 大纲 ---------------- */

function blockLabel(block, state) {
  if (block.kind === 'header') return t('outline.block.header');
  if (block.kind === 'footer') return t('outline.block.footer');
  const section = state.sections.find(s => s.id === block.sectionId);
  if (!section) return '?';
  const key = section.id === 'cons' ? 'outline.section.cons'
    : (section.id === 'main' ? 'outline.section.main' : null);
  return key ? t(key) : (section.titleSub || section.titleEn || section.id);
}

function makeDraggable(node, payload, onDrop) {
  node.draggable = true;
  node.addEventListener('dragstart', e => {
    dragPayload = payload;
    node.classList.add('dragging');
    try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'x'); } catch (err) { /* 忽略 */ }
  });
  node.addEventListener('dragend', () => {
    dragPayload = null;
    node.classList.remove('dragging');
  });
  node.addEventListener('dragover', e => {
    if (!dragPayload || dragPayload.type !== payload.type) return;
    e.preventDefault();
    node.classList.add('drag-over');
  });
  node.addEventListener('dragleave', () => node.classList.remove('drag-over'));
  node.addEventListener('drop', e => {
    e.preventDefault();
    node.classList.remove('drag-over');
    if (!dragPayload) return;
    onDrop(dragPayload, payload);
    dragPayload = null;
  });
}

function renderItemRow(app, section, item) {
  const node = el('div', 'outline-item');
  if (app.sel && app.sel.type === 'item' && app.sel.id === item.id) node.classList.add('is-selected');
  node.appendChild(el('span', 'drag-dot', '⠿'));
  const label = el('span', 'outline-item-title',
    item.title || t('outline.itemUntitled'));
  if (!item.title) label.classList.add('is-muted');
  node.appendChild(label);

  const actions = el('span', 'outline-actions');
  const dup = button('⧉', e => { e.stopPropagation(); app.duplicateItem(section.id, item.id); }, 'mini');
  dup.title = t('outline.duplicate');
  const del = button('✕', e => { e.stopPropagation(); app.removeItem(section.id, item.id); }, 'mini danger');
  del.title = t('outline.deleteItem');
  actions.append(dup, del);
  node.appendChild(actions);

  node.addEventListener('click', () => app.select({ type: 'item', id: item.id, sectionId: section.id }));
  makeDraggable(node, { type: 'item', id: item.id, sectionId: section.id }, (from, to) => {
    if (from.sectionId !== to.sectionId) return;
    app.reorderItem(from.sectionId, from.id, to.id);
  });
  return node;
}

function renderSectionRows(app, block) {
  const state = app.state;
  const wrap = el('div', 'outline-block');
  const section = state.sections.find(s => s.id === block.sectionId);
  if (!section) return wrap;
  if (block.visible === false) wrap.classList.add('is-hidden');
  if (app.sel && app.sel.type === 'section' && app.sel.id === section.id) wrap.classList.add('is-selected');

  const head = el('div', 'outline-head');
  head.appendChild(el('span', 'drag-dot', '⠿'));
  head.appendChild(iconEl('section', 'head-badge'));
  head.appendChild(el('span', 'outline-title', blockLabel(block, state)));
  const count = el('span', 'outline-count', String(section.items.length));
  head.appendChild(count);
  if (block.visible === false) head.appendChild(el('span', 'badge-mini', t('outline.hidden')));
  wrap.appendChild(head);

  const list = el('div', 'outline-items');
  if (!section.items.length) {
    list.appendChild(el('div', 'outline-empty', t('outline.emptyItems')));
  } else {
    section.items.forEach(item => list.appendChild(renderItemRow(app, section, item)));
  }
  wrap.appendChild(list);

  const add = button('+ ' + t('outline.addItem'), e => {
    e.stopPropagation();
    app.addItem(section.id);
  }, 'add');
  wrap.appendChild(add);

  head.addEventListener('click', e => {
    if (e.target.closest('.outline-actions')) return;
    app.select({ type: 'section', id: section.id, blockId: block.id });
  });
  makeDraggable(head, { type: 'block', id: block.id }, (from, to) => {
    app.reorderBlock(from.id, to.id);
  });
  return wrap;
}

function renderSimpleBlock(app, block, titleKey, subtitleText) {
  const wrap = el('div', 'outline-block');
  if (block.visible === false) wrap.classList.add('is-hidden');
  const selectedType = block.kind === 'header' ? 'header' : 'footer';
  if (app.sel && app.sel.type === selectedType) wrap.classList.add('is-selected');

  const head = el('div', 'outline-head');
  head.appendChild(el('span', 'drag-dot', '⠿'));
  head.appendChild(iconEl(block.kind === 'header' ? 'header' : 'footer', 'head-badge'));
  head.appendChild(el('span', 'outline-title', t(titleKey)));
  if (block.visible === false) head.appendChild(el('span', 'badge-mini', t('outline.hidden')));
  wrap.appendChild(head);
  if (subtitleText) wrap.appendChild(el('div', 'outline-sub', subtitleText));

  head.addEventListener('click', () => app.select({ type: selectedType, blockId: block.id }));
  makeDraggable(head, { type: 'block', id: block.id }, (from, to) => {
    app.reorderBlock(from.id, to.id);
  });
  return wrap;
}

export function renderOutline(app, host) {
  host.replaceChildren();
  const state = app.state;
  state.blocks.forEach(block => {
    if (block.kind === 'header') {
      host.appendChild(renderSimpleBlock(app, block, 'outline.block.header',
        state.header.circle || ''));
    } else if (block.kind === 'footer') {
      host.appendChild(renderSimpleBlock(app, block, 'outline.block.footer',
        state.footer.left || ''));
    } else {
      host.appendChild(renderSectionRows(app, block));
    }
  });
}

/* ---------------- 右栏：上下文面板 ---------------- */

function globalTabs(app, host) {
  const tabs = [
    ['layout', 'panel.tab.layout'],
    ['theme', 'panel.tab.theme'],
    ['fonts', 'panel.tab.fonts'],
    ['export', 'panel.tab.export'],
    ['project', 'panel.tab.project'],
  ];
  const bar = el('div', 'tabs');
  tabs.forEach(([key, labelKey]) => {
    const b = el('button', 'tab' + (app.tab === key ? ' is-active' : ''), '');
    b.type = 'button';
    b.append(iconEl(key, 'tab-icon'), el('span', 'tab-caret'), el('span', 'tab-label', t(labelKey)));
    b.addEventListener('click', () => { app.tab = key; app.renderInspector(); });
    bar.appendChild(b);
  });
  host.appendChild(bar);
}

function panelLayout(app) {
  const L = app.state.layout;
  const out = [];
  const padLim = LAYOUT_LIMITS.padding;
  const gapLim = LAYOUT_LIMITS.gap;
  const secLim = LAYOUT_LIMITS.sectionGap;
  const sizeLim = LAYOUT_LIMITS.baseSize;

  /**
   * 画布宽度是整套版式的基准：改了宽度，字号与页边距、间距必须同比跟着走，
   * 否则切到「印刷宽 2480」会得到一张 2480px 宽、字还是 15px 的图 —— 字小到没法印。
   */
  const setWidth = w => app.commit(s => {
    const next = Math.max(200, Math.min(10000, Math.round(w)));
    if (s.layout.scaleWithWidth !== false && s.layout.width > 0) {
      scaleLayoutSizes(s.layout, next / s.layout.width);
    }
    s.layout.width = next;
  }, { inspector: true });

  const widthInput = numberInput(L.width, setWidth,
    { min: 200, max: 10000, step: 1, commitOn: 'change' });
  const presets = el('div', 'chips');
  [['preset.a4', 794], ['preset.print', 2480], ['preset.social', 1080], ['preset.square', 1080]]
    .forEach(([key, w]) => {
      presets.appendChild(button(t(key), () => setWidth(w), 'chip'));
    });
  out.push(group('layout.title', [
    field(t('layout.width'), widthInput),
    field(t('layout.presets'), presets),
    checkbox(t('layout.scaleWithWidth'), L.scaleWithWidth !== false, v => app.commit(s => {
      s.layout.scaleWithWidth = v;
    }, { inspector: false })),
    el('p', 'fld-hint', t('layout.scaleHint')),
  ]));

  const heightCtl = row(
    selectInput([
      { value: 'auto', label: t('layout.heightAuto') },
      { value: 'fixed', label: t('layout.heightFixed') },
    ], L.height === 'auto' ? 'auto' : 'fixed', v => {
      app.commit(s => { s.layout.height = v === 'auto' ? 'auto' : Math.round(s.layout.height === 'auto' ? 1123 : s.layout.height); });
    })
  );
  const heightItems = [field(t('layout.height'), heightCtl)];
  if (L.height !== 'auto') {
    heightItems.push(field(t('layout.heightFixedValue'),
      numberInput(L.height, v => app.commit(s => { s.layout.height = Math.max(200, Math.round(v)); }, { inspector: false }))));
  }
  out.push(group(null, heightItems));

  const pad = L.padding;
  out.push(group(null, [
    field(t('layout.padding'), el('div', 'quad')),
  ]));
  // 页边距四个数字放一行
  const quad = out[out.length - 1].querySelector('.quad');
  [['t', pad.t], ['r', pad.r], ['b', pad.b], ['l', pad.l]].forEach(([key, value]) => {
    quad.appendChild(numberInput(value, v => app.commit(s => {
      s.layout.padding[key] = Math.max(padLim[0], Math.min(padLim[1], Math.round(v)));
    }, { inspector: false }), { min: padLim[0], max: padLim[1] }));
  });

  out.push(group(null, [
    columnPair(
      field(t('layout.columns'), selectInput(
        [1, 2, 3, 4].map(n => ({ value: n, label: String(n) })),
        // 栏数决定卡片可选宽度，改完要让右栏（尤其是卡片宽度选项）立刻跟上
        L.columns, v => app.commit(s => { s.layout.columns = Number(v); }, { inspector: true })
      )),
      field(t('layout.baseSize'), numberInput(L.baseSize, v => app.commit(s => {
        s.layout.baseSize = Math.max(sizeLim[0], Math.min(sizeLim[1], v));
      }, { inspector: false }), { min: sizeLim[0], max: sizeLim[1], step: 0.5 }))
    ),
    columnPair(
      field(t('layout.gapX'), numberInput(L.gapX, v => app.commit(s => {
        s.layout.gapX = Math.max(gapLim[0], Math.min(gapLim[1], v));
      }, { inspector: false }), { min: gapLim[0], max: gapLim[1] })),
      field(t('layout.gapY'), numberInput(L.gapY, v => app.commit(s => {
        s.layout.gapY = Math.max(gapLim[0], Math.min(gapLim[1], v));
      }, { inspector: false }), { min: gapLim[0], max: gapLim[1] }))
    ),
    field(t('layout.sectionGap'), numberInput(L.sectionGap, v => app.commit(s => {
      s.layout.sectionGap = Math.max(secLim[0], Math.min(secLim[1], v));
    }, { inspector: false }), { min: secLim[0], max: secLim[1] })),
    // 已经有内容、但宽度是后改的旧项目：一键按当前宽度把字号与间距重新等比适配
    el('p', 'fld-hint', t('layout.refitHint')),
    button(t('layout.refitBtn'), () => app.commit(s => {
      applyDesignScale(s.layout, s.layout.width);
    }, { inspector: true }), 'ghost block'),
    button(t('layout.reset'), () => app.commit(s => {
      s.layout = JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
    }, { inspector: true }), 'ghost'),
  ]));
  return out;
}

function panelTheme(app) {
  const state = app.state;
  const out = [];
  const presets = el('div', 'chips');
  presets.appendChild(button(t('theme.presetNeutral'), () => app.commit(s => {
    applyPaletteColors(s, NEUTRAL_PALETTE);
  }), 'chip'));
  presets.appendChild(button(t('theme.presetSky'), () => app.commit(s => {
    applyPaletteColors(s, SKY_PALETTE);
  }), 'chip'));
  out.push(group('theme.presets', [presets, el('p', 'fld-hint', t('theme.presetHint'))]));

  const colors = PALETTE_KEYS.map(key => hexField(colorLabelKey(key), state.theme[key], v => {
    app.commit(s => { s.theme[key] = v; }, { inspector: false });
  }));
  out.push(group('theme.colors', colors));

  const decor = state.theme.decor;
  out.push(group(null, [
    field(t('theme.decor'), selectInput(
      DECOR_TYPES.map(kind => ({ value: kind, label: t('decor.' + kind) })),
      decor.type, v => app.commit(s => { s.theme.decor.type = v; }, { inspector: false })
    )),
    columnPair(
      field(t('theme.decorOpacity'), numberInput(Math.round(decor.opacity * 100), v => app.commit(s => {
        s.theme.decor.opacity = Math.max(0, Math.min(1, v / 100));
      }, { inspector: false }), { min: 0, max: 100, step: 5 })),
      field(t('theme.decorDensity'), numberInput(decor.density, v => app.commit(s => {
        s.theme.decor.density = Math.max(0.5, Math.min(3, v));
      }, { inspector: false }), { min: 0.5, max: 3, step: 0.1 }))
    ),
  ]));

  // 我的配色
  const saved = listPalettes();
  const list = el('div', 'palette-list');
  if (!saved.length) list.appendChild(el('p', 'fld-hint', t('theme.saveEmpty')));
  saved.forEach(p => {
    const rowEl = el('div', 'palette-row');
    rowEl.appendChild(el('span', 'palette-name', p.name || '—'));
    rowEl.appendChild(button(t('theme.apply'), () => {
      app.commit(s => { applyPaletteColors(s, p.colors); });
      app.toast(t('toast.paletteApplied', { name: p.name }));
    }, 'mini'));
    rowEl.appendChild(button(t('theme.delete'), () => {
      deletePalette(p.id);
      app.toast(t('toast.paletteDeleted'));
      app.renderInspector();
    }, 'mini danger'));
    list.appendChild(rowEl);
  });
  const nameInput = textInput('', () => {}, t('theme.saveName'));
  out.push(group('theme.saved', [
    list,
    row(nameInput, button(t('theme.saveCurrent'), () => {
      const name = nameInput.value.trim();
      if (!name) { app.toast(t('toast.paletteNeedName')); return; }
      savePalette(name, app.state.theme);
      nameInput.value = '';
      app.toast(t('toast.paletteSaved', { name }));
      app.renderInspector();
    }, 'ghost')),
  ]));
  return out;
}

function colorLabelKey(key) {
  return {
    bg: 'theme.bg', cardBg: 'theme.cardBg', cardBorder: 'theme.cardBorder',
    title: 'theme.title', body: 'theme.body', muted: 'theme.muted',
    accent: 'theme.accent', headerBg: 'theme.headerBg', headerText: 'theme.headerText',
    footerBg: 'theme.footerBg', footerText: 'theme.footerText',
  }[key] || key;
}

function panelFonts(app) {
  const state = app.state;
  const out = [];

  out.push(group('lang.docTitle', [
    selectInput([
      { value: 'ja', label: t('lang.ja') },
      { value: 'zh', label: t('lang.zh') },
    ], state.docLang, v => app.setDocLang(v)),
    el('p', 'fld-hint', t('lang.docHint')),
  ]));

  const fontOpts = FONT_OPTIONS.map(f => ({ value: f.key, label: fontLabel(f.key) }));
  out.push(group('fonts.title', [
    field(t('fonts.base'), selectInput(fontOpts, state.fonts.base, v => app.commit(s => { s.fonts.base = v; }))),
    field(t('fonts.display'), selectInput(fontOpts, state.fonts.display, v => app.commit(s => { s.fonts.display = v; }))),
    field(t('fonts.scale'), numberInput(state.fonts.scale, v => app.commit(s => {
      s.fonts.scale = Math.max(50, Math.min(200, v));
    }, { inspector: false }), { min: 50, max: 200, step: 5 })),
    el('p', 'fld-hint', t('fonts.langHint')),
  ]));

  // 本地字体
  const status = el('p', 'fld-hint', app.localFontName
    ? t('fonts.localLoaded', { name: app.localFontName })
    : t('fonts.localNone'));
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2';
  fileInput.addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (file) app.loadLocalFont(file);
  });
  const localBtns = [fileInput];
  if (app.localFontName) {
    localBtns.push(button(t('fonts.localRemove'), () => app.removeLocalFont(), 'ghost'));
  }
  out.push(group('fonts.localTitle', [
    el('p', 'fld-hint', t('fonts.localHint')),
    ...localBtns,
    status,
  ]));

  // 日→简中转换（只在内容语言为简体中文时可用）
  const canConvert = state.docLang === 'zh';
  const convertBtn = button(t('fonts.convert'), () => app.convertJpToSc(), 'ghost');
  convertBtn.disabled = !canConvert;
  out.push(group(null, [
    convertBtn,
    el('p', 'fld-hint', canConvert ? t('fonts.convertHint') : t('fonts.convertDisabled')),
  ]));
  return out;
}

function panelExport(app) {
  const state = app.state;
  const plan = exportPlan(state, app.els.canvas);
  const out = [];
  const modeCtl = selectInput([
    { value: 'scale', label: t('export.mode.scale') },
    { value: 'width', label: t('export.mode.width') },
  ], state.export.mode, v => app.commit(s => { s.export.mode = v; }));
  const items = [
    field(t('export.mode'), modeCtl),
    field(t('export.scale'), selectInput(
      [1, 2, 3, 4].map(n => ({ value: n, label: n + '×' })),
      state.export.scale, v => app.commit(s => { s.export.scale = Number(v); })
    )),
    field(t('export.targetWidth'), numberInput(state.export.targetWidth, v => app.commit(s => {
      s.export.targetWidth = Math.max(200, Math.round(v));
    }, { inspector: false }), { min: 200, max: 20000, step: 10 })),
    field(t('export.prefix'), textInput(state.export.prefix, v => app.commit(s => {
      s.export.prefix = v;
    }, { inspector: false }), td('doc.fileLabel')),
      t('export.prefixHint')),
  ];
  out.push(group('export.title', items));

  const info = el('div', 'info-grid');
  info.appendChild(infoRow(t('export.result'), plan.outW + ' × ' + plan.outH + ' px', 'size'));
  info.appendChild(infoRow(t('export.estimate'), estimateSize(plan.outW * plan.outH), 'estimate'));
  info.appendChild(infoRow('', exportFileName(state, plan), 'name'));
  out.push(group(null, [info]));

  if (plan.tiled) out.push(el('p', 'fld-hint', t('export.tiling')));
  if (plan.outW > 12000) out.push(el('p', 'fld-hint warn', t('export.tooWide', { w: plan.outW })));
  const itemCount = state.sections.reduce((n, s) => n + s.items.length, 0);
  if (!itemCount) out.push(el('p', 'fld-hint warn', t('export.noItemsHint')));

  out.push(group(null, [button(t('export.button'), () => app.exportImage(), 'primary block')]));
  return out;
}

function infoRow(label, value, key) {
  const r = el('div', 'info-row');
  r.appendChild(el('span', 'info-label', label));
  const v = el('span', 'info-value', value);
  if (key) v.dataset.info = key;
  r.appendChild(v);
  return r;
}

/**
 * 只刷新导出面板里的尺寸/体积/文件名，不重建整个面板。
 * 这样调整导出设置时信息会立刻跟上，又不会打断正在输入的字段。
 */
export function refreshExportInfo(app, host) {
  const sizeEl = host.querySelector('[data-info="size"]');
  if (!sizeEl) return;
  const plan = exportPlan(app.state, app.els.canvas);
  sizeEl.textContent = plan.outW + ' × ' + plan.outH + ' px';
  const estimateEl = host.querySelector('[data-info="estimate"]');
  if (estimateEl) estimateEl.textContent = estimateSize(plan.outW * plan.outH);
  const nameEl = host.querySelector('[data-info="name"]');
  if (nameEl) nameEl.textContent = exportFileName(app.state, plan);
}

function estimateSize(pixels) {
  // PNG 压缩率因内容差异很大，这里只给一个数量级参考
  const bytes = pixels * 0.45;
  if (bytes > 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  return Math.max(1, Math.round(bytes / 1024)) + ' KB';
}

function panelProject(app) {
  const state = app.state;
  const out = [];
  out.push(group('project.title', [
    field(t('project.name'), textInput(state.meta.name, v => app.commit(s => {
      s.meta.name = v;
    }, { inspector: false }), t('project.namePlaceholder'))),
    el('p', 'fld-hint', t('project.hint')),
    button(t('project.export'), () => app.exportProject(), 'ghost block'),
  ]));

  const importInput = document.createElement('input');
  importInput.type = 'file';
  importInput.accept = '.json,application/json';
  importInput.addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (file) app.importProject(file);
  });
  out.push(group(null, [importInput]));

  out.push(group(null, [
    button(t('project.reset'), () => app.resetAll(), 'ghost danger block'),
    el('p', 'fld-hint', t('project.storageNote')),
  ]));
  return out;
}

function panelItem(app) {
  const state = app.state;
  const found = findItem(state, app.sel.id);
  if (!found) return [el('p', 'fld-hint', '—')];
  const { item, section } = found;
  const set = (field_, value) => app.commit(s => {
    const f = findItem(s, item.id);
    if (f) f.item[field_] = value;
  }, { inspector: false, outline: true });

  const out = [];
  out.push(group('panel.selectedItem', [
    field(t('item.title'), textInput(item.title, v => set('title', v), td('doc.ph.title'))),
    columnPair(
      field(t('item.subtitle'), textInput(item.subtitle, v => set('subtitle', v), td('doc.ph.subtitle'))),
      field(t('item.price'), textInput(item.price, v => set('price', v), '1,000'), t('item.priceHint'))
    ),
    field(t('item.desc'), textArea(item.desc, v => set('desc', v), td('doc.ph.desc'), 3)),
    columnPair(
      field(t('item.note'), textInput(item.note, v => set('note', v), td('doc.ph.note'))),
      field(t('item.badges'), textInput(item.badges, v => set('badges', v), 'NEW:accent'), t('item.badgeHelp'))
    ),
  ]));

  // 卡片宽度按「栏数」等分：栏数 2 → 1/2 栏就是半栏；栏数 4 → 还能选 1/4、3/4。
  // 用分数而不是"几栏"来表述，是因为大家想的是"半栏/整栏"，不是网格单位。
  const cols = Math.max(1, Number(state.layout.columns) || 1);
  const spanLabel = i => {
    if (i >= cols) return t('span.full');
    if (i * 2 === cols) return t('span.half');
    return i + '/' + cols + ' ' + t('span.unit');
  };
  const spanOpts = [];
  for (let i = 1; i <= cols; i++) spanOpts.push({ value: i, label: spanLabel(i) });
  out.push(group(null, [
    field(t('item.span'), selectInput(spanOpts,
      Math.min(item.span, cols), v => set('span', Number(v))), t('span.hint')),
  ]));

  // 只有一栏时结构上就分不出半栏，给一个一步到位的改法，而不是让选项"凭空消失"
  if (cols === 1) {
    out.push(group(null, [
      button(t('span.enableHalf'), () => app.commit(s => {
        s.sections.forEach(sec => sec.items.forEach(it => {
          // 原本满宽的卡片继续保持满宽（2 栏时 span=2），只把当前这张切成半栏
          if (it.id !== item.id) it.span = 2;
        }));
        const f = findItem(s, item.id);
        if (f) f.item.span = 1;
        s.layout.columns = 2;
      }, { inspector: true, outline: true }), 'ghost block'),
    ]));
  }

  // 封面
  const coverFile = document.createElement('input');
  coverFile.type = 'file';
  coverFile.accept = 'image/*';
  coverFile.addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (file) app.setItemCover(item.id, file);
  });
  const coverBtns = [coverFile];
  if (item.cover) coverBtns.push(button(t('item.coverRemove'), () => set('cover', ''), 'ghost'));
  out.push(group('item.cover', [
    ...coverBtns,
    el('p', 'fld-hint', t('item.coverHint')),
    columnPair(
      field(t('item.coverFit'), selectInput(
        COVER_FITS.map(f => ({ value: f, label: t('fit.' + f) })),
        item.coverFit, v => set('coverFit', v))),
      field(t('item.coverRatio'), selectInput(
        COVER_RATIOS.map(r => ({
          value: r,
          label: r === 'auto' ? t('ratio.auto')
            : t('ratio.' + r.replace(':', 'x')),
        })), item.coverRatio, v => set('coverRatio', v)))
    ),
    field(t('item.focal'),
      columnPair(
        numberInput(item.focalX, v => set('focalX', Math.max(0, Math.min(100, v))), { min: 0, max: 100, step: 5 }),
        numberInput(item.focalY, v => set('focalY', Math.max(0, Math.min(100, v))), { min: 0, max: 100, step: 5 })
      ), t('item.focalHint')),
  ]));

  // 操作
  const others = state.sections.filter(s => s.id !== section.id);
  const actions = [
    button(t('item.moveUp'), () => app.moveItem(section.id, item.id, -1), 'ghost'),
    button(t('item.moveDown'), () => app.moveItem(section.id, item.id, 1), 'ghost'),
    button(t('item.duplicate'), () => app.duplicateItem(section.id, item.id), 'ghost'),
  ];
  others.forEach(sec => {
    const name = sec.id === 'cons' ? t('outline.section.cons')
      : (sec.id === 'main' ? t('outline.section.main') : (sec.titleSub || sec.id));
    actions.push(button('→ ' + name, () => app.moveItemToSection(item.id, sec.id), 'ghost'));
  });
  actions.push(button(t('item.delete'), () => app.removeItem(section.id, item.id), 'ghost danger'));
  out.push(group('item.actions', actions));

  return out;
}

function panelBlock(app) {
  const state = app.state;
  const sel = app.sel;
  if (sel.type === 'header') return panelHeader(app, state);
  if (sel.type === 'footer') return panelFooter(app, state);
  if (sel.type === 'section') return panelSection(app, state, sel.id);
  return [];
}

function panelHeader(app, state) {
  const set = (field_, value) => app.commit(s => { s.header[field_] = value; }, { inspector: false });
  const out = [];
  out.push(group('header.title', [
    checkbox(t('header.visible'), blockVisible(state, 'header'), v => app.setBlockVisible('header', v)),
    field(t('header.event'), textInput(state.header.event, v => set('event', v), td('doc.ph.event'))),
    columnPair(
      field(t('header.circle'), textInput(state.header.circle, v => set('circle', v), td('doc.ph.circle'))),
      field(t('header.booth'), textInput(state.header.booth, v => set('booth', v), td('doc.ph.booth')))
    ),
  ]));

  const bannerInput = document.createElement('input');
  bannerInput.type = 'file';
  bannerInput.accept = 'image/*';
  bannerInput.addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (file) app.setBanner(file);
  });
  const bannerBtns = [bannerInput];
  if (state.header.banner) {
    bannerBtns.push(button(t('header.bannerRemove'), () => {
      app.commit(s => { s.header.banner = ''; });
    }, 'ghost'));
  }
  out.push(group('header.banner', [
    ...bannerBtns,
    el('p', 'fld-hint', t('header.bannerHint')),
    hexField('theme.headerBg', state.theme.headerBg, v => app.commit(s => { s.theme.headerBg = v; }, { inspector: false })),
    hexField('theme.headerText', state.theme.headerText, v => app.commit(s => { s.theme.headerText = v; }, { inspector: false })),
  ]));
  return out;
}

function panelFooter(app, state) {
  const out = [];
  out.push(group('footer.title', [
    checkbox(t('footer.visible'), blockVisible(state, 'footer'), v => app.setBlockVisible('footer', v)),
    field(t('footer.left'), textInput(state.footer.left, v => app.commit(s => {
      s.footer.left = v;
    }, { inspector: false }), td('doc.ph.footerLeft'))),
    field(t('footer.right'), textInput(state.footer.right, v => app.commit(s => {
      s.footer.right = v;
    }, { inspector: false }), '© {year} {circle}'), t('footer.varsHint')),
    hexField('theme.footerBg', state.theme.footerBg, v => app.commit(s => { s.theme.footerBg = v; }, { inspector: false })),
    hexField('theme.footerText', state.theme.footerText, v => app.commit(s => { s.theme.footerText = v; }, { inspector: false })),
  ]));
  return out;
}

function panelSection(app, state, sectionId) {
  const section = state.sections.find(s => s.id === sectionId);
  if (!section) return [];
  const out = [];
  out.push(group(t(section.id === 'cons' ? 'outline.section.cons' : 'outline.section.main'), [
    checkbox(t('section.visible'), blockVisible(state, 'section', sectionId), v => app.setBlockVisible('section', v, sectionId)),
    columnPair(
      field(t('section.titleEn'), textInput(section.titleEn, v => app.commit(s => {
        const sec = s.sections.find(x => x.id === sectionId);
        if (sec) sec.titleEn = v;
      }, { inspector: false, outline: true }))),
      field(t('section.titleSub'), textInput(section.titleSub, v => app.commit(s => {
        const sec = s.sections.find(x => x.id === sectionId);
        if (sec) sec.titleSub = v;
      }, { inspector: false, outline: true })))
    ),
    button('+ ' + t('outline.addItem'), () => app.addItem(sectionId), 'ghost block'),
  ]));
  return out;
}

/* ---------------- 选择与查询辅助 ---------------- */

export function findItem(state, itemId) {
  for (const section of state.sections) {
    const item = section.items.find(i => i.id === itemId);
    if (item) return { item, section };
  }
  return null;
}

export function blockVisible(state, kind, sectionId) {
  const block = state.blocks.find(b => b.kind === kind &&
    (kind === 'section' ? b.sectionId === sectionId : true));
  return block ? block.visible !== false : true;
}

/* ---------------- 主入口 ---------------- */

export function renderInspector(app, host) {
  host.replaceChildren();
  if (!app.sel || app.sel.type === 'global') {
    globalTabs(app, host);
    const body = el('div', 'tab-body');
    let panels;
    if (app.tab === 'theme') panels = panelTheme(app);
    else if (app.tab === 'fonts') panels = panelFonts(app);
    else if (app.tab === 'export') panels = panelExport(app);
    else if (app.tab === 'project') panels = panelProject(app);
    else panels = panelLayout(app);
    panels.forEach(p => body.appendChild(p));
    host.appendChild(body);
    return;
  }

  const bar = el('div', 'ctx-head');
  bar.appendChild(iconEl(app.sel.type === 'item' ? 'item' : 'block', 'head-badge'));
  bar.appendChild(el('span', 'ctx-title', app.sel.type === 'item'
    ? t('panel.selectedItem') : t('panel.selectedBlock')));
  bar.appendChild(button(t('panel.back'), () => app.select(null), 'link'));
  host.appendChild(bar);

  const body = el('div', 'tab-body');
  const panels = app.sel.type === 'item' ? panelItem(app) : panelBlock(app);
  panels.forEach(p => body.appendChild(p));
  host.appendChild(body);
}
