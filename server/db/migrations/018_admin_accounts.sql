CREATE TABLE admin_users (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 display_name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('administrator','host')),
 password_hash TEXT NOT NULL, disabled INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE admin_sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES admin_users(id), expires_at INTEGER NOT NULL
);
CREATE TABLE admin_invitations (
 id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, email TEXT NOT NULL COLLATE NOCASE,
 role TEXT NOT NULL CHECK(role IN ('administrator','host')),
 kind TEXT NOT NULL CHECK(kind IN ('invite','reset')), expires_at INTEGER NOT NULL,
 used_at INTEGER, created_by TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE admin_audit (
 id TEXT PRIMARY KEY, actor_id TEXT, action TEXT NOT NULL, target TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
