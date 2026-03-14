// ============================================================
// BridgeForge – Stellar Chain Adapter
// Handles burn/mint of EURCV on Stellar (Testnet)
// ============================================================

import * as StellarSdk from "@stellar/stellar-sdk";
import { ChainAdapter, BurnProof, MintResult, RefundResult } from "../../types/index.js";
import { chainConfigs, operatorKeys } from "../../config/index.js";

const ASSET_CODE = "tEURCV";

export class StellarAdapter implements ChainAdapter {
  chain = "stellar" as const;
  private server: StellarSdk.Horizon.Server;
  private issuerPublicKey: string;
  private issuerKeypair: StellarSdk.Keypair | null = null;
  private asset: StellarSdk.Asset | null = null;

  constructor() {
    this.server = new StellarSdk.Horizon.Server(chainConfigs.stellar.rpcUrl);
    this.issuerPublicKey = chainConfigs.stellar.tokenAddress;

    const secret = operatorKeys.stellar;
    if (secret) {
      this.issuerKeypair = StellarSdk.Keypair.fromSecret(secret);
    }

    if (this.issuerPublicKey) {
      this.asset = new StellarSdk.Asset(ASSET_CODE, this.issuerPublicKey);
      console.log("[Stellar] Adapter initialized");
    } else {
      console.warn("[Stellar] Missing issuer address – adapter disabled");
    }
  }

  async executeMint(recipientAddress: string, amount: string): Promise<MintResult> {
    try {
      if (!this.issuerKeypair || !this.asset) {
        throw new Error("[Stellar] Wallet not configured");
      }

      const account = await this.server.loadAccount(this.issuerKeypair.publicKey());
      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: recipientAddress,
            asset: this.asset,
            amount: amount,
          })
        )
        .setTimeout(30)
        .build();

      transaction.sign(this.issuerKeypair);
      const result = await this.server.submitTransaction(transaction);
      const txHash = result.hash;
      console.log(`[Stellar] Mint tx confirmed: ${txHash}`);
      return { success: true, txHash };
    } catch (err) {
      console.error("[Stellar] Mint failed:", err);
      return { success: false, txHash: "" };
    }
  }

  async verifyBurn(txHash: string): Promise<BurnProof> {
    try {
      const tx = await this.server.transactions().transaction(txHash).call();

      const opsResponse = await this.server
        .operations()
        .forTransaction(txHash)
        .call();

      for (const op of opsResponse.records) {
        const p = op as unknown as Record<string, unknown>;
        if (
          p.type === "payment" &&
          p.asset_code === ASSET_CODE &&
          p.asset_issuer === this.issuerPublicKey &&
          p.to === this.issuerPublicKey
        ) {
          return {
            valid: tx.successful,
            sender: p.from as string,
            amount: p.amount as string,
            txHash,
          };
        }
      }

      return { valid: false, sender: "", amount: "0", txHash };
    } catch (error) {
      console.error("[Stellar] verifyBurn error:", error);
      return { valid: false, sender: "", amount: "0", txHash };
    }
  }

  async refund(senderAddress: string, amount: string): Promise<RefundResult> {
    return this.executeMint(senderAddress, amount);
  }

  async getBalance(address: string): Promise<string> {
    try {
      const account = await this.server.loadAccount(address);
      const balance = account.balances.find(
        (b) =>
          b.asset_type !== "native" &&
          (b as StellarSdk.Horizon.HorizonApi.BalanceLineAsset).asset_code === ASSET_CODE &&
          (b as StellarSdk.Horizon.HorizonApi.BalanceLineAsset).asset_issuer === this.issuerPublicKey
      );
      return balance ? balance.balance : "0";
    } catch {
      return "0";
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.server.loadAccount(this.issuerPublicKey);
      return true;
    } catch {
      return false;
    }
  }

  async hasTrustline(address: string): Promise<boolean> {
    try {
      const account = await this.server.loadAccount(address);
      return account.balances.some(
        (b) =>
          b.asset_type !== "native" &&
          (b as StellarSdk.Horizon.HorizonApi.BalanceLineAsset).asset_code === ASSET_CODE &&
          (b as StellarSdk.Horizon.HorizonApi.BalanceLineAsset).asset_issuer === this.issuerPublicKey
      );
    } catch {
      return false;
    }
  }
}
