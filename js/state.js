/**
 * 状态模型：默认值、结构校验、旧存档迁移
 *
 * 硬约束：新建项目不内置任何具体素材。
 * 作品名、副标题、说明、价格、编号、社团名、摊位号、活动名与日期、
 * 场地、网址、版权主体一律留空，只保留中性占位提示。
 */
import { td, DOC_LANGS, UI_LANGS } from './i18n.js';

export const SCHEMA = 5;
export const STORAGE_KEY = 'bookmenu-project-v5';
/** 仅用于识别旧版存档的键名特征，不包含任何作品信息 */
export const LEGACY_KEY_MARKER = 'menu-designer';

/** 中性默认配色 */
export const NEUTRAL_PALETTE = {
  bg: '#f7f7f9',
  cardBg: '#ffffff',
  cardBorder: '#e5e7eb',
  title: '#1f2937',
  body: '#374151',
  muted: '#9ca3af',
  accent: '#4b5d91',
  headerBg: '#2b3a55',
  headerText: '#ffffff',
  footerBg: '#f3f4f6',
  footerText: '#6b7280',
};

/** 内置配色：夜空粉紫（取自海报的靛蓝—丁香—粉紫） */
export const SKY_PALETTE = {
  bg: '#304274',
  cardBg: '#3e5488',
  cardBorder: '#6573a3',
  title: '#e7dae3',
  body: '#d6c2d6',
  muted: '#b8b4ce',
  accent: '#d6c2d6',
  headerBg: '#26314f',
  headerText: '#e7dae3',
  footerBg: '#26314f',
  footerText: '#b8b4ce',
};

export const PALETTE_KEYS = [
  'bg', 'cardBg', 'cardBorder', 'title', 'body', 'muted', 'accent',
  'headerBg', 'headerText', 'footerBg', 'footerText',
];

export const DEFAULT_LAYOUT = {
  width: 794,
  height: 'auto',      // 'auto' 或具体像素值
  padding: { t: 48, r: 56, b: 48, l: 56 },
  columns: 2,
  gapX: 24,
  gapY: 32,
  sectionGap: 36,
  baseSize: 15,
  // 改画布宽度时，字号 / 页边距 / 间距是否跟着等比缩放。
  // 默认开：切到「印刷宽 2480」时整套版式一起放大，成品观感与 A4 一致，只是像素更高。
  scaleWithWidth: true,
};

/** 版式各项的取值范围（宽度放大到印刷尺寸时，字号与间距也要有足够上限） */
export const LAYOUT_LIMITS = {
  padding: [0, 2000],
  gap: [0, 1200],
  sectionGap: [0, 3000],
  baseSize: [8, 200],
};

const clampNum = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * 按倍率等比缩放字号、页边距与间距（画布宽度变化时使用）。
 * 只动尺寸类参数，栏数与锁定高度保持不变。
 */
export function scaleLayoutSizes(layout, k) {
  const ratio = (isFinite(k) && k > 0) ? k : 1;
  const P = LAYOUT_LIMITS;
  layout.padding = {
    t: Math.round(clampNum(layout.padding.t * ratio, ...P.padding)),
    r: Math.round(clampNum(layout.padding.r * ratio, ...P.padding)),
    b: Math.round(clampNum(layout.padding.b * ratio, ...P.padding)),
    l: Math.round(clampNum(layout.padding.l * ratio, ...P.padding)),
  };
  layout.gapX = Math.round(clampNum(layout.gapX * ratio, ...P.gap));
  layout.gapY = Math.round(clampNum(layout.gapY * ratio, ...P.gap));
  layout.sectionGap = Math.round(clampNum(layout.sectionGap * ratio, ...P.sectionGap));
  layout.baseSize = Math.round(clampNum(layout.baseSize * ratio, ...P.baseSize) * 10) / 10;
  return layout;
}

/** 以 A4 版式为基准，按当前画布宽度重算整套尺寸 */
export function applyDesignScale(layout, width) {
  const ref = DEFAULT_LAYOUT;
  const w = clampNum(Number(width) || ref.width, 200, 10000);
  const k = w / ref.width;
  layout.width = w;
  layout.padding = {
    t: Math.round(clampNum(ref.padding.t * k, ...LAYOUT_LIMITS.padding)),
    r: Math.round(clampNum(ref.padding.r * k, ...LAYOUT_LIMITS.padding)),
    b: Math.round(clampNum(ref.padding.b * k, ...LAYOUT_LIMITS.padding)),
    l: Math.round(clampNum(ref.padding.l * k, ...LAYOUT_LIMITS.padding)),
  };
  layout.gapX = Math.round(clampNum(ref.gapX * k, ...LAYOUT_LIMITS.gap));
  layout.gapY = Math.round(clampNum(ref.gapY * k, ...LAYOUT_LIMITS.gap));
  layout.sectionGap = Math.round(clampNum(ref.sectionGap * k, ...LAYOUT_LIMITS.sectionGap));
  layout.baseSize = Math.round(clampNum(ref.baseSize * k, ...LAYOUT_LIMITS.baseSize) * 10) / 10;
  layout.scaleWithWidth = true;
  return layout;
}

