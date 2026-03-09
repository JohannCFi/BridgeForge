import "dotenv/config";
import xrpl from "xrpl";

const issuerWallet = xrpl.Wallet.fromSeed(process.env.XRPL_PRIVATE_KEY || "");
console.log("Issuer wallet:", issuerWallet.classicAddress);
console.log("Expected issuer:", process.env.XRPL_ISSUER_ADDRESS);
console.log("Match:", issuerWallet.classicAddress === process.env.XRPL_ISSUER_ADDRESS);

console.log("");

const senderKey = process.env.XRPL_SENDER_KEY;
console.log("XRPL_SENDER_KEY raw:", JSON.stringify(senderKey));
if (senderKey && senderKey.trim()) {
  const senderWallet = xrpl.Wallet.fromSeed(senderKey.trim());
  console.log("Sender wallet:", senderWallet.classicAddress);
  console.log("Expected sender: rZXsBGx1JVXCZ3XS2qnDx6jfhkS8EBmUw");
  console.log("Match:", senderWallet.classicAddress === "rZXsBGx1JVXCZ3XS2qnDx6jfhkS8EBmUw");
} else {
  console.log("XRPL_SENDER_KEY is empty or not set!");
}
