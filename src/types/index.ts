// ============================================================
// BridgeForge – Shared Types
// Inspired by Circle CCTP & LayerZero OFT burn-and-mint model
// ============================================================

/** Supported blockchain networks */
export type Chain = "ethereum" | "solana" | "xrpl";

/** Transfer status lifecycle (mirrors CCTP flow) */
export type TransferStatus =
  | "pending"       // Transfer request received
  | "burning"       // Burn tx submitted on source chain
  | "burned"        // Burn confirmed on source chain
  | "attesting"     // Backend creating attestation proof
  | "attested"      // Attestation ready
  | "minting"       // Mint tx submitted on destination chain
  | "completed"     // Mint confirmed – transfer done
  | "failed";       // Something went wrong

/** A cross-chain transfer request */
export interface TransferRequest {
  sourceChain: Chain;
  destinationChain: Chain;
  senderAddress: string;
  recipientAddress: string;
  amount: string;            // String to avoid floating-point issues
  token: "testEURCV";        // Only one token for now
}

/** A transfer in progress, tracked by the bridge */
export interface Transfer extends TransferRequest {
  id: string;
  status: TransferStatus;
  burnTxHash?: string;
  mintTxHash?: string;
  attestation?: Attestation;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Attestation – proof that a burn happened on the source chain.
 * In CCTP, Circle signs this. In our bridge, our backend is the attester.
 * In production, Forge would be the attester.
 */
export interface Attestation {
  transferId: string;
  sourceChain: Chain;
  destinationChain: Chain;
  amount: string;
  recipientAddress: string;
  burnTxHash: string;
  signature: string;         // Signed by our backend (attester)
  timestamp: number;
}

/**
 * Chain adapter interface – each blockchain implements this.
 * This is the abstraction layer that hides chain-specific logic.
 */
export interface ChainAdapter {
  chain: Chain;

  /** Burn tokens on this chain. Returns the burn tx hash. */
  burn(senderAddress: string, amount: string): Promise<string>;

  /** Mint tokens on this chain. Returns the mint tx hash. */
  mint(recipientAddress: string, amount: string): Promise<string>;

  /** Listen for burn events. Calls the handler when a burn is detected. */
  listenForBurns(handler: (event: BurnEvent) => void): void;

  /** Get the token balance of an address */
  getBalance(address: string): Promise<string>;

  /** Check if an address is valid on this chain */
  isValidAddress(address: string): boolean;
}

/** Event emitted when tokens are burned on a chain */
export interface BurnEvent {
  chain: Chain;
  txHash: string;
  sender: string;
  amount: string;
  timestamp: number;
}

/** API response wrapper */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
