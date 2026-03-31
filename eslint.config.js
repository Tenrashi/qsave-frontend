import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist/", "src-tauri/", "coverage/", "scripts/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
);
