import crypto from 'node:crypto';

const password=process.argv[2]??'';
if(password.length<12){console.error('Host password must contain at least 12 characters.');process.exit(1)}
const salt=crypto.randomBytes(16).toString('base64url');
const hash=crypto.scryptSync(password,salt,64).toString('base64url');
console.log(`HOST_PASSWORD_HASH=scrypt$${salt}$${hash}`);
