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

    if (!this.issuerAddress) {
      console.warn("[XRPL] Missing issuer address – adapter disabled");
    } else {
      console.log("[XRPL] Adapter initialized");
    }
  }

  private async ensureConnected(): Promise<void> {
    if (!this.client.isConnected()) {
      this.connected = false;
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
    if (!this.issuerWallet) throw new Error("XRPL wallet not configured");

    // On XRPL, burn = send tokens BACK to the issuer.
    // The sender must sign their own tx. For the POC, we derive a wallet
    // from the XRPL_SENDER_KEY env var, or fall back to the issuer wallet
    // if the sender IS the issuer.
    let senderWallet: xrpl.Wallet;
    if (senderAddress === this.issuerWallet.classicAddress) {
      senderWallet = this.issuerWallet;
    } else {
      const senderKey = process.env.XRPL_SENDER_KEY;
      if (senderKey) {
        senderWallet = xrpl.Wallet.fromSeed(senderKey);
      } else {
        throw new Error(`[XRPL] No private key available for sender ${senderAddress}. Set XRPL_SENDER_KEY in .env`);
      }
    }

    console.log(`[XRPL] Burn: sender=${senderAddress}, signer=${senderWallet.classicAddress}, amount=${amount}`);

    const payment: xrpl.Payment = {
      TransactionType: "Payment",
      Account: senderWallet.classicAddress,
      Destination: this.issuerAddress,
      Amount: {
        currency: CURRENCY_CODE,
        issuer: this.issuerAddress,
        value: amount,
      },
    };

    const prepared = await this.client.autofill(payment);
    const signed = senderWallet.sign(prepared);
    const result = await this.client.submitAndWait(signed.tx_blob);

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
