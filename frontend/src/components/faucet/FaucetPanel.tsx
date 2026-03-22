import { useState } from "react";
import { Droplets, Loader2, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import type { Chain, Token } from "../../types";
import { CHAINS } from "../../config/chains";
import { ChainSelector } from "../bridge/ChainSelector";
import { TokenSelector } from "../bridge/TokenSelector";
import { api } from "../../api/client";
import { useChainWallet } from "../../hooks/useWallet";

export function FaucetPanel({ selectedToken, onTokenChange }: { selectedToken: Token; onTokenChange: (t: Token) => void }) {
  const [chain, setChain] = useState<Chain>("xrpl");
  const token = selectedToken;
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ txHash: string; chain: Chain } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wallet = useChainWallet(chain);
  const chainMeta = CHAINS.find((c) => c.id === chain);

  const displayAddress = address || wallet.address || "";

  const handleMint = async () => {
    if (!displayAddress) return;
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const data = await api.faucet(chain, displayAddress, token);
      setResult({ txHash: data.txHash, chain: data.chain });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mint failed");
    } finally {
      setLoading(false);
    }
  };

  const explorerLink = result && chainMeta
    ? `${chainMeta.explorerUrl}/tx/${result.txHash}`
    : null;

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Droplets size={20} className="text-emerald-400" />
        <h1 className="text-xl font-semibold text-white">Faucet</h1>
      </div>

      <div className="bg-zinc-900/60 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
        <p className="text-sm text-zinc-400 mb-5">
          Mint 1,000 test tokens to any address. One request per address per minute.
        </p>

        {/* Token selector */}
        <div className="mb-4">
          <label className="text-xs text-zinc-500 uppercase tracking-wider mb-2 block">
            Token
          </label>
          <TokenSelector value={token} onChange={(t) => { onTokenChange(t); setResult(null); setError(null); }} />
        </div>

        {/* Chain selector */}
        <div className="mb-4">
          <label className="text-xs text-zinc-500 uppercase tracking-wider mb-2 block">
            Chain
          </label>
          <ChainSelector value={chain} onChange={(c) => { setChain(c); setResult(null); setError(null); }} />
        </div>

        {/* Address input */}
        <div className="mb-5">
          <label className="text-xs text-zinc-500 uppercase tracking-wider mb-2 block">
            Recipient address
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={wallet.address || "Enter address..."}
            className="w-full bg-black/40 border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/20 transition-colors"
          />
          {wallet.connected && !address && (
            <p className="text-xs text-zinc-600 mt-1.5">
              Using connected wallet address
            </p>
          )}
        </div>

        {/* Mint button */}
        <button
          onClick={handleMint}
          disabled={loading || !displayAddress}
          className={`w-full py-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            loading || !displayAddress
              ? "bg-zinc-800/50 text-zinc-600 cursor-not-allowed"
              : "bg-white text-black hover:bg-zinc-200 cursor-pointer"
          }`}
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Minting...
            </>
          ) : (
            <>
              <Droplets size={16} />
              Mint 1,000 {token}
            </>
          )}
        </button>

        {/* Success */}
        {result && (
          <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle size={16} className="text-emerald-400" />
              <span className="text-sm font-medium text-emerald-400">Minted successfully!</span>
            </div>
            <p className="text-xs text-zinc-400 break-all">
              Tx: {result.txHash}
            </p>
            {explorerLink && (
              <a
                href={explorerLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 mt-2"
              >
                View on explorer <ExternalLink size={12} />
              </a>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-red-400" />
              <span className="text-sm text-red-400">{error}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
