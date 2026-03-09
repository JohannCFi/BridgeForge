interface AmountInputProps {
  value: string;
  onChange: (val: string) => void;
  balance: string;
}

export function AmountInput({ value, onChange, balance }: AmountInputProps) {
  const bal = parseFloat(balance) || 0;

  const setPercent = (pct: number) => {
    const amt = (bal * pct).toFixed(6).replace(/\.?0+$/, "");
    onChange(amt || "0");
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        inputMode="decimal"
        placeholder="0"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          if (/^\d*\.?\d*$/.test(v)) onChange(v);
        }}
        className="flex-1 bg-transparent text-2xl font-semibold text-white outline-none placeholder-zinc-600 min-w-0"
      />
      <div className="flex items-center gap-1.5">
        {[25, 50].map((pct) => (
          <button
            key={pct}
            onClick={() => setPercent(pct / 100)}
            className="px-2 py-1 text-xs font-medium text-zinc-400 bg-zinc-800 rounded-md hover:bg-zinc-700 hover:text-white transition-colors cursor-pointer"
          >
            {pct}%
          </button>
        ))}
        <button
          onClick={() => setPercent(1)}
          className="px-2 py-1 text-xs font-medium text-zinc-400 bg-zinc-800 rounded-md hover:bg-zinc-700 hover:text-white transition-colors cursor-pointer"
        >
          MAX
        </button>
        <div className="flex items-center gap-1.5 ml-2 px-3 py-1.5 bg-zinc-800/60 rounded-lg">
          <span className="text-sm font-medium text-zinc-300">tEURCV</span>
        </div>
      </div>
    </div>
  );
}
