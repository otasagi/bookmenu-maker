/**
 * 校验内置主题的可读性：node tools/check-palettes.mjs
 *
 * 品书是给人扫一眼就下单的，颜色再好看也不能读不清。
 * 这里按 WCAG 相对亮度算对比度：正文与文字取 4.5，
 * 次要文字与强调色放宽到 3.2 / 3.0。有任何一项不达标就退出码 1。
 */
import { THEME_PRESETS } from '../js/palettes.js';

/** 旧版就有的两套配色：颜色值一律不改动（改了下单的人和已发的图就对不上了），
 *  这里只把实测值打出来备查，不计入失败。 */
const LEGACY = ['neutral', 'sky'];

const CHECKS = [
  ['主标题', 'title', 'cardBg', 4.5],
  ['正文', 'body', 'cardBg', 4.5],
  ['次要文字', 'muted', 'cardBg', 3.2],
  ['强调色', 'accent', 'cardBg', 3.0],
  ['主标题/页面底色', 'title', 'bg', 4.5],
  ['刊头文字', 'headerText', 'headerBg', 4.5],
  ['页脚文字', 'footerText', 'footerBg', 4.5],
];

function channel(c) {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function luminance(hex) {
  const h = String(hex).replace('#', '');
  return 0.2126 * channel(parseInt(h.slice(0, 2), 16)) +
    0.7152 * channel(parseInt(h.slice(2, 4), 16)) +
    0.0722 * channel(parseInt(h.slice(4, 6), 16));
}

function ratio(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

let failed = 0;
for (const pack of THEME_PRESETS) {
  const legacy = LEGACY.includes(pack.id);
  const bad = [];
  for (const [label, a, b, min] of CHECKS) {
    const r = ratio(pack.colors[a], pack.colors[b]);
    if (r < min) bad.push(label + ' ' + r.toFixed(2) + ' < ' + min);
  }
  if (bad.length) {
    if (legacy) console.log('· ' + pack.id.padEnd(10) + '沿用旧版值：' + bad.join('  '));
    else {
      failed++;
      console.log('✗ ' + pack.id.padEnd(10) + bad.join('  '));
    }
  } else {
    console.log('✓ ' + pack.id);
  }
}

console.log('\n' + THEME_PRESETS.length + ' 套主题，新增 ' + failed + ' 套未达标');
process.exit(failed ? 1 : 0);
