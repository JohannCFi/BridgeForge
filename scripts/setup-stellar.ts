// ============================================================
// BridgeForge – Setup testEURCV (tEURCV) on Stellar Testnet
// Usage: npx tsx scripts/setup-stellar.ts
//
// This script:
// 1. Creates an issuer keypair on Stellar testnet (funded via Friendbot)
// 2. Creates a holder keypair (the bridge operator)
// 3. Sets up a trust line from holder to issuer for tEURCV
// 4. Mints (sends) tEURCV from issuer to holder
// ============================================================

import * as StellarSdk from "@stellar/stellar-sdk";

const ASSET_CODE = "tEURCV";

async function fundAccount(publicKey: string): Promise<void> {
  const response = await fetch(
    `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`
  );
  if (!response.ok) {
    throw new Error(`Friendbot failed: ${response.statusText}`);
  }
  console.log(`  Funded via Friendbot`);
}

async function main() {
  const server = new StellarSdk.Horizon.Server(
    "https://horizon-testnet.stellar.org"
  );

  // 1. Create issuer keypair
  console.log("Creating issuer keypair...");
  const issuerKeypair = StellarSdk.Keypair.random();
  console.log("Issuer public key:", issuerKeypair.publicKey());
  console.log("Issuer secret key:", issuerKeypair.secret());
  await fundAccount(issuerKeypair.publicKey());

  // 2. Create holder/operator keypair
  console.log("\nCreating holder keypair...");
  const holderKeypair = StellarSdk.Keypair.random();
  console.log("Holder public key:", holderKeypair.publicKey());
  console.log("Holder secret key:", holderKeypair.secret());
  await fundAccount(holderKeypair.publicKey());

  // 3. Create trust line from holder to issuer for tEURCV
  // The holder says: "I trust this issuer for tEURCV up to max supply"
  console.log("\nCreating trust line...");
  const asset = new StellarSdk.Asset(ASSET_CODE, issuerKeypair.publicKey());

  const holderAccount = await server.loadAccount(holderKeypair.publicKey());
  const trustTx = new StellarSdk.TransactionBuilder(holderAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET,
  })
    .addOperation(
      StellarSdk.Operation.changeTrust({
        asset: asset,
        limit: "1000000000", // Max 1 billion
      })
    )
    .setTimeout(30)
    .build();

  trustTx.sign(holderKeypair);
  const trustResult = await server.submitTransaction(trustTx);
  console.log("Trust line created:", trustResult.hash);

  // 4. Mint: issuer sends tEURCV to holder (tokens created from nothing)
  console.log("\nMinting 10,000 tEURCV to holder...");
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
  const mintResult = await server.submitTransaction(mintTx);
  console.log("Mint tx:", mintResult.hash);

  // 5. Verify balance
  const holderAccountInfo = await server.loadAccount(holderKeypair.publicKey());
  const teurcvBalance = holderAccountInfo.balances.find(
    (b) =>
      b.asset_type !== "native" &&
      (b as StellarSdk.Horizon.HorizonApi.BalanceLineAsset).asset_code ===
        ASSET_CODE &&
      (b as StellarSdk.Horizon.HorizonApi.BalanceLineAsset).asset_issuer ===
        issuerKeypair.publicKey()
  );
  console.log("\nHolder tEURCV balance:", teurcvBalance?.balance);

  // 6. Print config for .env
  console.log("\n========================================");
  console.log("Add these to your .env:");
  console.log(`STELLAR_ISSUER_ADDRESS=${issuerKeypair.publicKey()}`);
  console.log(`STELLAR_PRIVATE_KEY=${issuerKeypair.secret()}`);
  console.log(`STELLAR_SENDER_KEY=${holderKeypair.secret()}`);
  console.log("========================================");
}

main().catch(console.error);
