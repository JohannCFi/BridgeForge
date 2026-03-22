// ============================================================
// BridgeForge – Deploy testUSDCV to Sepolia
// Usage: npx hardhat run scripts/deploy-usdcv.ts --network sepolia
// ============================================================

import "@nomicfoundation/hardhat-ethers";
import { network } from "hardhat";

const connection = await network.connect();
console.log(`Deploying testUSDCV to ${connection.networkName}...`);

const ethers = connection.ethers;

const [deployer] = await ethers.getSigners();
console.log("Deployer address:", deployer.address);
const balance = await ethers.provider.getBalance(deployer.address);
console.log("Balance:", ethers.formatEther(balance), "SepoliaETH");

const token = await ethers.deployContract("TestUSDCV");
await token.waitForDeployment();

const address = await token.getAddress();
console.log("\ntestUSDCV deployed to:", address);
console.log("\nNext steps:");
console.log(`1. Add ETHEREUM_USDCV_TOKEN_ADDRESS=${address} to your .env`);
console.log("2. Update frontend VITE_ETHEREUM_USDCV_ADDRESS accordingly");
