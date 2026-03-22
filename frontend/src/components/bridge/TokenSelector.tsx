import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import type { Token } from "../../types";
import { TOKENS, getToken } from "../../config/tokens";

interface TokenSelectorProps {
  value: Token;
  onChange: (token: Token) => void;
}

export function TokenSelector({ value, onChange }: TokenSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = getToken(value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/60 border border-white/[0.08] rounded-lg hover:bg-zinc-700/60 transition-colors cursor-pointer"
      >
        <img src={selected.icon} alt={selected.symbol} className="w-3.5 h-3.5" />
        <span className="text-sm font-medium text-zinc-300">
          {selected.symbol}
        </span>
        <ChevronDown size={14} className="text-zinc-500" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 min-w-[180px] bg-zinc-900 border border-white/[0.1] rounded-xl shadow-2xl overflow-hidden">
          {TOKENS.map((token) => (
            <button
              key={token.id}
              onClick={() => {
                onChange(token.id);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.05] transition-colors cursor-pointer ${
                token.id === value ? "bg-white/[0.03]" : ""
              }`}
            >
              <img src={token.icon} alt={token.symbol} className="w-4 h-4 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-white">
                  {token.symbol}
                </div>
                <div className="text-xs text-zinc-500">{token.name}</div>
              </div>
              {token.id === value && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
