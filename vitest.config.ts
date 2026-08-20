import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Unit tests cover the pure logic — the bits where a wrong answer is a
 * wrong answer regardless of database, browser or network.
 *
 * Anything that touches Supabase, RLS or a real browser is covered by the
 * verify-*.mjs scripts and the Playwright suite instead. Mocking those
 * would test the mock.
 */
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
