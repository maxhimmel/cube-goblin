import type { Plugin } from "vite";

const MANA_CSS = /mana-font[\\/]css[\\/]mana\.css$/u;
const FONT_FACE = /@font-face\s*\{[^}]*\}/gu;

export function manaFontWoff2Only(): Plugin {
  return {
    name: "repo:mana-font-woff2-only",
    enforce: "pre",
    transform(code, id) {
      return MANA_CSS.test(id.split("?")[0] ?? id) ? code.replace(FONT_FACE, "") : undefined;
    },
  };
}
