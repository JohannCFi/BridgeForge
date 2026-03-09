// ============================================================
// BridgeForge – Solana Chain Adapter
// Handles burn/mint of testEURCV on Solana (Devnet)
//
// Solana uses SPL tokens:
// - Mint authority (operator) can mint new tokens
// - Anyone can burn their own tokens
// - Each holder needs an Associated Token Account (ATA)
// ============================================================

import {
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import {
  burn,
  mintTo,
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddress,
  getAccount,
} from "@solana/spl-token";
import { ChainAdapter, BurnEvent } from "../../types/index.js";
import { chainConfigs, operatorKeys } from "../../config/index.js";

export class SolanaAdapter implements ChainAdapter {
  chain = "solana" as const;
  private connection: Connection;
  private operatorKeypair: Keypair | null = null;
  private mintAddress: PublicKey | null = null;

  constructor() {
    this.connection = new Connection(chainConfigs.solana.rpcUrl, "confirmed");

    const keyStr = operatorKeys.solana;
    if (keyStr) {
      const secretKey = Uint8Array.from(JSON.parse(keyStr));
      this.operatorKeypair = Keypair.fromSecretKey(secretKey);
    }

    const tokenAddr = chainConfigs.solana.tokenAddress;
    if (tokenAddr) {
      this.mintAddress = new PublicKey(tokenAddr);
    }

    console.log("[Solana] Adapter initialized");
  }

  async burn(senderAddress: string, amount: string): Promise<string> {
    if (!this.operatorKeypair || !this.mintAddress) {
      throw new Error("[Solana] Wallet or mint not configured");
    }

    const owner = new PublicKey(senderAddress);
    const ata = await getAssociatedTokenAddress(this.mintAddress, owner);

    const parsedAmount = Math.round(parseFloat(amount) * 10 ** 6);

    const txSig = await burn(
      this.connection,
      this.operatorKeypair, // payer
      ata, // token account to burn from
      this.mintAddress, // token mint
      this.operatorKeypair, // owner of the token account (POC: operator)
      parsedAmount
    );

    console.log(`[Solana] Burn tx confirmed: ${txSig}`);
    return txSig;
  }

  async mint(recipientAddress: string, amount: string): Promise<string> {
    if (!this.operatorKeypair || !this.mintAddress) {
      throw new Error("[Solana] Wallet or mint not configured");
    }

    const recipient = new PublicKey(recipientAddress);

    // Create ATA for recipient if it doesn't exist
    const ata = await getOrCreateAssociatedTokenAccount(
      this.connection,
      this.operatorKeypair, // payer
      this.mintAddress, // token mint
      recipient // owner
    );

    const parsedAmount = Math.round(parseFloat(amount) * 10 ** 6);

    const txSig = await mintTo(
      this.connection,
      this.operatorKeypair, // payer
      this.mintAddress, // token mint
      ata.address, // destination
      this.operatorKeypair, // mint authority
      parsedAmount
    );

    console.log(`[Solana] Mint tx confirmed: ${txSig}`);
    return txSig;
  }

  listenForBurns(handler: (event: BurnEvent) => void): void {
    if (!this.mintAddress) {
      console.log("[Solana] Mint not configured, skipping burn listener");
      return;
    }

    // Listen for logs mentioning the token mint (burn events)
    this.connection.onLogs(
      this.mintAddress,
      (logs) => {
        // SPL Token burn instruction contains "Burn" in the logs
        if (logs.logs.some((log) => log.includes("Burn"))) {
          handler({
            chain: "solana",
            txHash: logs.signature,
            sender: "", // Would need to parse the tx for the actual sender
            amount: "0", // Would need to parse the tx for the actual amount
            timestamp: Date.now(),
          });
        }
      },
      "confirmed"
    );

    console.log("[Solana] Listening for burn events...");
  }

  async getBalance(address: string): Promise<string> {
    if (!this.mintAddress) throw new Error("[Solana] Mint not configured");

    const owner = new PublicKey(address);
    const ata = await getAssociatedTokenAddress(this.mintAddress, owner);

    try {
      const account = await getAccount(this.connection, ata);
      return (Number(account.amount) / 10 ** 6).toString();
    } catch {
      return "0"; // ATA doesn't exist = no balance
    }
  }

  isValidAddress(address: string): boolean {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  }
}
