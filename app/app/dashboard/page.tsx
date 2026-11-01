"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/components/WalletProvider";

interface Dash {
  balance: number;
  split: { chat: number; tasks: number; referrals: number };
  tasks: { follow: boolean; like: boolean; retweet: boolean; allDone: boolean };
  referral: {
    code: string | null;
    link: string | null;
    clicks: number;
    conversions: number;
    earnings: number;
  };
  daily: { used: number; cap: number };
  claimOpen: boolean;
  founding: { isFounding: boolean; spotsTaken: number; cap: number };
}

export default function DashboardPage() {
  const { wallet } = useWallet();
  const [data, setData] = useState<Dash | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!wallet) return;
    try {
      const res = await fetch(
        `/api/dashboard?wallet=${encodeURIComponent(wallet)}`
      );
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
      <div className="py-14 text-center">
        <p className="text-lg font-light text-ink">
          connect your wallet to see your dashboard.
        </p>
      </div>
    );
  }
  if (!data) {
    return <p className="py-14 text-center font-mono text-xs text-faint">loading…</p>;
  }

  const pct = Math.min(100, Math.round((data.daily.used / data.daily.cap) * 100));

  return (
    <div>
      <h1 className="text-xl font-light lowercase text-ink">dashboard</h1>

      {/* balance */}
      <div className="mt-8 border-t border-line pt-8 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
          total points
        </p>
        <p className="mt-2 text-6xl font-light tracking-tight text-ink md:text-7xl">
          {data.balance.toLocaleString()}
        </p>
        <p className="mt-3 font-mono text-[11px] text-faint">
          1 point = 1 $YAPCP · claimable after launch
        </p>
        {data.founding?.isFounding ? (
          <p className="mt-3 inline-block rounded-full bg-ink px-4 py-1.5 font-mono text-[11px] text-white">
            founding 100 · 2x chat earnings forever
          </p>
        ) : (
          data.founding && data.founding.spotsTaken < data.founding.cap && (
            <p className="mt-3 font-mono text-[11px] text-muted">
              founding 100: {data.founding.cap - data.founding.spotsTaken} spots left for 2x earnings
            </p>
          )
        )}
      </div>

      {/* split */}
      <div className="mt-8 border-t border-line">
        {(
          [
            ["chat", data.split.chat],
            ["tasks", data.split.tasks],
            ["referrals", data.split.referrals],
          ] as const
        ).map(([label, value]) => (
          <div
            key={label}
            className="flex items-baseline justify-between border-b border-line py-3.5"
          >
            <span className="font-mono text-xs uppercase tracking-[0.14em] text-faint">
              {label}
            </span>
            <span className="font-mono text-sm text-ink">
              {value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      {/* today's progress */}
      <div className="mt-10">
        <div className="flex items-baseline justify-between">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
            today
          </p>
          <p className="font-mono text-sm text-ink">
            {data.daily.used}
            <span className="text-faint">/{data.daily.cap}</span>
          </p>
        </div>
        <div className="mt-3 h-px bg-line">
          <div className="h-px bg-ink" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 font-mono text-[10px] text-faint">
          rewarded messages today
        </p>
      </div>

      {/* x tasks checklist */}
      <div className="mt-10 border-t border-line pt-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
          x tasks
        </p>
        <div className="mt-2">
          {(["follow", "like", "retweet"] as const).map((t) => (
            <div
              key={t}
              className="flex items-center justify-between border-b border-line py-3"
            >
              <span className="text-sm text-muted">{t}</span>
              <span
                className={`font-mono text-[11px] ${data.tasks[t] ? "text-ink" : "text-faint"}`}
              >
                {data.tasks[t] ? "done" : "todo"}
              </span>
            </div>
          ))}
        </div>
        {!data.tasks.allDone && (
          <Link
            href="/app/tasks"
            className="mt-4 inline-block font-mono text-xs text-muted underline underline-offset-2 hover:text-ink"
          >
            finish tasks
          </Link>
        )}
      </div>

      {/* referrals */}
      <div className="mt-10 border-t border-line pt-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
          referrals
        </p>
        {data.referral.link ? (
          <>
            <div className="mt-4 flex gap-2">
              <input
                readOnly
                value={data.referral.link}
                onClick={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-xl border border-line bg-wash px-4 py-2.5 font-mono text-xs text-muted focus:border-ink focus:outline-none"
              />
              <button
                onClick={() => {
                  if (data.referral.link) {
                    navigator.clipboard.writeText(data.referral.link).catch(() => {});
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }
                }}
                className="shrink-0 rounded-full border border-ink bg-white px-5 py-2.5 text-sm text-ink transition hover:bg-ink hover:text-white"
              >
                {copied ? "copied" : "copy"}
              </button>
            </div>
            <div className="mt-5 flex gap-8">
              {(
                [
                  ["clicks", data.referral.clicks],
                  ["conversions", data.referral.conversions],
                  ["earnings", `${data.referral.earnings.toLocaleString()} pts`],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
                    {label}
                  </p>
                  <p className="mt-1 font-mono text-sm text-ink">{value}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted">
            finish the x tasks to unlock your referral link.
          </p>
        )}
      </div>

      {/* claim */}
      <div className="mt-10 border-t border-line pt-10 text-center">
        <button
          disabled
          className="cursor-not-allowed rounded-full border border-line bg-wash px-10 py-3 text-base text-faint"
        >
          claim $YAPCP
        </button>
        <p className="mt-3 font-mono text-[11px] text-faint">
          claim opens at $YAPCP launch.
        </p>
      </div>
    </div>
  );
}
