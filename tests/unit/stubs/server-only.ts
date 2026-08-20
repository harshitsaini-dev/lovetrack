/**
 * Stand-in for the real `server-only` package under Vitest.
 *
 * The real one throws on import to keep server modules out of the client
 * bundle. That guard is worth keeping in the source, so it is neutralised
 * here instead of being deleted from the modules under test.
 */
export {};
