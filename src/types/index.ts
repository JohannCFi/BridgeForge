// ============================================================
// BridgeForge – Shared Types
// Inspired by Circle CCTP & LayerZero OFT burn-and-mint model
// ============================================================

/** Supported blockchain networks */
export type Chain = "ethereum" | "solana" | "xrpl" | "stellar";

/** Supported tokens */
export type Token = "tEURCV" | "tUSDCV";
export const SUPPORTED_TOKENS: Token[] = ["tEURCV", "tUSDCV"];

/** Transfer status lifecycle */
export type TransferStatus =
  | "pending"
  | "rejected"
  | "ready"
  | "expired"
  | "burn_confirmed"
  | "attested"
  | "minting"
  | "completed"
  | "mint_failed"
  | "refunding"
  | "refunded"
  | "refund_failed";

/** Domain IDs for cross-chain addressing */
export const DOMAIN_IDS: Record<Chain, number> = {
  ethereum: 0,
  solana: 1,
  xrpl: 2,
  stellar: 3,
};

/** Bridge message matching on-chain BridgeMessage struct */
export interface BridgeMessage {
  version: number;
  transferId: string;
  sourceDomain: number;
  destDomain: number;
  sender: string;
  recipient: string;
  amount: string;
  burnTxHash: string;
}

/** Result of verifying a burn transaction on-chain */
export interface BurnProof {
  valid: boolean;
  sender: string;
  amount: string;
  txHash: string;
  transferId?: string; // on-chain transferId from BurnForBridge event (ETH/Solana only)
}

/** Result of executing a mint */
export interface MintResult {
  success: boolean;
  txHash: string;
}

/** Result of executing a refund */
export interface RefundResult {
  success: boolean;
  txHash: string;
}

/** Token-specific context passed to adapter methods */
export interface TokenContext {
  tokenAddress: string;
  currencyCode?: string;  // XRPL 40-char hex currency code
  assetCode?: string;     // Stellar asset code (e.g. "tUSDCV")
  operatorKey?: string;   // Override operator key (XRPL seed / Stellar secret)
}

/**
 * Chain adapter interface – each blockchain implements this.
 * This is the abstraction layer that hides chain-specific logic.
 */
export interface ChainAdapter {
  chain: Chain;
  verifyBurn(txHash: string): Promise<BurnProof>;
  executeMint(recipientAddress: string, amount: string, tokenCtx?: TokenContext): Promise<MintResult>;
  refund(senderAddress: string, amount: string, tokenCtx?: TokenContext): Promise<RefundResult>;
  getBalance(address: string, tokenCtx?: TokenContext): Promise<string>;
  isHealthy(): Promise<boolean>;
  hasTrustline?(address: string, tokenCtx?: TokenContext): Promise<boolean>;
}

/** API response wrapper */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
