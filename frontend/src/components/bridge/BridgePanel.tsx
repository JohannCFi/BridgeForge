import { useState } from "react";
import { ArrowDownUp, HelpCircle, Loader2 } from "lucide-react";
import type { Chain } from "../../types";
import {
  useBalance,
  useChainConfig,
  useChainStatus,
} from "../../api/hooks";
import { useChainWallet } from "../../hooks/useWallet";
import { useBridge } from "../../hooks/useBridge";
import { ChainSelector } from "./ChainSelector";
import { AmountInput } from "./AmountInput";
import { WalletModal } from "./WalletModal";
import { WalletBadge } from "./WalletBadge";
import { TransferProgress } from "./TransferProgress";
import { ChainStatusBadge } from "../common/ChainStatusBadge";
import { TrustlineWarning } from "../common/TrustlineWarning";

export function BridgePanel() {
  const [sourceChain, setSourceChain] = useState<Chain>("ethereum");
  const [destChain, setDestChain] = useState<Chain>("solana");
  const [amount, setAmount] = useState("");
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [walletModalSide, setWalletModalSide] = useState<"source" | "destination">("source");

  const { data: chainConfig } = useChainConfig();
  const { data: chainStatus } = useChainStatus();

  const sourceWallet = useChainWallet(sourceChain);
  const destWallet = useChainWallet(destChain);

  const { bridge, transferId, step, error, reset } = useBridge();

  // Balance
  const { data: balanceData } = useBalance(
    sourceChain,
    sourceWallet.address || ""
  );
  const balance = balanceData?.balance ?? "0";

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
    } catch (_e) {
      // handled by useBridge
    }
  };

  const handleBridge = async () => {
    if (!sourceWallet.address || !destWallet.address || !amount || !chainConfig) return;

    const tokenAddress = chainConfig[sourceChain].tokenAddress;
    await bridge({
      sourceChain,
      destChain,
      sourceAddress: sourceWallet.address,
      destAddress: destWallet.address,
      amount,
      signBurn: sourceWallet.signBurn,
      tokenAddress,
    });

    if (step === "done") setAmount("");
  };

  const sameChain = sourceChain === destChain;
  const sourceDown = chainStatus?.[sourceChain] === false;
  const destDown = chainStatus?.[destChain] === false;
  const chainDown = sourceDown || destDown;
  const insufficientBalance =
    !!amount && parseFloat(amount) > 0 && parseFloat(amount) > parseFloat(balance);
  const isProcessing = step === "registering" || step === "burning" || step === "confirming";

  const handleMainButton = () => {
    if (!sourceWallet.connected) {
      openWalletModal("source");
    } else if (!destWallet.connected) {
      openWalletModal("destination");
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
    if (!destWallet.connected) return "Connect destination wallet";
    if (!amount || parseFloat(amount) <= 0) return "Enter an amount";
    if (insufficientBalance) return "Insufficient balance";
    return "Bridge EURCV";
  };

  const mainButtonEnabled =
    !sameChain &&
    !chainDown &&
    !isProcessing &&
    (!sourceWallet.connected ||
      !destWallet.connected ||
      (!!amount && parseFloat(amount) > 0 && !insufficientBalance));

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-xl font-semibold text-white">Bridge</h1>
        <HelpCircle size={16} className="text-zinc-500" />
      </div>

      {/* Card */}
      <div className="bg-zinc-900/60 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
        {/* Source (From) */}
        <div className="mb-1">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
              From <ChainStatusBadge chain={sourceChain} />
            </span>
            <div className="flex items-center gap-2">
              {sourceWallet.connected && (
                <span className="text-xs text-zinc-500">
                  {parseFloat(balance).toFixed(2)} EURCV
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
            <WalletBadge
              address={destWallet.address}
              connected={destWallet.connected}
              onConnect={() => openWalletModal("destination")}
              onDisconnect={() => destWallet.disconnect()}
            />
          </div>

          <ChainSelector value={destChain} onChange={setDestChain} />

          {destWallet.connected && amount && parseFloat(amount) > 0 && (
            <div className="mt-3 flex items-center justify-between text-xs text-zinc-500 px-1">
              <span>You will receive</span>
              <span className="text-white font-medium">~{amount} EURCV</span>
            </div>
          )}
        </div>

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
          className={`w-full mt-5 py-4 rounded-xl text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            mainButtonEnabled
              ? !sourceWallet.connected || !destWallet.connected
                ? "bg-zinc-700 text-zinc-200 hover:bg-zinc-600"
                : "bg-white text-black hover:bg-zinc-200"
              : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
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

        {/* Error without transferId (e.g. rejected before creation) */}
        {step === "error" && !transferId && error && (
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

        {step === "done" && (
          <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <p className="text-xs text-emerald-400">Bridge complete!</p>
            <button
              onClick={reset}
              className="text-xs text-emerald-300 underline mt-1 cursor-pointer"
            >
              Start new transfer
            </button>
          </div>
        )}
      </div>

      {/* Wallet selection modal */}
      <WalletModal
        open={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        side={walletModalSide}
        onSelect={handleWalletSelect}
      />
    </div>
  );
}
