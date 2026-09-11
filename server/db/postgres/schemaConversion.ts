export interface SourceTable {
  name: string;
  sql: string;
  indexes?: Array<{ name: string; sql: string }>;
  foreignKeys: Array<{ id: number; seq: number; table: string; from: string; to: string; on_delete: string; on_update: string }>;
}
const identifier = (value: string) => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) throw new Error('Invalid migration identifier.');
  return `"${value}"`;
};
const referentialAction = (value: string) => {
  if (!['NO ACTION', 'RESTRICT', 'SET NULL', 'SET DEFAULT', 'CASCADE'].includes(value)) throw new Error('Unsupported foreign key action.');
  return value;
};

/** Convert the audited final SQLite schema, retaining checks and unique keys.
 * Foreign keys are installed after all tables to allow circular references. */
export function postgresSchema(tables: SourceTable[]): string[] {
  const statements = ['CREATE SCHEMA nerd_wars_game', 'SET LOCAL search_path TO nerd_wars_game, pg_catalog'];
  for (const table of tables) {
    identifier(table.name);
    if (!new RegExp(`^CREATE TABLE (?:"${table.name}"|${table.name})\\s*\\(`, 'i').test(table.sql)) throw new Error('Unexpected source table definition.');
    const sql = table.sql
      .replace(/\bREFERENCES\s+[a-z_][a-z0-9_]*\s*\([a-z_][a-z0-9_]*\)(?:\s+ON\s+(?:DELETE|UPDATE)\s+(?:SET NULL|SET DEFAULT|NO ACTION|CASCADE|RESTRICT))*/gi, '')
      .replace(/DEFAULT CURRENT_TIMESTAMP\b/gi, 'DEFAULT (CURRENT_TIMESTAMP::text)')
      .replace(/json_valid\(alternate_answers\)/gi, "jsonb_typeof(alternate_answers::jsonb) = 'array'")
      .replace(/\bREAL\b/g, 'DOUBLE PRECISION');
    if (/\bREFERENCES\b|\bPRAGMA\b|\bAUTOINCREMENT\b|json_valid\(/i.test(sql)) throw new Error('Unsupported SQLite schema feature.');
    statements.push(sql);
  }
  const known = new Set(tables.map(t => t.name));
  for (const table of tables) {
    const groups = new Map<number, SourceTable['foreignKeys']>();
    for (const fk of table.foreignKeys) groups.set(fk.id, [...(groups.get(fk.id) ?? []), fk]);
    for (const [id, keys] of groups) {
      keys.sort((a, b) => a.seq - b.seq);
      const fk = keys[0];
      if (!known.has(fk.table)) throw new Error('Foreign key target is absent from snapshot.');
      statements.push(`ALTER TABLE ${identifier(table.name)} ADD CONSTRAINT ${identifier(`${table.name}_migration_fk_${id}`)} FOREIGN KEY (${keys.map(k => identifier(k.from)).join(',')}) REFERENCES ${identifier(fk.table)} (${keys.map(k => identifier(k.to)).join(',')}) ON DELETE ${referentialAction(fk.on_delete)} ON UPDATE ${referentialAction(fk.on_update)} DEFERRABLE INITIALLY DEFERRED`);
    }
  }
  for (const table of tables) {
    for (const index of table.indexes ?? []) {
      identifier(index.name);
      if (!new RegExp(`^CREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+(?:"${index.name}"|${index.name})\\s+ON\\s+(?:"${table.name}"|${table.name})\\s*\\(`, 'i').test(index.sql)) {
        throw new Error('Unexpected source index definition.');
      }
      statements.push(index.sql);
    }
  }
  return statements;
}
