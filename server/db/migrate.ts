import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, '../../data'); fs.mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(process.env.DATABASE_PATH ?? path.join(dataDir, 'geek-trivia.db'));
db.exec('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
for (const name of fs.readdirSync(path.join(here, 'migrations')).filter(n => n.endsWith('.sql')).sort()) {
  if (!db.prepare('SELECT 1 FROM migrations WHERE name = ?').get(name)) { db.exec('BEGIN'); try { db.exec(fs.readFileSync(path.join(here, 'migrations', name), 'utf8')); db.prepare('INSERT INTO migrations(name) VALUES(?)').run(name); db.exec('COMMIT'); } catch(error) { db.exec('ROLLBACK'); throw error; } }
}
db.close(); console.log('Migrations complete.');
