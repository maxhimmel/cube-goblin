import js from "@eslint/js";
import type { Linter } from "eslint";
import { defineConfig } from "eslint/config";
import prettier from "eslint-config-prettier/flat";
import tseslint from "typescript-eslint";
import { noComments } from "./no-comments.ts";

export function createConfig(tsconfigRootDir: string): Linter.Config[] {
  return defineConfig(
    { ignores: ["**/node_modules/**", "**/dist/**", "**/.turbo/**"] },
    {
      files: ["**/*.ts"],
      extends: [
        js.configs.recommended,
        tseslint.configs.strictTypeChecked,
        tseslint.configs.stylisticTypeChecked,
      ],
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
      },
      plugins: {
        repo: { rules: { "no-comments": noComments } },
      },
      rules: {
        "repo/no-comments": "error",
        eqeqeq: ["error", "always"],
        curly: ["error", "all"],
        "no-var": "error",
        "prefer-const": "error",
        "@typescript-eslint/explicit-module-boundary-types": "error",
        "@typescript-eslint/consistent-type-imports": "error",
        "@typescript-eslint/switch-exhaustiveness-check": "error",
        "@typescript-eslint/no-floating-promises": "error",
      },
    },
    prettier,
  );
}
