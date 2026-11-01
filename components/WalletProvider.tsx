"use client";
import { createContext, useContext, useMemo, type FC, type ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider as AdapterWalletProvider,
  useWallet as useAdapterWallet,
} from "@solana/wallet-adapter-react";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";

// wallet-adapter-react@0.15.x ships types compiled against React 19's JSX
// namespace, which trips React 18's type checker. The runtime is React 18
// compatible — this cast only quiets the type mismatch.
const ConnectionProviderTyped = ConnectionProvider as unknown as FC<{
  endpoint: string;
  children: ReactNode;
}>;
const AdapterWalletProviderTyped = AdapterWalletProvider as unknown as FC<{
  wallets: unknown[];
  autoConnect?: boolean;
  children: ReactNode;
}>;

/**
 * App-level wallet identity, backed by the real Solana wallet adapter.
 * `wallet` is the connected public key (base58) or null.
 * `setWallet(null)` disconnects; any other value is ignored (kept for API compat).
 * Points are saved per wallet address — connecting IS the login.
 */
interface WalletCtx {
  wallet: string | null;
  setWallet: (w: string | null) => void;
}

const Ctx = createContext<WalletCtx>({ wallet: null, setWallet: () => {} });

function IdentityBridge({ children }: { children: ReactNode }) {
  const { publicKey, disconnect } = useAdapterWallet();
  const value = useMemo<WalletCtx>(
    () => ({
      wallet: publicKey ? publicKey.toBase58() : null,
      setWallet: (w: string | null) => {
        if (w === null) disconnect().catch(() => {});
      },
    }),
    [publicKey, disconnect]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => clusterApiUrl("mainnet-beta"), []);
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );
  return (
    <ConnectionProviderTyped endpoint={endpoint}>
      <AdapterWalletProviderTyped wallets={wallets} autoConnect>
        <IdentityBridge>{children}</IdentityBridge>
      </AdapterWalletProviderTyped>
    </ConnectionProviderTyped>
  );
}

export const useWallet = () => useContext(Ctx);
