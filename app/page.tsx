"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WalletProvider } from "@/components/WalletProvider";
import Corners from "@/components/Corners";
import GlyphField from "@/components/GlyphField";
import ChatInput from "@/components/ChatInput";
import ScrambleHeading from "@/components/ScrambleHeading";

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

const SUGGESTIONS = ["what is $YAPCP?", "how do I earn?", "i want in"];

const STEPS = [
  ["01", "connect wallet", "link your solana wallet. one wallet per account."],
  ["02", "enter your x id", "drop your handle and link your account."],
  [
    "03",
    "follow · like · retweet",
    "do all three on the launch post, get verified, earn 5,000 pts.",
  ],
  [
    "04",
    "chat & earn",
    "ask quality questions about $YAPCP. better questions, more points.",
  ],
  [
    "05",
    "refer & earn more",
    "share your link: 300 pts per friend + 10% of their chat earnings.",
  ],
];

const REWARDS: [string, string][] = [
  ["basic question", "100 pts"],
  ["detailed question", "300 pts"],
  ["deep / researched question", "1,000 pts"],
  ["x task bundle", "5,000 pts · one-time"],
  ["referral converts", "300 pts"],
  ["referral chat earnings", "10% · forever"],
  ["daily cap", "20 rewarded msgs · ~20,000 pts max"],
];

const TOKENOMICS: [string, string][] = [
  ["chat & task rewards", "40%"],
  ["referral pool", "15%"],
  ["liquidity", "15%"],
  ["team · vested", "15%"],
  ["treasury", "15%"],
];

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
      {children}
    </p>
  );
}

function Hero() {
  const router = useRouter();
  const [value, setValue] = useState("");

  const go = (text: string) => {
    const t = text.trim();
    if (!t) return;
    router.push(`/app/chat?q=${encodeURIComponent(t)}`);
  };

  return (
    <section className="relative z-10 mx-auto flex min-h-[92dvh] w-full max-w-3xl flex-col items-center justify-center px-5 pb-16 pt-28">
      <ScrambleHeading
        text="what do you want to know?"
        className="text-center text-4xl font-light tracking-tight text-ink md:text-[3.4rem] md:leading-[1.1]"
      />
      <p className="mt-4 text-center text-[15px] text-muted">
        yapfi is a chat-to-earn wrapper for $YAPCP — ask, learn, earn.
      </p>

      <div className="mt-8 w-full max-w-[660px]">
        <ChatInput
          value={value}
          onChange={setValue}
          onSend={() => go(value)}
          placeholder="Ask YapFi anything..."
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => go(s)}
            className="rounded-full border border-line bg-white px-4 py-1.5 font-mono text-xs text-muted shadow-sm transition hover:border-faint hover:text-ink"
          >
            {s}
          </button>
        ))}
      </div>

      <p className="mt-10 max-w-md text-center font-mono text-[11px] leading-relaxed text-faint">
        points are pre-launch and convert 1:1 to $YAPCP at TGE · not financial
        advice · not affiliated with x
      </p>
    </section>
  );
}

export default function Landing() {
  return (
    <WalletProvider>
      <div className="relative min-h-screen bg-white text-ink">
        <GlyphField />
        <Corners />
        <Suspense fallback={null}>
          <ReferralCapture />
        </Suspense>

        <Hero />

        {/* how it works */}
        <section className="relative z-10 mx-auto max-w-3xl px-5 py-16">
          <div className="border-t border-line pt-10">
            <SectionLabel>how it works</SectionLabel>
            <div className="mt-6">
              {STEPS.map(([n, title, text]) => (
                <div
                  key={n}
                  className="flex gap-5 border-b border-line py-5 first:border-t"
                >
                  <span className="w-8 shrink-0 font-mono text-xs text-faint">
                    {n}
                  </span>
                  <div>
                    <h3 className="text-[15px] text-ink">{title}</h3>
                    <p className="mt-0.5 text-sm text-muted">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* earnings */}
        <section className="relative z-10 mx-auto max-w-3xl px-5 py-16">
          <div className="border-t border-line pt-10">
            <SectionLabel>earnings</SectionLabel>
            <p className="mt-4 text-sm text-muted">
              pre-launch you earn points — 1 point = 1 $YAPCP, claimable after
              launch.
            </p>
            <div className="mt-6">
              {REWARDS.map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-baseline justify-between gap-4 border-b border-line py-3.5 first:border-t"
                >
                  <span className="text-sm text-muted">{label}</span>
                  <span className="shrink-0 font-mono text-sm text-ink">
                    {value}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-6 font-mono text-[11px] leading-relaxed text-faint">
              1 rewarded message per 2 min · duplicates &amp; off-topic earn 0 ·
              paid from a fixed daily pool, so rewards can&apos;t inflate
            </p>
          </div>
        </section>

        {/* tokenomics */}
        <section className="relative z-10 mx-auto max-w-3xl px-5 py-16">
          <div className="border-t border-line pt-10">
            <SectionLabel>$YAPCP · 100,000,000,000 supply</SectionLabel>
            <div className="mt-6">
              {TOKENOMICS.map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-baseline justify-between gap-4 border-b border-line py-3.5 first:border-t"
                >
                  <span className="text-sm text-muted">{label}</span>
                  <span className="shrink-0 font-mono text-sm text-ink">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer className="relative z-10 border-t border-line px-5 py-8">
          <p className="text-center font-mono text-[11px] text-faint">
            nothing here is financial advice
          </p>
        </footer>
      </div>
    </WalletProvider>
  );
}
