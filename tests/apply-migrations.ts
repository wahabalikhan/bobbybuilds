import { applyD1Migrations, env } from "cloudflare:test";

// Safe to run before every test file: already-applied migrations are skipped.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
