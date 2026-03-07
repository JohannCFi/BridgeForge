// ============================================================
// BridgeForge – Deploy testEURCV to Sepolia
// Usage: npx hardhat run scripts/deploy.ts --network sepolia
// ============================================================

import "@nomicfoundation/hardhat-ethers";
import { network } from "hardhat";

const connection = await network.connect();
console.log(`Deploying testEURCV to ${connection.networkName}...`);
console.log("Connection keys:", Object.keys(connection));

const ethers = connection.ethers;

const [deployer] = await ethers.getSigners();
console.log("Deployer address:", deployer.address);
const balance = await ethers.provider.getBalance(deployer.address);
console.log("Balance:", ethers.formatEther(balance), "SepoliaETH");

const token = await ethers.deployContract("TestEURCV");
await token.waitForDeployment();

const address = await token.getAddress();
console.log("\ntestEURCV deployed to:", address);
console.log("\nNext steps:");
console.log(`1. Add ETHEREUM_TOKEN_ADDRESS=${address} to your .env`);
console.log("2. Mint some tokens: npx hardhat run scripts/mint.ts --network sepolia");
