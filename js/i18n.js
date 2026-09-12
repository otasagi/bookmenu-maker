/**
 * 多语言引擎
 *
 * 两套语言各司其职、互不影响：
 * - uiLang  ：编辑器界面文案（按钮、标签、提示）
 * - docLang ：品书内容语言（画布占位提示、价格与日期格式、导出文件名用语）
 *
 * 关键点：中文界面下也完全可以做日文品书，反之亦然。反过来也一样，
 * 切换界面语言永远不会改动用户写下的内容。
 */
import zh from '../i18n/zh.js';
import ja from '../i18n/ja.js';

export const UI_LANGS = ['ja', 'zh'];
export const DOC_LANGS = ['ja', 'zh'];

const DICTS = { zh, ja };

let uiLang = 'zh';
let docLang = 'ja';

/** 依据浏览器语言判断首次打开用哪种界面语言（日语优先判定） */
export function detectUiLang() {
  const list = (navigator.languages && navigator.languages.length)
    ? navigator.languages
    : [navigator.language || ''];
  for (const raw of list) {
    const tag = String(raw || '').toLowerCase();
    if (tag.startsWith('ja')) return 'ja';
    if (tag.startsWith('zh')) return 'zh';
  }
  return 'zh';
}

export function setUiLang(lang) {
  uiLang = UI_LANGS.includes(lang) ? lang : 'zh';
  return uiLang;
}

export function setDocLang(lang) {
  docLang = DOC_LANGS.includes(lang) ? lang : 'ja';
  return docLang;
}

export function getUiLang() { return uiLang; }
export function getDocLang() { return docLang; }

/** 界面文案 */
export function t(key, vars) {
  return interpolate(pick(DICTS[uiLang], key), vars);
}

/** 画布内容文案（跟随内容语言） */
export function td(key, vars) {
  return interpolate(pick(DICTS[docLang], key), vars);
}

function pick(dict, key) {
  if (dict && dict[key] !== undefined) return dict[key];
  // 缺失时回退到中文词条，并提示开发者补齐另一份语言文件
  if (zh[key] !== undefined) return zh[key];
  if (typeof console !== 'undefined') console.warn('[i18n] 缺少词条:', key);
  return key;
}

function interpolate(str, vars) {
  let s = String(str == null ? '' : str);
  if (vars) {
    for (const k in vars) s = s.split('{' + k + '}').join(String(vars[k]));
  }
  return s;
}

/**
 * 把界面语言应用到 DOM。
 * 支持 data-i18n（文本）、data-i18n-ph（placeholder）、
 * data-i18n-title（title）、data-i18n-aria（aria-label）。
 */
export function applyI18n(root) {
  const scope = root || document;
  scope.querySelectorAll('[data-i18n]').forEach(node => {
    node.textContent = t(node.getAttribute('data-i18n'));
  });
  scope.querySelectorAll('[data-i18n-ph]').forEach(node => {
    node.setAttribute('placeholder', t(node.getAttribute('data-i18n-ph')));
  });
  scope.querySelectorAll('[data-i18n-title]').forEach(node => {
    node.setAttribute('title', t(node.getAttribute('data-i18n-title')));
  });
  scope.querySelectorAll('[data-i18n-aria]').forEach(node => {
    node.setAttribute('aria-label', t(node.getAttribute('data-i18n-aria')));
  });
  // 修正 lang 属性：中文界面必须是 zh-Hans，而不是 ja
  document.documentElement.lang = uiLang === 'ja' ? 'ja' : 'zh-Hans';
}

/** 开发期校验：两份语言文件的键集合必须一致 */
export function checkKeys() {
  const zhKeys = Object.keys(zh);
  const jaKeys = Object.keys(ja);
  const missingInJa = zhKeys.filter(k => !(k in ja));
  const missingInZh = jaKeys.filter(k => !(k in zh));
  if (missingInJa.length || missingInZh.length) {
    console.warn('[i18n] 语言文件不一致',
      { 缺少日文: missingInJa, 缺少中文: missingInZh });
  }
  return { missingInJa, missingInZh };
}

/** 用于导出文件名的语言标签（跟随内容语言） */
export function docLabel(key) {
  return td(key);
}
