export type Chain = "ethereum" | "solana" | "xrpl" | "stellar";

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

export interface CreateTransferRequest {
  sourceChain: Chain;
  destChain: Chain;
  sourceAddress: string;
  destAddress: string;
  amount: string;
}

export interface Transfer {
  id: string;
  status: TransferStatus;
  sourceChain: Chain;
  sourceAddress: string;
  destChain: Chain;
  destAddress: string;
  amount: string;
  burnTxHash?: string;
  mintTxHash?: string;
  refundTxHash?: string;
  errorLog?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChainMeta {
  id: Chain;
  name: string;
  icon: string;
  explorerUrl: string;
}
