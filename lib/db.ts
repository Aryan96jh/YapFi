// YapFi data layer — async, two backends.
//
// - Postgres (via `pg` Pool) when DATABASE_URL is set — this is the
//   production path (Vercel serverless has a read-only filesystem, so the
//   old SQLite file cannot even be created there).
// - Local SQLite (better-sqlite3) when DATABASE_URL is unset — zero-config
//   local dev, unchanged behavior.
//
// Routes must use the async helpers below and never touch a driver directly.
// created_at is stored as ISO-8601 TEXT in both backends so the app code
// (Date.parse etc.) behaves identically.

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { Pool } from "pg";

export function isPostgres(): boolean {
  return !!process.env.DATABASE_URL;
}

export function nowIso(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Schema (plain SQL, both dialects)
// ---------------------------------------------------------------------------

const SCHEMA_SQLITE = `
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

const SCHEMA_PG = `
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
  id BIGSERIAL PRIMARY KEY,
  user_wallet TEXT NOT NULL,
  text TEXT NOT NULL,
  on_topic INTEGER NOT NULL DEFAULT 0,
  reward INTEGER NOT NULL DEFAULT 0,
  tier INTEGER,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ledger (
  id BIGSERIAL PRIMARY KEY,
  user_wallet TEXT NOT NULL,
  amount INTEGER NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS referrals (
  id BIGSERIAL PRIMARY KEY,
  referrer_wallet TEXT NOT NULL,
  referee_wallet TEXT NOT NULL UNIQUE,
  converted_at TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS referral_clicks (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_wallet ON messages(user_wallet);
CREATE INDEX IF NOT EXISTS idx_ledger_wallet ON ledger(user_wallet);
CREATE INDEX IF NOT EXISTS idx_clicks_code ON referral_clicks(code);
`;

// ---------------------------------------------------------------------------
// Low-level primitives
// ---------------------------------------------------------------------------

let sqlite: Database.Database | null = null;
function getSqlite(): Database.Database {
  if (!sqlite) {
    const dir = path.join(process.cwd(), "data");
    fs.mkdirSync(dir, { recursive: true });
    sqlite = new Database(path.join(dir, "yapfi.db"));
    sqlite.pragma("journal_mode = WAL");
    sqlite.exec(SCHEMA_SQLITE);
  }
  return sqlite;
}

let pool: Pool | null = null;
let pgReady: Promise<void> | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Neon / Supabase require TLS; this is their documented Node setup.
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

function ensurePgSchema(): Promise<void> {
  if (!pgReady) {
    pgReady = (async () => {
      await getPool().query(SCHEMA_PG);
    })();
  }
  return pgReady;
}

async function all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (isPostgres()) {
    await ensurePgSchema();
    const res = await getPool().query(sql, params as unknown[]);
    return res.rows as T[];
  }
  return getSqlite().prepare(sql).all(...params) as T[];
}

async function get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  if (isPostgres()) {
    await ensurePgSchema();
    const res = await getPool().query(sql, params as unknown[]);
    return (res.rows[0] as T | undefined) ?? undefined;
  }
  return getSqlite().prepare(sql).get(...params) as T | undefined;
}

async function run(sql: string, params: unknown[] = []): Promise<void> {
  if (isPostgres()) {
    await ensurePgSchema();
    await getPool().query(sql, params as unknown[]);
    return;
  }
  getSqlite().prepare(sql).run(...params);
}

const n = (v: unknown): number => Number(v ?? 0);

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export interface UserRow {
  wallet: string;
  x_handle: string | null;
  x_user_id: string | null;
  referral_code: string | null;
  referred_by: string | null;
  created_at: string;
}

export interface UserPublic {
  wallet: string;
  x_handle: string | null;
  referral_code: string | null;
  referred_by: string | null;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function getUser(wallet: string): Promise<UserRow | undefined> {
  return get<UserRow>(
    isPostgres()
      ? "SELECT * FROM users WHERE wallet = $1"
      : "SELECT * FROM users WHERE wallet = ?",
    [wallet]
  );
}

export async function getUserByReferralCode(
  code: string
): Promise<UserRow | undefined> {
  return get<UserRow>(
    isPostgres()
      ? "SELECT * FROM users WHERE referral_code = $1"
      : "SELECT * FROM users WHERE referral_code = ?",
    [code.toUpperCase()]
  );
}

/** Wallet address already linked to this X handle (case-insensitive), if any. */
export async function findWalletByHandle(
  handle: string
): Promise<string | null> {
  const row = await get<{ wallet: string }>(
    isPostgres()
      ? "SELECT wallet FROM users WHERE LOWER(x_handle) = LOWER($1)"
      : "SELECT wallet FROM users WHERE LOWER(x_handle) = LOWER(?)",
    [handle]
  );
  return row?.wallet ?? null;
}

/**
 * Insert the user, or on wallet conflict update the handle (keeping any
 * existing referred_by). Throws on X-handle unique violation — callers map
 * that to a 409.
 */
export async function upsertUser(
  wallet: string,
  handle: string,
  referredBy: string | null
): Promise<void> {
  const sql = isPostgres()
    ? `INSERT INTO users (wallet, x_handle, x_user_id, referral_code, referred_by, created_at)
       VALUES ($1, $2, NULL, NULL, $3, $4)
       ON CONFLICT(wallet) DO UPDATE SET
         x_handle = excluded.x_handle,
         referred_by = COALESCE(users.referred_by, excluded.referred_by)`
    : `INSERT INTO users (wallet, x_handle, x_user_id, referral_code, referred_by, created_at)
       VALUES (?, ?, NULL, NULL, ?, ?)
       ON CONFLICT(wallet) DO UPDATE SET
         x_handle = excluded.x_handle,
         referred_by = COALESCE(users.referred_by, excluded.referred_by)`;
  await run(sql, [wallet, handle, referredBy, nowIso()]);
}

export async function getUserPublic(
  wallet: string
): Promise<UserPublic | undefined> {
  return get<UserPublic>(
    isPostgres()
      ? "SELECT wallet, x_handle, referral_code, referred_by FROM users WHERE wallet = $1"
      : "SELECT wallet, x_handle, referral_code, referred_by FROM users WHERE wallet = ?",
    [wallet]
  );
}

export async function setReferralCode(
  wallet: string,
  code: string
): Promise<void> {
  await run(
    isPostgres()
      ? "UPDATE users SET referral_code = $1 WHERE wallet = $2"
      : "UPDATE users SET referral_code = ? WHERE wallet = ?",
    [code, wallet]
  );
}

/** Generate a unique 8-char referral code. */
export async function genReferralCode(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = crypto.randomBytes(4).toString("hex").toUpperCase();
    const exists = await get<{ one: number }>(
      isPostgres()
        ? "SELECT 1 AS one FROM users WHERE referral_code = $1"
        : "SELECT 1 AS one FROM users WHERE referral_code = ?",
      [code]
    );
    if (!exists) return code;
  }
  throw new Error("could not generate unique referral code");
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function countTasks(wallet: string): Promise<number> {
  const row = await get<{ c: unknown }>(
    isPostgres()
      ? "SELECT COUNT(*) AS c FROM tasks WHERE user_wallet = $1"
      : "SELECT COUNT(*) AS c FROM tasks WHERE user_wallet = ?",
    [wallet]
  );
  return n(row?.c);
}

export async function taskTypes(wallet: string): Promise<string[]> {
  const rows = await all<{ task_type: string }>(
    isPostgres()
      ? "SELECT task_type FROM tasks WHERE user_wallet = $1"
      : "SELECT task_type FROM tasks WHERE user_wallet = ?",
    [wallet]
  );
  return rows.map((r) => r.task_type);
}

export async function ignoreTask(wallet: string, task: string): Promise<void> {
  await run(
    isPostgres()
      ? "INSERT INTO tasks (user_wallet, task_type, verified_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING"
      : "INSERT OR IGNORE INTO tasks (user_wallet, task_type, verified_at) VALUES (?, ?, ?)",
    [wallet, task, nowIso()]
  );
}

/** Has the one-time task-bundle ledger award already been paid? */
export async function hasTaskBundleAward(wallet: string): Promise<boolean> {
  const row = await get<{ one: number }>(
    isPostgres()
      ? "SELECT 1 AS one FROM ledger WHERE user_wallet = $1 AND source = 'task' LIMIT 1"
      : "SELECT 1 AS one FROM ledger WHERE user_wallet = ? AND source = 'task' LIMIT 1",
    [wallet]
  );
  return !!row;
}

// ---------------------------------------------------------------------------
// Chat / messages
// ---------------------------------------------------------------------------

export async function countRewardedToday(wallet: string): Promise<number> {
  const row = await get<{ c: unknown }>(
    isPostgres()
      // Day boundary follows the DB session date; Neon/Supabase default to UTC,
      // matching the old SQLite date(created_at) = date('now') (UTC) behavior.
      ? "SELECT COUNT(*) AS c FROM messages WHERE user_wallet = $1 AND reward > 0 AND created_at::date = CURRENT_DATE"
      : "SELECT COUNT(*) AS c FROM messages WHERE user_wallet = ? AND reward > 0 AND date(created_at) = date('now')",
    [wallet]
  );
  return n(row?.c);
}

export async function lastRewardedAt(wallet: string): Promise<string | null> {
  const row = await get<{ created_at: string }>(
    isPostgres()
      ? "SELECT created_at FROM messages WHERE user_wallet = $1 AND reward > 0 ORDER BY id DESC LIMIT 1"
      : "SELECT created_at FROM messages WHERE user_wallet = ? AND reward > 0 ORDER BY id DESC LIMIT 1",
    [wallet]
  );
  return row?.created_at ?? null;
}

export async function recentMessageTexts(
  wallet: string,
  limit = 50
): Promise<string[]> {
  const rows = await all<{ text: string }>(
    isPostgres()
      ? "SELECT text FROM messages WHERE user_wallet = $1 ORDER BY id DESC LIMIT $2"
      : "SELECT text FROM messages WHERE user_wallet = ? ORDER BY id DESC LIMIT ?",
    [wallet, limit]
  );
  return rows.map((r) => r.text);
}

export async function insertMessage(
  wallet: string,
  text: string,
  onTopic: boolean,
  reward: number,
  tier: number | null
): Promise<void> {
  await run(
    isPostgres()
      ? "INSERT INTO messages (user_wallet, text, on_topic, reward, tier, created_at) VALUES ($1, $2, $3, $4, $5, $6)"
      : "INSERT INTO messages (user_wallet, text, on_topic, reward, tier, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [wallet, text, onTopic ? 1 : 0, reward, tier, nowIso()]
  );
}

// ---------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------

export async function addLedger(
  wallet: string,
  amount: number,
  source: "chat" | "task" | "referral"
): Promise<void> {
  await run(
    isPostgres()
      ? "INSERT INTO ledger (user_wallet, amount, source, created_at) VALUES ($1, $2, $3, $4)"
      : "INSERT INTO ledger (user_wallet, amount, source, created_at) VALUES (?, ?, ?, ?)",
    [wallet, amount, source, nowIso()]
  );
}

export async function getBalance(wallet: string): Promise<number> {
  const row = await get<{ total: unknown }>(
    isPostgres()
      ? "SELECT COALESCE(SUM(amount), 0) AS total FROM ledger WHERE user_wallet = $1"
      : "SELECT COALESCE(SUM(amount), 0) AS total FROM ledger WHERE user_wallet = ?",
    [wallet]
  );
  return n(row?.total);
}

export async function getSplit(wallet: string): Promise<{
  chat: number;
  tasks: number;
  referrals: number;
}> {
  const rows = await all<{ source: string; total: unknown }>(
    isPostgres()
      ? "SELECT source, COALESCE(SUM(amount), 0) AS total FROM ledger WHERE user_wallet = $1 GROUP BY source"
      : "SELECT source, COALESCE(SUM(amount), 0) AS total FROM ledger WHERE user_wallet = ? GROUP BY source",
    [wallet]
  );
  const split = { chat: 0, tasks: 0, referrals: 0 };
  for (const r of rows) {
    const total = n(r.total);
    if (r.source === "chat") split.chat = total;
    else if (r.source === "task") split.tasks = total;
    else if (r.source === "referral") split.referrals = total;
  }
  return split;
}

// ---------------------------------------------------------------------------
// Referrals
// ---------------------------------------------------------------------------

export async function ignoreReferral(
  referrerWallet: string,
  refereeWallet: string
): Promise<void> {
  const at = nowIso();
  await run(
    isPostgres()
      ? "INSERT INTO referrals (referrer_wallet, referee_wallet, converted_at, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING"
      : "INSERT OR IGNORE INTO referrals (referrer_wallet, referee_wallet, converted_at, created_at) VALUES (?, ?, ?, ?)",
    [referrerWallet, refereeWallet, at, at]
  );
}

export async function countConversions(wallet: string): Promise<number> {
  const row = await get<{ c: unknown }>(
    isPostgres()
      ? "SELECT COUNT(*) AS c FROM referrals WHERE referrer_wallet = $1 AND converted_at IS NOT NULL"
      : "SELECT COUNT(*) AS c FROM referrals WHERE referrer_wallet = ? AND converted_at IS NOT NULL",
    [wallet]
  );
  return n(row?.c);
}

export async function countClicks(code: string): Promise<number> {
  const row = await get<{ c: unknown }>(
    isPostgres()
      ? "SELECT COUNT(*) AS c FROM referral_clicks WHERE code = $1"
      : "SELECT COUNT(*) AS c FROM referral_clicks WHERE code = ?",
    [code]
  );
  return n(row?.c);
}

export async function insertClick(code: string): Promise<void> {
  await run(
    isPostgres()
      ? "INSERT INTO referral_clicks (code, created_at) VALUES ($1, $2)"
      : "INSERT INTO referral_clicks (code, created_at) VALUES (?, ?)",
    [code, nowIso()]
  );
}

// ---------------------------------------------------------------------------
// Admin analytics
// ---------------------------------------------------------------------------

export interface AdminUserRow {
  wallet: string;
  x_handle: string | null;
  created_at: string;
  balance: number;
  chats: number;
  tasks_done: number;
  last_active: string | null;
}

export interface AdminStats {
  totals: {
    users: number;
    usersToday: number;
    chats: number;
    rewardedChats: number;
    pointsIssued: number;
    tasksCompleted: number;
    referralClicks: number;
    referralConversions: number;
  };
  pointsBySource: { source: string; points: number }[];
  churn: { eligible: number; active7d: number; churned: number; churnRate: number };
  daily: { day: string; signups: number; active: number }[];
  recentUsers: AdminUserRow[];
  topEarners: AdminUserRow[];
}

const USER_STATS_SELECT = `
SELECT u.wallet, u.x_handle, u.created_at,
  COALESCE((SELECT SUM(l.amount) FROM ledger l WHERE l.user_wallet = u.wallet), 0) AS balance,
  COALESCE((SELECT COUNT(*) FROM messages m WHERE m.user_wallet = u.wallet), 0) AS chats,
  COALESCE((SELECT COUNT(*) FROM tasks t WHERE t.user_wallet = u.wallet), 0) AS tasks_done,
  (SELECT MAX(x.created_at) FROM (
    SELECT m2.created_at FROM messages m2 WHERE m2.user_wallet = u.wallet
    UNION ALL
    SELECT l2.created_at FROM ledger l2 WHERE l2.user_wallet = u.wallet
    UNION ALL
    SELECT t2.verified_at AS created_at FROM tasks t2 WHERE t2.user_wallet = u.wallet
  ) x) AS last_active
FROM users u`;

export async function adminStats(): Promise<AdminStats> {
  const pg = isPostgres();
  const P = (i: number) => (pg ? `$${i}` : "?");
  const day1 = new Date(Date.now() - 864e5).toISOString();
  const day7 = new Date(Date.now() - 7 * 864e5).toISOString();
  const day14 = new Date(Date.now() - 14 * 864e5).toISOString();

  const count = async (sql: string, params: unknown[] = []) =>
    n((await get<{ c: unknown }>(sql, params))?.c);

  const users = await count("SELECT COUNT(*) AS c FROM users");
  const usersToday = await count(
    `SELECT COUNT(*) AS c FROM users WHERE created_at >= ${P(1)}`, [day1]);
  const chats = await count("SELECT COUNT(*) AS c FROM messages");
  const rewardedChats = await count(
    "SELECT COUNT(*) AS c FROM messages WHERE reward > 0");
  const pointsIssued = await count(
    "SELECT COALESCE(SUM(amount), 0) AS c FROM ledger");
  const tasksCompleted = await count("SELECT COUNT(*) AS c FROM tasks");
  const referralClicks = await count("SELECT COUNT(*) AS c FROM referral_clicks");
  const referralConversions = await count(
    "SELECT COUNT(*) AS c FROM referrals WHERE converted_at IS NOT NULL");

  const pointsBySource = (
    await all<{ source: string; points: unknown }>(
      "SELECT source, COALESCE(SUM(amount), 0) AS points FROM ledger GROUP BY source"
    )
  ).map((r) => ({ source: r.source, points: n(r.points) }));

  // Churn: users registered >7d ago with zero activity in the last 7d.
  const eligibleRows = await all<{ wallet: string }>(
    `SELECT wallet FROM users WHERE created_at < ${P(1)}`, [day7]);
  const activeRows = await all<{ w: string }>(
    `SELECT DISTINCT user_wallet AS w FROM messages WHERE created_at >= ${P(1)}
     UNION SELECT DISTINCT user_wallet FROM ledger WHERE created_at >= ${P(2)}
     UNION SELECT DISTINCT user_wallet FROM tasks WHERE verified_at >= ${P(3)}`,
    [day7, day7, day7]
  );
  const activeSet = new Set(activeRows.map((r) => r.w));
  const eligible = eligibleRows.length;
  const active7d = eligibleRows.filter((r) => activeSet.has(r.wallet)).length;
  const churned = eligible - active7d;

  // 14-day series: signups + distinct active wallets per day.
  const signupRows = await all<{ day: string; c: unknown }>(
    `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS c FROM users
     WHERE created_at >= ${P(1)} GROUP BY day`, [day14]);
  const activeDayRows = await all<{ day: string; c: unknown }>(
    `SELECT substr(created_at, 1, 10) AS day, COUNT(DISTINCT user_wallet) AS c FROM (
       SELECT user_wallet, created_at FROM messages WHERE created_at >= ${P(1)}
       UNION ALL
       SELECT user_wallet, created_at FROM ledger WHERE created_at >= ${P(1)}
       UNION ALL
       SELECT user_wallet, verified_at AS created_at FROM tasks WHERE verified_at >= ${P(1)}
     ) AS act GROUP BY day`, [day14]);
  const signupsByDay = new Map(signupRows.map((r) => [r.day, n(r.c)]));
  const activeByDay = new Map(activeDayRows.map((r) => [r.day, n(r.c)]));
  const daily: AdminStats["daily"] = [];
  for (let i = 13; i >= 0; i--) {
    const day = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    daily.push({ day, signups: signupsByDay.get(day) ?? 0, active: activeByDay.get(day) ?? 0 });
  }

  const mapUser = (r: Record<string, unknown>): AdminUserRow => ({
    wallet: String(r.wallet),
    x_handle: (r.x_handle as string | null) ?? null,
    created_at: String(r.created_at),
    balance: n(r.balance),
    chats: n(r.chats),
    tasks_done: n(r.tasks_done),
    last_active: (r.last_active as string | null) ?? null,
  });
  const recentUsers = (
    await all<Record<string, unknown>>(`${USER_STATS_SELECT} ORDER BY u.created_at DESC LIMIT 50`)
  ).map(mapUser);
  const topEarners = (
    await all<Record<string, unknown>>(
      `SELECT * FROM (${USER_STATS_SELECT}) s ORDER BY s.balance DESC LIMIT 20`
    )
  ).map(mapUser);

  return {
    totals: { users, usersToday, chats, rewardedChats, pointsIssued, tasksCompleted, referralClicks, referralConversions },
    pointsBySource,
    churn: { eligible, active7d, churned, churnRate: eligible > 0 ? churned / eligible : 0 },
    daily,
    recentUsers,
    topEarners,
  };
}

// ---------------------------------------------------------------------------
// Founding 100 — first 100 registered users get 2x chat earnings forever.
// ---------------------------------------------------------------------------

export const FOUNDING_CAP = 100;
export const FOUNDING_MULTIPLIER = 2;

/** Number of founding spots taken (capped at FOUNDING_CAP). */
export async function foundingSpotsTaken(): Promise<number> {
  const c = n((await get<{ c: unknown }>("SELECT COUNT(*) AS c FROM users"))?.c);
  return Math.min(c, FOUNDING_CAP);
}

/** True if this wallet is among the first FOUNDING_CAP registered users
 *  (ordered by created_at, wallet as tiebreak). Unknown wallets → false. */
export async function isFounding100(wallet: string): Promise<boolean> {
  const pg = isPostgres();
  const P = (i: number) => (pg ? `$${i}` : "?");
  const exists = await get<{ wallet: string }>(
    `SELECT wallet FROM users WHERE wallet = ${P(1)}`, [wallet]);
  if (!exists) return false;
  const row = await get<{ rank: unknown }>(
    `SELECT COUNT(*) AS rank FROM users WHERE
       created_at < (SELECT created_at FROM users WHERE wallet = ${P(1)})
       OR (created_at = (SELECT created_at FROM users WHERE wallet = ${P(2)})
           AND wallet < ${P(3)})`,
    [wallet, wallet, wallet]
  );
  return n(row?.rank) < FOUNDING_CAP;
}
