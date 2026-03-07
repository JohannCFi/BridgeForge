import { HardhatUserConfig } from "hardhat/config";
import hardhatToolbox from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  plugins: [hardhatToolbox],
  networks: {
    sepolia: {
      type: "http",
      url: process.env.ETHEREUM_RPC_URL || "https://rpc.sepolia.org",
      accounts: process.env.ETHEREUM_PRIVATE_KEY
        ? [process.env.ETHEREUM_PRIVATE_KEY]
        : [],
    },
  },
};

export default config;
