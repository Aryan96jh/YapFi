"use client";
import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@/components/WalletProvider";

const POST_URL = process.env.NEXT_PUBLIC_LAUNCH_POST_URL || "#";

const TASK_DEFS = [
  {
    id: "like",
    title: "like the post",
    text: "tap like on the official launch post.",
  },
  {
    id: "comment",
    title: "comment on the post",
    text: "leave a comment on the launch post.",
  },
  {
    id: "retweet",
    title: "retweet the post",
    text: "retweet the launch post to your followers.",
  },
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
  const [tasks, setTasks] = useState({
    like: false,
    comment: false,
    retweet: false,
  });
  const [refLink, setRefLink] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justAwarded, setJustAwarded] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!wallet) return;
    try {
      const res = await fetch(
        `/api/dashboard?wallet=${encodeURIComponent(wallet)}`
      );
      if (res.ok) {
        const d: Dash = await res.json();
        setLinked(d.x_handle);
        if (d.x_handle) setHandle(d.x_handle);
        setTasks({
          like: d.tasks.like,
          comment: d.tasks.comment,
          retweet: d.tasks.retweet,
        });
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
        const dash = await fetch(
          `/api/dashboard?wallet=${encodeURIComponent(wallet)}`
        );
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
      <div className="py-14 text-center">
        <p className="text-lg font-light text-ink">
          connect your wallet to see your tasks.
        </p>
      </div>
    );
  }

  const allDone = tasks.like && tasks.comment && tasks.retweet;

  return (
    <div>
      <h1 className="text-xl font-light lowercase text-ink">x tasks</h1>
      <p className="mt-2 text-sm text-muted">
        complete all three on the launch post to unlock chat and earn a
        one-time <span className="font-mono text-ink">5,000 pts</span> bonus.
      </p>

      {error && (
        <div className="mt-5 rounded-2xl border border-line bg-white px-5 py-4 text-sm text-ink shadow-sm">
          {error}
        </div>
      )}

      {/* 01 — link x handle */}
      <div className="mt-8 border-t border-line pt-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
          01 — link x
        </p>
        <div className="mt-4 flex gap-2">
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@yourhandle"
            disabled={!!linked}
            className="min-w-0 flex-1 rounded-xl border border-line bg-white px-4 py-2.5 text-sm text-ink placeholder:text-faint focus:border-ink focus:outline-none disabled:bg-wash disabled:text-muted"
          />
          {!linked ? (
            <button
              onClick={linkHandle}
              disabled={busy === "link" || !handle.trim()}
              className="shrink-0 rounded-full bg-ink px-6 py-2.5 text-sm text-white transition hover:opacity-80 disabled:opacity-30"
            >
              {busy === "link" ? "linking…" : "link"}
            </button>
          ) : (
            <span className="shrink-0 rounded-full border border-line bg-wash px-5 py-2.5 font-mono text-sm text-muted">
              @{linked}
            </span>
          )}
        </div>
        <p className="mt-2 font-mono text-[10px] text-faint">
          demo — handle is stored as typed. production will use x oauth.
        </p>
      </div>

      {/* 02 — the three tasks */}
      <div className="mt-8 border-t border-line pt-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
          02 — engage
        </p>
        <div className="mt-2">
          {TASK_DEFS.map((t) => {
            const done = tasks[t.id as keyof typeof tasks];
            const enabled = !!linked && !done;
            return (
              <div
                key={t.id}
                className="flex items-center justify-between gap-4 border-b border-line py-5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-[15px] text-ink">{t.title}</h3>
                    {done && (
                      <span className="font-mono text-[11px] text-muted">
                        verified
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-muted">{t.text}</p>
                  <a
                    href={POST_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 inline-block font-mono text-xs text-muted underline underline-offset-2 hover:text-ink"
                  >
                    open the launch post
                  </a>
                  <p className="mt-1 font-mono text-[10px] text-faint">
                    demo — self-confirm. set X_BEARER_TOKEN for real
                    verification.
                  </p>
                </div>
                <button
                  onClick={() => verify(t.id)}
                  disabled={!enabled || busy === t.id}
                  className={`shrink-0 rounded-full px-5 py-2 text-sm transition ${
                    done
                      ? "cursor-default border border-line bg-wash text-faint"
                      : "border border-ink bg-white text-ink hover:bg-ink hover:text-white disabled:opacity-30"
                  }`}
                >
                  {done
                    ? "done"
                    : busy === t.id
                      ? "verifying…"
                      : "verify"}
                </button>
              </div>
            );
          })}
        </div>
        {!linked && (
          <p className="mt-4 font-mono text-[11px] text-faint">
            link your x handle above to enable verification.
          </p>
        )}
      </div>

      {justAwarded && (
        <div className="mt-10 border-t border-line pt-10 text-center">
          <p className="text-4xl font-light text-ink">+5,000 pts</p>
          <p className="mt-2 font-mono text-xs text-muted">
            bundle complete — chat is unlocked
          </p>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted">
            here is your referral link — share it to earn 2,500 pts per friend
            + 10% of their chat earnings.
          </p>
        </div>
      )}

      {allDone && refLink && (
        <div className="mt-10 border-t border-line pt-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
            03 — your referral link
          </p>
          <div className="mt-4 flex gap-2">
            <input
              readOnly
              value={refLink}
              onClick={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-xl border border-line bg-wash px-4 py-2.5 font-mono text-xs text-muted focus:border-ink focus:outline-none"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(refLink).catch(() => {});
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="shrink-0 rounded-full border border-ink bg-white px-5 py-2.5 text-sm text-ink transition hover:bg-ink hover:text-white"
            >
              {copied ? "copied" : "copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
