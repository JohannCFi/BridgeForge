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

export function useBridge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: TransferRequest) => api.initiateTransfer(req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transfers"] });
      qc.invalidateQueries({ queryKey: ["balance"] });
    },
  });
}
