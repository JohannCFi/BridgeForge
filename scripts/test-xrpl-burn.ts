import "dotenv/config";
import xrpl from "xrpl";

const CURRENCY_CODE = "7445555243560000000000000000000000000000";

async function main() {
  const client = new xrpl.Client(process.env.XRPL_RPC_URL || "wss://s.altnet.rippletest.net:51233");
  await client.connect();

  const senderWallet = xrpl.Wallet.fromSeed(process.env.XRPL_SENDER_KEY || "");
  console.log("Sender:", senderWallet.classicAddress);
  console.log("Issuer:", process.env.XRPL_ISSUER_ADDRESS);
  console.log("Algorithm:", senderWallet.publicKey.startsWith("ED") ? "ed25519" : "secp256k1");

  // Check balance first
  const lines = await client.request({ command: "account_lines", account: senderWallet.classicAddress });
  const line = lines.result.lines.find(l => l.account === process.env.XRPL_ISSUER_ADDRESS);
  console.log("Current balance:", line?.balance ?? "0");

  // Try a small burn (1 tEURCV)
  const payment: xrpl.Payment = {
    TransactionType: "Payment",
    Account: senderWallet.classicAddress,
    Destination: process.env.XRPL_ISSUER_ADDRESS || "",
    Amount: {
      currency: CURRENCY_CODE,
      issuer: process.env.XRPL_ISSUER_ADDRESS || "",
      value: "1",
    },
  };

  console.log("\nSubmitting burn tx...");
  const prepared = await client.autofill(payment);
  console.log("LastLedgerSequence:", prepared.LastLedgerSequence);
  const signed = senderWallet.sign(prepared);
  console.log("Signed tx hash:", signed.hash);

  try {
    const result = await client.submitAndWait(signed.tx_blob);
    console.log("Result:", result.result.meta?.toString());
    console.log("Hash:", result.result.hash);
    console.log("SUCCESS!");
  } catch (e) {
    console.error("Error:", e);
  }

  await client.disconnect();
}

main();
