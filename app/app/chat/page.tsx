"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/components/WalletProvider";

interface Msg {
  role: "user" | "assistant";
  text: string;
  reward?: number;
  tier?: number;
  note?: string | null;
}

const TIER_LABEL: Record<number, string> = {
  1: "basic",
  2: "detailed",
  3: "deep",
};

export default function ChatPage() {
  const { wallet } = useWallet();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [daily, setDaily] = useState<{ used: number; cap: number } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const refreshDaily = useCallback(async () => {
    if (!wallet) return;
    try {
      const res = await fetch(`/api/dashboard?wallet=${encodeURIComponent(wallet)}`);
      if (res.ok) {
        const d = await res.json();
        setDaily(d.daily);
      }
    } catch {
      /* ignore */
    }
  }, [wallet]);

  useEffect(() => {
    setMessages([]);
    setError(null);
    refreshDaily();
  }, [wallet, refreshDaily]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || !wallet || loading) return;
    setInput("");
    setError(null);
    setMessages((m) => [...m, { role: "user", text }]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, message: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "something went wrong");
        return;
      }
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: data.reply,
          reward: data.reward,
          tier: data.tier,
          note: data.note,
        },
      ]);
      setDaily({ used: data.dailyUsed, cap: data.dailyCap });
    } catch {
      setError("network error — try again");
    } finally {
      setLoading(false);
    }
  };

  if (!wallet) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
        <p className="text-lg">Connect your wallet to start chatting.</p>
        <p className="mt-2 text-sm text-muted">
          Use the Connect button in the header — any address works in this demo.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Chat &amp; earn</h1>
        {daily && (
          <span className="rounded-full bg-white/5 px-4 py-1 font-mono text-sm text-cyan">
            today {daily.used}/{daily.cap} rewarded
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm">
          {error === "finish X tasks first" ? (
            <>
              Finish your X tasks first —{" "}
              <Link href="/app/tasks" className="font-semibold text-gold underline">
                go to Tasks
              </Link>
            </>
          ) : (
            error
          )}
        </div>
      )}

      <div className="flex h-[55vh] flex-col rounded-xl border border-white/10 bg-white/[0.03]">
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 && (
            <p className="mt-8 text-center text-sm text-muted">
              Ask anything about $YAPCP. Quality questions earn more: 100 / 300
              / 1,000 pts.
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-gold/20 text-ink"
                    : "border border-white/10 bg-white/5"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.text}</p>
                {m.role === "assistant" && m.reward !== undefined && m.reward > 0 && (
                  <div className="mt-2 inline-block rounded-full bg-cyan/15 px-2.5 py-0.5 font-mono text-xs text-cyan">
                    +{m.reward} pts · {TIER_LABEL[m.tier || 1]}
                  </div>
                )}
                {m.role === "assistant" && m.note && (
                  <div className="mt-2 text-xs text-muted">{m.note}</div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-muted">
                thinking…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="flex gap-2 border-t border-white/10 p-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            placeholder="Ask about $YAPCP…"
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm placeholder:text-muted/60 focus:border-gold focus:outline-none"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="rounded-lg bg-gold px-5 py-2.5 text-sm font-bold text-navy hover:brightness-110 disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">
        Max 1 rewarded message per 2 minutes • 20 rewarded messages/day •
        duplicates and off-topic messages earn 0 pts.
      </p>
    </div>
  );
}
