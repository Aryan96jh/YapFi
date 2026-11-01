import Image from "next/image";
import Link from "next/link";
import { WalletProvider } from "@/components/WalletProvider";
import WalletBar from "@/components/WalletBar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WalletProvider>
      <div className="min-h-screen">
        <header className="border-b border-white/10">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo.svg"
                alt="YapFi logo"
                width={36}
                height={36}
                className="rounded-lg"
              />
              <span className="text-xl font-bold">YapFi</span>
            </Link>
            <nav className="flex items-center gap-5 text-sm">
              <Link href="/app/chat" className="text-muted hover:text-ink">
                Chat
              </Link>
              <Link href="/app/tasks" className="text-muted hover:text-ink">
                Tasks
              </Link>
              <Link
                href="/app/dashboard"
                className="text-muted hover:text-ink"
              >
                Dashboard
              </Link>
            </nav>
            <WalletBar />
          </div>
        </header>
        <div className="mx-auto max-w-5xl px-4 pt-4">
          <div className="rounded-lg border border-gold/40 bg-gold/10 px-4 py-2 text-xs text-gold">
            DEMO &mdash; the wallet is a typed-in prototype identity. Production
            will require signed-message auth.
          </div>
        </div>
        <main className="mx-auto max-w-5xl px-4 pb-16 pt-6">{children}</main>
      </div>
    </WalletProvider>
  );
}
