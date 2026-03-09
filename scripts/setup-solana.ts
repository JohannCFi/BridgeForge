// ============================================================
// BridgeForge – Setup testEURCV on Solana Devnet
// Usage: npx tsx scripts/setup-solana.ts
//
// This script:
// 1. Creates a keypair for the bridge operator
// 2. Airdrops SOL for gas fees
// 3. Creates a SPL Token mint (testEURCV)
// 4. Creates an Associated Token Account (ATA)
// 5. Mints 10,000 testEURCV to the operator
// ============================================================

import "dotenv/config";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";

async function main() {
  // Connect to Solana Devnet
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  console.log("Connected to Solana Devnet\n");

  // 1. Create or resume operator keypair
  let operator: Keypair;
  const resumeKey = process.env.SOLANA_PRIVATE_KEY;
  if (resumeKey) {
    // Resume mode: reuse existing keypair (already funded via faucet)
    operator = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(resumeKey)));
    console.log("Resuming with existing keypair:", operator.publicKey.toBase58());
  } else {
    operator = Keypair.generate();
    console.log("Operator public key:", operator.publicKey.toBase58());

    // Try airdrop
    console.log("\nRequesting SOL airdrop...");
    let airdropSuccess = false;
    for (const amount of [1, 0.5]) {
      try {
        const airdropSig = await connection.requestAirdrop(
          operator.publicKey,
          amount * LAMPORTS_PER_SOL
        );
        await connection.confirmTransaction(airdropSig);
        console.log(`Airdrop confirmed: ${amount} SOL`);
        airdropSuccess = true;
        break;
      } catch (err) {
        console.log(`Airdrop of ${amount} SOL failed, retrying...`);
      }
    }
    if (!airdropSuccess) {
      console.log("\nAirdrop failed (faucet is rate-limited).");
      console.log("Manual alternative:");
      console.log(`1. Go to https://faucet.solana.com/`);
      console.log(`2. Select "Devnet"`);
      console.log(`3. Paste this address: ${operator.publicKey.toBase58()}`);
      console.log(`4. Add this to your .env then re-run the script:`);
      console.log(`SOLANA_PRIVATE_KEY=${JSON.stringify(Array.from(operator.secretKey))}`);
      return;
    }
  }

  // Check balance
  const solBalance = await connection.getBalance(operator.publicKey);
  console.log(`SOL balance: ${solBalance / LAMPORTS_PER_SOL}`);
  if (solBalance === 0) {
    console.log("No SOL balance. Fund the wallet first then re-run.");
    return;
  }

  // 3. Create SPL Token mint (testEURCV)
  // The operator is both the mint authority and freeze authority
  // 6 decimals like real EURCV
  console.log("\nCreating testEURCV token mint...");
  const mint = await createMint(
    connection,
    operator, // payer
    operator.publicKey, // mint authority (can mint new tokens)
    operator.publicKey, // freeze authority (can freeze accounts, like Forge's compliance)
    6 // decimals (same as EURCV)
  );
  console.log("Token mint address:", mint.toBase58());

  // 4. Create Associated Token Account for the operator
  console.log("\nCreating token account...");
  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    operator, // payer
    mint, // token mint
    operator.publicKey // owner
  );
  console.log("Token account:", tokenAccount.address.toBase58());

  // 5. Mint 10,000 testEURCV (with 6 decimals = 10_000_000_000)
  console.log("\nMinting 10,000 testEURCV...");
  const mintAmount = 10_000 * 10 ** 6; // 10,000 tokens with 6 decimals
  await mintTo(
    connection,
    operator, // payer
    mint, // token mint
    tokenAccount.address, // destination
    operator, // mint authority
    mintAmount
  );

  // 6. Verify balance
  const accountInfo = await getAccount(connection, tokenAccount.address);
  const balance = Number(accountInfo.amount) / 10 ** 6;
  console.log("testEURCV balance:", balance);

  // 7. Print config for .env
  console.log("\n========================================");
  console.log("Add these to your .env:");
  console.log(`SOLANA_TOKEN_ADDRESS=${mint.toBase58()}`);
  console.log(
    `SOLANA_PRIVATE_KEY=${JSON.stringify(Array.from(operator.secretKey))}`
  );
  console.log(`SOLANA_OPERATOR_ADDRESS=${operator.publicKey.toBase58()}`);
  console.log("========================================");
}

main().catch(console.error);
