import { useAccount } from "wagmi";
import { useBalance } from "../../api/hooks";
import { CHAINS } from "../../config/chains";

export function AssetsPanel() {
  const { address, isConnected } = useAccount();

  return (
    <div className="w-full max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold text-white mb-6">Assets</h1>

      <div className="bg-zinc-900/60 backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-3 px-5 py-3 border-b border-white/[0.06] text-xs text-zinc-500 uppercase tracking-wider">
          <span>Network</span>
          <span>Token</span>
          <span className="text-right">Balance</span>
        </div>

        {/* Rows */}
        {CHAINS.map((chain) => (
          <AssetRow
            key={chain.id}
            chainId={chain.id}
            chainName={chain.name}
            chainIcon={chain.icon}
            address={chain.id === "ethereum" && isConnected ? address! : ""}
          />
        ))}
      </div>

      {!isConnected && (
        <p className="text-xs text-zinc-600 mt-4 text-center">
          Connect your wallet to view Ethereum balances
        </p>
      )}
    </div>
  );
}

function AssetRow({
  chainId,
  chainName,
  chainIcon,
  address,
}: {
  chainId: string;
  chainName: string;
  chainIcon: string;
  address: string;
}) {
  const { data } = useBalance(chainId as any, address);

  return (
    <div className="grid grid-cols-3 px-5 py-4 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors items-center">
      <div className="flex items-center gap-3">
        <img src={chainIcon} alt={chainName} className="w-6 h-6" />
        <span className="text-sm text-white font-medium">{chainName}</span>
      </div>
      <span className="text-sm text-zinc-400">tEURCV</span>
      <span className="text-sm text-white text-right font-medium">
        {data?.balance ?? "--"}
      </span>
    </div>
  );
}
