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

  initiateTransfer: (req: TransferRequest) =>
    request<Transfer>("/transfer", {
      method: "POST",
      body: JSON.stringify(req),
    }),

  getTransfer: (id: string) => request<Transfer>(`/transfer/${id}`),

  getTransfers: () => request<Transfer[]>("/transfers"),
};
