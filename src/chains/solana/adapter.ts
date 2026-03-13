// ============================================================
// BridgeForge – Solana Chain Adapter
// Handles burn/mint of EURCV on Solana (Devnet)
// ============================================================

import {
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import {
  mintTo,
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddress,
  getAccount,
} from "@solana/spl-token";
import { ChainAdapter, BurnProof, MintResult, RefundResult } from "../../types/index.js";
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

  async executeMint(recipientAddress: string, amount: string): Promise<MintResult> {
    try {
      if (!this.operatorKeypair || !this.mintAddress) {
        throw new Error("[Solana] Wallet or mint not configured");
      }

      const recipient = new PublicKey(recipientAddress);
      const ata = await getOrCreateAssociatedTokenAccount(
        this.connection,
        this.operatorKeypair,
        this.mintAddress,
        recipient
      );

      const parsedAmount = Math.round(parseFloat(amount) * 10 ** 6);
      const txSig = await mintTo(
        this.connection,
        this.operatorKeypair,
        this.mintAddress,
        ata.address,
        this.operatorKeypair,
        parsedAmount
      );

      console.log(`[Solana] Mint tx confirmed: ${txSig}`);
      return { success: true, txHash: txSig };
    } catch (err) {
      console.error("[Solana] Mint failed:", err);
      return { success: false, txHash: "" };
    }
  }

  async verifyBurn(txHash: string): Promise<BurnProof> {
    const tx = await this.connection.getParsedTransaction(txHash, {
      maxSupportedTransactionVersion: 0,
    });

    if (!tx || !tx.meta || tx.meta.err) {
      return { valid: false, sender: "", amount: "0", txHash };
    }

    // Look for SPL Token burn instruction
    for (const ix of tx.transaction.message.instructions) {
      const parsed = ix as { program?: string; parsed?: { type?: string; info?: { amount?: string; authority?: string } } };
      if (
        parsed.program === "spl-token" &&
        parsed.parsed?.type === "burn" &&
        parsed.parsed.info
      ) {
        const amount = (Number(parsed.parsed.info.amount) / 10 ** 6).toString();
        return {
          valid: true,
          sender: parsed.parsed.info.authority ?? "",
          amount,
          txHash,
        };
      }
    }

    // Check inner instructions
    if (tx.meta.innerInstructions) {
      for (const inner of tx.meta.innerInstructions) {
        for (const ix of inner.instructions) {
          const parsed = ix as { program?: string; parsed?: { type?: string; info?: { amount?: string; authority?: string } } };
          if (
            parsed.program === "spl-token" &&
            parsed.parsed?.type === "burn" &&
            parsed.parsed.info
          ) {
            const amount = (Number(parsed.parsed.info.amount) / 10 ** 6).toString();
            return {
              valid: true,
              sender: parsed.parsed.info.authority ?? "",
              amount,
              txHash,
            };
          }
        }
      }
    }

    return { valid: false, sender: "", amount: "0", txHash };
  }

  async refund(senderAddress: string, amount: string): Promise<RefundResult> {
    return this.executeMint(senderAddress, amount);
  }

  async getBalance(address: string): Promise<string> {
    if (!this.mintAddress) throw new Error("[Solana] Mint not configured");

    const owner = new PublicKey(address);
    const ata = await getAssociatedTokenAddress(this.mintAddress, owner);

    try {
      const account = await getAccount(this.connection, ata);
      return (Number(account.amount) / 10 ** 6).toString();
    } catch {
      return "0";
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.connection.getSlot();
      return true;
    } catch {
      return false;
    }
  }
}
