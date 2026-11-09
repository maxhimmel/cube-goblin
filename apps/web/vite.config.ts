import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { manaFontWoff2Only } from "./server/mana-font-plugin.ts";
import { workbench } from "./server/workbench-plugin.ts";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig(({ command }) => ({
  plugins: [
    manaFontWoff2Only(),
    react(),
    viteSingleFile(),
    workbench({
      repoRoot: process.env["CUBE_REPO_ROOT"] ?? REPO_ROOT,
      cacheDir: fileURLToPath(new URL("../../.cache/scryfall", import.meta.url)),
    }),
  ],
  resolve: {
    alias: {
      "#mode": fileURLToPath(
        new URL(
          command === "serve" ? "./src/modes/workbench.tsx" : "./src/modes/share.tsx",
          import.meta.url,
        ),
      ),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
}));
