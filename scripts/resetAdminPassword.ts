import '../server/env.js';
import fs from 'node:fs';
import path from 'node:path';
import { createInvitation } from '../server/adminAccounts.js';
import { db } from '../server/db/database.js';

// Local operator recovery only: this is deliberately not an unauthenticated API.
try {
  const email = process.argv[2];
  if (!email) throw new Error('Supply the host or administrator email address.');
  const reset = createInvitation({ email, role: 'host', kind: 'reset' }, null);
  const directory = path.resolve('.local');
  fs.mkdirSync(directory, { recursive: true });
  const link = `http://127.0.0.1:8787/#admin-setup/${reset.token}`;
  fs.writeFileSync(path.join(directory, 'password-reset.json'), JSON.stringify({
    email: reset.email, link, expiresAt: reset.expiresAt,
  }), { mode: 0o600 });
  console.log('Private recovery link saved to .local/password-reset.json. It expires in one hour and works once.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Unable to create a reset link.');
  process.exitCode = 1;
} finally { db.close(); }
