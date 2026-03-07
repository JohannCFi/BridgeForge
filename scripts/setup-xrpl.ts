// ============================================================
// BridgeForge – Setup testEURCV on XRPL Testnet
// Usage: npx tsx scripts/setup-xrpl.ts
//
// This script:
// 1. Creates an issuer wallet on XRPL testnet (funded via faucet)
// 2. Creates a holder wallet (the bridge operator)
// 3. Sets up a trust line from holder to issuer for testEURCV
// 4. Mints (sends) testEURCV from issuer to holder
// ============================================================

import xrpl from "xrpl";

async function main() {
  // Connect to XRPL Testnet
  const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233");
  await client.connect();
  console.log("Connected to XRPL Testnet\n");

  // 1. Create issuer wallet via faucet (free testnet XRP)
  console.log("Creating issuer wallet...");
  const issuerFund = await client.fundWallet();
  const issuerWallet = issuerFund.wallet;
  console.log("Issuer address:", issuerWallet.address);
  console.log("Issuer seed:", issuerWallet.seed);

  // 2. Create bridge operator wallet via faucet
  console.log("\nCreating bridge operator wallet...");
  const operatorFund = await client.fundWallet();
  const operatorWallet = operatorFund.wallet;
  console.log("Operator address:", operatorWallet.address);
  console.log("Operator seed:", operatorWallet.seed);

  // 3. Configure issuer account settings
  // DefaultRipple: allows tokens to be transferred between holders
  console.log("\nConfiguring issuer account...");
  const issuerSettings: xrpl.AccountSet = {
    TransactionType: "AccountSet",
    Account: issuerWallet.address,
    SetFlag: xrpl.AccountSetAsfFlags.asfDefaultRipple,
  };
  const settingsResult = await client.submitAndWait(issuerSettings, {
    wallet: issuerWallet,
  });
  console.log("Issuer configured:", settingsResult.result.meta?.TransactionResult);

  // 4. Create trust line from operator to issuer
  // This is like "approving" a token – the operator says
  // "I trust this issuer for up to 1 billion testEURCV"
  console.log("\nCreating trust line...");
  const trustLine: xrpl.TrustSet = {
    TransactionType: "TrustSet",
    Account: operatorWallet.address,
    LimitAmount: {
      currency: "7445555243560000000000000000000000000000",          // 3-char currency codes on XRPL (or hex for longer)
      issuer: issuerWallet.address,
      value: "1000000000",         // Max 1 billion
    },
  };
  const trustResult = await client.submitAndWait(trustLine, {
    wallet: operatorWallet,
  });
  console.log("Trust line created:", trustResult.result.meta?.TransactionResult);

  // 5. Mint: issuer sends testEURCV to operator
  // On XRPL, "minting" = the issuer sends tokens (created from nothing)
  console.log("\nMinting 10,000 testEURCV to operator...");
  const payment: xrpl.Payment = {
    TransactionType: "Payment",
    Account: issuerWallet.address,
    Destination: operatorWallet.address,
    Amount: {
      currency: "7445555243560000000000000000000000000000",
      issuer: issuerWallet.address,
      value: "10000",
    },
  };
  const paymentResult = await client.submitAndWait(payment, {
    wallet: issuerWallet,
  });
  console.log("Mint result:", paymentResult.result.meta?.TransactionResult);

  // 6. Verify balance
  const balances = await client.request({
    command: "account_lines",
    account: operatorWallet.address,
  });
  const testEurcvBalance = balances.result.lines.find(
    (line) => line.currency === "7445555243560000000000000000000000000000"
  );
  console.log("\nOperator testEURCV balance:", testEurcvBalance?.balance);

  // 7. Print config for .env
  console.log("\n========================================");
  console.log("Add these to your .env:");
  console.log(`XRPL_ISSUER_ADDRESS=${issuerWallet.address}`);
  console.log(`XRPL_ISSUER_SEED=${issuerWallet.seed}`);
  console.log(`XRPL_OPERATOR_ADDRESS=${operatorWallet.address}`);
  console.log(`XRPL_OPERATOR_SEED=${operatorWallet.seed}`);
  console.log("========================================");

  await client.disconnect();
}

main().catch(console.error);
