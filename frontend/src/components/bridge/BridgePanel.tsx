import { useState } from "react";
import { ArrowDownUp, HelpCircle, Loader2 } from "lucide-react";
import type { Chain } from "../../types";
import {
  useBalance,
  useChainConfig,
  useRegisterTransfer,
  useConfirmBurn,
} from "../../api/hooks";
import { useChainWallet } from "../../hooks/useWallet";
import { ChainSelector } from "./ChainSelector";
import { AmountInput } from "./AmountInput";
import { WalletModal } from "./WalletModal";
import { WalletBadge } from "./WalletBadge";

type BridgeStep = "idle" | "registering" | "burning" | "confirming" | "done" | "error";

export function BridgePanel() {
  const [sourceChain, setSourceChain] = useState<Chain>("ethereum");
  const [destChain, setDestChain] = useState<Chain>("solana");
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<BridgeStep>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [walletModalSide, setWalletModalSide] = useState<"source" | "destination">("source");

  const { data: chainConfig } = useChainConfig();

  const sourceWallet = useChainWallet(sourceChain);
  const destWallet = useChainWallet(destChain);

  const registerTransfer = useRegisterTransfer();
  const confirmBurn = useConfirmBurn();

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

  // Open the wallet modal for the appropriate side
  const openWalletModal = (side: "source" | "destination") => {
    setWalletModalSide(side);
    setWalletModalOpen(true);
  };

  // Handle wallet selection from the modal – all chains use wallet.connect(walletId)
  const handleWalletSelect = async (walletId: string) => {
    setWalletModalOpen(false);
    const wallet = walletModalSide === "source" ? sourceWallet : destWallet;

    try {
      await wallet.connect(walletId);
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : "Failed to connect wallet");
      setStep("error");
    }
  };

  const handleBridge = async () => {
    if (!sourceWallet.address || !destWallet.address || !amount || !chainConfig) return;

    try {
      setStep("registering");
      setStatusMsg("Registering transfer...");

      const transfer = await registerTransfer.mutateAsync({
        sourceChain,
        destinationChain: destChain,
        senderAddress: sourceWallet.address,
        recipientAddress: destWallet.address,
        amount,
      });

      setStep("burning");
      setStatusMsg("Please sign the burn transaction in your wallet...");

      const tokenAddress = chainConfig[sourceChain].tokenAddress;
      const burnTxHash = await sourceWallet.signBurn({
        amount,
        tokenAddress,
        destinationChain: destChain,
        recipientAddress: destWallet.address!,
      });

      setStep("confirming");
      setStatusMsg("Verifying burn and minting on destination chain...");

      await confirmBurn.mutateAsync({
        transferId: transfer.id,
        burnTxHash,
      });

      setStep("done");
      setStatusMsg(`Bridge complete! Transfer ID: ${transfer.id.slice(0, 8)}...`);
      setAmount("");
    } catch (e) {
      setStep("error");
      setStatusMsg(e instanceof Error ? e.message : "Bridge failed");
    }
  };

  const sameChain = sourceChain === destChain;
  const insufficientBalance =
    !!amount && parseFloat(amount) > 0 && parseFloat(amount) > parseFloat(balance);
  const isProcessing = step === "registering" || step === "burning" || step === "confirming";

  // Single bottom button logic
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
    if (isProcessing) {
      if (step === "registering") return "Registering...";
      if (step === "burning") return "Sign burn in wallet...";
      if (step === "confirming") return "Verifying & minting...";
    }
    if (!sourceWallet.connected) return "Connect source wallet";
    if (!destWallet.connected) return "Connect destination wallet";
    if (!amount || parseFloat(amount) <= 0) return "Enter an amount";
    if (insufficientBalance) return "Insufficient balance";
    return "Bridge tEURCV";
  };

  const mainButtonEnabled =
    !sameChain &&
    !isProcessing &&
    // Allow click if wallets not connected (opens modal)
    (!sourceWallet.connected ||
      !destWallet.connected ||
      (!!amount && parseFloat(amount) > 0 && !insufficientBalance));

  const modalChain = walletModalSide === "source" ? sourceChain : destChain;

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
            <span className="text-xs text-zinc-500 uppercase tracking-wider">
              From
            </span>
            <div className="flex items-center gap-2">
              {sourceWallet.connected && (
                <span className="text-xs text-zinc-500">
                  {parseFloat(balance).toFixed(2)} tEURCV
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
            <span className="text-xs text-zinc-500 uppercase tracking-wider">
              To
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
              <span className="text-white font-medium">~{amount} tEURCV</span>
            </div>
          )}
        </div>

        {/* Single main button */}
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

        {/* Status messages */}
        {step === "done" && (
          <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <p className="text-xs text-emerald-400">{statusMsg}</p>
          </div>
        )}
        {step === "error" && (
          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-xs text-red-400">{statusMsg}</p>
            <button
              onClick={() => setStep("idle")}
              className="text-xs text-red-300 underline mt-1 cursor-pointer"
            >
              Try again
            </button>
          </div>
        )}
        {isProcessing && (
          <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <p className="text-xs text-blue-400">{statusMsg}</p>
          </div>
        )}
      </div>

      {/* Wallet selection modal */}
      <WalletModal
        open={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        chain={modalChain}
        side={walletModalSide}
        onSelect={handleWalletSelect}
      />
    </div>
  );
}
