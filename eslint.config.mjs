import js from "@eslint/js";
import globals from "globals";
import pluginJs from '@eslint/js';
import { defineConfig } from "eslint/config";

export default defineConfig([
  { files: ["**/*.{js,mjs,cjs}"], plugins: { js }, extends: ["js/recommended"], languageOptions: { globals: globals.browser } },
  { files: ["**/*.js"], languageOptions: { sourceType: "commonjs" } },
  { languageOptions: { globals: globals.jest } },
  pluginJs.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      }
    }
  }
]);
