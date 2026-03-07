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
  "function balanceOf(address account) view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function decimals() view returns (uint8)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

export class EthereumAdapter implements ChainAdapter {
  chain = "ethereum" as const;
  private provider: ethers.JsonRpcProvider;
  private operatorWallet: ethers.Wallet;
  private tokenContract: ethers.Contract;

  constructor() {
    const config = chainConfigs.ethereum;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.operatorWallet = new ethers.Wallet(operatorKeys.ethereum, this.provider);
    this.tokenContract = new ethers.Contract(
      config.tokenAddress,
      TEST_EURCV_ABI,
      this.operatorWallet
    );
  }

  async burn(senderAddress: string, amount: string): Promise<string> {
    // In the real flow, the user calls burn() themselves via the frontend.
    // Here we simulate it from the operator for the POC.
    const decimals = await this.tokenContract.decimals();
    const parsedAmount = ethers.parseUnits(amount, decimals);

    const tx = await this.tokenContract.burn(parsedAmount);
    const receipt = await tx.wait();
    console.log(`[Ethereum] Burn tx confirmed: ${receipt.hash}`);
    return receipt.hash;
  }

  async mint(recipientAddress: string, amount: string): Promise<string> {
    const decimals = await this.tokenContract.decimals();
    const parsedAmount = ethers.parseUnits(amount, decimals);

    const tx = await this.tokenContract.mint(recipientAddress, parsedAmount);
    const receipt = await tx.wait();
    console.log(`[Ethereum] Mint tx confirmed: ${receipt.hash}`);
    return receipt.hash;
  }

  listenForBurns(handler: (event: BurnEvent) => void): void {
    // A burn is a Transfer event to the zero address
    const burnFilter = this.tokenContract.filters.Transfer(null, ethers.ZeroAddress);

    this.tokenContract.on(burnFilter, (from: string, _to: string, value: bigint, event: ethers.EventLog) => {
      handler({
        chain: "ethereum",
        txHash: event.transactionHash,
        sender: from,
        amount: ethers.formatUnits(value, 18),
        timestamp: Date.now(),
      });
    });

    console.log("[Ethereum] Listening for burn events...");
  }

  async getBalance(address: string): Promise<string> {
    const balance = await this.tokenContract.balanceOf(address);
    const decimals = await this.tokenContract.decimals();
    return ethers.formatUnits(balance, decimals);
  }

  isValidAddress(address: string): boolean {
    return ethers.isAddress(address);
  }
}
