import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
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
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // shadcn-ui primitives là code vendored, sinh bởi `npx shadcn add`. CLAUDE.md
  // quy định không sửa: sửa tay sẽ bị ghi đè ở lần cập nhật component sau, và
  // diff vendored lẫn vào diff nghiệp vụ khiến review khó. Tắt đúng 2 rule mà
  // upstream vi phạm, KHÔNG tắt cả bộ.
  {
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-empty-object-type": "off",
      "react-refresh/only-export-components": "off",
    },
  },
  // Provider + hook `useX()` xuất chung một file là pattern chính tắc của React
  // Context. react-refresh cảnh báo vì file xuất cả component lẫn non-component,
  // nhưng tách ra chỉ đổi lấy 2 file cho mỗi context mà không được gì.
  {
    files: ["src/contexts/**/*.{ts,tsx}"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
);
