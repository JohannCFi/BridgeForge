import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { getBalance } from "./balances";
import type { Chain, Token, CreateTransferRequest } from "../types";

export function useBalance(chain: Chain | null, address: string, token: Token = "tEURCV") {
  return useQuery({
    queryKey: ["balance", chain, address, token],
    queryFn: () => getBalance(chain!, address, token),
    enabled: !!chain && !!address,
    refetchInterval: 15_000,
  });
}

export function useTransfers(address?: string, chain?: string) {
  return useQuery({
    queryKey: ["transfers", address, chain],
    queryFn: () => api.getTransfers(address, chain),
    refetchInterval: 5_000,
  });
}

export function useChainConfig() {
  return useQuery({
    queryKey: ["chainConfig"],
    queryFn: api.getConfig,
    staleTime: Infinity,
  });
}

/** Poll chain health statuses */
export function useChainStatus() {
  return useQuery({
    queryKey: ["chainStatus"],
    queryFn: api.getHealth,
    refetchInterval: 30_000,
  });
}

/** Poll a single transfer status while it's active */
export function useTransferStatus(transferId: string | null) {
  return useQuery({
    queryKey: ["transfer", transferId],
    queryFn: () => api.getTransfer(transferId!),
    enabled: !!transferId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status) return 3_000;
      // Stop polling when terminal
      if (["completed", "refunded", "refund_failed", "expired", "rejected"].includes(status)) {
        return false;
      }
      return 3_000;
    },
  });
}

/** Register transfer intent (step 1) */
export function useRegisterTransfer() {
  return useMutation({
    mutationFn: (req: CreateTransferRequest) => api.registerTransfer(req),
  });
}

/** Confirm burn and trigger mint (step 2) */
export function useConfirmBurn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { transferId: string; burnTxHash: string }) =>
      api.confirmBurn(params.transferId, params.burnTxHash),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transfers"] });
      qc.invalidateQueries({ queryKey: ["balance"] });
    },
  });
}
