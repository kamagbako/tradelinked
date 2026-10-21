import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const eslintConfig = [
  { ignores: [".next/**", "node_modules/**", "coverage/**", "next-env.d.ts", "public/sw.js", "public/workbox-*.js", "public/swe-worker-*.js"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
