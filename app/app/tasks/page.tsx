"use client";
import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@/components/WalletProvider";

const POST_URL = process.env.NEXT_PUBLIC_LAUNCH_POST_URL || "#";

const TASK_DEFS = [
  { id: "like", title: "Like the post", text: "Tap like on the official launch post." },
  { id: "comment", title: "Comment on the post", text: "Leave a comment on the launch post." },
  { id: "retweet", title: "Retweet the post", text: "Retweet the launch post to your followers." },
];

interface Dash {
  x_handle: string | null;
  tasks: { like: boolean; comment: boolean; retweet: boolean; allDone: boolean };
  referral: { code: string | null; link: string | null };
}

export default function TasksPage() {
  const { wallet } = useWallet();
  const [handle, setHandle] = useState("");
  const [linked, setLinked] = useState<string | null>(null);
  const [tasks, setTasks] = useState({ like: false, comment: false, retweet: false });
  const [refLink, setRefLink] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justAwarded, setJustAwarded] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!wallet) return;
    try {
      const res = await fetch(`/api/dashboard?wallet=${encodeURIComponent(wallet)}`);
      if (res.ok) {
        const d: Dash = await res.json();
        setLinked(d.x_handle);
        if (d.x_handle) setHandle(d.x_handle);
        setTasks({ like: d.tasks.like, comment: d.tasks.comment, retweet: d.tasks.retweet });
        setRefLink(d.referral.link);
      }
    } catch {
      /* ignore */
    }
  }, [wallet]);

  useEffect(() => {
    setLinked(null);
    setRefLink(null);
    load();
  }, [wallet, load]);

  const linkHandle = async () => {
    if (!wallet || !handle.trim()) return;
    setBusy("link");
    setError(null);
    try {
      const referredBy = localStorage.getItem("yapfi_pending_referrer");
      const res = await fetch("/api/users/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet,
          x_handle: handle.trim(),
          referred_by: referredBy || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "link failed");
        return;
      }
      setLinked(data.x_handle);
      if (referredBy) localStorage.removeItem("yapfi_pending_referrer");
    } catch {
      setError("network error — try again");
    } finally {
      setBusy(null);
    }
  };

  const verify = async (task: string) => {
    if (!wallet) return;
    setBusy(task);
    setError(null);
    try {
      const res = await fetch("/api/tasks/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, task }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "verification failed");
        return;
      }
      setTasks((t) => ({ ...t, [task]: true }));
      if (data.bundleAwarded) {
        setJustAwarded(true);
        const dash = await fetch(`/api/dashboard?wallet=${encodeURIComponent(wallet)}`);
        if (dash.ok) {
          const d: Dash = await dash.json();
          setRefLink(d.referral.link);
        }
      }
    } catch {
      setError("network error — try again");
    } finally {
      setBusy(null);
    }
  };

  if (!wallet) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
        <p className="text-lg">Connect your wallet to see your tasks.</p>
      </div>
    );
  }

  const allDone = tasks.like && tasks.comment && tasks.retweet;

  return (
    <div>
      <h1 className="text-2xl font-bold">X tasks</h1>
      <p className="mt-1 text-sm text-muted">
        Complete all three on the launch post to unlock chat and earn a one-time{" "}
        <span className="font-semibold text-gold">5,000 pts</span> bonus.
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Step 1: link X handle */}
      <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5">
        <h2 className="font-semibold">1. Link your X account</h2>
        <p className="mt-1 text-xs text-muted">
          DEMO — handle is stored as typed. Production will use X OAuth.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@yourhandle"
            disabled={!!linked}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm placeholder:text-muted/60 focus:border-gold focus:outline-none disabled:opacity-60"
          />
          {!linked ? (
            <button
              onClick={linkHandle}
              disabled={busy === "link" || !handle.trim()}
              className="rounded-lg bg-gold px-5 py-2 text-sm font-bold text-navy hover:brightness-110 disabled:opacity-40"
            >
              {busy === "link" ? "Linking…" : "Link"}
            </button>
          ) : (
            <span className="rounded-lg bg-cyan/15 px-4 py-2 text-sm font-semibold text-cyan">
              @{linked} linked
            </span>
          )}
        </div>
      </div>

      {/* Step 2: the three tasks */}
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {TASK_DEFS.map((t) => {
          const done = tasks[t.id as keyof typeof tasks];
          const enabled = !!linked && !done;
          return (
            <div
              key={t.id}
              className="flex flex-col rounded-xl border border-white/10 bg-white/5 p-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{t.title}</h3>
                {done && <span className="text-xl text-cyan">✓</span>}
              </div>
              <p className="mt-1 flex-1 text-sm text-muted">{t.text}</p>
              <a
                href={POST_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-3 text-sm text-cyan underline underline-offset-2"
              >
                Open the launch post
              </a>
              <button
                onClick={() => verify(t.id)}
                disabled={!enabled || busy === t.id}
                className="mt-3 rounded-lg bg-gold px-4 py-2 text-sm font-bold text-navy hover:brightness-110 disabled:opacity-40"
              >
                {done ? "Verified" : busy === t.id ? "Verifying…" : "Verify"}
              </button>
              <p className="mt-2 text-[11px] text-muted">
                DEMO — self-confirm. Set X_BEARER_TOKEN for real verification.
              </p>
            </div>
          );
        })}
      </div>

      {justAwarded && (
        <div className="mt-6 rounded-xl border border-gold/40 bg-gold/10 p-6 text-center">
          <p className="text-xl font-bold text-gold">+5,000 pts — bundle complete!</p>
          <p className="mt-1 text-sm text-muted">
            Chat is unlocked. Here is your referral link — share it to earn 2,500
            pts per friend + 10% of their chat earnings.
          </p>
        </div>
      )}

      {allDone && refLink && (
        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5">
          <h2 className="font-semibold">Your referral link</h2>
          <div className="mt-3 flex gap-2">
            <input
              readOnly
              value={refLink}
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 font-mono text-sm text-cyan"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(refLink).catch(() => {});
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="rounded-lg bg-gold px-4 py-2 text-sm font-bold text-navy hover:brightness-110"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
