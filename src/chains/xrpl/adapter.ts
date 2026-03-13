// ============================================================
// BridgeForge – XRP Ledger Chain Adapter
// Handles burn/mint of EURCV on XRPL (Testnet)
// ============================================================

import xrpl from "xrpl";
import { ChainAdapter, BurnProof, MintResult, RefundResult } from "../../types/index.js";
import { chainConfigs, operatorKeys } from "../../config/index.js";

// XRPL: currency codes > 3 chars must be 40-char hex (ASCII of "tEURCV" padded with zeros)
const CURRENCY_CODE = "7445555243560000000000000000000000000000";

export class XrplAdapter implements ChainAdapter {
  chain = "xrpl" as const;
  private client: xrpl.Client;
  private issuerAddress: string;
  private issuerWallet: xrpl.Wallet | null = null;

  constructor() {
    this.client = new xrpl.Client(chainConfigs.xrpl.rpcUrl);
    this.issuerAddress = chainConfigs.xrpl.tokenAddress;

    if (!this.issuerAddress) {
      console.warn("[XRPL] Missing issuer address – adapter disabled");
    } else {
      console.log("[XRPL] Adapter initialized");
    }
  }

  private async ensureConnected(): Promise<void> {
    if (!this.client.isConnected()) {
      await this.client.connect();

      const seed = operatorKeys.xrpl;
      if (seed) {
        this.issuerWallet = xrpl.Wallet.fromSeed(seed);
      }
    }
  }

  async executeMint(recipientAddress: string, amount: string): Promise<MintResult> {
    try {
      await this.ensureConnected();
      if (!this.issuerWallet) throw new Error("XRPL wallet not configured");

      const payment: xrpl.Payment = {
        TransactionType: "Payment",
        Account: this.issuerAddress,
        Destination: recipientAddress,
        Amount: {
          currency: CURRENCY_CODE,
          issuer: this.issuerAddress,
          value: amount,
        },
      };

      const result = await this.client.submitAndWait(payment, {
        wallet: this.issuerWallet,
      });

      const txHash = result.result.hash;
      console.log(`[XRPL] Mint tx confirmed: ${txHash}`);
      return { success: true, txHash };
    } catch (err) {
      console.error("[XRPL] Mint failed:", err);
      return { success: false, txHash: "" };
    }
  }

  async verifyBurn(txHash: string): Promise<BurnProof> {
    await this.ensureConnected();

    try {
      const response = await this.client.request({
        command: "tx",
        transaction: txHash,
      });

      const txJson = response.result.tx_json;

      if (
        txJson.TransactionType === "Payment" &&
        txJson.Destination === this.issuerAddress &&
        typeof txJson.Amount === "object" &&
        txJson.Amount !== null
      ) {
        const amount = txJson.Amount as { currency: string; value: string };
        if (amount.currency === CURRENCY_CODE) {
          const meta = response.result.meta as { TransactionResult?: string } | undefined;
          const confirmed = meta?.TransactionResult === "tesSUCCESS";
          return {
            valid: confirmed,
            sender: txJson.Account,
            amount: amount.value,
            txHash,
          };
        }
      }

      return { valid: false, sender: "", amount: "0", txHash };
    } catch (error) {
      console.error("[XRPL] verifyBurn error:", error);
      return { valid: false, sender: "", amount: "0", txHash };
    }
  }

  async refund(senderAddress: string, amount: string): Promise<RefundResult> {
    // Refund = issuer sends tokens back to original sender
    return this.executeMint(senderAddress, amount);
  }

  async getBalance(address: string): Promise<string> {
    await this.ensureConnected();

    const response = await this.client.request({
      command: "account_lines",
      account: address,
    });

    const line = response.result.lines.find(
      (l) => l.currency === CURRENCY_CODE && l.account === this.issuerAddress
    );

    return line?.balance ?? "0";
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.ensureConnected();
      await this.client.request({ command: "server_info" });
      return true;
    } catch {
      return false;
    }
  }

  async hasTrustline(address: string): Promise<boolean> {
    try {
      await this.ensureConnected();
      const response = await this.client.request({
        command: "account_lines",
        account: address,
      });
      return response.result.lines.some(
        (l) => l.currency === CURRENCY_CODE && l.account === this.issuerAddress
      );
    } catch {
      return false;
    }
  }
}
