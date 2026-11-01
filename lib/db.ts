import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import crypto from "crypto";

// NOTE: SQLite via better-sqlite3 is the v1 prototype store. The schema and
// all access go through this module so it can be swapped for Postgres later
// (replace getDb() internals + the few raw SQL call sites).

let db: Database.Database | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  wallet TEXT PRIMARY KEY,
  x_handle TEXT UNIQUE,
  x_user_id TEXT,
  referral_code TEXT UNIQUE,
  referred_by TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
  user_wallet TEXT NOT NULL,
  task_type TEXT NOT NULL,
  verified_at TEXT NOT NULL,
  PRIMARY KEY (user_wallet, task_type)
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_wallet TEXT NOT NULL,
  text TEXT NOT NULL,
  on_topic INTEGER NOT NULL DEFAULT 0,
  reward INTEGER NOT NULL DEFAULT 0,
  tier INTEGER,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_wallet TEXT NOT NULL,
  amount INTEGER NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_wallet TEXT NOT NULL,
  referee_wallet TEXT NOT NULL UNIQUE,
  converted_at TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS referral_clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_wallet ON messages(user_wallet);
CREATE INDEX IF NOT EXISTS idx_ledger_wallet ON ledger(user_wallet);
CREATE INDEX IF NOT EXISTS idx_clicks_code ON referral_clicks(code);
`;

export function getDb(): Database.Database {
  if (db) return db;
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  db = new Database(path.join(dir, "yapfi.db"));
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);
  return db;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export interface UserRow {
  wallet: string;
  x_handle: string | null;
  x_user_id: string | null;
  referral_code: string | null;
  referred_by: string | null;
  created_at: string;
}

export function getUser(wallet: string): UserRow | undefined {
  return getDb()
    .prepare("SELECT * FROM users WHERE wallet = ?")
    .get(wallet) as UserRow | undefined;
}

export function getUserByReferralCode(code: string): UserRow | undefined {
  return getDb()
    .prepare("SELECT * FROM users WHERE referral_code = ?")
    .get(code.toUpperCase()) as UserRow | undefined;
}

/** Generate a unique 8-char referral code. */
export function genReferralCode(): string {
  const database = getDb();
  for (let i = 0; i < 20; i++) {
    const code = crypto.randomBytes(4).toString("hex").toUpperCase();
    const exists = database
      .prepare("SELECT 1 FROM users WHERE referral_code = ?")
      .get(code);
    if (!exists) return code;
  }
  throw new Error("could not generate unique referral code");
}

export function addLedger(
  wallet: string,
  amount: number,
  source: "chat" | "task" | "referral"
): void {
  getDb()
    .prepare(
      "INSERT INTO ledger (user_wallet, amount, source, created_at) VALUES (?, ?, ?, ?)"
    )
    .run(wallet, amount, source, nowIso());
}

export function getBalance(wallet: string): number {
  const row = getDb()
    .prepare(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM ledger WHERE user_wallet = ?"
    )
    .get(wallet) as { total: number };
  return row.total;
}

export function getSplit(wallet: string): {
  chat: number;
  tasks: number;
  referrals: number;
} {
  const rows = getDb()
    .prepare(
      "SELECT source, COALESCE(SUM(amount), 0) AS total FROM ledger WHERE user_wallet = ? GROUP BY source"
    )
    .all(wallet) as { source: string; total: number }[];
  const split = { chat: 0, tasks: 0, referrals: 0 };
  for (const r of rows) {
    if (r.source === "chat") split.chat = r.total;
    else if (r.source === "task") split.tasks = r.total;
    else if (r.source === "referral") split.referrals = r.total;
  }
  return split;
}
