import { useState } from "react";
import { ArrowDownUp, HelpCircle, Zap } from "lucide-react";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import type { Chain } from "../../types";
import { useBalance, useBridge } from "../../api/hooks";
import { ChainSelector } from "./ChainSelector";
import { AmountInput } from "./AmountInput";

export function BridgePanel() {
  const [sourceChain, setSourceChain] = useState<Chain>("ethereum");
  const [destChain, setDestChain] = useState<Chain>("xrpl");
  const [amount, setAmount] = useState("");
  const [senderAddress, setSenderAddress] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");

  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const bridge = useBridge();

  const swap = () => {
    const prevSource = sourceChain;
    const prevDest = destChain;
    const prevSender = senderAddress;
    const prevRecipient = recipientAddress;
    setSourceChain(prevDest);
    setDestChain(prevSource);
    setSenderAddress(prevRecipient);
    setRecipientAddress(prevSender);
  };

  // Resolve addresses: use wallet if chain is Ethereum and connected, otherwise use manual input
  const resolvedSender =
    sourceChain === "ethereum" && isConnected ? address! : senderAddress;
  const resolvedRecipient =
    destChain === "ethereum" && isConnected ? address! : recipientAddress;

  // Manual address input only for non-EVM chains (XRPL, Solana).
  // For Ethereum, the wallet connection handles the address.
  const needsSenderInput = sourceChain !== "ethereum";
  const needsRecipientInput = destChain !== "ethereum";

  // Balance
  const { data: balanceData } = useBalance(
    sourceChain,
    resolvedSender || ""
  );
  const balance = balanceData?.balance ?? "0";

  const handleBridge = async () => {
    if (!isConnected && (sourceChain === "ethereum" || destChain === "ethereum")) {
      openConnectModal?.();
      return;
    }

    if (!resolvedSender || !resolvedRecipient || !amount) return;

    try {
      await bridge.mutateAsync({
        sourceChain,
        destinationChain: destChain,
        senderAddress: resolvedSender,
        recipientAddress: resolvedRecipient,
        amount,
      });
      setAmount("");
      setSenderAddress("");
      setRecipientAddress("");
    } catch {
      // Error handled by mutation state
    }
  };

  const sameChain = sourceChain === destChain;
  const insufficientBalance =
    !!amount && parseFloat(amount) > 0 && parseFloat(amount) > parseFloat(balance);

  const buttonLabel = () => {
    if (sameChain) return "Cannot bridge to the same chain";
    if (bridge.isPending) return "Bridging...";
    if (
      !isConnected &&
      (sourceChain === "ethereum" || destChain === "ethereum")
    )
      return "Connect wallet and bridge";
    if (!amount || parseFloat(amount) <= 0) return "Enter an amount";
    if (insufficientBalance) return "Insufficient balance";
    if (needsSenderInput && !senderAddress) return "Enter sender address";
    if (needsRecipientInput && !recipientAddress)
      return "Enter recipient address";
    return "Bridge tEURCV";
  };

  const canBridge =
    !sameChain &&
    !insufficientBalance &&
    !bridge.isPending &&
    !!amount &&
    parseFloat(amount) > 0 &&
    !!resolvedSender &&
    !!resolvedRecipient;

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-white">Bridge</h1>
          <HelpCircle size={16} className="text-zinc-500" />
        </div>
        <button className="p-2 rounded-lg bg-zinc-800/60 hover:bg-zinc-700 transition-colors cursor-pointer">
          <Zap size={16} className="text-zinc-400" />
        </button>
      </div>

      {/* Card */}
      <div className="bg-zinc-900/60 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
        {/* Transfer From */}
        <div className="mb-1">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-zinc-500 uppercase tracking-wider">
              Transfer from
            </span>
            <span className="text-xs text-zinc-500">
              Balance:{" "}
              <span className="text-white font-medium">{balance}</span>
            </span>
          </div>
          <div className="mb-3">
            <ChainSelector
              value={sourceChain}
              onChange={(chain) => {
                setSourceChain(chain);
              }}
            />
          </div>

          {/* Sender address for non-EVM source */}
          {needsSenderInput && (
            <div className="mb-3">
              <input
                type="text"
                placeholder={`Your ${sourceChain === "solana" ? "Solana" : sourceChain === "stellar" ? "Stellar" : "XRPL"} address`}
                value={senderAddress}
                onChange={(e) => setSenderAddress(e.target.value)}
                className="w-full bg-black/40 border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-white/20 transition-colors"
              />
            </div>
          )}

          <div className="bg-black/40 border border-white/[0.06] rounded-xl px-4 py-3">
            <AmountInput
              value={amount}
              onChange={setAmount}
              balance={balance}
            />
          </div>
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

        {/* Transfer To */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-zinc-500 uppercase tracking-wider">
              Transfer to
            </span>
          </div>
          <ChainSelector
            value={destChain}
            onChange={(chain) => {
              setDestChain(chain);
            }}
          />

          {/* Recipient address for non-EVM destination */}
          {needsRecipientInput && (
            <div className="mt-3">
              <input
                type="text"
                placeholder={`Recipient ${destChain === "solana" ? "Solana" : destChain === "stellar" ? "Stellar" : "XRPL"} address`}
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                className="w-full bg-black/40 border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-white/20 transition-colors"
              />
            </div>
          )}

        </div>

        {/* Bridge Button */}
        <button
          onClick={handleBridge}
          disabled={!canBridge && !(
            !isConnected &&
            (sourceChain === "ethereum" || destChain === "ethereum")
          )}
          className={`w-full mt-5 py-4 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
            canBridge ||
            (!isConnected &&
              (sourceChain === "ethereum" || destChain === "ethereum"))
              ? "bg-white text-black hover:bg-zinc-200"
              : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
          }`}
        >
          {buttonLabel()}
        </button>

        {/* Status messages */}
        {bridge.isSuccess && (
          <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <p className="text-xs text-emerald-400">
              Transfer initiated! ID: {bridge.data.id.slice(0, 8)}...
            </p>
          </div>
        )}
        {bridge.isError && (
          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-xs text-red-400">
              {bridge.error instanceof Error
                ? bridge.error.message
                : "Bridge failed"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
