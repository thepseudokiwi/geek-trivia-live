import { expect, it } from 'vitest';
import { postgresSchema, type SourceTable } from '../server/db/postgres/schemaConversion.js';

it('retains checks and unique keys while translating timestamps and JSON validation', () => {
  const sql = postgresSchema([{ name: 'questions', foreignKeys: [], sql: "CREATE TABLE questions (id TEXT PRIMARY KEY, alternate_answers TEXT CHECK(json_valid(alternate_answers)), created_at TEXT DEFAULT CURRENT_TIMESTAMP, difficulty INTEGER CHECK(difficulty BETWEEN 1 AND 5), UNIQUE(id,difficulty))" }]);
  expect(sql[2]).toContain("CHECK(jsonb_typeof(alternate_answers::jsonb) = 'array')");
  expect(sql[2]).toContain('DEFAULT (CURRENT_TIMESTAMP::text)');
  expect(sql[2]).toContain('CHECK(difficulty BETWEEN 1 AND 5)');
  expect(sql[2]).toContain('UNIQUE(id,difficulty)');
});

it('creates both sides of circular references before adding deferred constraints', () => {
  const tables: SourceTable[] = ['episodes', 'participants'].map((name, i) => ({
    name, sql: `CREATE TABLE ${name} (id TEXT PRIMARY KEY, other_id TEXT REFERENCES ${i ? 'episodes' : 'participants'}(id) ON DELETE SET NULL)`,
    foreignKeys: [{ id: 0, seq: 0, table: i ? 'episodes' : 'participants', from: 'other_id', to: 'id', on_delete: 'SET NULL', on_update: 'NO ACTION' }],
  }));
  const sql = postgresSchema(tables);
  expect(sql.slice(2, 4).join('\n')).not.toContain('REFERENCES');
  expect(sql[4]).toContain('REFERENCES "participants" ("id") ON DELETE SET NULL');
  expect(sql[5]).toContain('REFERENCES "episodes" ("id")');
  expect(sql[5]).toContain('DEFERRABLE INITIALLY DEFERRED');
});

it('rejects unrecognized SQLite features instead of silently discarding them', () => {
  expect(() => postgresSchema([{ name: 'items', sql: 'CREATE TABLE items (id INTEGER PRIMARY KEY AUTOINCREMENT)', foreignKeys: [] }])).toThrow('Unsupported SQLite');
});
