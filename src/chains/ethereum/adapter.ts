// ============================================================
// BridgeForge – Ethereum Chain Adapter
// Handles burn/mint of EURCV on Ethereum (Sepolia testnet)
// ============================================================

import { ethers } from "ethers";
import { ChainAdapter, BurnProof, MintResult, RefundResult, TokenContext } from "../../types/index.js";
import { chainConfigs, operatorKeys } from "../../config/index.js";

const BRIDGE_ABI = [
  "event BurnForBridge(bytes32 indexed transferId, address indexed sender, uint256 amount, uint32 destDomain, bytes32 recipient, uint64 nonce)",
];

const TOKEN_ABI = [
  "function mint(address to, uint256 amount) external",
  "function balanceOf(address account) view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
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
        TOKEN_ABI,
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

  async executeMint(recipientAddress: string, amount: string, tokenCtx?: TokenContext): Promise<MintResult> {
    try {
      const contract = tokenCtx?.tokenAddress
        ? new ethers.Contract(tokenCtx.tokenAddress, TOKEN_ABI, this.operatorWallet!)
        : this.ensureReady();
      const parsedAmount = ethers.parseUnits(amount, 6);
      const tx = await contract.mint(recipientAddress, parsedAmount);
      const receipt = await tx.wait();
      console.log(`[Ethereum] Mint tx confirmed: ${receipt.hash}`);
      return { success: true, txHash: receipt.hash };
    } catch (err) {
      console.error("[Ethereum] Mint failed:", err);
      return { success: false, txHash: "" };
    }
  }

  async verifyBurn(txHash: string): Promise<BurnProof> {
    this.ensureReady();
    const receipt = await this.provider.getTransactionReceipt(txHash);
    if (!receipt || receipt.status !== 1) {
      return { valid: false, sender: "", amount: "0", txHash };
    }

    const bridgeIface = new ethers.Interface(BRIDGE_ABI);
    const tokenIface = new ethers.Interface(TOKEN_ABI);

    // Try BurnForBridge event first (from EURCVBridge contract)
    for (const log of receipt.logs) {
      try {
        const parsed = bridgeIface.parseLog({ topics: log.topics as string[], data: log.data });
        if (parsed && parsed.name === "BurnForBridge") {
          return {
            valid: true,
            sender: parsed.args[1],
            amount: ethers.formatUnits(parsed.args[2], 6),
            txHash,
            transferId: parsed.args[0],
          };
        }
      } catch {
        // Not a BurnForBridge log
      }
    }

    // Fallback: Transfer to 0x0 (simple burn)
    for (const log of receipt.logs) {
      try {
        const parsed = tokenIface.parseLog({ topics: log.topics as string[], data: log.data });
        if (parsed && parsed.name === "Transfer" && parsed.args[1] === ethers.ZeroAddress) {
          return {
            valid: true,
            sender: parsed.args[0],
            amount: ethers.formatUnits(parsed.args[2], 6),
            txHash,
          };
        }
      } catch {
        // Not a Transfer log
      }
    }

    return { valid: false, sender: "", amount: "0", txHash };
  }

  async refund(senderAddress: string, amount: string, tokenCtx?: TokenContext): Promise<RefundResult> {
    return this.executeMint(senderAddress, amount, tokenCtx);
  }

  async getBalance(address: string, tokenCtx?: TokenContext): Promise<string> {
    const contract = tokenCtx?.tokenAddress
      ? new ethers.Contract(tokenCtx.tokenAddress, TOKEN_ABI, this.provider)
      : this.ensureReady();
    const balance = await contract.balanceOf(address);
    return ethers.formatUnits(balance, 6);
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.provider.getBlockNumber();
      return true;
    } catch {
      return false;
    }
  }
}
