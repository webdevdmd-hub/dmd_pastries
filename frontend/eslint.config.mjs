import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import prettierConfig from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import simpleImportSortPlugin from "eslint-plugin-simple-import-sort";
import globals from "globals";
import tseslint from "typescript-eslint";

import { designRules } from "./eslint.design-rules.mjs";

const config = tseslint.config(
  {
    ignores: [
      ".next/**",
      "coverage/**",
      "dist/**",
      "eslint.config.mjs",
      "eslint.design-rules.mjs",
      "next-env.d.ts",
      "node_modules/**",
      "postcss.config.mjs",
      "scripts/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "@next/next": nextPlugin,
      "react-hooks": reactHooksPlugin,
      import: importPlugin,
      "simple-import-sort": simpleImportSortPlugin,
    },
    rules: {
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...reactHooksPlugin.configs.recommended.rules,
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "separate-type-imports",
        },
      ],
      "@typescript-eslint/no-confusing-void-expression": [
        "error",
        {
          ignoreArrowShorthand: true,
        },
      ],
      "@typescript-eslint/no-invalid-void-type": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "import/first": "error",
      "import/newline-after-import": "error",
    },
  },
  {
    // Design system guardrails. All at "warn" during the migration; each rule
    // flips to "error" in the phase that clears it. See eslint.design-rules.mjs
    // and docs/design/MIGRATION.md.
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["warn", ...designRules],
    },
  },
  prettierConfig,
);

export default config;
