"use client";
import { useState } from "react";
import { useWallet } from "./WalletProvider";

/**
 * White bordered pill. Unconnected: opens a small panel to paste an address.
 * Connected: shows the truncated address with a quiet disconnect.
 * Identity logic is unchanged: typed-in address stored in localStorage.
 */
export default function WalletBar() {
  const { wallet, setWallet } = useWallet();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");

  const connect = () => {
    const v = input.trim();
    if (!v) return;
    setWallet(v);
    setInput("");
    setOpen(false);
  };

  if (wallet) {
    return (
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 shadow-pop transition hover:border-faint"
          aria-label="wallet menu"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-ink" />
          <span className="font-mono text-xs text-ink">
            {wallet.slice(0, 6)}&hellip;{wallet.slice(-4)}
          </span>
        </button>
        {open && (
          <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-line bg-white p-3 shadow-pop">
            <p className="break-all font-mono text-[11px] leading-relaxed text-muted">
              {wallet}
            </p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-faint">
              demo identity — typed in
            </p>
            <button
              onClick={() => {
                setWallet(null);
                setOpen(false);
              }}
              className="mt-3 w-full rounded-full border border-line px-4 py-1.5 text-sm text-muted transition hover:border-ink hover:text-ink"
            >
              disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-full border border-line bg-white px-5 py-2 text-sm text-ink shadow-pop transition hover:border-ink"
      >
        connect wallet
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-line bg-white p-3 shadow-pop">
          <p className="font-mono text-[10px] uppercase tracking-wider text-faint">
            demo — paste any address
          </p>
          <div className="mt-2 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") connect();
                if (e.key === "Escape") setOpen(false);
              }}
              placeholder="wallet address"
              autoFocus
              className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3 py-2 font-mono text-xs text-ink placeholder:text-faint focus:border-ink focus:outline-none"
            />
            <button
              onClick={connect}
              disabled={!input.trim()}
              className="shrink-0 rounded-full bg-ink px-4 py-2 text-sm text-white transition hover:opacity-80 disabled:opacity-30"
            >
              connect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
