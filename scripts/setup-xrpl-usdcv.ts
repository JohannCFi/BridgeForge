// ============================================================
// BridgeForge – Setup tUSDCV on XRPL Testnet
// Usage: npx tsx scripts/setup-xrpl-usdcv.ts
//
// Reuses the existing tEURCV issuer to issue tUSDCV.
// Requires XRPL_ISSUER_ADDRESS and XRPL_PRIVATE_KEY in .env.
// ============================================================

import "dotenv/config";
import xrpl from "xrpl";

// tUSDCV currency code: ASCII hex of "tUSDCV" padded to 40 chars
const CURRENCY_CODE = "7455534443560000000000000000000000000000";

async function main() {
  const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233");
  await client.connect();
  console.log("Connected to XRPL Testnet\n");

  // Load existing issuer
  const issuerSeed = process.env.XRPL_PRIVATE_KEY;
  const issuerAddress = process.env.XRPL_ISSUER_ADDRESS;
  if (!issuerSeed || !issuerAddress) {
    console.error("XRPL_PRIVATE_KEY and XRPL_ISSUER_ADDRESS must be set in .env");
    process.exit(1);
  }

  const issuerWallet = xrpl.Wallet.fromSeed(issuerSeed);
  console.log("Reusing issuer:", issuerWallet.address);

  // Create a temporary operator wallet to hold tUSDCV
  console.log("\nCreating operator wallet for tUSDCV...");
  const operatorFund = await client.fundWallet();
  const operatorWallet = operatorFund.wallet;
  console.log("Operator address:", operatorWallet.address);

  // Create trust line from operator to issuer for tUSDCV
  console.log("\nCreating trust line for tUSDCV...");
  const trustLine: xrpl.TrustSet = {
    TransactionType: "TrustSet",
    Account: operatorWallet.address,
    LimitAmount: {
      currency: CURRENCY_CODE,
      issuer: issuerWallet.address,
      value: "1000000000",
    },
  };
  await client.submitAndWait(trustLine, { wallet: operatorWallet });

  // Mint 10,000 tUSDCV to operator
  console.log("\nMinting 10,000 tUSDCV to operator...");
  const payment: xrpl.Payment = {
    TransactionType: "Payment",
    Account: issuerWallet.address,
    Destination: operatorWallet.address,
    Amount: {
      currency: CURRENCY_CODE,
      issuer: issuerWallet.address,
      value: "10000",
    },
  };
  await client.submitAndWait(payment, { wallet: issuerWallet });

  // Verify balance
  const balances = await client.request({
    command: "account_lines",
    account: operatorWallet.address,
  });
  const usdcvBalance = balances.result.lines.find(
    (line) => line.currency === CURRENCY_CODE
  );
  console.log("\nOperator tUSDCV balance:", usdcvBalance?.balance);

  console.log("\n========================================");
  console.log("Add this to your .env:");
  console.log(`XRPL_USDCV_ISSUER_ADDRESS=${issuerWallet.address}`);
  console.log("(Same issuer as tEURCV — no new private key needed)");
  console.log("========================================");

  await client.disconnect();
}

main().catch(console.error);
