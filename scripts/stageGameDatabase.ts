import '../server/env.js';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

// Staging is deliberately separate from the active game schema. It preserves
// source rows for a verified conversion without replacing account or live data.
const input = process.argv[2];
if (!input) throw new Error('Usage: node --import tsx scripts/stageGameDatabase.ts <snapshot.json>');
const url = process.env.BETA_DATABASE_URL;
if (!url) throw new Error('BETA_DATABASE_URL must identify the beta migration destination.');
const raw = readFileSync(input, 'utf8');
const snapshot = JSON.parse(raw);
if (snapshot.format !== 'nerd-wars-sqlite-snapshot' || snapshot.version !== 1 || !Array.isArray(snapshot.tables)) {
  throw new Error('Unsupported game snapshot.');
}
const names = new Set<string>();
for (const table of snapshot.tables) {
  if (typeof table.name !== 'string' || names.has(table.name) || !Array.isArray(table.rows) || !Array.isArray(table.columns)) {
    throw new Error('Invalid or duplicate table in snapshot.');
  }
  names.add(table.name);
}
const digest = createHash('sha256').update(raw).digest('hex');
const sql = neon(url);
await sql.transaction([
  sql.query('CREATE SCHEMA IF NOT EXISTS nerd_wars_migration'),
  sql.query(`CREATE TABLE IF NOT EXISTS nerd_wars_migration.snapshots (
    sha256 text PRIMARY KEY, imported_at timestamptz NOT NULL DEFAULT now(),
    payload jsonb NOT NULL, table_count integer NOT NULL, row_count integer NOT NULL
  )`),
  sql.query(`INSERT INTO nerd_wars_migration.snapshots (sha256,payload,table_count,row_count)
    VALUES ($1,$2::jsonb,$3,$4) ON CONFLICT (sha256) DO NOTHING`,
  [digest, raw, snapshot.tables.length, snapshot.tables.reduce((n: number, t: any) => n + t.rows.length, 0)]),
]);
const [verification] = await sql.query(`SELECT table_count, row_count,
  jsonb_array_length(payload->'tables') AS actual_table_count,
  (SELECT sum(jsonb_array_length(t->'rows')) FROM jsonb_array_elements(payload->'tables') t) AS actual_row_count
  FROM nerd_wars_migration.snapshots WHERE sha256=$1`, [digest]);
if (!verification || Number(verification.table_count) !== Number(verification.actual_table_count)
  || Number(verification.row_count) !== Number(verification.actual_row_count)) {
  throw new Error('Remote staging verification failed.');
}
console.log(JSON.stringify({ sha256: digest, tables: verification.table_count, rows: verification.row_count, staged: true }));
