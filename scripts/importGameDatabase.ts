import '../server/env.js';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gameQuery, gameTransaction, closeGameStore } from '../server/db/postgres/gameStore.js';
import { postgresSchema, type SourceTable } from '../server/db/postgres/schemaConversion.js';

const input = process.argv[2];
const checkOnly = process.argv.includes('--check');
if (!input || (!checkOnly && !process.env.BETA_DATABASE_URL)) throw new Error('A snapshot filename and BETA_DATABASE_URL are required (or use --check).');
const raw = readFileSync(input, 'utf8');
const snapshot = JSON.parse(raw);
if (snapshot.format !== 'nerd-wars-sqlite-snapshot' || snapshot.version !== 1 || !Array.isArray(snapshot.tables)) throw new Error('Unsupported snapshot.');
type Table = SourceTable & { columns: Array<{ name: string }>; rows: Record<string, unknown>[] };
const tables = snapshot.tables as Table[];
const ddl = postgresSchema(tables);
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
const digest = createHash('sha256').update(raw).digest('hex');
if (checkOnly) {
  console.log(JSON.stringify({ checked: true, sha256: digest, tables: tables.length, statements: ddl.length }));
} else try {
  await gameTransaction(async () => {
    // CREATE SCHEMA fails if a previous import or a running game already exists.
    // No drop, truncate or overwrite is permitted by this migration utility.
    for (const statement of ddl) await gameQuery(statement);
    for (const table of tables) {
      const columns = table.columns.map(c => c.name);
      const permitted = new Set(columns);
      for (const row of table.rows) {
        if (Object.keys(row).some(key => !permitted.has(key))) throw new Error('Unknown column in source row.');
      }
      for (let offset = 0; offset < table.rows.length; offset += 100) {
        const rows = table.rows.slice(offset, offset + 100);
        const values = rows.flatMap(row => columns.map(column => row[column] ?? null));
        const tuples = rows.map((_, i) => `(${columns.map((_, j) => `$${i * columns.length + j + 1}`).join(',')})`);
        await gameQuery(`INSERT INTO ${quote(table.name)} (${columns.map(quote).join(',')}) VALUES ${tuples.join(',')}`, values);
      }
      const [count] = await gameQuery(`SELECT count(*) AS n FROM ${quote(table.name)}`);
      if (Number(count.n) !== table.rows.length) throw new Error(`Row count mismatch for ${table.name}.`);
    }
    await gameQuery('SET CONSTRAINTS ALL IMMEDIATE');
    await gameQuery('CREATE TABLE migration_source (sha256 text PRIMARY KEY, imported_at timestamptz NOT NULL DEFAULT now())');
    await gameQuery('INSERT INTO migration_source (sha256) VALUES ($1)', [digest]);
  });
  console.log(JSON.stringify({ imported: true, sha256: digest, tables: tables.length, rows: tables.reduce((n, t) => n + t.rows.length, 0) }));
} finally {
  await closeGameStore();
}
