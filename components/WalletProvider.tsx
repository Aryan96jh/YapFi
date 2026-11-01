"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface WalletCtx {
  wallet: string | null;
  setWallet: (w: string | null) => void;
}

const Ctx = createContext<WalletCtx>({ wallet: null, setWallet: () => {} });

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWalletState] = useState<string | null>(null);

  useEffect(() => {
    setWalletState(localStorage.getItem("yapfi_wallet"));
  }, []);

  const setWallet = (w: string | null) => {
    if (w) localStorage.setItem("yapfi_wallet", w);
    else localStorage.removeItem("yapfi_wallet");
    setWalletState(w);
  };

  return <Ctx.Provider value={{ wallet, setWallet }}>{children}</Ctx.Provider>;
}

export const useWallet = () => useContext(Ctx);
