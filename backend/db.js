const Database = require("better-sqlite3");
const path = require("path");

// DB_PATH lets tests/deployments point at a different database file.
const dbFile = process.env.DB_PATH || path.join(__dirname, "data", "app.db");
const db = new Database(dbFile);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 1,
  verify_token_hash TEXT,
  verify_expires INTEGER NOT NULL DEFAULT 0,
  reset_token_hash TEXT,
  reset_expires INTEGER NOT NULL DEFAULT 0,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS assessments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS assessment_items (
  assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  notes TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (assessment_id, item_id)
);
`);

// ---- Lightweight migrations (safe to run on every start) ----
function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

// Existing accounts are trusted as verified; only new registrations start at 0.
ensureColumn("users", "email_verified", "INTEGER NOT NULL DEFAULT 1");
ensureColumn("users", "verify_token_hash", "TEXT");
ensureColumn("users", "verify_expires", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("users", "reset_token_hash", "TEXT");
ensureColumn("users", "reset_expires", "INTEGER NOT NULL DEFAULT 0");

db.exec(`
CREATE INDEX IF NOT EXISTS idx_users_verify_token ON users(verify_token_hash);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token_hash);
`);

module.exports = db;
