import "dotenv/config";
import xrpl from "xrpl";

const wallet = xrpl.Wallet.fromSeed(process.env.XRPL_PRIVATE_KEY || "");
console.log("=== XRPL Testnet ===");
console.log("Address:", wallet.classicAddress);
console.log("Public key:", wallet.publicKey);
