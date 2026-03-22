import { useAccount } from "wagmi";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { useXrplWalletContext } from "../../contexts/XrplWalletContext";
import { useStellarWalletContext } from "../../contexts/StellarWalletContext";
import { useBalance } from "../../api/hooks";
import { CHAINS } from "../../config/chains";
import { TOKENS } from "../../config/tokens";
import type { Chain, Token } from "../../types";

function useWalletAddress(chainId: Chain): string {
  const { address: ethAddress, isConnected: ethConnected } = useAccount();
  const solana = useSolanaWallet();
  const xrpl = useXrplWalletContext();
  const stellar = useStellarWalletContext();

  switch (chainId) {
    case "ethereum":
      return ethConnected && ethAddress ? ethAddress : "";
    case "solana":
      return solana.connected && solana.publicKey ? solana.publicKey.toBase58() : "";
    case "xrpl":
      return xrpl.connected && xrpl.address ? xrpl.address : "";
    case "stellar":
      return stellar.connected && stellar.address ? stellar.address : "";
  }
}

export function AssetsPanel() {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold text-white mb-6">Assets</h1>

      <div className="bg-zinc-900/60 backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-3 px-3 md:px-5 py-3 border-b border-white/[0.06] text-xs text-zinc-500 uppercase tracking-wider">
          <span>Network</span>
          <span>Token</span>
          <span className="text-right">Balance</span>
        </div>

        {/* Rows: each chain x each token */}
        {CHAINS.map((chain) =>
          TOKENS.map((token) => (
            <AssetRow
              key={`${chain.id}-${token.id}`}
              chainId={chain.id as Chain}
              chainName={chain.name}
              chainIcon={chain.icon}
              token={token.id}
              tokenSymbol={token.symbol}
              tokenColor={token.color}
            />
          ))
        )}
      </div>
    </div>
  );
}

function AssetRow({
  chainId,
  chainName,
  chainIcon,
  token,
  tokenSymbol,
  tokenColor,
}: {
  chainId: Chain;
  chainName: string;
  chainIcon: string;
  token: Token;
  tokenSymbol: string;
  tokenColor: string;
}) {
  const address = useWalletAddress(chainId);
  const { data } = useBalance(chainId, address, token);

  return (
    <div className="grid grid-cols-3 px-3 md:px-5 py-4 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors items-center">
      <div className="flex items-center gap-3">
        <img src={chainIcon} alt={chainName} className="w-6 h-6" />
        <span className="text-sm text-white font-medium">{chainName}</span>
      </div>
      <div className="flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: tokenColor }}
        />
        <span className="text-sm text-zinc-400">{tokenSymbol}</span>
      </div>
      <span className="text-sm text-white text-right font-medium">
        {data?.balance ?? "--"}
      </span>
    </div>
  );
}
