// ============================================================
// BridgeForge – Setup tUSDCV on Stellar Testnet
// Usage: npx tsx scripts/setup-stellar-usdcv.ts
//
// Reuses the existing tEURCV issuer to issue tUSDCV.
// Requires STELLAR_ISSUER_ADDRESS and STELLAR_PRIVATE_KEY in .env.
// ============================================================

import "dotenv/config";
import * as StellarSdk from "@stellar/stellar-sdk";

const ASSET_CODE = "tUSDCV";

async function main() {
  const server = new StellarSdk.Horizon.Server(
    "https://horizon-testnet.stellar.org"
  );

  // Load existing issuer
  const issuerSecret = process.env.STELLAR_PRIVATE_KEY;
  const issuerPublic = process.env.STELLAR_ISSUER_ADDRESS;
  if (!issuerSecret || !issuerPublic) {
    console.error("STELLAR_PRIVATE_KEY and STELLAR_ISSUER_ADDRESS must be set in .env");
    process.exit(1);
  }

  const issuerKeypair = StellarSdk.Keypair.fromSecret(issuerSecret);
  console.log("Reusing issuer:", issuerKeypair.publicKey());

  // Create holder/operator keypair
  console.log("\nCreating holder keypair...");
  const holderKeypair = StellarSdk.Keypair.random();
  console.log("Holder public key:", holderKeypair.publicKey());

  // Fund holder via Friendbot
  const response = await fetch(
    `https://friendbot.stellar.org?addr=${encodeURIComponent(holderKeypair.publicKey())}`
  );
  if (!response.ok) {
    throw new Error(`Friendbot failed: ${response.statusText}`);
  }
  console.log("  Funded via Friendbot");

  // Create trust line from holder to issuer for tUSDCV
  console.log("\nCreating trust line for tUSDCV...");
  const asset = new StellarSdk.Asset(ASSET_CODE, issuerKeypair.publicKey());

  const holderAccount = await server.loadAccount(holderKeypair.publicKey());
  const trustTx = new StellarSdk.TransactionBuilder(holderAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET,
  })
    .addOperation(
      StellarSdk.Operation.changeTrust({
        asset: asset,
        limit: "1000000000",
      })
    )
    .setTimeout(30)
    .build();

  trustTx.sign(holderKeypair);
  await server.submitTransaction(trustTx);

  // Mint 10,000 tUSDCV to holder
  console.log("\nMinting 10,000 tUSDCV to holder...");
  const issuerAccount = await server.loadAccount(issuerKeypair.publicKey());
  const mintTx = new StellarSdk.TransactionBuilder(issuerAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: holderKeypair.publicKey(),
        asset: asset,
        amount: "10000",
      })
    )
    .setTimeout(30)
    .build();

  mintTx.sign(issuerKeypair);
  await server.submitTransaction(mintTx);

  // Verify balance
  const holderAccountInfo = await server.loadAccount(holderKeypair.publicKey());
  const usdcvBalance = holderAccountInfo.balances.find(
    (b) =>
      b.asset_type !== "native" &&
      (b as StellarSdk.Horizon.HorizonApi.BalanceLineAsset).asset_code === ASSET_CODE &&
      (b as StellarSdk.Horizon.HorizonApi.BalanceLineAsset).asset_issuer === issuerKeypair.publicKey()
  );
  console.log("\nHolder tUSDCV balance:", usdcvBalance?.balance);

  console.log("\n========================================");
  console.log("Add this to your .env:");
  console.log(`STELLAR_USDCV_ISSUER_ADDRESS=${issuerKeypair.publicKey()}`);
  console.log("(Same issuer as tEURCV — no new private key needed)");
  console.log("========================================");
}

main().catch(console.error);
