import { useTransferStatus } from "../../api/hooks";
import { getChain } from "../../config/chains";
import type { Chain, TransferStatus } from "../../types";

interface Props {
  transferId: string;
  sourceChain: Chain;
  destChain: Chain;
}

const STEPS = [
  { key: "ready", label: "Preparation" },
  { key: "burn_confirmed", label: "Burn confirmed" },
  { key: "attested", label: "Attestation signed" },
  { key: "minting", label: "Mint in progress" },
  { key: "completed", label: "Completed" },
] as const;

function getStepIndex(status: TransferStatus): number {
  switch (status) {
    case "ready": return 0;
    case "burn_confirmed": return 1;
    case "attested": return 2;
    case "minting": return 3;
    case "completed": return 4;
    case "refunding":
    case "refunded":
    case "refund_failed":
    case "mint_failed":
      return 3; // Failed at mint stage
    default: return 0;
  }
}

function isTerminalError(status: TransferStatus): boolean {
  return ["mint_failed", "refund_failed", "refunded", "expired", "rejected"].includes(status);
}

function getExplorerTxUrl(chain: Chain, txHash: string): string | null {
  const meta = getChain(chain);
  if (!meta || !txHash) return null;
  if (chain === "ethereum") return `${meta.explorerUrl}/tx/${txHash}`;
  if (chain === "solana") return `${meta.explorerUrl}/tx/${txHash}?cluster=devnet`;
  if (chain === "xrpl") return `${meta.explorerUrl}/transactions/${txHash}`;
  if (chain === "stellar") return `${meta.explorerUrl}/tx/${txHash}`;
  return null;
}

export function TransferProgress({ transferId, sourceChain, destChain }: Props) {
  const { data: transfer, isLoading } = useTransferStatus(transferId);

  if (isLoading || !transfer) {
    return <div className="text-white/50 text-sm animate-pulse">Loading transfer status...</div>;
  }

  const currentStep = getStepIndex(transfer.status);
  const hasError = isTerminalError(transfer.status);

  return (
    <div className="space-y-3">
      <div className="text-xs text-white/40 font-mono">{transfer.id}</div>

      {STEPS.map((step, i) => {
        const isDone = i < currentStep || (i === currentStep && transfer.status === "completed");
        const isCurrent = i === currentStep && !isDone;
        const isFailed = hasError && i === currentStep;

        return (
          <div key={step.key} className="flex items-start gap-3">
            {/* Icon */}
            <div className="mt-0.5 flex-shrink-0">
              {isDone ? (
                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : isFailed ? (
                <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              ) : isCurrent ? (
                <div className="w-5 h-5 rounded-full border-2 border-blue-400 flex items-center justify-center animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full border border-white/20" />
              )}
            </div>

            {/* Label + tx hash */}
            <div>
              <div className={`text-sm ${isDone ? "text-white" : isCurrent ? "text-blue-300" : "text-white/30"}`}>
                {step.label}
              </div>
              {/* Show burn tx hash at step 1 */}
              {step.key === "burn_confirmed" && transfer.burnTxHash && (
                <TxLink chain={sourceChain} txHash={transfer.burnTxHash} />
              )}
              {/* Show mint tx hash at completion */}
              {step.key === "completed" && transfer.mintTxHash && (
                <TxLink chain={destChain} txHash={transfer.mintTxHash} />
              )}
            </div>
          </div>
        );
      })}

      {/* Error message */}
      {hasError && transfer.errorLog && (
        <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-red-300 text-xs">
          {transfer.errorLog}
        </div>
      )}

      {/* Refund info */}
      {transfer.status === "refunded" && transfer.refundTxHash && (
        <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded text-amber-300 text-xs">
          Refunded: <TxLink chain={sourceChain} txHash={transfer.refundTxHash} />
        </div>
      )}
    </div>
  );
}

function TxLink({ chain, txHash }: { chain: Chain; txHash: string }) {
  const url = getExplorerTxUrl(chain, txHash);
  const short = `${txHash.slice(0, 8)}...${txHash.slice(-6)}`;
  if (!url) return <span className="text-xs text-white/30 font-mono">{short}</span>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline font-mono">
      {short} ↗
    </a>
  );
}
