"use client";

import { useCallback, useEffect, useState } from "react";

interface UserRow {
  wallet: string;
  x_handle: string | null;
  created_at: string;
  balance: number;
  chats: number;
  tasks_done: number;
  last_active: string | null;
}

interface Stats {
  totals: {
    users: number; usersToday: number; chats: number; rewardedChats: number;
    pointsIssued: number; tasksCompleted: number; referralClicks: number;
    referralConversions: number;
  };
  pointsBySource: { source: string; points: number }[];
  churn: { eligible: number; active7d: number; churned: number; churnRate: number };
  daily: { day: string; signups: number; active: number }[];
  recentUsers: UserRow[];
  topEarners: UserRow[];
}

const trunc = (w: string) => (w.length > 12 ? `${w.slice(0, 6)}…${w.slice(-4)}` : w);
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <p className="font-mono text-[11px] uppercase tracking-wider text-faint">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-ink">{value}</p>
      {sub && <p className="mt-1 font-mono text-xs text-muted">{sub}</p>}
    </div>
  );
}

function UserTable({ rows }: { rows: UserRow[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-card">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-line font-mono text-[11px] uppercase tracking-wider text-faint">
            <th className="px-4 py-3">wallet</th>
            <th className="px-4 py-3">x handle</th>
            <th className="px-4 py-3">joined</th>
            <th className="px-4 py-3">chats</th>
            <th className="px-4 py-3">tasks</th>
            <th className="px-4 py-3">points</th>
            <th className="px-4 py-3">last active</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.wallet} className="border-b border-line last:border-0 hover:bg-wash">
              <td className="px-4 py-2.5 font-mono text-xs text-ink">{trunc(u.wallet)}</td>
              <td className="px-4 py-2.5 text-muted">{u.x_handle ? `@${u.x_handle}` : "—"}</td>
              <td className="px-4 py-2.5 text-muted">{fmtDate(u.created_at)}</td>
              <td className="px-4 py-2.5 text-ink">{u.chats}</td>
              <td className="px-4 py-2.5 text-ink">{u.tasks_done}/3</td>
              <td className="px-4 py-2.5 font-medium text-ink">{u.balance.toLocaleString("en-IN")}</td>
              <td className="px-4 py-2.5 text-muted">{fmtDate(u.last_active)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={7} className="px-4 py-8 text-center text-faint">no users yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (k: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/stats", { headers: { "x-admin-key": k } });
      if (res.status === 401) throw new Error("wrong key");
      if (res.status === 503) throw new Error("ADMIN_KEY is not set on the server yet");
      if (!res.ok) throw new Error("failed to load");
      setStats(await res.json());
      setAuthed(true);
      sessionStorage.setItem("yapfi-admin-key", k);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem("yapfi-admin-key");
    if (saved) { setKey(saved); load(saved); }
  }, [load]);

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-5">
        <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-8 shadow-card">
          <p className="font-mono text-xs text-faint">yapfi · admin</p>
          <h1 className="mt-2 text-2xl font-semibold text-ink">private dashboard</h1>
          <p className="mt-2 text-sm text-muted">enter your admin key to view user analytics.</p>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && key && load(key)}
            placeholder="admin key"
            className="mt-5 w-full rounded-xl border border-line px-4 py-3 text-sm text-ink outline-none placeholder:text-faint focus:border-ink"
          />
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <button
            onClick={() => key && load(key)}
            disabled={!key || loading}
            className="mt-4 w-full rounded-xl bg-ink px-4 py-3 text-sm font-medium text-white disabled:opacity-40"
          >
            {loading ? "checking…" : "unlock"}
          </button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return <div className="flex min-h-screen items-center justify-center text-faint">loading…</div>;
  }

  const t = stats.totals;
  const maxDay = Math.max(1, ...stats.daily.map((d) => Math.max(d.signups, d.active)));
  const maxSrc = Math.max(1, ...stats.pointsBySource.map((s) => s.points));

  return (
    <div className="min-h-screen bg-white px-5 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="font-mono text-xs text-faint">yapfi · admin</p>
            <h1 className="mt-1 text-3xl font-semibold text-ink">analytics</h1>
          </div>
          <button
            onClick={() => { sessionStorage.removeItem("yapfi-admin-key"); setAuthed(false); setStats(null); setKey(""); }}
            className="rounded-full border border-line px-4 py-2 font-mono text-xs text-muted hover:text-ink"
          >
            lock
          </button>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card label="registered users" value={t.users.toLocaleString("en-IN")} sub={`+${t.usersToday} today`} />
          <Card label="total chats" value={t.chats.toLocaleString("en-IN")} sub={`${t.rewardedChats.toLocaleString("en-IN")} rewarded`} />
          <Card label="points issued" value={t.pointsIssued.toLocaleString("en-IN")} sub="all sources" />
          <Card label="tasks completed" value={t.tasksCompleted.toLocaleString("en-IN")} sub="follow+like+retweet" />
          <Card label="referral clicks" value={t.referralClicks.toLocaleString("en-IN")} />
          <Card label="referral conversions" value={t.referralConversions.toLocaleString("en-IN")} sub="finished tasks" />
          <Card
            label="churn rate (7d)"
            value={`${Math.round(stats.churn.churnRate * 100)}%`}
            sub={`${stats.churn.churned} churned · ${stats.churn.active7d} active of ${stats.churn.eligible} eligible`}
          />
          <Card
            label="avg chats / user"
            value={t.users > 0 ? (t.chats / t.users).toFixed(1) : "0"}
            sub={`avg points / user: ${t.users > 0 ? Math.round(t.pointsIssued / t.users).toLocaleString("en-IN") : 0}`}
          />
        </div>

        <h2 className="mt-10 font-mono text-xs uppercase tracking-wider text-faint">points by source</h2>
        <div className="mt-3 rounded-2xl border border-line bg-white p-5 shadow-card">
          {stats.pointsBySource.map((s) => (
            <div key={s.source} className="mb-3 last:mb-0">
              <div className="flex justify-between font-mono text-xs text-muted">
                <span>{s.source}</span><span>{s.points.toLocaleString("en-IN")}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-wash">
                <div className="h-2 rounded-full bg-ink" style={{ width: `${Math.round((s.points / maxSrc) * 100)}%` }} />
              </div>
            </div>
          ))}
          {stats.pointsBySource.length === 0 && <p className="text-sm text-faint">no points issued yet</p>}
        </div>

        <h2 className="mt-10 font-mono text-xs uppercase tracking-wider text-faint">last 14 days</h2>
        <div className="mt-3 rounded-2xl border border-line bg-white p-5 shadow-card">
          <div className="flex items-end justify-between gap-1" style={{ height: 120 }}>
            {stats.daily.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${d.day}: ${d.signups} signups, ${d.active} active`}>
                <div className="w-full max-w-[14px] rounded-sm bg-ink" style={{ height: `${Math.max(2, (d.active / maxDay) * 100)}%`, opacity: 0.85 }} />
                <div className="w-full max-w-[14px] rounded-sm bg-line" style={{ height: `${Math.max(2, (d.signups / maxDay) * 100)}%` }} />
                <span className="font-mono text-[9px] text-faint">{d.day.slice(5)}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 font-mono text-[11px] text-faint">dark = active users · light = new signups (hover a day for numbers)</p>
        </div>

        <h2 className="mt-10 font-mono text-xs uppercase tracking-wider text-faint">top earners</h2>
        <div className="mt-3"><UserTable rows={stats.topEarners} /></div>

        <h2 className="mt-10 font-mono text-xs uppercase tracking-wider text-faint">recent users</h2>
        <div className="mt-3"><UserTable rows={stats.recentUsers} /></div>

        <p className="mt-8 text-center font-mono text-[11px] text-faint">
          churn = registered &gt;7 days ago with zero activity in the last 7 days
        </p>
      </div>
    </div>
  );
}
