"use client";
import { useState } from "react";
import { useWallet } from "./WalletProvider";

export default function WalletBar() {
  const { wallet, setWallet } = useWallet();
  const [input, setInput] = useState("");

  if (wallet) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="rounded-full bg-cyan/15 px-3 py-1 font-mono text-cyan">
          {wallet.slice(0, 6)}&hellip;{wallet.slice(-4)}
        </span>
        <button
          onClick={() => setWallet(null)}
          className="text-muted hover:text-ink"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && input.trim()) setWallet(input.trim());
        }}
        placeholder="Paste wallet address (demo)"
        className="w-52 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm placeholder:text-muted/60 focus:border-gold focus:outline-none"
      />
      <button
        onClick={() => input.trim() && setWallet(input.trim())}
        className="rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-navy hover:brightness-110"
      >
        Connect
      </button>
    </div>
  );
}
