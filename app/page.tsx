"use client";
import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

function ReferralCapture() {
  const params = useSearchParams();
  useEffect(() => {
    const r = params.get("r");
    if (r) {
      const code = r.trim().toUpperCase();
      localStorage.setItem("yapfi_pending_referrer", code);
      fetch("/api/referral/click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      }).catch(() => {});
    }
  }, [params]);
  return null;
}

const STEPS = [
  {
    n: "1",
    title: "Connect wallet",
    text: "Link your Solana wallet. One wallet per account.",
  },
  {
    n: "2",
    title: "Enter your X ID",
    text: "Drop your Twitter handle and link your account.",
  },
  {
    n: "3",
    title: "Like • Comment • Retweet",
    text: "Do all three on the launch post, get verified, earn 5,000 pts.",
  },
  {
    n: "4",
    title: "Chat & earn",
    text: "Ask quality questions about $YAPCP. Better questions, more points.",
  },
  {
    n: "5",
    title: "Refer & earn more",
    text: "Share your link: 2,500 pts per friend + 10% of their chat earnings.",
  },
];

const REWARDS: [string, string][] = [
  ["Basic question", "100 pts"],
  ["Detailed question", "300 pts"],
  ["Deep / researched question", "1,000 pts"],
  ["Daily cap", "20 rewarded messages (~20,000 pts max)"],
  ["X task bundle (like + comment + retweet)", "5,000 pts — one-time"],
  ["Referral", "2,500 pts + 10% of referee chat earnings"],
];

export default function Landing() {
  return (
    <div className="min-h-screen">
      <Suspense fallback={null}>
        <ReferralCapture />
      </Suspense>

      {/* Hero */}
      <section className="mx-auto flex max-w-4xl flex-col items-center px-4 pb-16 pt-20 text-center">
        <Image
          src="/logo.svg"
          alt="YapFi logo"
          width={200}
          height={200}
          className="rounded-2xl"
          priority
        />
        <h1 className="mt-8 text-5xl font-extrabold tracking-tight md:text-6xl">
          YapFi
        </h1>
        <p className="mt-4 text-2xl font-semibold text-gold">
          Ask. Learn. Earn.
        </p>
        <p className="mt-4 max-w-xl text-muted">
          A chat-to-earn AI wrapper for the{" "}
          <span className="font-semibold text-ink">$YAPCP</span> token. The more
          you yap, the more you earn.
        </p>
        <p className="mt-3 font-mono text-sm text-cyan">
          $YAPCP • 100,000,000,000 supply • claimable after launch
        </p>
        <Link
          href="/app/chat"
          className="mt-10 rounded-xl bg-gold px-8 py-3 text-lg font-bold text-navy hover:brightness-110"
        >
          Launch app
        </Link>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-4 pb-16">
        <h2 className="text-center text-3xl font-bold">How it works</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-5">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="rounded-xl border border-white/10 bg-white/5 p-5"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/20 font-bold text-gold">
                {s.n}
              </div>
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Rewards */}
      <section className="mx-auto max-w-3xl px-4 pb-16">
        <h2 className="text-center text-3xl font-bold">Rewards</h2>
        <p className="mt-2 text-center text-sm text-muted">
          Pre-launch you earn points — 1 point = 1 $YAPCP, claimable after
          launch.
        </p>
        <div className="mt-8 overflow-hidden rounded-xl border border-white/10">
          {REWARDS.map(([label, value], i) => (
            <div
              key={label}
              className={`flex items-center justify-between px-6 py-4 ${
                i % 2 === 0 ? "bg-white/5" : "bg-transparent"
              }`}
            >
              <span className="text-muted">{label}</span>
              <span className="font-mono font-semibold text-cyan">{value}</span>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link
            href="/app/chat"
            className="rounded-xl bg-gold px-8 py-3 text-lg font-bold text-navy hover:brightness-110"
          >
            Start earning
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/10 px-4 py-8 text-center text-xs text-muted">
        YapFi prototype — points have no value until $YAPCP launches. Demo
        build, not financial advice.
      </footer>
    </div>
  );
}
