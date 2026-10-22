import '../server/env.js';
import '../server/db/migrate.js';
import fs from 'node:fs';
import path from 'node:path';
import { createInvitation } from '../server/adminAccounts.js';
import { db } from '../server/db/database.js';

const email=process.argv[2];
if(!email)throw new Error('Supply the initial administrator email.');
const invitation=createInvitation({email,role:'administrator'},null,true);
const directory=path.resolve('.local');fs.mkdirSync(directory,{recursive:true});
const output=path.join(directory,'admin-setup.txt');
fs.writeFileSync(output,`Nerd Wars — initial administrator setup\n\nAccount: ${invitation.email}\nOpen on this server computer:\nhttp://127.0.0.1:8787/#admin-setup/${invitation.token}\n\nExpires: ${new Date(invitation.expiresAt).toISOString()}\nThis is a private, single-use link. Do not share it. Choose your password on the setup page.\n`,{mode:0o600});
console.log(`Private setup link saved to ${output}`);db.close();
