/**
 * Runs before any module (and therefore before src/config/env.ts calls
 * `dotenv/config`). dotenv never overwrites an already-set process.env var, so
 * assigning here wins over apps/api/.env — set TEST_DATABASE_URL to point the
 * integration tests at an isolated Postgres instead of the dev database.
 */
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
