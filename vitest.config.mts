import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    css: false,
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/messages/**",
        "src/**/*.d.ts",
        "src/lib/types.ts",
        "src/app/**/layout.tsx",
        "src/app/manifest.ts",
        "src/app/robots.ts",
        "src/app/sitemap.ts",
      ],
    },
  },
});
