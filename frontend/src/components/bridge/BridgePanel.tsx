import { useState } from "react";
import { ArrowDownUp, HelpCircle, Loader2 } from "lucide-react";
import type { Chain, Token } from "../../types";
import {
  useBalance,
  useChainConfig,
  useChainStatus,
} from "../../api/hooks";
import { useChainWallet } from "../../hooks/useWallet";
import { useBridge } from "../../hooks/useBridge";
import { getToken } from "../../config/tokens";
import { CHAINS } from "../../config/chains";
import { ChainSelector } from "./ChainSelector";
import { TokenSelector } from "./TokenSelector";
import { AmountInput } from "./AmountInput";
import { WalletModal } from "./WalletModal";
import { WalletBadge } from "./WalletBadge";
import { TransferProgress } from "./TransferProgress";
import { ChainStatusBadge } from "../common/ChainStatusBadge";
import { TrustlineWarning } from "../common/TrustlineWarning";

function isValidAddress(chain: Chain, address: string): boolean {
  if (!address) return true; // empty is not invalid, just incomplete
  switch (chain) {
    case "ethereum":
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    case "solana":
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
    case "xrpl":
      return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address);
    case "stellar":
      return /^G[A-Z2-7]{55}$/.test(address);
  }
}

export function BridgePanel({ selectedToken, onTokenChange }: { selectedToken: Token; onTokenChange: (t: Token) => void }) {
  const [sourceChain, setSourceChain] = useState<Chain>("ethereum");
  const [destChain, setDestChain] = useState<Chain>("solana");
  const [amount, setAmount] = useState("");
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [walletModalSide, setWalletModalSide] = useState<"source" | "destination">("source");
  const [manualDestAddress, setManualDestAddress] = useState("");

  const { data: chainConfig } = useChainConfig();
  const { data: chainStatus } = useChainStatus();

  const sourceWallet = useChainWallet(sourceChain);
  const destWallet = useChainWallet(destChain);

  const { bridge, transferId, step, error, reset } = useBridge();

  const tokenMeta = getToken(selectedToken);

  // Effective destination address: wallet or manual input
  const destAddress = destWallet.address || manualDestAddress;

  // Balances (token-aware)
  const { data: balanceData } = useBalance(
    sourceChain,
    sourceWallet.address || "",
    selectedToken
  );
  const balance = balanceData?.balance ?? "0";

  const { data: destBalanceData } = useBalance(
    destChain,
    destAddress || "",
    selectedToken
  );
  const destBalance = destBalanceData?.balance ?? "0";

  const swap = () => {
    const prev = sourceChain;
    setSourceChain(destChain);
    setDestChain(prev);
  };

  const openWalletModal = (side: "source" | "destination") => {
    setWalletModalSide(side);
    setWalletModalOpen(true);
  };

  const handleWalletSelect = async (walletId: string) => {
    setWalletModalOpen(false);
    const wallet = walletModalSide === "source" ? sourceWallet : destWallet;
    try {
      await wallet.connect(walletId);
    } catch (e) {
      console.error("Wallet connect error:", e);
    }
  };

  const handleBridge = async () => {
    if (!sourceWallet.address || !destAddress || !amount || !chainConfig) return;

    // Get the right token address for the source chain
    const chainMeta = CHAINS.find((c) => c.id === sourceChain);
    const tokenAddress = chainMeta?.tokenAddresses[selectedToken] || chainConfig[sourceChain]?.tokenAddress || "";

    await bridge({
      sourceChain,
      destChain,
      sourceAddress: sourceWallet.address,
      destAddress,
      amount,
      token: selectedToken,
      signBurn: sourceWallet.signBurn,
      tokenAddress,
    });

    if (step === "done") setAmount("");
  };

  const sameChain = sourceChain === destChain;
  const sourceDown = chainStatus?.[sourceChain] === false;
  const destDown = chainStatus?.[destChain] === false;
  const chainDown = sourceDown || destDown;
  const sameAddress =
    !!sourceWallet.address &&
    !!destAddress &&
    sourceWallet.address.toLowerCase() === destAddress.toLowerCase();
  const insufficientBalance =
    !!amount && parseFloat(amount) > 0 && parseFloat(amount) > parseFloat(balance);
  const isProcessing = step === "registering" || step === "burning" || step === "confirming";

  const hasDestination = !!destAddress;
  const invalidDestAddress = !!manualDestAddress && !destWallet.connected && !isValidAddress(destChain, manualDestAddress);

  const handleMainButton = () => {
    if (!sourceWallet.connected) {
      openWalletModal("source");
    } else {
      handleBridge();
    }
  };

  const mainButtonLabel = () => {
    if (sameChain) return "Cannot bridge to the same chain";
    if (chainDown) return sourceDown ? "Source chain unavailable" : "Destination chain unavailable";
    if (isProcessing) {
      if (step === "registering") return "Registering...";
      if (step === "burning") return "Sign burn in wallet...";
      if (step === "confirming") return "Verifying & minting...";
    }
    if (!sourceWallet.connected) return "Connect source wallet";
    if (!hasDestination) return "Enter destination address";
    if (invalidDestAddress) return "Invalid address for this chain";
    if (sameAddress) return "Source and destination must differ";
    if (!amount || parseFloat(amount) <= 0) return "Enter an amount";
    if (insufficientBalance) return "Insufficient balance";
    return `Bridge ${selectedToken}`;
  };

  const mainButtonEnabled =
    !sameChain &&
    !chainDown &&
    !isProcessing &&
    !invalidDestAddress &&
    (!sourceWallet.connected ||
      (hasDestination && !sameAddress && !!amount && parseFloat(amount) > 0 && !insufficientBalance));

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-white">Bridge</h1>
          <HelpCircle size={16} className="text-zinc-500" />
        </div>
        <TokenSelector value={selectedToken} onChange={onTokenChange} />
      </div>

      {/* Card */}
      <div className="bg-zinc-900/60 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 md:p-5">
        {/* Source (From) */}
        <div className="mb-1">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
              From <ChainStatusBadge chain={sourceChain} />
            </span>
            <div className="flex items-center gap-2">
              {sourceWallet.connected && (
                <span className="text-xs text-zinc-500">
                  {parseFloat(balance).toFixed(2)} {selectedToken}
                </span>
              )}
              <WalletBadge
                address={sourceWallet.address}
                connected={sourceWallet.connected}
                onConnect={() => openWalletModal("source")}
                onDisconnect={() => sourceWallet.disconnect()}
              />
            </div>
          </div>

          <div className="mb-3">
            <ChainSelector value={sourceChain} onChange={setSourceChain} />
          </div>

          {sourceWallet.connected && (
            <div className="bg-black/40 border border-white/[0.06] rounded-xl px-4 py-3">
              <AmountInput
                value={amount}
                onChange={setAmount}
                balance={balance}
                tokenSymbol={selectedToken}
              />
            </div>
          )}
        </div>

        {/* Swap Button */}
        <div className="flex justify-center my-3 relative z-10">
          <button
            onClick={swap}
            className="p-2.5 bg-zinc-800 border border-white/[0.1] rounded-xl hover:bg-zinc-700 transition-all hover:rotate-180 duration-300 cursor-pointer"
          >
            <ArrowDownUp size={16} className="text-zinc-300" />
          </button>
        </div>

        {/* Destination (To) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
              To <ChainStatusBadge chain={destChain} />
            </span>
            <div className="flex items-center gap-2">
              {hasDestination && (
                <span className="text-xs text-zinc-500">
                  {parseFloat(destBalance).toFixed(2)} {selectedToken}
                </span>
              )}
              <WalletBadge
                address={destWallet.address}
                connected={destWallet.connected}
                onConnect={() => openWalletModal("destination")}
                onDisconnect={() => { destWallet.disconnect(); setManualDestAddress(""); }}
              />
            </div>
          </div>

          <ChainSelector value={destChain} onChange={setDestChain} />

          {/* Manual address input (when wallet not connected) */}
          {!destWallet.connected && (
            <div className="mt-3">
              <input
                type="text"
                value={manualDestAddress}
                onChange={(e) => setManualDestAddress(e.target.value)}
                placeholder="Or paste destination address..."
                className={`w-full bg-black/40 border rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none transition-colors ${
                  invalidDestAddress
                    ? "border-red-500/50 focus:border-red-500/70"
                    : "border-white/[0.06] focus:border-white/20"
                }`}
              />
              {invalidDestAddress && (
                <p className="text-xs text-red-400 mt-1.5 px-1">
                  Invalid address format for {destChain === "ethereum" ? "Ethereum" : destChain === "solana" ? "Solana" : destChain === "xrpl" ? "XRPL" : "Stellar"}
                </p>
              )}
            </div>
          )}

          {hasDestination && amount && parseFloat(amount) > 0 && (
            <div className="mt-3 flex items-center justify-between text-xs text-zinc-500 px-1">
              <span>You will receive</span>
              <span className="text-white font-medium">~{amount} {selectedToken}</span>
            </div>
          )}
        </div>

        {/* Exchange rate info */}
        {amount && parseFloat(amount) > 0 && (
          <div className="mt-2 text-xs text-zinc-600 px-1">
            1 {selectedToken} = {tokenMeta.fiatSymbol}{tokenMeta.fiatValue}
          </div>
        )}

        {/* Trustline warning for XRPL/Stellar */}
        {error && (destChain === "xrpl" || destChain === "stellar") && (
          <div className="mt-3">
            <TrustlineWarning chain={destChain} errorMessage={error} />
          </div>
        )}

        {/* Main button */}
        <button
          onClick={handleMainButton}
          disabled={!mainButtonEnabled}
          className={`w-full mt-5 py-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            mainButtonEnabled
              ? "bg-white text-black hover:bg-zinc-200 cursor-pointer"
              : "bg-zinc-800/50 text-zinc-600 cursor-not-allowed"
          }`}
        >
          {isProcessing && <Loader2 size={16} className="animate-spin" />}
          {mainButtonLabel()}
        </button>

        {/* Transfer progress stepper (replaces inline status messages) */}
        {transferId && step !== "idle" && (
          <div className="mt-4 p-4 bg-black/30 border border-white/[0.06] rounded-xl">
            <TransferProgress
              transferId={transferId}
              sourceChain={sourceChain}
              destChain={destChain}
            />
          </div>
        )}

        {/* Error */}
        {step === "error" && error && (
          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-xs text-red-400">{error}</p>
            <button
              onClick={reset}
              className="text-xs text-red-300 underline mt-1 cursor-pointer"
            >
              Try again
            </button>
          </div>
        )}

      </div>

      {/* Wallet selection modal */}
      <WalletModal
        open={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        side={walletModalSide}
        chain={walletModalSide === "source" ? sourceChain : destChain}
        onSelect={handleWalletSelect}
      />
    </div>
  );
}
