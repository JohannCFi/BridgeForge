import type { Chain, Token } from "../types";
import { CHAINS } from "../config/chains";
import { api } from "./client";

function getChainConfig(chain: Chain) {
  const cfg = CHAINS.find((c) => c.id === chain);
  if (!cfg) throw new Error(`Unknown chain: ${chain}`);
  return cfg;
}

async function getEthereumBalance(address: string, tokenAddress: string): Promise<string> {
  const cfg = getChainConfig("ethereum");
  const { ethers } = await import("ethers");
  const provider = new ethers.JsonRpcProvider(cfg.rpcUrl);
  const contract = new ethers.Contract(
    tokenAddress,
    ["function balanceOf(address) view returns (uint256)"],
    provider
  );
  const balance = await contract.balanceOf(address);
  return ethers.formatUnits(balance, 6);
}

async function getSolanaBalance(address: string, tokenAddress: string): Promise<string> {
  const cfg = getChainConfig("solana");
  const { Connection, PublicKey } = await import("@solana/web3.js");
  const { getAssociatedTokenAddress, getAccount } = await import("@solana/spl-token");

  const connection = new Connection(cfg.rpcUrl, "confirmed");
  const mint = new PublicKey(tokenAddress);
  const owner = new PublicKey(address);
  const ata = await getAssociatedTokenAddress(mint, owner);

  try {
    const account = await getAccount(connection, ata);
    return (Number(account.amount) / 10 ** 6).toString();
  } catch {
    return "0";
  }
}

export async function getBalance(
  chain: Chain,
  address: string,
  token: Token = "tEURCV"
): Promise<{ chain: Chain; address: string; balance: string; token: Token }> {
  // XRPL and Stellar RPCs block browser CORS — route through backend API
  if (chain === "xrpl" || chain === "stellar") {
    return api.getBalance(chain, address, token);
  }

  const cfg = getChainConfig(chain);
  const tokenAddress = cfg.tokenAddresses[token];

  if (!tokenAddress) {
    return { chain, address, balance: "0", token };
  }

  let balance: string;
  switch (chain) {
    case "ethereum":
      balance = await getEthereumBalance(address, tokenAddress);
      break;
    case "solana":
      balance = await getSolanaBalance(address, tokenAddress);
      break;
    default:
      balance = "0";
  }
  return { chain, address, balance, token };
}
