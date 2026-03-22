// ============================================================
// BridgeForge – XRP Ledger Chain Adapter
// Handles burn/mint of EURCV on XRPL (Testnet)
// ============================================================

import xrpl from "xrpl";
import { ChainAdapter, BurnProof, MintResult, RefundResult, TokenContext } from "../../types/index.js";
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

  async executeMint(recipientAddress: string, amount: string, tokenCtx?: TokenContext): Promise<MintResult> {
    try {
      await this.ensureConnected();

      const issuer = tokenCtx?.tokenAddress || this.issuerAddress;
      const currency = tokenCtx?.currencyCode || CURRENCY_CODE;

      let wallet = this.issuerWallet;
      if (tokenCtx?.operatorKey) {
        wallet = xrpl.Wallet.fromSeed(tokenCtx.operatorKey);
      }
      if (!wallet) throw new Error("XRPL wallet not configured");

      const payment: xrpl.Payment = {
        TransactionType: "Payment",
        Account: issuer,
        Destination: recipientAddress,
        Amount: {
          currency,
          issuer,
          value: amount,
        },
      };

      const result = await this.client.submitAndWait(payment, { wallet });

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
      const txAmount = (txJson as any).DeliverMax ?? (txJson as any).Amount;

      if (
        txJson.TransactionType === "Payment" &&
        txJson.Destination === this.issuerAddress &&
        typeof txAmount === "object" &&
        txAmount !== null
      ) {
        const amount = txAmount as { currency: string; value: string };
        const meta = response.result.meta as { TransactionResult?: string } | undefined;
        const confirmed = meta?.TransactionResult === "tesSUCCESS";
        return {
          valid: confirmed,
          sender: txJson.Account,
          amount: amount.value,
          txHash,
        };
      }

      return { valid: false, sender: "", amount: "0", txHash };
    } catch (error) {
      console.error("[XRPL] verifyBurn error:", error);
      return { valid: false, sender: "", amount: "0", txHash };
    }
  }

  async refund(senderAddress: string, amount: string, tokenCtx?: TokenContext): Promise<RefundResult> {
    return this.executeMint(senderAddress, amount, tokenCtx);
  }

  async getBalance(address: string, tokenCtx?: TokenContext): Promise<string> {
    await this.ensureConnected();

    const issuer = tokenCtx?.tokenAddress || this.issuerAddress;
    const currency = tokenCtx?.currencyCode || CURRENCY_CODE;

    const response = await this.client.request({
      command: "account_lines",
      account: address,
    });

    const line = response.result.lines.find(
      (l) => l.currency === currency && l.account === issuer
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

  async hasTrustline(address: string, tokenCtx?: TokenContext): Promise<boolean> {
    try {
      await this.ensureConnected();
      const issuer = tokenCtx?.tokenAddress || this.issuerAddress;
      const currency = tokenCtx?.currencyCode || CURRENCY_CODE;
      const response = await this.client.request({
        command: "account_lines",
        account: address,
      });
      return response.result.lines.some(
        (l) => l.currency === currency && l.account === issuer
      );
    } catch {
      return false;
    }
  }
}