const FONT_KEYS = ['sans-jp', 'sans-sc', 'serif-jp', 'serif-sc', 'maru-jp', 'local'];

export const COVER_RATIOS = ['1:1', '4:3', '3:4', '16:9', 'auto'];
export const COVER_FITS = ['cover', 'contain'];
export const DECOR_TYPES = ['none', 'constellation', 'grid', 'diagonal'];

export function uid(prefix) {
  return (prefix || 'id') + '-' + Date.now().toString(36) + '-' +
    Math.floor(Math.random() * 1e6).toString(36);
}

/** 默认字体随内容语言配对：正文黑体、标题衬线 */
export function defaultFontsFor(docLang) {
  return docLang === 'zh'
    ? { base: 'sans-sc', display: 'serif-sc', scale: 100, localName: '' }
    : { base: 'sans-jp', display: 'serif-jp', scale: 100, localName: '' };
}

export function newSection(id, titleEn, subKey) {
  return {
    id,
    titleEn,
    titleSub: td(subKey),
    items: [],
  };
}

export function newItem(span) {
  return {
    id: uid('item'),
    title: '',
    subtitle: '',
    desc: '',
    price: '',
    badges: '',
    note: '',
    cover: '',
    coverFit: 'cover',
    coverRatio: '1:1',
    focalX: 50,
    focalY: 50,
    span: span || 1,
  };
}

