"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/components/WalletProvider";
import ChatInput from "@/components/ChatInput";

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
  const pendingQ = useRef<string | null>(null);
  const prevWallet = useRef<string | null | undefined>(undefined);

  const refreshDaily = useCallback(async () => {
    if (!wallet) return;
    try {
      const res = await fetch(
        `/api/dashboard?wallet=${encodeURIComponent(wallet)}`
      );
      if (res.ok) {
        const d = await res.json();
        setDaily(d.daily);
      }
    } catch {
      /* ignore */
    }
  }, [wallet]);

  const doSend = useCallback(async (text: string, w: string) => {
    setError(null);
    setMessages((m) => [...m, { role: "user", text }]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: w, message: text }),
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
  }, []);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text || !wallet || loading) return;
    setInput("");
    void doSend(text, wallet);
  }, [input, wallet, loading, doSend]);

  // hero prefill: ?q= arrives from the landing input — capture once
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q")?.trim();
    if (!q) return;
    window.history.replaceState(null, "", "/app/chat");
    pendingQ.current = q;
    setInput(q);
  }, []);

  // wallet lifecycle: reset the thread when the identity changes,
  // auto-send a pending hero question on first connect
  useEffect(() => {
    const was = prevWallet.current;
    prevWallet.current = wallet;
    if (was !== undefined && was !== wallet) setMessages([]);
    setError(null);
    refreshDaily();
    if (was === null && wallet && pendingQ.current) {
      const q = pendingQ.current;
      pendingQ.current = null;
      setInput("");
      void doSend(q, wallet);
    }
  }, [wallet, refreshDaily, doSend]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex min-h-[62dvh] flex-col">
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-xl font-light lowercase text-ink">chat &amp; earn</h1>
        {daily && wallet && (
          <span className="font-mono text-xs text-faint">
            today {daily.used}/{daily.cap} rewarded
          </span>
        )}
      </div>

      {error && (
        <div className="mb-5 rounded-2xl border border-line bg-white px-5 py-4 text-sm text-ink shadow-sm">
          {error === "finish X tasks first" ? (
            <>
              finish your x tasks first —{" "}
              <Link href="/app/tasks" className="underline underline-offset-2">
                go to tasks
              </Link>
            </>
          ) : (
            error
          )}
        </div>
      )}

      <div className="flex-1">
        {!wallet ? (
          <div className="py-14 text-center">
            <p className="text-lg font-light text-ink">
              connect your wallet to start chatting.
            </p>
            <p className="mt-2 font-mono text-xs text-muted">
              use the connect button, top right — any address works in this
              demo.
            </p>
          </div>
        ) : (
          <>
            {messages.length === 0 && (
              <p className="mt-10 text-center text-sm text-faint">
                ask anything about $YAPCP. quality questions earn more — 100 /
                300 / 1,000 pts.
              </p>
            )}
            <div className="space-y-6">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {m.role === "user" ? (
                    <div className="max-w-[85%] rounded-2xl border border-line bg-wash px-5 py-3.5">
                      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
                        {m.text}
                      </p>
                    </div>
                  ) : (
                    <div className="max-w-[92%]">
                      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
                        {m.text}
                      </p>
                      {m.reward !== undefined && m.reward > 0 && (
                        <p className="mt-1.5 font-mono text-[11px] text-muted">
                          +{m.reward} pts · {TIER_LABEL[m.tier || 1]}
                        </p>
                      )}
                      {m.note && (
                        <p className="mt-1.5 font-mono text-[11px] text-faint">
                          {m.note}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {loading && <p className="font-mono text-xs text-faint">thinking…</p>}
              <div ref={bottomRef} />
            </div>
          </>
        )}
      </div>

      <div className="sticky bottom-16 z-10 bg-white/90 pt-4 backdrop-blur">
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={send}
          disabled={loading || !wallet}
          placeholder={
            wallet ? "Ask about $YAPCP…" : "Connect your wallet first…"
          }
        />
        <p className="mt-3 text-center font-mono text-[10px] leading-relaxed text-faint">
          1 rewarded msg per 2 min · 20/day · duplicates &amp; off-topic earn 0
        </p>
      </div>
    </div>
  );
}
