/**
 * 内置主题包：配色 + 推荐背景装饰 + 推荐字体配对
 *
 * 一套主题就是一次完整的观感切换，所以除了 11 个颜色，还带上：
 * - decor：套用时一并写入背景装饰（类型 / 浓度 / 疏密）
 * - fonts：写成「角色」而不是具体字体键，套用时再按内容语言解析，
 *          这样同一套主题在日文与简体中文品书上都能落到对的字体。
 *
 * 中性 / 夜空粉紫两套颜色值来自 state.js，保持与旧版完全一致。
 */
import { NEUTRAL_PALETTE, SKY_PALETTE } from './state.js';

/** 颜色键 → 出厂值的对照，新增主题照这个顺序写即可 */
const preset = (id, colors, decor, fonts) => ({
  id,
  nameKey: 'theme.preset.' + id,
  colors,
  decor,
  fonts,
});

export const THEME_PRESETS = [
  preset('neutral', NEUTRAL_PALETTE,
    { type: 'none', opacity: 0.5, density: 1 },
    { base: 'sans', display: 'serif' }),
  preset('sky', SKY_PALETTE,
    { type: 'constellation', opacity: 0.5, density: 1 },
    { base: 'sans', display: 'serif' }),

  /* ---------- 浅色 ---------- */

  preset('washi', {
    bg: '#f6f1e7', cardBg: '#fffdf8', cardBorder: '#e2d9c8',
    title: '#2f2a24', body: '#4a443b', muted: '#8d8272', accent: '#b4442f',
    headerBg: '#2f2a24', headerText: '#f6f1e7',
    footerBg: '#efe7d8', footerText: '#6e6656',
  }, { type: 'none', opacity: 0.5, density: 1 }, { base: 'sans', display: 'serif' }),

  preset('sumi', {
    bg: '#f2f2f2', cardBg: '#ffffff', cardBorder: '#dedede',
    title: '#141414', body: '#3a3a3a', muted: '#8c8c8c', accent: '#b03a2e',
    headerBg: '#1a1a1a', headerText: '#ffffff',
    footerBg: '#ececec', footerText: '#6b6b6b',
  }, { type: 'none', opacity: 0.5, density: 1 }, { base: 'sans', display: 'serif' }),

  preset('sakura', {
    bg: '#fceef1', cardBg: '#ffffff', cardBorder: '#f2d7de',
    title: '#4a2b33', body: '#5c4149', muted: '#a1868e', accent: '#d05b7d',
    headerBg: '#8c4359', headerText: '#fff5f7',
    footerBg: '#f9e6ea', footerText: '#855e68',
  }, { type: 'none', opacity: 0.5, density: 1 }, { base: 'sans', display: 'maru' }),

  preset('mint', {
    bg: '#edf6f2', cardBg: '#ffffff', cardBorder: '#d5e8e1',
    title: '#17332c', body: '#2f4f47', muted: '#74908a', accent: '#12886f',
    headerBg: '#14503f', headerText: '#eafaf4',
    footerBg: '#e6f2ee', footerText: '#557069',
  }, { type: 'grid', opacity: 0.4, density: 1 }, { base: 'sans', display: 'sans' }),

  preset('citrus', {
    bg: '#fff0d8', cardBg: '#ffffff', cardBorder: '#f4e0c8',
    title: '#402a12', body: '#57402a', muted: '#9c8569', accent: '#d2691e',
    headerBg: '#45301b', headerText: '#fff4e4',
    footerBg: '#fdf1e0', footerText: '#82694e',
  }, { type: 'diagonal', opacity: 0.35, density: 1 }, { base: 'sans', display: 'sans' }),

  preset('lavender', {
    bg: '#f4f0fa', cardBg: '#ffffff', cardBorder: '#e3daf2',
    title: '#322445', body: '#4a3d5d', muted: '#9082a8', accent: '#7c5cc4',
    headerBg: '#4a3670', headerText: '#f3ecff',
    footerBg: '#efe9f8', footerText: '#6f6285',
  }, { type: 'constellation', opacity: 0.45, density: 1 }, { base: 'sans', display: 'serif' }),

  /* ---------- 深色 ---------- */

  preset('midnight', {
    bg: '#141a26', cardBg: '#1d2637', cardBorder: '#313d55',
    title: '#eef2fa', body: '#c8d2e4', muted: '#8b98b0', accent: '#d8b26a',
    headerBg: '#0e131c', headerText: '#eef2fa',
    footerBg: '#0e131c', footerText: '#8b98b0',
  }, { type: 'constellation', opacity: 0.5, density: 1 }, { base: 'sans', display: 'serif' }),

  preset('forest', {
    bg: '#16211c', cardBg: '#1f2d26', cardBorder: '#33463c',
    title: '#eaf2ec', body: '#c2d3c8', muted: '#8aa294', accent: '#d7c37a',
    headerBg: '#101815', headerText: '#eaf2ec',
    footerBg: '#101815', footerText: '#8aa294',
  }, { type: 'diagonal', opacity: 0.4, density: 1 }, { base: 'sans', display: 'serif' }),

  preset('charcoal', {
    bg: '#17171a', cardBg: '#202024', cardBorder: '#34343a',
    title: '#f4f4f6', body: '#c9c9d0', muted: '#8b8b94', accent: '#22d3c5',
    headerBg: '#0f0f12', headerText: '#f4f4f6',
    footerBg: '#0f0f12', footerText: '#8b8b94',
  }, { type: 'grid', opacity: 0.35, density: 1.2 }, { base: 'sans', display: 'sans' }),

  preset('yozakura', {
    bg: '#1f1622', cardBg: '#2b1f2e', cardBorder: '#453449',
    title: '#f6e9f1', body: '#d7c3d3', muted: '#9d8899', accent: '#f0a0c0',
    headerBg: '#150f17', headerText: '#f6e9f1',
    footerBg: '#150f17', footerText: '#9d8899',
  }, { type: 'constellation', opacity: 0.5, density: 1 }, { base: 'sans', display: 'serif' }),
];

/** 浅色主题（色卡分组用） */
export const LIGHT_PRESET_IDS = ['neutral', 'washi', 'sumi', 'sakura', 'mint', 'citrus', 'lavender'];
/** 深色主题（色卡分组用） */
export const DARK_PRESET_IDS = ['sky', 'midnight', 'forest', 'charcoal', 'yozakura'];

/**
 * 主题里的字体「角色」→ 实际字体键。
 * 圆体只有日文版，中文内容下回退黑体。
 */
export function resolvePackFonts(pack, docLang) {
  const want = (pack && pack.fonts) || {};
  const zh = docLang === 'zh';
  const base = want.base === 'serif' ? (zh ? 'serif-sc' : 'serif-jp') : (zh ? 'sans-sc' : 'sans-jp');
  let display;
  if (want.display === 'serif') display = zh ? 'serif-sc' : 'serif-jp';
  else if (want.display === 'maru') display = zh ? 'sans-sc' : 'maru-jp';
  else if (want.display === 'sans') display = zh ? 'sans-sc' : 'sans-jp';
  else display = null;
  return { base, display };
}

export function findPreset(id) {
  return THEME_PRESETS.find(p => p.id === id) || null;
}