/** 全新项目：内容全部留空，只有结构与中性占位 */
export function createDefaultState(docLang) {
  const lang = DOC_LANGS.includes(docLang) ? docLang : 'ja';
  return {
    schema: SCHEMA,
    meta: { name: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    uiLang: null,     // null 表示尚未决定，由启动逻辑按浏览器语言判定
    docLang: lang,
    layout: JSON.parse(JSON.stringify(DEFAULT_LAYOUT)),
    theme: Object.assign({}, NEUTRAL_PALETTE, {
      decor: { type: 'none', opacity: 0.5, density: 1 },
    }),
    fonts: defaultFontsFor(lang),
    header: { event: '', circle: '', booth: '', banner: '' },
    blocks: [
      { id: 'b-header', kind: 'header', visible: true },
      { id: 'b-main', kind: 'section', sectionId: 'main', visible: true },
      { id: 'b-cons', kind: 'section', sectionId: 'cons', visible: true },
      { id: 'b-footer', kind: 'footer', visible: true },
    ],
    sections: [
      newSection('main', 'RELEASE', 'doc.sectionMainSub'),
      newSection('cons', 'CONSIGNMENT', 'doc.sectionConsSub'),
    ],
    footer: { left: '', right: '© {year} {circle}' },
    export: { mode: 'scale', scale: 3, targetWidth: 2480, prefix: '' },
  };
}

function num(v, fallback, min, max) {
  const n = Number(v);
  if (!isFinite(n)) return fallback;
  if (min !== undefined && n < min) return min;
  if (max !== undefined && n > max) return max;
  return n;
}

function clampEnum(v, allowed, fallback) {
  return allowed.includes(v) ? v : fallback;
}

function hex(v, fallback) {
  const s = String(v == null ? '' : v).trim();
  return /^#[0-9a-f]{3,8}$/i.test(s) ? s : fallback;
}

/**
 * 结构校验：把任意来源的数据补齐成合法状态。
 * 只做校验与补全，不改写用户填写的文字内容。
 */
export function normalize(input) {
  const raw = input && typeof input === 'object' ? input : {};
  const docLang = clampEnum(raw.docLang, DOC_LANGS, 'ja');
  const base = createDefaultState(docLang);

  const layout = Object.assign({}, base.layout, raw.layout || {});
  const pad = Object.assign({}, base.layout.padding, (raw.layout && raw.layout.padding) || {});
  layout.padding = {
    t: num(pad.t, base.layout.padding.t, ...LAYOUT_LIMITS.padding),
    r: num(pad.r, base.layout.padding.r, ...LAYOUT_LIMITS.padding),
    b: num(pad.b, base.layout.padding.b, ...LAYOUT_LIMITS.padding),
    l: num(pad.l, base.layout.padding.l, ...LAYOUT_LIMITS.padding),
  };
  layout.width = num(layout.width, base.layout.width, 200, 10000);
  layout.height = (layout.height === 'auto' || layout.height == null)
    ? 'auto'
    : num(layout.height, 'auto', 200, 20000);
  layout.columns = num(layout.columns, base.layout.columns, 1, 4);
  layout.gapX = num(layout.gapX, base.layout.gapX, ...LAYOUT_LIMITS.gap);
  layout.gapY = num(layout.gapY, base.layout.gapY, ...LAYOUT_LIMITS.gap);
  layout.sectionGap = num(layout.sectionGap, base.layout.sectionGap, ...LAYOUT_LIMITS.sectionGap);
  layout.baseSize = num(layout.baseSize, base.layout.baseSize, ...LAYOUT_LIMITS.baseSize);
  layout.scaleWithWidth = layout.scaleWithWidth !== false;
  // 等比缩放会带出 46.85138… 这类长小数，面板里读不下去，统一收敛到合理精度
  layout.width = Math.round(layout.width);
  if (layout.height !== 'auto') layout.height = Math.round(layout.height);
  ['t', 'r', 'b', 'l'].forEach(k => { layout.padding[k] = Math.round(layout.padding[k]); });
  layout.gapX = Math.round(layout.gapX);
  layout.gapY = Math.round(layout.gapY);
  layout.sectionGap = Math.round(layout.sectionGap);
  layout.baseSize = Math.round(layout.baseSize * 10) / 10;

  const theme = Object.assign({}, base.theme, raw.theme || {});
  PALETTE_KEYS.forEach(k => { theme[k] = hex(theme[k], base.theme[k]); });
  const decorRaw = (raw.theme && raw.theme.decor) || {};
  theme.decor = {
    type: clampEnum(decorRaw.type, DECOR_TYPES, 'none'),
    opacity: num(decorRaw.opacity, 0.5, 0, 1),
    density: num(decorRaw.density, 1, 0.5, 3),
  };

  const fonts = Object.assign({}, base.fonts, raw.fonts || {});
  fonts.base = clampEnum(fonts.base, FONT_KEYS, base.fonts.base);
  fonts.display = clampEnum(fonts.display, FONT_KEYS, base.fonts.display);
  fonts.scale = num(fonts.scale, 100, 50, 200);
  fonts.localName = typeof fonts.localName === 'string' ? fonts.localName : '';

  const exportCfg = Object.assign({}, base.export, raw.export || {});
  exportCfg.mode = clampEnum(exportCfg.mode, ['scale', 'width'], 'scale');
  exportCfg.scale = num(exportCfg.scale, 3, 1, 6);
  exportCfg.targetWidth = num(exportCfg.targetWidth, 2480, 200, 20000);
  exportCfg.prefix = typeof exportCfg.prefix === 'string' ? exportCfg.prefix : '';

  const header = Object.assign({}, base.header, raw.header || {});
  const footer = Object.assign({}, base.footer, raw.footer || {});

  // 区块顺序：以保存的顺序为准，但补齐缺失的区块、剔除失效引用
  const knownKinds = ['header', 'footer'];
  let blocks = Array.isArray(raw.blocks) ? raw.blocks.filter(b => b && knownKinds.includes(b.kind) || (b && b.kind === 'section' && b.sectionId)) : [];
  if (!blocks.length) blocks = JSON.parse(JSON.stringify(base.blocks));

  let sections = Array.isArray(raw.sections) ? raw.sections : [];
  sections = sections.filter(s => s && typeof s === 'object').map(s => ({
    id: typeof s.id === 'string' && s.id ? s.id : uid('sec'),
    titleEn: typeof s.titleEn === 'string' ? s.titleEn : '',
    titleSub: typeof s.titleSub === 'string' ? s.titleSub : '',
    items: Array.isArray(s.items) ? s.items.map(normalizeItem) : [],
  }));
  if (!sections.length) sections = JSON.parse(JSON.stringify(base.sections));

  // 确保每个区块引用的 section 都存在；确保每个 section 都有一个区块
  const sectionIds = sections.map(s => s.id);
  blocks = blocks.filter(b => b.kind !== 'section' || sectionIds.includes(b.sectionId));
  sections.forEach(s => {
    if (!blocks.some(b => b.kind === 'section' && b.sectionId === s.id)) {
      blocks.push({ id: uid('b'), kind: 'section', sectionId: s.id, visible: true });
    }
  });
  if (!blocks.some(b => b.kind === 'header')) blocks.unshift({ id: 'b-header', kind: 'header', visible: true });
  if (!blocks.some(b => b.kind === 'footer')) blocks.push({ id: 'b-footer', kind: 'footer', visible: true });
  blocks = blocks.map(b => ({
    id: b.id || uid('b'),
    kind: b.kind,
    sectionId: b.sectionId,
    visible: b.visible !== false,
  }));

  return {
    schema: SCHEMA,
    meta: {
      name: typeof (raw.meta && raw.meta.name) === 'string' ? raw.meta.name : '',
      createdAt: (raw.meta && raw.meta.createdAt) || base.meta.createdAt,
      updatedAt: new Date().toISOString(),
    },
    uiLang: UI_LANGS.includes(raw.uiLang) ? raw.uiLang : null,
    docLang,
    layout,
    theme,
    fonts,
    header: {
      event: str(header.event), circle: str(header.circle),
      booth: str(header.booth), banner: str(header.banner),
    },
    blocks,
    sections,
    footer: { left: str(footer.left), right: str(footer.right) },
    export: exportCfg,
  };
}

function str(v) { return typeof v === 'string' ? v : (v == null ? '' : String(v)); }

function normalizeItem(it) {
  const o = it && typeof it === 'object' ? it : {};
  return {
    id: typeof o.id === 'string' && o.id ? o.id : uid('item'),
    title: str(o.title),
    subtitle: str(o.subtitle),
    desc: str(o.desc),
    price: str(o.price),
    badges: str(o.badges),
    note: str(o.note),
    cover: str(o.cover),
    coverFit: clampEnum(o.coverFit, COVER_FITS, 'cover'),
    coverRatio: clampEnum(o.coverRatio, COVER_RATIOS, '1:1'),
    focalX: num(o.focalX, 50, 0, 100),
    focalY: num(o.focalY, 50, 0, 100),
    span: num(o.span, 1, 1, 4),
  };
}

/** 找到浏览器里可能存在的旧版存档键（不写死具体键名） */
export function findLegacyKey(storage) {
  try {
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.indexOf(LEGACY_KEY_MARKER) !== -1) return k;
    }
  } catch (e) { /* 隐私模式等场景忽略 */ }
  return null;
}

