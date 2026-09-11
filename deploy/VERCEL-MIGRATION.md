# Vercel migration status

This branch is not ready for beta testing. The frontend builds, but the game
runtime still uses synchronous SQLite queries and process-local timers/leases.

## Completed

- Neon `nerd-wars-beta-postgres` connected in Portland; `BETA_` variables.
- Existing Upstash `upstash-kv-gray-door` connected; `BETA_REDIS_URL` supported.
- Read-only SQLite snapshot exporter with integrity check and exclusive output.
- Transactional Neon staging utility that preserves source rows in a separate
  schema, deduplicates by SHA-256, and checks remote table/row counts.
- TypeScript build checks pass for both migration utilities.

The latest private source snapshot is `.local/neon-migration-source-with-indexes-20260911.json`
(31 tables, 1998 rows). It is ignored by Git and must stay private. It has not
yet been staged remotely. No database secrets are available in the local
environment; obtain the connected beta variables through authenticated Vercel
access without printing secrets or committing them.

Additional implementation prepared September 11:

- `importGameDatabase.ts --check` validates conversion of all 31 source tables
  and their indexes (81 DDL statements). Remote import is atomic, preserves
  foreign keys/unique constraints, and refuses to replace an existing schema.
- PostgreSQL connection/transaction context, episode advisory locks, and async
  question repository are implemented but not yet wired into Express routes.
- Redis controller leases support exclusive acquisition, expiry and token-checked
  renewal/release. They are not yet wired into WebSocket ownership handling.
- Nine focused tests pass for transaction ownership, schema conversion and
  Redis lease operations. These tests use mocks; live PostgreSQL/Redis integration
  and browser gameplay remain unverified. TypeScript compilation passes.

## Remaining

1. Stage and verify the source snapshot in Neon.
2. Convert game repositories and transactions to PostgreSQL, preserving schema
   constraints, scoring idempotency, and first-buzzer atomicity.
3. Persist controller leases, presence, and timed transitions across instances.
4. Implement Vercel request/WebSocket entry points and reconnect recovery.
5. Migrate uploaded assets to durable storage and verify authentication wiring.
6. Deploy a preview, test full gameplay across separate browser sessions and
   server restarts, then promote and verify the beta domain's HTTPS certificate.

Do not substitute a local SQLite file in a Vercel function for durable storage.
Unit tests or a successful frontend build alone are insufficient for readiness.
