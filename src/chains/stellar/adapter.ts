// ============================================================
// BridgeForge – Stellar Chain Adapter
// Handles burn/mint of testEURCV on Stellar (Testnet)
//
// Stellar uses trust lines, similar to XRPL:
// - Mint = issuer sends tokens to holder (created from nothing)
// - Burn = holder sends tokens back to issuer (destroyed)
// ============================================================

import * as StellarSdk from "@stellar/stellar-sdk";
import { ChainAdapter, BurnEvent, BurnVerification } from "../../types/index.js";
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

  async mint(recipientAddress: string, amount: string): Promise<string> {
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
    return txHash;
  }

  async verifyBurn(txHash: string): Promise<BurnVerification> {
    try {
      const tx = await this.server.transactions().transaction(txHash).call();

      // Get operations for this transaction
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
            txHash,
            sender: p.from as string,
            amount: p.amount as string,
            confirmed: tx.successful,
          };
        }
      }

      return { txHash, sender: "", amount: "0", confirmed: false };
    } catch (error) {
      console.error("[Stellar] verifyBurn error:", error);
      return { txHash, sender: "", amount: "0", confirmed: false };
    }
  }

  listenForBurns(handler: (event: BurnEvent) => void): void {
    if (!this.asset) {
      console.warn("[Stellar] Asset not configured, skipping burn listener");
      return;
    }

    this.server
      .payments()
      .forAccount(this.issuerPublicKey)
      .cursor("now")
      .stream({
        onmessage: (payment) => {
          const p = payment as unknown as Record<string, unknown>;
          if (
            p.type === "payment" &&
            p.asset_code === ASSET_CODE &&
            p.to === this.issuerPublicKey &&
            p.from !== this.issuerPublicKey
          ) {
            handler({
              chain: "stellar",
              txHash: (p.transaction_hash as string) ?? "",
              sender: p.from as string,
              amount: p.amount as string,
              timestamp: Date.now(),
            });
          }
        },
        onerror: (error: unknown) => {
          console.error("[Stellar] Stream error:", error);
        },
      });

    console.log("[Stellar] Listening for burn events...");
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

  isValidAddress(address: string): boolean {
    return /^G[A-Z2-7]{55}$/.test(address);
  }
}
