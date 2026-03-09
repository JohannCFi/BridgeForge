import "dotenv/config";
import xrpl from "xrpl";

const client = new xrpl.Client(process.env.XRPL_RPC_URL || "wss://s.altnet.rippletest.net:51233");

async function main() {
  await client.connect();

  const address = process.env.XRPL_ISSUER_ADDRESS || "";
  console.log("=== XRPL Testnet ===");
  console.log("Address:", address);

  try {
    const info = await client.request({ command: "account_info", account: address });
    console.log("Account activated: YES");
    console.log("XRP balance:", xrpl.dropsToXrp(info.result.account_data.Balance));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("actNotFound")) {
      console.log("Account activated: NO — needs 10 XRP to activate");
    } else {
      console.log("Error:", msg);
    }
  }

  await client.disconnect();
}

main();