/**
 * 旧版（单文件 v4.x）存档 → 新版结构
 * 用户已填写的内容原样保留，只做结构映射。
 */
export function migrateLegacy(old) {
  if (!old || typeof old !== 'object') return null;
  const columns = DEFAULT_LAYOUT.columns;
  const widthToSpan = w => {
    if (w === 'w-full') return columns;
    if (w === 'w-third') return Math.max(1, Math.round(columns / 3));
    return Math.max(1, Math.round(columns / 2)); // w-half 或未指定
  };
  const fontMap = {
    'noto-jp': 'sans-jp', 'noto-sc': 'sans-sc',
    'noto-serif-jp': 'serif-jp', 'noto-serif-sc': 'serif-sc',
    'zen': 'sans-jp', 'mincho': 'serif-jp', 'alimama': 'local',
  };
  const docFont = fontMap[old.docFont] || 'sans-jp';
  const docLang = String(old.docFont || '').indexOf('-sc') !== -1 ? 'zh' : 'ja';

  const next = createDefaultState(docLang);
  const oldProducts = Array.isArray(old.products) ? old.products : [];
  const pick = type => oldProducts.filter(p => (p && p.type ? p.type : 'main') === type).map(p => ({
    id: uid('item'),
    title: str(p.title),
    subtitle: str(p.subTitle),
    desc: str(p.desc),
    price: str(p.price),
    badges: str(p.tags),
    note: str(p.note),
    cover: str(p.img),
    coverFit: 'cover',
    coverRatio: '1:1',
    focalX: 50,
    focalY: 50,
    span: widthToSpan(p.width),
  }));
  next.sections[0].items = pick('main');
  next.sections[1].items = pick('cons');

  if (typeof old.mainEn === 'string' && old.mainEn) next.sections[0].titleEn = old.mainEn;
  if (typeof old.mainJp === 'string' && old.mainJp) next.sections[0].titleSub = old.mainJp;
  if (typeof old.consEn === 'string' && old.consEn) next.sections[1].titleEn = old.consEn;
  if (typeof old.consJp === 'string' && old.consJp) next.sections[1].titleSub = old.consJp;

  next.header.event = str(old.event);
  next.header.circle = str(old.circle);
  next.header.booth = str(old.booth);
  next.header.banner = str(old.bannerImage);
  next.footer.left = str(old.footerEn);
  next.footer.right = str(old.footerJp);

  if (old.headerBg) next.theme.headerBg = hex(old.headerBg, next.theme.headerBg);
  if (old.headerText) next.theme.headerText = hex(old.headerText, next.theme.headerText);

  next.fonts.base = docFont;
  next.fonts.display = docFont === 'sans-sc' ? 'serif-sc' : (docFont === 'serif-sc' ? 'serif-sc' : (docFont === 'serif-jp' ? 'serif-jp' : 'sans-jp'));
  if (old.exportScale) next.export.scale = num(old.exportScale, 3, 1, 6);

  next.uiLang = old.uiLang === 'ja' ? 'ja' : 'zh';
  return normalize(next);
}
