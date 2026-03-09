// ============================================================
// BridgeForge – Ethereum Chain Adapter
// Handles burn/mint of testEURCV on Ethereum (Sepolia testnet)
// ============================================================

import { ethers } from "ethers";
import { ChainAdapter, BurnEvent } from "../../types";
import { chainConfigs, operatorKeys } from "../../config";

// Minimal ABI for our testEURCV ERC-20 with burn & mint
const TEST_EURCV_ABI = [
  "function mint(address to, uint256 amount) external",
  "function burn(uint256 amount) external",
  "function bridgeBurn(uint256 amount, string destinationChain, string recipientAddress) external",
  "function balanceOf(address account) view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function decimals() view returns (uint8)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event BridgeBurn(address indexed sender, uint256 amount, string destinationChain, string recipientAddress)",
];

export class EthereumAdapter implements ChainAdapter {
  chain = "ethereum" as const;
  private provider: ethers.JsonRpcProvider;
  private operatorWallet: ethers.Wallet | null = null;
  private tokenContract: ethers.Contract | null = null;

  constructor() {
    const config = chainConfigs.ethereum;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);

    const key = operatorKeys.ethereum;
    if (key && config.tokenAddress) {
      this.operatorWallet = new ethers.Wallet(key, this.provider);
      this.tokenContract = new ethers.Contract(
        config.tokenAddress,
        TEST_EURCV_ABI,
        this.operatorWallet
      );
      console.log("[Ethereum] Adapter initialized");
    } else {
      console.warn("[Ethereum] Missing private key or token address – adapter disabled");
    }
  }

  private ensureReady(): ethers.Contract {
    if (!this.tokenContract) throw new Error("[Ethereum] Adapter not configured");
    return this.tokenContract;
  }

  async burn(senderAddress: string, amount: string): Promise<string> {
    const contract = this.ensureReady();
    const decimals = await contract.decimals();
    const parsedAmount = ethers.parseUnits(amount, decimals);

    const tx = await contract.burn(parsedAmount);
    const receipt = await tx.wait();
    console.log(`[Ethereum] Burn tx confirmed: ${receipt.hash}`);
    return receipt.hash;
  }

  async mint(recipientAddress: string, amount: string): Promise<string> {
    const contract = this.ensureReady();
    const decimals = await contract.decimals();
    const parsedAmount = ethers.parseUnits(amount, decimals);

    const tx = await contract.mint(recipientAddress, parsedAmount);
    const receipt = await tx.wait();
    console.log(`[Ethereum] Mint tx confirmed: ${receipt.hash}`);
    return receipt.hash;
  }

  listenForBurns(handler: (event: BurnEvent) => void): void {
    if (!this.tokenContract) {
      console.warn("[Ethereum] Adapter not configured, skipping burn listener");
      return;
    }

    this.tokenContract.on("BridgeBurn", (sender: string, amount: bigint, _destChain: string, _recipient: string, event: ethers.EventLog) => {
      handler({
        chain: "ethereum",
        txHash: event.transactionHash,
        sender,
        amount: ethers.formatUnits(amount, 6),
        timestamp: Date.now(),
      });
    });

    console.log("[Ethereum] Listening for BridgeBurn events...");
  }

  async getBalance(address: string): Promise<string> {
    const contract = this.ensureReady();
    const balance = await contract.balanceOf(address);
    const decimals = await contract.decimals();
    return ethers.formatUnits(balance, decimals);
  }

  isValidAddress(address: string): boolean {
    return ethers.isAddress(address);
  }
}
