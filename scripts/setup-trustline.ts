import "dotenv/config";
import xrpl from "xrpl";

// The receiver account - needs a trust line to the issuer
const RECEIVER_ADDRESS = "rNfuHpxigmk1y55BeYn8xwQRhxVSEAF3mg";
const CURRENCY_CODE = "7445555243560000000000000000000000000000";

async function main() {
  const client = new xrpl.Client(process.env.XRPL_RPC_URL || "wss://s.altnet.rippletest.net:51233");
  await client.connect();

  console.log("Receiver:", RECEIVER_ADDRESS);
  console.log("Issuer:", process.env.XRPL_ISSUER_ADDRESS);
  console.log("");
  console.log("NOTE: The trust line must be submitted by the RECEIVER wallet.");
  console.log("You need the receiver's seed/private key to create a trust line.");
  console.log("");
  console.log("Option 1: Import your Xaman seed here");
  console.log("Option 2: Create the trust line manually in Xaman");
  console.log("");
  console.log("To create it in Xaman:");
  console.log("1. Go to Settings > Advanced > Node > set to testnet");
  console.log("2. Go to the + button > Trust Set");
  console.log("3. Set currency to tEURCV (hex: 7445555243560000000000000000000000000000)");
  console.log("4. Set issuer to:", process.env.XRPL_ISSUER_ADDRESS);
  console.log("5. Set limit to 1000000");

  await client.disconnect();
}

main().catch(console.error);
