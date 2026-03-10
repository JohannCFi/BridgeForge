export type Chain = "ethereum" | "solana" | "xrpl" | "stellar";

export type TransferStatus =
  | "pending"
  | "burning"
  | "burned"
  | "attesting"
  | "attested"
  | "minting"
  | "completed"
  | "failed";

export interface TransferRequest {
  sourceChain: Chain;
  destinationChain: Chain;
  senderAddress: string;
  recipientAddress: string;
  amount: string;
}

export interface Transfer extends TransferRequest {
  id: string;
  status: TransferStatus;
  token: string;
  burnTxHash?: string;
  mintTxHash?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChainMeta {
  id: Chain;
  name: string;
  icon: string;
  explorerUrl: string;
}
