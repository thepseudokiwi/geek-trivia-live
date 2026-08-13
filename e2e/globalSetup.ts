import{execFileSync}from'node:child_process';import path from'node:path';
export default function globalSetup(){const databasePath=process.env.E2E_DATABASE_PATH??path.resolve('data/e2e.db');execFileSync(process.execPath,['--import','tsx','server/db/seed.ts'],{cwd:process.cwd(),env:{...process.env,DATABASE_PATH:databasePath},stdio:'inherit'})}
