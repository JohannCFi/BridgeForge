import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { Chain, TransferRequest } from "../types";

export function useBalance(chain: Chain | null, address: string) {
  return useQuery({
    queryKey: ["balance", chain, address],
    queryFn: () => api.getBalance(chain!, address),
    enabled: !!chain && !!address,
    refetchInterval: 15_000,
  });
}

export function useTransfers() {
  return useQuery({
    queryKey: ["transfers"],
    queryFn: api.getTransfers,
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

/** Register transfer intent (step 1) */
export function useRegisterTransfer() {
  return useMutation({
    mutationFn: (req: TransferRequest) => api.registerTransfer(req),
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
