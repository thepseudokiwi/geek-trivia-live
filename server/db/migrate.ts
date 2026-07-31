import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, '../../data'); fs.mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(process.env.DATABASE_PATH ?? path.join(dataDir, 'geek-trivia.db'));
db.exec('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
for (const name of fs.readdirSync(path.join(here, 'migrations')).filter(n => n.endsWith('.sql')).sort()) {
  if (!db.prepare('SELECT 1 FROM migrations WHERE name = ?').get(name)) { const rebuildsForeignKeys=name==='010_repair_contestant_foreign_keys.sql';if(rebuildsForeignKeys)db.exec('PRAGMA foreign_keys=OFF');db.exec('BEGIN'); try { db.exec(fs.readFileSync(path.join(here, 'migrations', name), 'utf8')); db.prepare('INSERT INTO migrations(name) VALUES(?)').run(name); db.exec('COMMIT');if(rebuildsForeignKeys){db.exec('PRAGMA foreign_keys=ON');const problems=db.prepare('PRAGMA foreign_key_check').all();if(problems.length)throw new Error(`Foreign-key repair failed: ${JSON.stringify(problems)}`)} } catch(error) { if(db.isTransaction)db.exec('ROLLBACK');if(rebuildsForeignKeys)db.exec('PRAGMA foreign_keys=ON');throw error; } }
}
db.close(); console.log('Migrations complete.');
