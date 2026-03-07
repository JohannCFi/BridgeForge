// ============================================================
// BridgeForge – Mint testEURCV tokens for testing
// Usage: npx hardhat run scripts/mint.ts --network sepolia
// ============================================================

import { network } from "hardhat";

const { ethers } = await network.connect();

const tokenAddress = process.env.ETHEREUM_TOKEN_ADDRESS;
if (!tokenAddress) {
  throw new Error("Set ETHEREUM_TOKEN_ADDRESS in your .env first");
}

const [deployer] = await ethers.getSigners();
console.log("Minting with account:", deployer.address);

const token = await ethers.getContractAt("TestEURCV", tokenAddress);

// Mint 10,000 testEURCV to the deployer (6 decimals like real EURCV)
const amount = ethers.parseUnits("10000", 6);
const tx = await token.mint(deployer.address, amount);
await tx.wait();

console.log(`Minted 10,000 testEURCV to ${deployer.address}`);
console.log(`Tx hash: ${tx.hash}`);
