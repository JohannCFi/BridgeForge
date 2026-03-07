// ============================================================
// BridgeForge – XRP Ledger Chain Adapter
// Handles burn/mint of testEURCV on XRPL (Testnet)
//
// XRPL uses trust lines, not smart contracts:
// - Mint = issuer sends tokens to holder (created from nothing)
// - Burn = holder sends tokens back to issuer (destroyed)
// ============================================================

import xrpl from "xrpl";
import { ChainAdapter, BurnEvent } from "../../types/index.js";
import { chainConfigs, operatorKeys } from "../../config/index.js";

// XRPL: currency codes > 3 chars must be 40-char hex (ASCII of "tEURCV" padded with zeros)
const CURRENCY_CODE = "7445555243560000000000000000000000000000";

export class XrplAdapter implements ChainAdapter {
  chain = "xrpl" as const;
  private client: xrpl.Client;
  private issuerAddress: string;
  private issuerWallet: xrpl.Wallet | null = null;
  private connected = false;

  constructor() {
    this.client = new xrpl.Client(chainConfigs.xrpl.rpcUrl);
    this.issuerAddress = chainConfigs.xrpl.tokenAddress;
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.client.connect();
      this.connected = true;

      const seed = operatorKeys.xrpl;
      if (seed) {
        this.issuerWallet = xrpl.Wallet.fromSeed(seed);
      }
    }
  }

  async burn(senderAddress: string, amount: string): Promise<string> {
    await this.ensureConnected();

    // On XRPL, burn = send tokens BACK to the issuer
    const payment: xrpl.Payment = {
      TransactionType: "Payment",
      Account: senderAddress,
      Destination: this.issuerAddress,
      Amount: {
        currency: CURRENCY_CODE,
        issuer: this.issuerAddress,
        value: amount,
      },
    };

    if (!this.issuerWallet) throw new Error("XRPL wallet not configured");
    const result = await this.client.submitAndWait(payment, {
      wallet: this.issuerWallet,
    });

    const txHash = result.result.hash;
    console.log(`[XRPL] Burn tx confirmed: ${txHash}`);
    return txHash;
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

  listenForBurns(handler: (event: BurnEvent) => void): void {
    this.ensureConnected().then(() => {
      this.client.request({
        command: "subscribe",
        accounts: [this.issuerAddress],
      });

      this.client.on("transaction", (tx) => {
        const transaction = tx.transaction;

        // Filter: only incoming payments with tEURCV
        if (
          transaction?.TransactionType === "Payment" &&
          transaction.Destination === this.issuerAddress &&
          typeof transaction.Amount === "object" &&
          transaction.Amount.currency === CURRENCY_CODE
        ) {
          handler({
            chain: "xrpl",
            txHash: transaction.hash ?? "",
            sender: transaction.Account,
            amount: transaction.Amount.value,
            timestamp: Date.now(),
          });
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
