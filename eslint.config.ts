import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-plugin-prettier/recommended";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      "**/dist/",
      "**/node_modules/",
      "**/coverage/",
      "**/bin/",
      "**/*.config.js",
      "**/*.config.mjs",
      "**/build/",
      "**/.turbo/",
    ],
  },

  // Base config for all TypeScript files
  {
    files: ["**/*.ts", "**/*.tsx"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
      },
      globals: {
        ...globals.node,
        ...globals.browser,
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/interface-name-prefix": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportNamespaceSpecifier",
          message: "Import named exports instead of namespace imports",
        },
      ],
    },
  },

  // React-specific config for web app
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },

  // Override for shadcn UI components - allow namespace imports
  {
    files: ["apps/web/src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },

  // NestJS-specific config for API
  {
    files: ["apps/api/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },

  // Pulumi/Infrastructure-specific config
  {
    files: ["apps/infra/**/*.ts"],
  },

  // Prettier integration
  prettier,
);
