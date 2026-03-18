import type { Chain } from "../types";
import { CHAINS } from "../config/chains";

function getChainConfig(chain: Chain) {
  const cfg = CHAINS.find((c) => c.id === chain);
  if (!cfg) throw new Error(`Unknown chain: ${chain}`);
  return cfg;
}

async function getEthereumBalance(address: string): Promise<string> {
  const cfg = getChainConfig("ethereum");
  const { ethers } = await import("ethers");
  const provider = new ethers.JsonRpcProvider(cfg.rpcUrl);
  const contract = new ethers.Contract(
    cfg.tokenAddress,
    ["function balanceOf(address) view returns (uint256)"],
    provider
  );
  const balance = await contract.balanceOf(address);
  return ethers.formatUnits(balance, 6);
}

async function getSolanaBalance(address: string): Promise<string> {
  const cfg = getChainConfig("solana");
  const { Connection, PublicKey } = await import("@solana/web3.js");
  const { getAssociatedTokenAddress, getAccount } = await import("@solana/spl-token");

  const connection = new Connection(cfg.rpcUrl, "confirmed");
  const mint = new PublicKey(cfg.tokenAddress);
  const owner = new PublicKey(address);
  const ata = await getAssociatedTokenAddress(mint, owner);

  try {
    const account = await getAccount(connection, ata);
    return (Number(account.amount) / 10 ** 6).toString();
  } catch {
    return "0";
  }
}

const XRPL_CURRENCY_CODE = "7445555243560000000000000000000000000000";

async function getXrplBalance(address: string): Promise<string> {
  const cfg = getChainConfig("xrpl");
  const res = await fetch(cfg.rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: "account_lines",
      params: [{ account: address }],
    }),
  });
  const json = await res.json();
  const lines: { currency: string; account: string; balance: string }[] =
    json.result?.lines ?? [];
  const line = lines.find(
    (l) => l.currency === XRPL_CURRENCY_CODE && l.account === cfg.tokenAddress
  );
  return line?.balance ?? "0";
}

async function getStellarBalance(address: string): Promise<string> {
  const cfg = getChainConfig("stellar");
  try {
    const res = await fetch(`${cfg.rpcUrl}/accounts/${address}`);
    if (!res.ok) return "0";
    const json = await res.json();
    const balance = json.balances?.find(
      (b: { asset_type: string; asset_code?: string; asset_issuer?: string }) =>
        b.asset_type !== "native" &&
        b.asset_code === "tEURCV" &&
        b.asset_issuer === cfg.tokenAddress
    );
    return balance?.balance ?? "0";
  } catch {
    return "0";
  }
}

export async function getBalance(
  chain: Chain,
  address: string
): Promise<{ chain: Chain; address: string; balance: string }> {
  let balance: string;
  switch (chain) {
    case "ethereum":
      balance = await getEthereumBalance(address);
      break;
    case "solana":
      balance = await getSolanaBalance(address);
      break;
    case "xrpl":
      balance = await getXrplBalance(address);
      break;
    case "stellar":
      balance = await getStellarBalance(address);
      break;
  }
  return { chain, address, balance };
}
