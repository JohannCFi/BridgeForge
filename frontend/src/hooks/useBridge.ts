import { useState } from "react";
import { useRegisterTransfer, useConfirmBurn } from "../api/hooks";
import type { Chain } from "../types";

export type BridgeStep = "idle" | "registering" | "burning" | "confirming" | "done" | "error";

export function useBridge() {
  const [transferId, setTransferId] = useState<string | null>(null);
  const [step, setStep] = useState<BridgeStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const registerMutation = useRegisterTransfer();
  const confirmMutation = useConfirmBurn();

  async function bridge(params: {
    sourceChain: Chain;
    destChain: Chain;
    sourceAddress: string;
    destAddress: string;
    amount: string;
    signBurn: (params: any) => Promise<string>;
    tokenAddress: string;
  }) {
    try {
      setStep("registering");
      setError(null);

      const transfer = await registerMutation.mutateAsync({
        sourceChain: params.sourceChain,
        destChain: params.destChain,
        sourceAddress: params.sourceAddress,
        destAddress: params.destAddress,
        amount: params.amount,
      });

      if (transfer.status === "rejected") {
        setStep("error");
        setError(transfer.errorLog || "Transfer rejected");
        return;
      }

      setTransferId(transfer.id);
      setStep("burning");

      const burnTxHash = await params.signBurn({
        amount: params.amount,
        tokenAddress: params.tokenAddress,
        destinationChain: params.destChain,
        recipientAddress: params.destAddress,
      });

      setStep("confirming");

      await confirmMutation.mutateAsync({
        transferId: transfer.id,
        burnTxHash,
      });

      setStep("done");
    } catch (err: any) {
      setStep("error");
      setError(err.message || "Bridge failed");
    }
  }

  function reset() {
    setStep("idle");
    setError(null);
    setTransferId(null);
  }

  return { bridge, transferId, step, error, reset };
}
