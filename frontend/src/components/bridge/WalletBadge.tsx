import { useState, useRef, useEffect } from "react";
import { Copy, LogOut, Wallet } from "lucide-react";

interface WalletBadgeProps {
  address: string | null;
  connected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function WalletBadge({ address, connected, onConnect, onDisconnect }: WalletBadgeProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const handleCopy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!connected || !address) {
    return (
      <button
        onClick={onConnect}
        className="flex items-center gap-1.5 text-xs text-zinc-400 bg-zinc-800/60 px-2.5 py-1.5 rounded-lg hover:bg-zinc-700 transition-colors cursor-pointer"
      >
        <Wallet size={12} />
        Not connected
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-1.5 text-xs text-zinc-400 bg-zinc-800/60 px-2 py-1 rounded-lg hover:bg-zinc-700 transition-colors cursor-pointer"
      >
        {truncate(address)}
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-44 bg-zinc-800 border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden z-50">
          <button
            onClick={() => {
              handleCopy();
              setMenuOpen(false);
            }}
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-zinc-300 hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            {copied ? "Copied!" : "Copy address"}
            <Copy size={14} className="text-zinc-500" />
          </button>
          <button
            onClick={() => {
              onDisconnect();
              setMenuOpen(false);
            }}
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-red-400 hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            Disconnect
            <LogOut size={14} className="text-red-500" />
          </button>
        </div>
      )}
    </div>
  );
}
