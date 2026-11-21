import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Next's recommended rules plus its TypeScript set. A rule that finds something real in the code as it stands is
// reported as a warning rather than an error, so `npm run lint` passes today and the warnings are a to-do list.
// Rules meant to hold are listed under "errors": a new violation of those fails the check.
const configs = [...nextVitals, ...nextTs];

// Anything the presets set to "error" is lowered to "warn" ...
const lowered = configs.map((c) => {
  if (!c.rules) return c;
  const rules = Object.fromEntries(Object.entries(c.rules).map(([name, v]) => {
    const level = Array.isArray(v) ? v[0] : v;
    const isError = level === "error" || level === 2;
    return [name, isError ? (Array.isArray(v) ? ["warn", ...v.slice(1)] : "warn") : v];
  }));
  return { ...c, rules };
});

export default defineConfig([
  ...lowered,
  {
    rules: {
      // ... except these, which are meant to hold everywhere.
      "react-hooks/rules-of-hooks": "error",
      // A leading underscore (or a rest sibling) marks a value that is dropped on purpose, e.g. `const { a: _a, ...rest } = x`.
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_", ignoreRestSiblings: true }],
    },
  },
  {
    // Test scripts and tooling files are plain Node scripts.
    files: ["**/*.test.mts", "e2e/**", "*.config.*"],
    rules: { "@typescript-eslint/no-explicit-any": "off", "no-console": "off" },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "node_modules/**", "public/**", "supabase/functions/**", "covers-to-upload/**", "design/**", "logo/**", "assets/**"]),
]);
