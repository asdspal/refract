// Load local .env for tests (DATABASE_URL, UPSTASH_*). No-op in CI.
try {
  process.loadEnvFile();
} catch {
  // .env absent
}
