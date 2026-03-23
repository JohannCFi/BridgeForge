import { X } from "lucide-react";
import type { Chain } from "../../types";

export type WalletOption = {
  id: string;
  name: string;
  icon: string;
  chains: Chain[];
};

const WALLETS: WalletOption[] = [
  { id: "metamask",       name: "MetaMask",       icon: "/icons/metamask.svg",       chains: ["ethereum"] },
  { id: "phantom",        name: "Phantom",        icon: "/icons/favicon-96x96.png",  chains: ["solana"] },
  { id: "rabby",          name: "Rabby",           icon: "/icons/rabby.svg",          chains: ["ethereum"] },
  { id: "walletconnect",  name: "WalletConnect",  icon: "/icons/walletconnect.svg",  chains: ["ethereum"] },
  { id: "crossmark",      name: "Crossmark",      icon: "/icons/crossmark.svg",      chains: ["xrpl"] },
  { id: "gemwallet",      name: "GemWallet",      icon: "/icons/gemwallet.svg",      chains: ["xrpl"] },
  { id: "freighter",      name: "Freighter",      icon: "/icons/image.png",          chains: ["stellar"] },
];

interface WalletModalProps {
  open: boolean;
  onClose: () => void;
  side: "source" | "destination";
  chain: Chain;
  onSelect: (walletId: string) => void;
}

export function WalletModal({ open, onClose, side, chain, onSelect }: WalletModalProps) {
  if (!open) return null;

  const available = WALLETS.filter((w) => w.chains.includes(chain));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-sm mx-4 bg-zinc-900 border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 className="text-lg font-semibold text-white">
            Connect {side} wallet
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors cursor-pointer"
          >
            <X size={16} className="text-zinc-400" />
          </button>
        </div>

        {/* Wallet list */}
        <div className="px-3 pb-4">
          {available.map((wallet) => (
            <button
              key={wallet.id}
              onClick={() => onSelect(wallet.id)}
              className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <img
                src={wallet.icon}
                alt={wallet.name}
                className="w-10 h-10 rounded-xl"
                onError={(e) => {
                  // Fallback: show first letter
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <span className="text-sm font-medium text-white">{wallet.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
