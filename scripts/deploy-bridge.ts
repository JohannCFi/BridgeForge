// ============================================================
// BridgeForge – Deploy EURCVToken + EURCVBridge
// Usage: npx hardhat run scripts/deploy-bridge.ts [--network sepolia]
// ============================================================

import "@nomicfoundation/hardhat-ethers";
import { network } from "hardhat";

const connection = await network.connect();
const { ethers } = connection;

const [deployer] = await ethers.getSigners();
console.log("Deploying with:", deployer.address);

const attesterAddress = process.env.ATTESTATION_PUBLIC_ADDRESS || deployer.address;
const localDomain = 0; // Ethereum
const minAmount = 1_000000n; // 1 EURCV
const maxAmount = 1_000_000_000000n; // 1M EURCV

// Deploy token
const tokenFactory = await ethers.getContractFactory("EURCVToken");
const token = await tokenFactory.deploy(deployer.address);
await token.waitForDeployment();
console.log("EURCVToken:", await token.getAddress());

// Deploy bridge
const bridgeFactory = await ethers.getContractFactory("EURCVBridge");
const bridge = await bridgeFactory.deploy(
  await token.getAddress(),
  attesterAddress,
  localDomain,
  minAmount,
  maxAmount,
  deployer.address
);
await bridge.waitForDeployment();
console.log("EURCVBridge:", await bridge.getAddress());

// Grant MINTER_ROLE to bridge
const minterRole = await token.MINTER_ROLE();
await token.grantRole(minterRole, await bridge.getAddress());
console.log("MINTER_ROLE granted to bridge");
