import "dotenv/config";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";

const connection = new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com", "confirmed");
const mint = new PublicKey(process.env.SOLANA_TOKEN_ADDRESS || "");
const owner = new PublicKey("7w21Tk7ozvqC4rhB5dBmyu1m5Te8maHx2q4Wcya33WeQ");

console.log("=== Solana Devnet ===");
console.log("Mint:", mint.toBase58());
console.log("Owner:", owner.toBase58());

try {
  const ata = await getAssociatedTokenAddress(mint, owner);
  console.log("ATA:", ata.toBase58());
  const account = await getAccount(connection, ata);
  console.log("testEURCV balance:", (Number(account.amount) / 10 ** 6).toString());
} catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  console.log("No token account found:", msg);
}
