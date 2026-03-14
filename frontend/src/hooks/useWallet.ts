// ============================================================
// BridgeForge – Unified wallet hook
// Returns connected address + burn function per chain.
// Ethereum uses wagmi connectors directly (no RainbowKit modal),
// Solana uses wallet-adapter, XRPL uses Crossmark/GemWallet,
// Stellar uses Freighter.
// ============================================================

import { useCallback } from "react";
import { useAccount, useConnect, useDisconnect, useWalletClient } from "wagmi";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import type { Chain } from "../types";
import { useXrplWallet } from "./useXrplWallet";
import { useStellarWallet } from "./useStellarWallet";

export interface BurnParams {
  amount: string;
  tokenAddress: string;
  /** Destination chain (encoded in BridgeBurn event for Ethereum) */
  destinationChain?: string;
  /** Recipient address on destination chain */
  recipientAddress?: string;
}

export interface ChainWallet {
  address: string | null;
  connected: boolean;
  /** Connect a specific wallet by its id (e.g. "metamask", "phantom", "crossmark") */
  connect: (walletId?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  /** Sign and send a burn transaction. Returns the tx hash. */
  signBurn: (params: BurnParams) => Promise<string>;
}

// Map our wallet IDs from WalletModal to wagmi connector IDs (EIP-6963 RDNS)
const WALLET_CONNECTOR_MAP: Record<string, string[]> = {
  metamask: ["metaMaskSDK", "io.metamask", "io.metamask.flask", "MetaMask"],
  rabby: ["io.rabby", "Rabby", "Rabby Wallet"],
  phantom: ["app.phantom", "Phantom"],
  walletconnect: ["walletConnect", "WalletConnect"],
};

function findEthConnector(
  connectors: readonly { id: string; name: string }[],
  walletId: string
) {
  const candidates = WALLET_CONNECTOR_MAP[walletId] ?? [walletId];

  // Match by id or name against known candidates
  for (const candidate of candidates) {
    const match = connectors.find(
      (c) => c.id === candidate || c.name === candidate
    );
    if (match) return match;
  }

  // Fuzzy match: check if connector id or name contains the walletId
  const fuzzy = connectors.find(
    (c) =>
      c.id.toLowerCase().includes(walletId) ||
      c.name.toLowerCase().includes(walletId)
  );
  if (fuzzy) return fuzzy;

  // Fallback to injected
  return connectors.find((c) => c.id === "injected");
}

/** Get wallet state + actions for a specific chain */
export function useChainWallet(chain: Chain): ChainWallet {
  // ---------- Ethereum (wagmi connectors) ----------
  const { address: ethAddress, isConnected: ethConnected, connector: ethConnector } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { data: walletClient } = useWalletClient();

  const ethSignBurn = useCallback(
    async (params: BurnParams): Promise<string> => {
      if (!ethAddress) throw new Error("Ethereum wallet not connected");

      const { ethers } = await import("ethers");

      let signer;
      if (ethConnector) {
        const provider = await ethConnector.getProvider();
        const ethProvider = new ethers.BrowserProvider(provider as any);
        signer = await ethProvider.getSigner();
      } else if (walletClient) {
        const provider = new ethers.BrowserProvider(walletClient.transport);
        signer = await provider.getSigner();
      } else {
        throw new Error("No Ethereum provider available");
      }

      // Use a reliable RPC for read calls (wallet RPC may be unreliable on custom networks)
      const readProvider = new ethers.JsonRpcProvider(
        import.meta.env.VITE_ALCHEMY_SEPOLIA_URL
      );
      const abi = [
        "function burn(uint256 amount) external",
        "function decimals() view returns (uint8)",
      ];
      const readContract = new ethers.Contract(params.tokenAddress, abi, readProvider);
      const decimals = await readContract.decimals();
      const parsedAmount = ethers.parseUnits(params.amount, decimals);

      // Use wallet signer for the actual transaction
      const writeContract = new ethers.Contract(params.tokenAddress, abi, signer);
      const tx = await writeContract.burn(parsedAmount);
      const receipt = await tx.wait();
      return receipt.hash;
    },
    [walletClient, ethAddress, ethConnector]
  );

  // ---------- Solana (wallet-adapter) ----------
  const solana = useSolanaWallet();

  const solanaSignBurn = useCallback(
    async (params: BurnParams): Promise<string> => {
      if (!solana.publicKey || !solana.signTransaction) {
        throw new Error("Solana wallet not connected");
      }

      const { Connection, PublicKey, Transaction } = await import("@solana/web3.js");
      const splToken = await import("@solana/spl-token");

      const connection = new Connection("https://api.devnet.solana.com", "confirmed");
      const mintPubkey = new PublicKey(params.tokenAddress);
      const ownerPubkey = solana.publicKey;

      const ata = await splToken.getAssociatedTokenAddress(mintPubkey, ownerPubkey);
      const parsedAmount = Math.round(parseFloat(params.amount) * 10 ** 6);

      const burnIx = splToken.createBurnInstruction(
        ata,           // token account
        mintPubkey,    // mint
        ownerPubkey,   // owner
        parsedAmount
      );

      const tx = new Transaction().add(burnIx);
      tx.feePayer = ownerPubkey;
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;

      const signed = await solana.signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(sig, "confirmed");
      return sig;
    },
    [solana.publicKey, solana.signTransaction]
  );

  // ---------- XRPL (Crossmark / GemWallet) ----------
  const xrplWallet = useXrplWallet();

  // ---------- Stellar (Freighter) ----------
  const stellarWallet = useStellarWallet();

  // ---------- Select by chain ----------
  switch (chain) {
    case "ethereum":
      return {
        address: ethAddress ?? null,
        connected: ethConnected,
        connect: async (walletId?: string) => {
          const connector = findEthConnector(connectors, walletId ?? "metamask");
          if (!connector) throw new Error(`No Ethereum connector found for "${walletId}"`);
          await connectAsync({ connector: connector as Parameters<typeof connectAsync>[0]["connector"] });
        },
        disconnect: async () => {
          await disconnectAsync({ connector: ethConnector });
        },
        signBurn: ethSignBurn,
      };

    case "solana":
      return {
        address: solana.publicKey?.toBase58() ?? null,
        connected: solana.connected,
        connect: async (walletId?: string) => {
          if (walletId) {
            const adapter = solana.wallets.find(
              (w) => w.adapter.name.toLowerCase() === walletId
            );
            if (adapter) {
              solana.select(adapter.adapter.name);
            } else {
              throw new Error(`Solana wallet "${walletId}" not found`);
            }
          }
          // wallet-adapter auto-connects after select thanks to autoConnect
          // but force connect if not yet connected
          if (!solana.connected) {
            await solana.connect();
          }
        },
        disconnect: async () => {
          await solana.disconnect();
        },
        signBurn: solanaSignBurn,
      };

    case "xrpl":
      return xrplWallet;

    case "stellar":
      return stellarWallet;
  }
}
