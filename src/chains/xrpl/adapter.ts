// ============================================================
// BridgeForge – XRP Ledger Chain Adapter
// Handles burn/mint of testEURCV on XRPL (Testnet)
//
// XRPL uses trust lines, not smart contracts:
// - Mint = issuer sends tokens to holder (created from nothing)
// - Burn = holder sends tokens back to issuer (destroyed)
// ============================================================

import xrpl from "xrpl";
import { ChainAdapter, BurnEvent, BurnVerification } from "../../types/index.js";
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

  async mint(recipientAddress: string, amount: string): Promise<string> {
    await this.ensureConnected();
    if (!this.issuerWallet) throw new Error("XRPL wallet not configured");

    // On XRPL, mint = issuer sends tokens to recipient (created from nothing)
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
    return txHash;
  }

  async verifyBurn(txHash: string): Promise<BurnVerification> {
    await this.ensureConnected();

    try {
      const response = await this.client.request({
        command: "tx",
        transaction: txHash,
      });

      const txJson = response.result.tx_json;

      // Check it's a Payment to the issuer with the right currency
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
            txHash,
            sender: txJson.Account,
            amount: amount.value,
            confirmed,
          };
        }
      }

      return { txHash, sender: "", amount: "0", confirmed: false };
    } catch (error) {
      console.error("[XRPL] verifyBurn error:", error);
      return { txHash, sender: "", amount: "0", confirmed: false };
    }
  }

  listenForBurns(handler: (event: BurnEvent) => void): void {
    this.ensureConnected().then(() => {
      this.client.request({
        command: "subscribe",
        accounts: [this.issuerAddress],
      });

      this.client.on("transaction", (tx: Record<string, unknown>) => {
        const transaction = tx.transaction as Record<string, unknown> | undefined;

        // Filter: only incoming payments with tEURCV
        if (
          transaction?.TransactionType === "Payment" &&
          transaction.Destination === this.issuerAddress &&
          typeof transaction.Amount === "object" &&
          transaction.Amount !== null
        ) {
          const amount = transaction.Amount as { currency: string; value: string };
          if (amount.currency === CURRENCY_CODE) {
            handler({
              chain: "xrpl",
              txHash: (transaction.hash as string) ?? "",
              sender: transaction.Account as string,
              amount: amount.value,
              timestamp: Date.now(),
            });
          }
        }
      });

      console.log("[XRPL] Listening for burn events...");
    });
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

  isValidAddress(address: string): boolean {
    return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address);
  }
}
