import { createConfig } from "@repo/eslint-config";
import type { Linter } from "eslint";

const HOST_ONLY = "Reach the host through `host` from src/host (see docs/VISION.md#apps).";

const config: Linter.Config[] = [
  ...createConfig(import.meta.dirname),
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/host/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.name='window'][property.name='desktop']",
          message: HOST_ONLY,
        },
        {
          selector: "MemberExpression[object.type='MetaProperty'][property.name='hot']",
          message: HOST_ONLY,
        },
      ],
    },
  },
];

export default config;
