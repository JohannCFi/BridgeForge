import { ChevronDown } from "lucide-react";
import type { Chain } from "../../types";
import { CHAINS } from "../../config/chains";
import { useState, useRef, useEffect } from "react";

interface ChainSelectorProps {
  value: Chain;
  onChange: (chain: Chain) => void;
}

export function ChainSelector({ value, onChange }: ChainSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = CHAINS.find((c) => c.id === value)!;
  const options = CHAINS;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800/80 border border-white/[0.08] hover:border-white/20 transition-colors cursor-pointer"
      >
        <img src={selected.icon} alt={selected.name} className="w-5 h-5" />
        <span className="text-sm font-medium text-white">{selected.name}</span>
        <ChevronDown size={14} className="text-zinc-400" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-56 bg-zinc-900 border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden z-50">
          {options.map((chain) => (
            <button
              key={chain.id}
              onClick={() => {
                onChange(chain.id);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/[0.06] transition-colors cursor-pointer ${
                chain.id === value ? "text-white bg-white/[0.04]" : "text-zinc-400"
              }`}
            >
              <img src={chain.icon} alt={chain.name} className="w-5 h-5" />
              {chain.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
