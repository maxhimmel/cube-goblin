# Mana font

Researched 2026-11-09 for mana symbols in the web app. Sources: [mana.andrewgioia.com](https://mana.andrewgioia.com/), [icons](https://mana.andrewgioia.com/icons.html), [attributes](https://mana.andrewgioia.com/attributes.html), [README](https://github.com/andrewgioia/mana), and the installed `mana-font` 1.18.0 CSS.

- **Package**: npm `mana-font`, CSS at `css/mana.css`. Fonts: SIL OFL 1.1. CSS/LESS/Sass: MIT. Symbol art: Wizards of the Coast.
- **Markup**: `<i class="ms ms-g ms-cost">`. `ms-cost` draws the round cost background; `ms-shadow` adds a shadow; `ms-2x`…`ms-6x` are sizes (so `ms-2x` is a size, not a {2/X} symbol).
- **Class names**: the Scryfall symbol, lowercase, with slashes removed: `{W/U}` → `ms-wu`, `{2/W}` → `ms-2w`, `{G/P}` → `ms-gp`. Exceptions checked in the CSS: `{T}` → `ms-tap`, `{Q}` → `ms-untap`, `{E}` → `ms-e`, `{∞}` → `ms-infinity`, `{½}` → `ms-1-2`, `{CHAOS}` → `ms-chaos`. `ms-half` is a modifier, not a glyph: half mana `{HW}` is `ms-w ms-half`. Also `ms-multicolor`. The mapping lives in `apps/web/src/mana.tsx`.
- **Accessibility**: the docs give no guidance. The app wraps a cost in `role="img"` with an `aria-label`.
- **Single-file build**: `mana.css` declares eot, woff, ttf and svg fonts (about 3.3 MB) and no woff2. The share doc inlines every referenced font, so `apps/web/server/mana-font-plugin.ts` strips the package's `@font-face` rules and `apps/web/src/mana.css` declares a woff2-only face (187 KB). The package CSS must be imported from JS, not with CSS `@import`, or the strip is skipped. `e2e/share-doc.spec.ts` asserts only woff2 is inlined.
