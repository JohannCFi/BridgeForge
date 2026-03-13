// ============================================================
// BridgeForge – Chain Adapter Registry
// Central access point for all chain adapters
// ============================================================

import { Chain, ChainAdapter } from "../types/index.js";
import { EthereumAdapter } from "./ethereum/adapter.js";
import { SolanaAdapter } from "./solana/adapter.js";
import { XrplAdapter } from "./xrpl/adapter.js";
import { StellarAdapter } from "./stellar/adapter.js";

/** Creates and returns all chain adapters */
export function createAdapters(): Record<Chain, ChainAdapter> {
  return {
    ethereum: new EthereumAdapter(),
    solana: new SolanaAdapter(),
    xrpl: new XrplAdapter(),
    stellar: new StellarAdapter(),
  };
}

export { EthereumAdapter, SolanaAdapter, XrplAdapter, StellarAdapter };
