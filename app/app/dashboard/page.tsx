"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/components/WalletProvider";

interface Dash {
  balance: number;
  split: { chat: number; tasks: number; referrals: number };
  tasks: { like: boolean; comment: boolean; retweet: boolean; allDone: boolean };
  referral: {
    code: string | null;
    link: string | null;
    clicks: number;
    conversions: number;
    earnings: number;
  };
  daily: { used: number; cap: number };
  claimOpen: boolean;
}

export default function DashboardPage() {
  const { wallet } = useWallet();
  const [data, setData] = useState<Dash | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!wallet) return;
    try {
      const res = await fetch(`/api/dashboard?wallet=${encodeURIComponent(wallet)}`);
      if (res.ok) setData(await res.json());
    } catch {
      /* ignore */
    }
  }, [wallet]);

  useEffect(() => {
    setData(null);
    load();
  }, [wallet, load]);

  if (!wallet) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
        <p className="text-lg">Connect your wallet to see your dashboard.</p>
      </div>
    );
  }
  if (!data) {
    return <p className="text-muted">Loading…</p>;
  }

  const pct = Math.min(100, Math.round((data.daily.used / data.daily.cap) * 100));

  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Balance */}
      <div className="mt-6 rounded-xl border border-gold/30 bg-gradient-to-br from-gold/15 to-transparent p-6 text-center">
        <p className="text-sm text-muted">Total points</p>
        <p className="mt-1 font-mono text-5xl font-extrabold text-gold">
          {data.balance.toLocaleString()}
        </p>
        <p className="mt-1 text-xs text-muted">
          1 point = 1 $YAPCP • claimable after launch
        </p>
        <div className="mx-auto mt-4 flex max-w-md justify-center gap-6 text-sm">
          <span>
            Chat <span className="font-mono text-cyan">{data.split.chat.toLocaleString()}</span>
          </span>
          <span>
            Tasks <span className="font-mono text-cyan">{data.split.tasks.toLocaleString()}</span>
          </span>
          <span>
            Referrals{" "}
            <span className="font-mono text-cyan">{data.split.referrals.toLocaleString()}</span>
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {/* Today's progress */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <h2 className="font-semibold">Today&apos;s progress</h2>
          <p className="mt-2 font-mono text-2xl">
            {data.daily.used}
            <span className="text-muted">/{data.daily.cap}</span>
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-cyan" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted">rewarded messages today</p>
        </div>

        {/* Task checklist */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <h2 className="font-semibold">X tasks</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {(["like", "comment", "retweet"] as const).map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span className={data.tasks[t] ? "text-cyan" : "text-muted"}>
                  {data.tasks[t] ? "✓" : "○"}
                </span>
                <span className="capitalize text-muted">{t}</span>
              </li>
            ))}
          </ul>
          {!data.tasks.allDone && (
            <Link href="/app/tasks" className="mt-3 inline-block text-sm text-gold underline underline-offset-2">
              Finish tasks
            </Link>
          )}
        </div>
      </div>

      {/* Referral panel */}
      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-5">
        <h2 className="font-semibold">Referrals</h2>
        {data.referral.link ? (
          <>
            <div className="mt-3 flex gap-2">
              <input
                readOnly
                value={data.referral.link}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 font-mono text-sm text-cyan"
              />
              <button
                onClick={() => {
                  if (data.referral.link) {
                    navigator.clipboard.writeText(data.referral.link).catch(() => {});
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }
                }}
                className="rounded-lg bg-gold px-4 py-2 text-sm font-bold text-navy hover:brightness-110"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="mt-4 flex gap-6 text-sm text-muted">
              <span>
                Clicks <span className="font-mono text-ink">{data.referral.clicks}</span>
              </span>
              <span>
                Conversions{" "}
                <span className="font-mono text-ink">{data.referral.conversions}</span>
              </span>
              <span>
                Earnings{" "}
                <span className="font-mono text-cyan">
                  {data.referral.earnings.toLocaleString()} pts
                </span>
              </span>
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">
            Finish the X tasks to unlock your referral link.
          </p>
        )}
      </div>

      {/* Claim */}
      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-5 text-center">
        <button
          disabled
          className="cursor-not-allowed rounded-xl bg-white/10 px-8 py-3 text-lg font-bold text-muted"
        >
          Claim $YAPCP
        </button>
        <p className="mt-2 text-xs text-muted">Claim opens at $YAPCP launch.</p>
      </div>
    </div>
  );
}
