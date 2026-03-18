import type { ChainMeta } from "../types";

export const CHAINS: ChainMeta[] = [
  {
    id: "ethereum",
    name: "Ethereum Sepolia",
    icon: "/icons/ethereum.svg",
    explorerUrl: "https://sepolia.etherscan.io",
    rpcUrl: import.meta.env.VITE_ALCHEMY_SEPOLIA_URL || "https://rpc.sepolia.org",
    tokenAddress: "0xc2880b20fBdF04c58CA9181e74fae3A299C15a2c",
  },
  {
    id: "solana",
    name: "Solana Devnet",
    icon: "/icons/solana.svg",
    explorerUrl: "https://explorer.solana.com/?cluster=devnet",
    rpcUrl: "https://api.devnet.solana.com",
    tokenAddress: "8uxdRK31zZXNnpovHm13LuRoe6PYh3m1fTBU6XZ2Cfxo",
  },
  {
    id: "xrpl",
    name: "XRPL Testnet",
    icon: "/icons/xrpl.svg",
    explorerUrl: "https://testnet.xrpl.org",
    rpcUrl: "https://s.altnet.rippletest.net:51234",
    tokenAddress: "rMFnd1EECtCuf42uGd48AhFGwiF3rKmnu4",
  },
  {
    id: "stellar",
    name: "Stellar Testnet",
    icon: "/icons/stellar.svg",
    explorerUrl: "https://stellar.expert/explorer/testnet",
    rpcUrl: "https://horizon-testnet.stellar.org",
    tokenAddress: "GCBC3KMTFHYUI3ULK3KHYEPAEEFN5OZ44PHIMWYAJJAFQHVN7VA3L423",
  },
];

export function getChain(id: string): ChainMeta | undefined {
  return CHAINS.find((c) => c.id === id);
}
