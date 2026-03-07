// ============================================================
// BridgeForge – Configuration
// All chain-specific settings: RPCs, contract addresses, etc.
// ============================================================

import { Chain } from "../types";

export interface ChainConfig {
  chain: Chain;
  name: string;
  rpcUrl: string;
  testnet: boolean;
  tokenAddress: string;     // testEURCV contract/token address
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
