import { Wallet, ArrowLeftRight, History } from "lucide-react";

type Tab = "assets" | "bridge" | "transactions";

interface SidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const NAV_ITEMS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "assets", label: "Assets", icon: <Wallet size={18} /> },
  { id: "bridge", label: "Bridge", icon: <ArrowLeftRight size={18} /> },
  { id: "transactions", label: "Transactions", icon: <History size={18} /> },
];

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 h-full w-60 bg-black/80 backdrop-blur-xl border-r border-white/[0.08] flex flex-col z-50">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/[0.08]">
        <img src="/forge-logo.svg" alt="Forge" className="w-full h-auto" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer mb-1 ${
                active
                  ? "bg-white/[0.08] text-white border-l-2 border-white"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] border-l-2 border-transparent"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-white/[0.08]">
        <p className="text-[10px] text-zinc-600 uppercase tracking-widest">
          Testnet
        </p>
      </div>
    </aside>
  );
}
