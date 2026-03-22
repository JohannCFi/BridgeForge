// ============================================================
// BridgeForge – Stellar Chain Adapter
// Handles burn/mint of EURCV on Stellar (Testnet)
// ============================================================

import * as StellarSdk from "@stellar/stellar-sdk";
import { ChainAdapter, BurnProof, MintResult, RefundResult, TokenContext } from "../../types/index.js";
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

  async executeMint(recipientAddress: string, amount: string, tokenCtx?: TokenContext): Promise<MintResult> {
    try {
      let keypair = this.issuerKeypair;
      let asset = this.asset;

      if (tokenCtx?.tokenAddress) {
        // Use token-specific asset (handles same-issuer multi-token case)
        asset = new StellarSdk.Asset(
          tokenCtx.assetCode || ASSET_CODE,
          tokenCtx.tokenAddress
        );
        // Load operator key override if provided
        if (tokenCtx.operatorKey) {
          keypair = StellarSdk.Keypair.fromSecret(tokenCtx.operatorKey);
        }
      }

      if (!keypair || !asset) {
        throw new Error("[Stellar] Wallet not configured");
      }

      const account = await this.server.loadAccount(keypair.publicKey());
      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: recipientAddress,
            asset,
            amount,
          })
        )
        .setTimeout(30)
        .build();

      transaction.sign(keypair);
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

  async refund(senderAddress: string, amount: string, tokenCtx?: TokenContext): Promise<RefundResult> {
    return this.executeMint(senderAddress, amount, tokenCtx);
  }

  async getBalance(address: string, tokenCtx?: TokenContext): Promise<string> {
    try {
      const issuer = tokenCtx?.tokenAddress || this.issuerPublicKey;
      const code = tokenCtx?.assetCode || ASSET_CODE;
      const account = await this.server.loadAccount(address);
      const balance = account.balances.find(
        (b) =>
          b.asset_type !== "native" &&
          (b as StellarSdk.Horizon.HorizonApi.BalanceLineAsset).asset_code === code &&
          (b as StellarSdk.Horizon.HorizonApi.BalanceLineAsset).asset_issuer === issuer
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

  async hasTrustline(address: string, tokenCtx?: TokenContext): Promise<boolean> {
    try {
      const issuer = tokenCtx?.tokenAddress || this.issuerPublicKey;
      const code = tokenCtx?.assetCode || ASSET_CODE;
      const account = await this.server.loadAccount(address);
      return account.balances.some(
        (b) =>
          b.asset_type !== "native" &&
          (b as StellarSdk.Horizon.HorizonApi.BalanceLineAsset).asset_code === code &&
          (b as StellarSdk.Horizon.HorizonApi.BalanceLineAsset).asset_issuer === issuer
      );
    } catch {
      return false;
    }
  }
}
