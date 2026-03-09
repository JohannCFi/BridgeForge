// ============================================================
// BridgeForge – Chain Adapter Registry
// Central access point for all chain adapters
// ============================================================

import { Chain, ChainAdapter } from "../types";
import { EthereumAdapter } from "./ethereum/adapter";
import { SolanaAdapter } from "./solana/adapter";
import { XrplAdapter } from "./xrpl/adapter";

/** Creates and returns all chain adapters */
export function createAdapters(): Record<Chain, ChainAdapter> {
  return {
    ethereum: new EthereumAdapter(),
    solana: new SolanaAdapter(),
    xrpl: new XrplAdapter(),
  };
}

export { EthereumAdapter, SolanaAdapter, XrplAdapter };
