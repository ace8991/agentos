import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "coverage",
      "node_modules",
      ".tmp_*",
      ".tmp_*/**",
      ".tmp_claude_code",
      ".tmp_claude_code/**",
      "*-clean",
      "*-clean/**",
      "backend/generated_workspaces",
      "backend/generated_workspaces/**",
      "backend/.venv",
      "backend/venv",
      "backend/venv/**",
      "backend/**/__pycache__",
      "**/*.pyc",
      "**/*.timestamp-*.mjs",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": "off",

      // ── Relaxed rules for pragmatic development ──
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "no-empty": "off",
    },
  },
);

