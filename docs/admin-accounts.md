# Backend accounts

Backend accounts are separate from player accounts. The running SQLite server
supports invite-only Administrator and Host accounts. This does not provision
accounts in the pending PostgreSQL/Vercel deployment.

Run `node --import tsx scripts/bootstrapAdmin.ts EMAIL` once on the server to
create the first Administrator invitation. The private link is written to
`.local/admin-setup.txt` (excluded from Git). It expires after 48 hours. Re-running
before activation revokes an earlier invitation for that address. Once an
account exists, bootstrap is refused; administrators create further invitations
through Access Management. No automatic emails are sent.

The initial recipient opens the link on localhost and chooses a password of
15–128 characters. Backend account mode takes over once the first account is
created: shared legacy host cookies and the unconfigured development bypass no
longer grant backend access. Sign in with email and password.

Hosts can use production and content controls. Administrators additionally
invite users, issue password-reset links, change roles, and disable accounts.
The last active Administrator cannot be demoted or disabled. Role changes,
disabling, password resets, and logout revoke sessions. Connected host sockets
recheck permission before commands and on their heartbeat.

Account management and sign-in require HTTPS or a direct localhost connection.
Configure HTTPS and the trusted proxy explicitly for remote administration;
never expose passwords over the public HTTP address. Sessions are HttpOnly,
SameSite=Strict, 12-hour cookies, with Secure set for HTTPS. Passwords use scrypt;
session and invitation tokens are stored only as SHA-256 hashes. Setup/reset
tokens are random, single-use, and expire after 48 hours. Administrative events
are recorded in `admin_audit` without passwords or raw tokens.

The ordinary game export does not include these security tables. Securely back
up the complete server database for account recovery. Keep the local setup-link
file private and remove it after activation. Never commit it.
