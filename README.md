# Book Menu Maker

A layout tool for doujin event price sheets (品書き / 品书). Enter the event details and a
product list, preview the sheet live, and export a single high-resolution PNG suitable for
social media or print.

The interface language and the document language are independent: a Japanese sheet can be
produced from the Chinese interface and vice versa.

---

## Getting started

This is a static site. No build step is required.

```bash
# Local preview (ES modules require HTTP; opening index.html directly does not work)
npx serve .
# or
python3 -m http.server 8000
```

Open the address printed by the server.

### First use

1. Fill in the header under **Structure** in the left column: event name, circle name, booth number.
2. Add products to each section, then edit title, price, description and cover image in the right panel.
3. Select a theme under **Appearance**, or adjust the colours and background decoration manually.
   Canvas width, column count and spacing are set under **Layout**.
4. Select **Export PNG** in the top bar to obtain the finished image.

---

## Features

### Canvas and layout

The canvas is not tied to any paper size. Width, height, margins, column count (1–4),
row and column spacing and section spacing are all adjustable.

Height can be set to follow the content or to a fixed value. When the height is fixed and the
content does not fit, an overflow indicator appears above the canvas. **Auto-fit** then reduces
the type size first and the spacing second, down to defined lower limits. If the content still
does not fit, the operation is reverted in full and manual adjustment is requested; the layout
is never modified without notice.

Cards are placed according to the column count. When the last row is not full — for example
three products in a two-column sheet — the last row expands to fill the width, and a single
remaining card becomes a wide card with the cover on the left and the text on the right.
This behaviour can be disabled under **Layout**. A row that contains a manually widened card
is left unchanged.

### Themes

Colours are driven by a set of variables: page background, card background and border, heading,
body and secondary text, accent, header background and text, footer background and text.

Twelve built-in themes are provided. Each combines a colour set, a background decoration and a
font pairing, so that a single selection changes the complete appearance:

- **Light** — Neutral (default), Washi, Sumi, Sakura, Mint, Citrus, Lavender
- **Dark** — Night Sky, Midnight, Forest, Charcoal, Night Sakura

Applying a theme can also apply its recommended font pairing; this can be disabled. Rounded
gothic pairings apply only when the document language is Japanese, and fall back to a sans-serif
for Chinese content.

Individual colours, the background decoration and the fonts remain editable after a theme has
been applied. The current appearance can be saved as a custom theme and applied again later;
entries saved by earlier versions, which stored colours only, remain usable.

Background decoration is also available independently of the themes: none, constellation,
fine grid and diagonal hatching, with adjustable intensity and density.

The contrast of the built-in themes can be verified:

```bash
node tools/check-palettes.mjs
```

### Fonts

Fonts are resolved from three sources, in order:

1. **Bundled with the project** (`assets/fonts/`) — Noto Sans JP, Noto Serif JP, Noto Sans SC and
   Noto Serif SC, licensed under the SIL Open Font License 1.1 and redistributable with the project.
2. **Installed system fonts** — referenced by family name (PingFang, Hiragino, Yu Gothic, Songti and
   others), requiring no download.
3. **Local font files** — a `.ttf`, `.otf`, `.woff` or `.woff2` file selected by the user, stored in
   the browser's IndexedDB and retained between sessions.

Japanese typesetting enables kinsoku processing (`line-break: strict`) and proportional kana (`palt`).

### Languages

- **Interface language**: Chinese or Japanese. Determined from the browser language on first run and
  remembered afterwards.
- **Document language**: determines the placeholders shown on the canvas, price formatting
  (`1,000円` or `¥1,000`) and the wording used in export file names (品書 or 品书).
- Changing either language never rewrites content that has already been entered.
- Conversion of Japanese source text to Simplified Chinese is a manual action. It is available only
  when the document language is Simplified Chinese, and it can be undone.

### Saving and project files

- Content is saved automatically in the local browser.
- **Project files** (`.json`) contain all text, images and colours. They can be used for backup, for
  moving to another computer or for handing the project to someone else. Data saved by the previous
  single-file version can be imported.
- If browser storage is exhausted, which typically happens when many images are used, the editor
  reports the condition and prompts for a project file export instead of discarding images silently.

### Export

The sheet is exported as a **single PNG**. The size can be specified either by a scale factor
(1×–4×) or by a target width in pixels, and the panel displays the resulting pixel dimensions and an
estimated file size.

An **outer margin**, given in canvas pixels, adds a blank border around the exported image. It scales
with the export factor and is filled with the page background colour; a value of zero disables it.
This prevents the header and footer from touching the edges when the image is posted to social media.

Large canvases are rendered in tiles and stitched together, which avoids the per-canvas size limits
imposed by browsers. The result is always a single image. The placeholder hints and selection
outlines shown in the editor are not included in the export, and a section that contains no products
is omitted entirely.

---

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `⌘/Ctrl + Z` | Undo |
| `⌘/Ctrl + Shift + Z` | Redo |
| `⌘/Ctrl + S` | Export project file |
| `⌘/Ctrl + E` | Export PNG |

An image file dragged onto a card sets its cover; dropped on the header area it becomes the banner.
With a card selected, an image can also be pasted from the clipboard.

---

## Project structure

```
index.html                 entry point
js/                        application modules
  main.js                  wiring and event handling
  state.js                 state model, defaults, legacy migration
  store.js                 local storage, project files, undo stack
  render.js                canvas rendering and placeholder rules
  editor.js                outline (left column) and inspector (right column)
  layout.js                layout variables, overflow detection, auto-fit
  theme.js                 colour variables, background decoration, custom themes
  palettes.js              the twelve built-in themes
  fonts.js                 font catalogue and local fonts (IndexedDB)
  export.js                tiled rendering and PNG export
  image.js                 image downscaling
  convert.js               Japanese to Simplified Chinese term mapping
i18n/                      Chinese and Japanese string tables
styles/                    editor and canvas stylesheets
vendor/                    bundled html2canvas
assets/fonts/              bundled fonts and fonts.css
assets/icon.svg            site icon (browser tab and bookmarks)
assets/icon-32.png         bitmap icon fallback
assets/icon-180.png        bitmap icon fallback (iOS home screen)
tools/fetch-fonts.mjs      fetch fonts and regenerate fonts.css
tools/check-palettes.mjs   contrast check for the built-in themes
legacy/                    previous single-file version (fallback only, excluded from releases)
```

---

## Deployment

The site is entirely static and uses only relative paths, so it can be published from a repository
subpath without further configuration. See [DEPLOY.md](DEPLOY.md) for the available options,
including the GitHub Pages requirements and the cache-busting version check used by the editor.

### Regenerating fonts

```bash
node tools/fetch-fonts.mjs
```

The script skips files that already exist, retrieves only the missing ones, and regenerates
`assets/fonts/fonts.css`.

---

## Defaults

A new project contains no sample content. Product names, circle name, booth number, event dates,
venue, URLs and copyright lines are all empty and display neutral structural placeholders. These
placeholders are visible only in the editor and are not included in the exported image.

---

## Licensing

The bundled Noto Sans JP, Noto Serif JP, Noto Sans SC and Noto Serif SC fonts are licensed under the
**SIL Open Font License 1.1**, which permits redistribution with the project. The bundled
html2canvas library is licensed under the MIT License.

System fonts (PingFang, Hiragino, Yu Gothic and others) and fonts loaded by the user are not
distributed with the project and are used only on the machine where they are installed.
