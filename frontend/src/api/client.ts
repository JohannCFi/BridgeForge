import type { Chain, Transfer, TransferRequest } from "../types";

const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Request failed");
  return json.data as T;
}

export const api = {
  getChains: () => request<Chain[]>("/chains"),

  getBalance: (chain: Chain, address: string) =>
    request<{ chain: Chain; address: string; balance: string; token: string }>(
      `/balance/${chain}/${address}`
    ),

  /** Register a transfer intent (no burn yet). Returns transfer with ID. */
  registerTransfer: (req: TransferRequest) =>
    request<Transfer>("/transfer", {
      method: "POST",
      body: JSON.stringify(req),
    }),

  /** Confirm user has burned. Backend verifies, attests, mints. */
  confirmBurn: (transferId: string, burnTxHash: string) =>
    request<Transfer>(`/transfer/${transferId}/confirm-burn`, {
      method: "POST",
      body: JSON.stringify({ burnTxHash }),
    }),

  getTransfer: (id: string) => request<Transfer>(`/transfer/${id}`),

  getTransfers: () => request<Transfer[]>("/transfers"),

  /** Get chain configs (token addresses) needed to construct burn txs */
  getConfig: () =>
    request<Record<Chain, { tokenAddress: string }>>("/config"),
};
