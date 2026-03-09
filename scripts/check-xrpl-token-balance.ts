import "dotenv/config";
import xrpl from "xrpl";

const client = new xrpl.Client(process.env.XRPL_RPC_URL || "wss://s.altnet.rippletest.net:51233");

async function main() {
  await client.connect();
  const res = await client.request({ command: "account_lines", account: "rZXsBGx1JVXCZ3XS2qnDx6jfhkS8EBmUw" });
  const line = res.result.lines.find(l => l.account === process.env.XRPL_ISSUER_ADDRESS);
  console.log("tEURCV balance:", line?.balance ?? "0");
  await client.disconnect();
}

main();
