import '../server/env.js';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

// A read-only, consistent source snapshot for the PostgreSQL migration.
// Never print rows: contestant tokens and other private game data may be present.
const output = process.argv[2];
if (!output) throw new Error('Usage: node --import tsx scripts/exportGameDatabase.ts <new-snapshot.json>');
const source = path.resolve(process.env.DATABASE_PATH ?? 'data/geek-trivia.db');
if (path.resolve(output) === source) throw new Error('Snapshot destination must differ from the source database.');
const database = new DatabaseSync(source, { readOnly: true });
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
try {
  database.exec('BEGIN');
  const integrity = database.prepare('PRAGMA integrity_check').all();
  if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok') {
    throw new Error('Source database failed its integrity check.');
  }
  const definitions = database.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  const tables = definitions.map(definition => {
    const name = String(definition.name);
    const columns = database.prepare(`PRAGMA table_info(${quote(name)})`).all();
    const foreignKeys = database.prepare(`PRAGMA foreign_key_list(${quote(name)})`).all();
    const rows = database.prepare(`SELECT * FROM ${quote(name)}`).all();
    const indexes = database.prepare("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name=? AND sql IS NOT NULL ORDER BY name").all(name);
    return { name, sql: definition.sql, columns, foreignKeys, indexes, rows };
  });
  database.exec('COMMIT');
  const payload = JSON.stringify({ format: 'nerd-wars-sqlite-snapshot', version: 1, createdAt: new Date().toISOString(), tables });
  // Exclusive creation prevents accidental replacement of an earlier backup.
  writeFileSync(output, payload, { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ output: path.resolve(output), tables: tables.length, rows: tables.reduce((n, t) => n + t.rows.length, 0), sha256: createHash('sha256').update(payload).digest('hex') }));
} finally {
  database.close();
}
