import Image from "next/image";
import Link from "next/link";
import WalletBar from "./WalletBar";

/**
 * Floating corners — the only chrome. Top-left brand, top-right wallet pill.
 * No nav bar, no sidebar.
 */
export default function Corners() {
  return (
    <div className="pointer-events-none fixed left-0 right-0 top-0 z-40 flex items-start justify-between px-5 pt-5 md:px-8 md:pt-6">
        <Link
          href="/"
          className="pointer-events-auto flex items-center gap-2.5"
          aria-label="yapfi home"
        >
          <Image
            src="/logo.svg"
            alt=""
            width={24}
            height={24}
            className="h-6 w-6"
          />
          <span className="font-mono text-sm tracking-tight text-ink">
            yapfi
          </span>
          <span className="font-mono text-xs text-faint">$YAPCP</span>
        </Link>
        <div className="pointer-events-auto">
          <WalletBar />
        </div>
      </div>
  );
}
