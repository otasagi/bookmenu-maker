#!/usr/bin/env node
/**
 * 下载项目自带的字体文件并生成 assets/fonts/fonts.css
 *
 *   node tools/fetch-fonts.mjs
 *
 * 只下载许可允许再分发的字体（Noto 系列为 SIL Open Font License 1.1）。
 * 下载后页面不再依赖任何外部 CDN：离线也能保持字形一致。
 */
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'assets', 'fonts');
const CDN = 'https://cdn.jsdelivr.net/npm';
const VERSION = '5.3.0';

const LATIN_RANGE = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const JP_RANGE = 'U+3000-30FF,U+3190-319F,U+31F0-31FF,U+3400-4DBF,U+4E00-9FFF,U+F900-FAFF,U+FF00-FFEF,U+20000-2FFFF';
const SC_RANGE = 'U+2E80-2EFF,U+3000-303F,U+31C0-31EF,U+3400-4DBF,U+4E00-9FFF,U+F900-FAFF,U+FE30-FE4F,U+FF00-FFEF,U+20000-2FFFF';

/** 样式里使用的字族名 → fontsource 包名与子集 */
const FAMILIES = [
  { cssName: 'Noto Sans JP', pkg: '@fontsource/noto-sans-jp', base: 'noto-sans-jp', subsets: [['japanese', JP_RANGE], ['latin', LATIN_RANGE]] },
  { cssName: 'Noto Serif JP', pkg: '@fontsource/noto-serif-jp', base: 'noto-serif-jp', subsets: [['japanese', JP_RANGE], ['latin', LATIN_RANGE]] },
  { cssName: 'Noto Sans SC', pkg: '@fontsource/noto-sans-sc', base: 'noto-sans-sc', subsets: [['chinese-simplified', SC_RANGE], ['latin', LATIN_RANGE]] },
  { cssName: 'Noto Serif SC', pkg: '@fontsource/noto-serif-sc', base: 'noto-serif-sc', subsets: [['chinese-simplified', SC_RANGE], ['latin', LATIN_RANGE]] },
];

const WEIGHTS = [400, 700, 900];

async function exists(path) {
  try { const s = await stat(path); return s.size > 1024; } catch (e) { return false; }
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.status + ' ' + url);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const faces = [];
  const failures = [];
  let downloaded = 0;
  let skipped = 0;

  for (const family of FAMILIES) {
    for (const [subset, range] of family.subsets) {
      for (const weight of WEIGHTS) {
        const file = family.base + '-' + subset + '-' + weight + '-normal.woff2';
        const dest = join(OUT_DIR, file);
        const url = CDN + '/' + family.pkg + '@' + VERSION + '/files/' + file;
        if (await exists(dest)) {
          skipped++;
        } else {
          try {
            await download(url, dest);
            downloaded++;
            process.stdout.write('.');
          } catch (err) {
            failures.push(file + '  (' + err.message + ')');
            continue;
          }
        }
        faces.push(
          '@font-face {\n' +
          '  font-family: \'' + family.cssName + '\';\n' +
          '  font-style: normal;\n' +
          '  font-weight: ' + weight + ';\n' +
          '  font-display: swap;\n' +
          '  src: url(\'./' + file + '\') format(\'woff2\');\n' +
          '  unicode-range: ' + range + ';\n' +
          '}'
        );
      }
    }
  }

  const header = [
    '/* 由 tools/fetch-fonts.mjs 生成，请勿手工编辑。',
    ' * 字体：Noto Sans JP / Noto Serif JP / Noto Sans SC / Noto Serif SC',
    ' * 许可：SIL Open Font License 1.1（允许随项目再分发）',
    ' * 未执行过该脚本时本文件为空，页面会自动回退到系统已安装的字体。',
    ' */',
    '',
  ].join('\n');

  await writeFile(join(OUT_DIR, 'fonts.css'), header + faces.join('\n\n') + '\n', 'utf8');

  process.stdout.write('\n');
  console.log('已写入 assets/fonts/fonts.css');
  console.log('  新下载 ' + downloaded + ' 个，已存在 ' + skipped + ' 个，共 ' + faces.length + ' 条 @font-face');
  if (failures.length) {
    console.log('  失败 ' + failures.length + ' 个：');
    failures.forEach(f => console.log('    - ' + f));
  }
}

main().catch(err => {
  console.error('字体获取失败：', err.message);
  process.exitCode = 1;
});
