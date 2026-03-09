import "dotenv/config";
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);
const wallet = new ethers.Wallet(process.env.ETHEREUM_PRIVATE_KEY || "", provider);
const contract = new ethers.Contract(
  process.env.ETHEREUM_TOKEN_ADDRESS || "",
  [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function owner() view returns (address)",
  ],
  provider
);

const decimals = await contract.decimals();
const balance = await contract.balanceOf(wallet.address);
const owner = await contract.owner();
const ethBalance = await provider.getBalance(wallet.address);

console.log("=== Ethereum (Sepolia) ===");
console.log("Operator:", wallet.address);
console.log("Contract owner:", owner);
console.log("Is owner:", wallet.address.toLowerCase() === owner.toLowerCase());
console.log("testEURCV balance:", ethers.formatUnits(balance, decimals));
console.log("ETH balance:", ethers.formatEther(ethBalance));
