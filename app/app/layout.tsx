import Link from "next/link";
import dynamic from "next/dynamic";
import Corners from "@/components/Corners";

// Wallet adapter touches window — client-only mount. Server render falls back
// to the default (disconnected) wallet context, which pages already handle.
const WalletProvider = dynamic(
  () =>
    import("@/components/WalletProvider").then((m) => m.WalletProvider),
  { ssr: false }
);

const NAV = [
  ["tasks", "/app/tasks"],
  ["chat", "/app/chat"],
  ["dashboard", "/app/dashboard"],
] as const;

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WalletProvider>
      <div className="relative min-h-screen bg-white text-ink">
        <Corners />
        <main className="mx-auto w-full max-w-2xl px-5 pb-28 pt-24">
          {children}
        </main>
        <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-white/85 backdrop-blur">
          <nav className="mx-auto flex max-w-2xl items-center justify-center gap-6 px-5 py-3">
            {NAV.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="font-mono text-xs text-muted transition hover:text-ink"
              >
                {label}
              </Link>
            ))}
          </nav>
        </footer>
      </div>
    </WalletProvider>
  );
}
