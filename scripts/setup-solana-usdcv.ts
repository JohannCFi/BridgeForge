// ============================================================
// BridgeForge – Setup tUSDCV on Solana Devnet
// Usage: npx tsx scripts/setup-solana-usdcv.ts
//
// This script reuses the existing operator keypair (from SOLANA_PRIVATE_KEY)
// and creates a new SPL Token mint for tUSDCV.
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
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  console.log("Connected to Solana Devnet\n");

  // Load existing operator keypair
  const resumeKey = process.env.SOLANA_PRIVATE_KEY;
  if (!resumeKey) {
    console.error("SOLANA_PRIVATE_KEY not set. Run setup-solana.ts first for tEURCV.");
    process.exit(1);
  }

  const operator = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(resumeKey)));
  console.log("Operator public key:", operator.publicKey.toBase58());

  const solBalance = await connection.getBalance(operator.publicKey);
  console.log(`SOL balance: ${solBalance / LAMPORTS_PER_SOL}`);
  if (solBalance === 0) {
    console.log("No SOL balance. Fund the wallet first.");
    return;
  }

  // Create SPL Token mint for tUSDCV (6 decimals)
  console.log("\nCreating tUSDCV token mint...");
  const mint = await createMint(
    connection,
    operator,
    operator.publicKey,
    operator.publicKey,
    6
  );
  console.log("tUSDCV mint address:", mint.toBase58());

  // Create ATA for operator
  console.log("\nCreating token account...");
  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    operator,
    mint,
    operator.publicKey
  );
  console.log("Token account:", tokenAccount.address.toBase58());

  // Mint 10,000 tUSDCV
  console.log("\nMinting 10,000 tUSDCV...");
  const mintAmount = 10_000 * 10 ** 6;
  await mintTo(connection, operator, mint, tokenAccount.address, operator, mintAmount);

  const accountInfo = await getAccount(connection, tokenAccount.address);
  const balance = Number(accountInfo.amount) / 10 ** 6;
  console.log("tUSDCV balance:", balance);

  console.log("\n========================================");
  console.log("Add this to your .env:");
  console.log(`SOLANA_USDCV_TOKEN_ADDRESS=${mint.toBase58()}`);
  console.log("========================================");
}

main().catch(console.error);
