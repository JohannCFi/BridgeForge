import type { ChainMeta } from "../types";

export const CHAINS: ChainMeta[] = [
  {
    id: "ethereum",
    name: "Ethereum Sepolia",
    icon: "/icons/ethereum.svg",
    explorerUrl: "https://sepolia.etherscan.io",
  },
  {
    id: "solana",
    name: "Solana Devnet",
    icon: "/icons/solana.svg",
    explorerUrl: "https://explorer.solana.com/?cluster=devnet",
  },
  {
    id: "xrpl",
    name: "XRPL Testnet",
    icon: "/icons/xrpl.svg",
    explorerUrl: "https://testnet.xrpl.org",
  },
  {
    id: "stellar",
    name: "Stellar Testnet",
    icon: "/icons/stellar.svg",
    explorerUrl: "https://stellar.expert/explorer/testnet",
  },
];

export function getChain(id: string): ChainMeta | undefined {
  return CHAINS.find((c) => c.id === id);
}
