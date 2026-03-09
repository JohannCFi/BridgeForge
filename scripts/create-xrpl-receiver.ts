import "dotenv/config";
import xrpl from "xrpl";

const CURRENCY_CODE = "7445555243560000000000000000000000000000";

async function main() {
  const client = new xrpl.Client(process.env.XRPL_RPC_URL || "wss://s.altnet.rippletest.net:51233");
  await client.connect();

  // 1. Generate a new wallet and fund it via testnet faucet
  console.log("Creating and funding new XRPL testnet wallet...");
  const { wallet, balance } = await client.fundWallet();

  console.log("\n=== New XRPL Receiver Wallet ===");
  console.log("Address:", wallet.classicAddress);
  console.log("Seed:", wallet.seed);
  console.log("XRP balance:", balance);

  // 2. Create trust line to the issuer for tEURCV
  console.log("\nCreating trust line to issuer for tEURCV...");
  const trustSet: xrpl.TrustSet = {
    TransactionType: "TrustSet",
    Account: wallet.classicAddress,
    LimitAmount: {
      currency: CURRENCY_CODE,
      issuer: process.env.XRPL_ISSUER_ADDRESS || "",
      value: "1000000",
    },
  };

  const result = await client.submitAndWait(trustSet, { wallet });
  console.log("Trust line created! Tx:", result.result.hash);

  console.log("\n=== Use this address for bridge transfers ===");
  console.log("recipientAddress:", wallet.classicAddress);
  console.log("\nSave the seed if you want to import into Xaman:", wallet.seed);

  await client.disconnect();
}

main().catch(console.error);
