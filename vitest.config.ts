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
      // `server-only` throws on import outside a Server Component. Its job
      // is to stop server code reaching the browser bundle, which a unit
      // test is not — so it is stubbed out rather than worked around by
      // removing the guard from the modules that should keep it.
      "server-only": fileURLToPath(
        new URL("./tests/unit/stubs/server-only.ts", import.meta.url),
      ),
    },
  },
});
