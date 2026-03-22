import type { Chain, Token, Transfer, CreateTransferRequest } from "../types";

const BASE = `${import.meta.env.VITE_API_URL || ""}/api/v1`;

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
  /** Get chain health statuses */
  getHealth: () => request<Record<Chain, boolean>>("/health"),

  getBalance: (chain: Chain, address: string, token: Token = "tEURCV") =>
    request<{ chain: Chain; address: string; balance: string; token: Token }>(
      `/balance/${chain}/${address}?token=${token}`
    ),

  /** Register a transfer intent. Returns transfer in ready or rejected status. */
  registerTransfer: (req: CreateTransferRequest) =>
    request<Transfer>("/transfer", {
      method: "POST",
      body: JSON.stringify(req),
    }),

  /** Confirm burn tx. Backend verifies, attests, enqueues mint. */
  confirmBurn: (transferId: string, burnTxHash: string) =>
    request<Transfer>(`/transfer/${transferId}/confirm-burn`, {
      method: "POST",
      body: JSON.stringify({ burnTxHash }),
    }),

  getTransfer: (id: string) => request<Transfer>(`/transfer/${id}`),

  getTransfers: (address?: string, chain?: string) => {
    const params = new URLSearchParams();
    if (address) params.set("address", address);
    if (chain) params.set("chain", chain);
    const qs = params.toString();
    return request<Transfer[]>(`/transfers${qs ? `?${qs}` : ""}`);
  },

  /** Get chain configs (token addresses) */
  getConfig: () =>
    request<Record<Chain, { tokenAddress: string }> & { tokens: Record<Token, Record<Chain, { tokenAddress: string }>> }>("/config"),

  /** Faucet: mint 1000 test tokens to an address */
  faucet: (chain: Chain, address: string, token: Token = "tEURCV") =>
    request<{ chain: Chain; address: string; amount: string; txHash: string; token: Token }>("/faucet", {
      method: "POST",
      body: JSON.stringify({ chain, address, token }),
    }),
};
