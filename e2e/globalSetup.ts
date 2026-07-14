import{execFileSync}from'node:child_process';
export default function globalSetup(){execFileSync(process.execPath,['--import','tsx','server/db/seed.ts'],{cwd:process.cwd(),env:{...process.env,DATABASE_PATH:'data/e2e.db'},stdio:'inherit'})}
