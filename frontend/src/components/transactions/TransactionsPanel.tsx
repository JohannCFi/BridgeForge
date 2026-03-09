import { ArrowRight, ExternalLink } from "lucide-react";
import { useTransfers } from "../../api/hooks";
import type { Transfer, TransferStatus } from "../../types";
import { getChain } from "../../config/chains";

const STATUS_STYLES: Record<TransferStatus, string> = {
  pending: "bg-yellow-500/10 text-yellow-400",
  burning: "bg-orange-500/10 text-orange-400",
  burned: "bg-orange-500/10 text-orange-400",
  attesting: "bg-blue-500/10 text-blue-400",
  attested: "bg-blue-500/10 text-blue-400",
  minting: "bg-purple-500/10 text-purple-400",
  completed: "bg-emerald-500/10 text-emerald-400",
  failed: "bg-red-500/10 text-red-400",
};

export function TransactionsPanel() {
  const { data: transfers, isLoading } = useTransfers();

  return (
    <div className="w-full max-w-lg mx-auto">
      <h1 className="text-xl font-semibold text-white mb-6">Transactions</h1>

      <div className="bg-zinc-900/60 backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden max-h-[500px] overflow-y-auto">
        {isLoading && (
          <div className="px-5 py-12 text-center text-zinc-500 text-sm">
            Loading...
          </div>
        )}

        {!isLoading && (!transfers || transfers.length === 0) && (
          <div className="px-5 py-12 text-center text-zinc-500 text-sm">
            No transactions yet
          </div>
        )}

        {transfers
          ?.slice()
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .map((tx) => (
            <TransactionRow key={tx.id} transfer={tx} />
          ))}
      </div>
    </div>
  );
}

function TransactionRow({ transfer }: { transfer: Transfer }) {
  const source = getChain(transfer.sourceChain);
  const dest = getChain(transfer.destinationChain);
  const time = new Date(transfer.createdAt).toLocaleString();

  return (
    <div className="px-5 py-4 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
      <div className="flex items-center justify-between">
        {/* Route */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <img
              src={source?.icon}
              alt={source?.name}
              className="w-5 h-5"
            />
            <span className="text-sm text-zinc-300">{source?.name}</span>
          </div>
          <ArrowRight size={14} className="text-zinc-600" />
          <div className="flex items-center gap-1.5">
            <img src={dest?.icon} alt={dest?.name} className="w-5 h-5" />
            <span className="text-sm text-zinc-300">{dest?.name}</span>
          </div>
        </div>

        {/* Amount */}
        <span className="text-sm text-white font-medium">
          {transfer.amount} tEURCV
        </span>
      </div>

      <div className="flex items-center justify-between mt-2">
        {/* ID & time */}
        <span className="text-xs text-zinc-600">
          {transfer.id.slice(0, 8)}... &middot; {time}
        </span>

        <div className="flex items-center gap-2">
          {/* Status badge */}
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
              STATUS_STYLES[transfer.status]
            }`}
          >
            {transfer.status}
          </span>

          {/* Explorer link */}
          {transfer.burnTxHash && source && (
            <a
              href={`${source.explorerUrl}/tx/${transfer.burnTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
