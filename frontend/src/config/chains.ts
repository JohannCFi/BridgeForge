import type { ChainMeta } from "../types";

const isMainnet = import.meta.env.VITE_NETWORK_MODE === "mainnet";

export const CHAINS: ChainMeta[] = [
  {
    id: "ethereum",
    name: isMainnet ? "Ethereum" : "Ethereum Sepolia",
    icon: "/icons/ethereum.png",
    explorerUrl: isMainnet ? "https://etherscan.io" : "https://sepolia.etherscan.io",
    rpcUrl: import.meta.env.VITE_ALCHEMY_SEPOLIA_URL || "https://rpc.sepolia.org",
    tokenAddress: "0xc2880b20fBdF04c58CA9181e74fae3A299C15a2c",
    tokenAddresses: {
      tEURCV: "0xc2880b20fBdF04c58CA9181e74fae3A299C15a2c",
      tUSDCV: "0x7D097e45Bb69610D4b9B8E4366Dd139E96fa5F7E",
      EURCV: import.meta.env.VITE_ETHEREUM_EURCV_ADDRESS || "",
      USDCV: import.meta.env.VITE_ETHEREUM_USDCV_ADDRESS || "",
    },
  },
  {
    id: "solana",
    name: isMainnet ? "Solana" : "Solana Devnet",
    icon: "/icons/solana.svg",
    explorerUrl: isMainnet ? "https://explorer.solana.com" : "https://explorer.solana.com/?cluster=devnet",
    rpcUrl: import.meta.env.VITE_SOLANA_RPC_URL || "https://api.devnet.solana.com",
    tokenAddress: "8uxdRK31zZXNnpovHm13LuRoe6PYh3m1fTBU6XZ2Cfxo",
    tokenAddresses: {
      tEURCV: "8uxdRK31zZXNnpovHm13LuRoe6PYh3m1fTBU6XZ2Cfxo",
      tUSDCV: "CNGv9zosJNcF67rXgGza1617KcPR8pyKZXB5ooS8GBpv",
      EURCV: import.meta.env.VITE_SOLANA_EURCV_ADDRESS || "",
      USDCV: import.meta.env.VITE_SOLANA_USDCV_ADDRESS || "",
    },
  },
  {
    id: "xrpl",
    name: isMainnet ? "XRP Ledger" : "XRPL Testnet",
    icon: "/icons/xrpb.png",
    explorerUrl: isMainnet ? "https://livenet.xrpl.org" : "https://testnet.xrpl.org",
    rpcUrl: import.meta.env.VITE_XRPL_RPC_URL || "https://s.altnet.rippletest.net:51234",
    tokenAddress: "rMFnd1EECtCuf42uGd48AhFGwiF3rKmnu4",
    tokenAddresses: {
      tEURCV: "rMFnd1EECtCuf42uGd48AhFGwiF3rKmnu4",
      tUSDCV: "rMFnd1EECtCuf42uGd48AhFGwiF3rKmnu4",
      EURCV: import.meta.env.VITE_XRPL_EURCV_ISSUER || "",
      USDCV: import.meta.env.VITE_XRPL_USDCV_ISSUER || "",
    },
  },
  {
    id: "stellar",
    name: isMainnet ? "Stellar" : "Stellar Testnet",
    icon: "/icons/Stellar.png",
    explorerUrl: isMainnet ? "https://stellar.expert/explorer/public" : "https://stellar.expert/explorer/testnet",
    rpcUrl: import.meta.env.VITE_STELLAR_RPC_URL || "https://horizon-testnet.stellar.org",
    tokenAddress: "GCBC3KMTFHYUI3ULK3KHYEPAEEFN5OZ44PHIMWYAJJAFQHVN7VA3L423",
    tokenAddresses: {
      tEURCV: "GCBC3KMTFHYUI3ULK3KHYEPAEEFN5OZ44PHIMWYAJJAFQHVN7VA3L423",
      tUSDCV: "GCBC3KMTFHYUI3ULK3KHYEPAEEFN5OZ44PHIMWYAJJAFQHVN7VA3L423",
      EURCV: import.meta.env.VITE_STELLAR_EURCV_ISSUER || "",
      USDCV: import.meta.env.VITE_STELLAR_USDCV_ISSUER || "",
    },
  },
];

export function getChain(id: string): ChainMeta | undefined {
  return CHAINS.find((c) => c.id === id);
}
