// ============================================================
// BridgeForge – Configuration
// All chain-specific settings: RPCs, contract addresses, etc.
// ============================================================

import { Chain, Token } from "../types/index.js";

export interface ChainConfig {
  chain: Chain;
  name: string;
  rpcUrl: string;
  testnet: boolean;
  tokenAddress: string;     // testEURCV contract/token address (legacy, kept for compat)
  explorerUrl: string;
}

/** Chain configurations – all testnets for the POC */
export const chainConfigs: Record<Chain, ChainConfig> = {
  ethereum: {
    chain: "ethereum",
    name: "Ethereum Sepolia",
    rpcUrl: process.env.ETHEREUM_RPC_URL || "https://rpc.sepolia.org",
    testnet: true,
    tokenAddress: process.env.ETHEREUM_TOKEN_ADDRESS || "",
    explorerUrl: "https://sepolia.etherscan.io",
  },
  solana: {
    chain: "solana",
    name: "Solana Devnet",
    rpcUrl: process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
    testnet: true,
    tokenAddress: process.env.SOLANA_TOKEN_ADDRESS || "",
    explorerUrl: "https://explorer.solana.com/?cluster=devnet",
  },
  xrpl: {
    chain: "xrpl",
    name: "XRPL Testnet",
    rpcUrl: process.env.XRPL_RPC_URL || "wss://s.altnet.rippletest.net:51233",
    testnet: true,
    tokenAddress: process.env.XRPL_ISSUER_ADDRESS || "",
    explorerUrl: "https://testnet.xrpl.org",
  },
  stellar: {
    chain: "stellar",
    name: "Stellar Testnet",
    rpcUrl: process.env.STELLAR_RPC_URL || "https://horizon-testnet.stellar.org",
    testnet: true,
    tokenAddress: process.env.STELLAR_ISSUER_ADDRESS || "",
    explorerUrl: "https://stellar.expert/explorer/testnet",
  },
};

/** Server config */
export const serverConfig = {
  port: parseInt(process.env.PORT || "3000", 10),
  host: process.env.HOST || "0.0.0.0",
};

/** Bridge operator private keys (loaded from .env, NEVER hardcoded) */
export const operatorKeys = {
  ethereum: process.env.ETHEREUM_PRIVATE_KEY || "",
  solana: process.env.SOLANA_PRIVATE_KEY || "",
  xrpl: process.env.XRPL_PRIVATE_KEY || "",
  stellar: process.env.STELLAR_PRIVATE_KEY || "",
  attestation: process.env.ATTESTATION_PRIVATE_KEY || "",
};

/** Token-specific configuration per chain */
export interface TokenChainConfig {
  tokenAddress: string;
  currencyCode?: string;  // XRPL hex currency code
  assetCode?: string;     // Stellar asset code
  operatorKey?: string;   // Override operator key for this token (XRPL/Stellar issuers)
}

// XRPL currency codes: ASCII hex-encoded, padded to 40 chars
const XRPL_EURCV_CURRENCY = "7445555243560000000000000000000000000000"; // "tEURCV"
const XRPL_USDCV_CURRENCY = "7455534443560000000000000000000000000000"; // "tUSDCV"

// XRPL currency codes for production tokens
const XRPL_EURCV_PROD_CURRENCY = "4555524356000000000000000000000000000000"; // "EURCV"
const XRPL_USDCV_PROD_CURRENCY = "5553444356000000000000000000000000000000"; // "USDCV"

export const tokenConfigs: Record<Token, Record<Chain, TokenChainConfig>> = {
  // ── Testnet tokens (current POC) ──
  tEURCV: {
    ethereum: { tokenAddress: process.env.ETHEREUM_TOKEN_ADDRESS || "" },
    solana: { tokenAddress: process.env.SOLANA_TOKEN_ADDRESS || "" },
    xrpl: {
      tokenAddress: process.env.XRPL_ISSUER_ADDRESS || "",
      currencyCode: XRPL_EURCV_CURRENCY,
    },
    stellar: {
      tokenAddress: process.env.STELLAR_ISSUER_ADDRESS || "",
      assetCode: "tEURCV",
    },
  },
  tUSDCV: {
    ethereum: { tokenAddress: process.env.ETHEREUM_USDCV_TOKEN_ADDRESS || "" },
    solana: { tokenAddress: process.env.SOLANA_USDCV_TOKEN_ADDRESS || "" },
    xrpl: {
      tokenAddress: process.env.XRPL_USDCV_ISSUER_ADDRESS || process.env.XRPL_ISSUER_ADDRESS || "",
      currencyCode: XRPL_USDCV_CURRENCY,
      operatorKey: process.env.XRPL_USDCV_PRIVATE_KEY || process.env.XRPL_PRIVATE_KEY || "",
    },
    stellar: {
      tokenAddress: process.env.STELLAR_USDCV_ISSUER_ADDRESS || process.env.STELLAR_ISSUER_ADDRESS || "",
      assetCode: "tUSDCV",
      operatorKey: process.env.STELLAR_USDCV_PRIVATE_KEY || process.env.STELLAR_PRIVATE_KEY || "",
    },
  },

  // ── Production SG Forge tokens ──
  // To activate: set the corresponding env vars (ETHEREUM_EURCV_PROD_ADDRESS, etc.)
  EURCV: {
    ethereum: { tokenAddress: process.env.ETHEREUM_EURCV_PROD_ADDRESS || "" },
    solana: { tokenAddress: process.env.SOLANA_EURCV_PROD_ADDRESS || "" },
    xrpl: {
      tokenAddress: process.env.XRPL_EURCV_PROD_ISSUER || "",
      currencyCode: XRPL_EURCV_PROD_CURRENCY,
      operatorKey: process.env.XRPL_EURCV_PROD_KEY || "",
    },
    stellar: {
      tokenAddress: process.env.STELLAR_EURCV_PROD_ISSUER || "",
      assetCode: "EURCV",
      operatorKey: process.env.STELLAR_EURCV_PROD_KEY || "",
    },
  },
  USDCV: {
    ethereum: { tokenAddress: process.env.ETHEREUM_USDCV_PROD_ADDRESS || "" },
    solana: { tokenAddress: process.env.SOLANA_USDCV_PROD_ADDRESS || "" },
    xrpl: {
      tokenAddress: process.env.XRPL_USDCV_PROD_ISSUER || "",
      currencyCode: XRPL_USDCV_PROD_CURRENCY,
      operatorKey: process.env.XRPL_USDCV_PROD_KEY || "",
    },
    stellar: {
      tokenAddress: process.env.STELLAR_USDCV_PROD_ISSUER || "",
      assetCode: "USDCV",
      operatorKey: process.env.STELLAR_USDCV_PROD_KEY || "",
    },
  },
};

/** Resolve the TokenContext for a given token+chain */
export function getTokenContext(token: Token, chain: Chain) {
  return tokenConfigs[token][chain];
}
