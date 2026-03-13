// ============================================================
// BridgeForge – Attestation Service (ECDSA)
// Signs burn proofs using ECDSA for on-chain verification.
// ============================================================

import { ethers } from "ethers";
import { BridgeMessage } from "../types/index.js";

export class AttestationService {
  private wallet: ethers.Wallet;

  constructor(privateKey: string) {
    this.wallet = new ethers.Wallet(privateKey);
  }

  getAttesterAddress(): string {
    return this.wallet.address;
  }

  async signMessage(message: BridgeMessage): Promise<string> {
    const messageHash = this.computeMessageHash(message);
    return this.wallet.signMessage(ethers.getBytes(messageHash));
  }

  computeMessageHash(message: BridgeMessage): string {
    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint32", "bytes32", "uint32", "uint32", "bytes32", "bytes32", "uint256", "bytes32"],
        [
          message.version,
          message.transferId,
          message.sourceDomain,
          message.destDomain,
          message.sender,
          message.recipient,
          BigInt(message.amount),
          message.burnTxHash,
        ]
      )
    );
  }

  verifyAttestation(message: BridgeMessage, signature: string): boolean {
    const messageHash = this.computeMessageHash(message);
    const recovered = ethers.verifyMessage(ethers.getBytes(messageHash), signature);
    return recovered === this.wallet.address;
  }
}
