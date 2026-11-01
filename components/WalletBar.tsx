"use client";
import { useState } from "react";
import {
  useWallet as useAdapterWallet,
  type Wallet,
} from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { useWallet } from "./WalletProvider";

const INSTALL_URLS: Record<string, string> = {
  Phantom: "https://phantom.app/download",
  Solflare: "https://solflare.com/download",
};

/**
 * White bordered pill, matching the site's minimal style.
 * Unconnected: lists Phantom / Solflare — connect if installed, install link if not.
 * Connected: truncated address with wallet name + quiet disconnect.
 */
export default function WalletBar() {
  const { wallet, setWallet } = useWallet();
  const { wallets, select, connect, connecting, wallet: active } =
    useAdapterWallet();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doConnect = async (w: Wallet) => {
    setError(null);
    try {
      select(w.adapter.name);
      await connect();
      setOpen(false);
    } catch {
      setError("connection rejected — try again");
    }
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
              via {active?.adapter.name ?? "wallet"}
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
            solana wallet
          </p>
          <div className="mt-2 flex flex-col gap-1.5">
            {wallets.map((w) => {
              const installed =
                w.readyState === WalletReadyState.Installed ||
                w.readyState === WalletReadyState.Loadable;
              const installUrl = INSTALL_URLS[w.adapter.name];
              return (
                <div
                  key={w.adapter.name}
                  className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2"
                >
                  <span className="text-sm text-ink">{w.adapter.name}</span>
                  {installed ? (
                    <button
                      onClick={() => doConnect(w)}
                      disabled={connecting}
                      className="rounded-full bg-ink px-4 py-1 text-xs text-white transition hover:opacity-80 disabled:opacity-30"
                    >
                      {connecting ? "connecting…" : "connect"}
                    </button>
                  ) : installUrl ? (
                    <a
                      href={installUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-line px-4 py-1 font-mono text-xs text-muted transition hover:border-ink hover:text-ink"
                    >
                      install
                    </a>
                  ) : (
                    <span className="font-mono text-[11px] text-faint">
                      not detected
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {error && (
            <p className="mt-2 font-mono text-[11px] text-muted">{error}</p>
          )}
          <p className="mt-2 font-mono text-[10px] text-faint">
            your wallet is your login — points save to this address
          </p>
        </div>
      )}
    </div>
  );
}
