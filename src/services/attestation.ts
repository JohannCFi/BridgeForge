// ============================================================
// BridgeForge – Attestation Service
// Our equivalent of Circle's attestation API in CCTP.
// Signs a proof that a burn happened, authorizing the mint.
// ============================================================

import crypto from "crypto";
import { Attestation, Chain } from "../types";
import { operatorKeys } from "../config";

/**
 * AttestationService – signs burn proofs.
 *
 * In CCTP, Circle runs an off-chain attestation service that watches
 * for burns and produces signed attestations. Our backend plays
 * that same role.
 *
 * In production, SG Forge would be the attester.
 */
export class AttestationService {
  private privateKey: string;

  constructor() {
    this.privateKey = operatorKeys.attestation;
  }

  /**
   * Create a signed attestation for a confirmed burn.
   * This proves to the destination chain that the burn is legitimate.
   */
  createAttestation(params: {
    transferId: string;
    sourceChain: Chain;
    destinationChain: Chain;
    amount: string;
    recipientAddress: string;
    burnTxHash: string;
  }): Attestation {
    const message = this.buildMessage(params);
    const signature = this.sign(message);

    const attestation: Attestation = {
      ...params,
      signature,
      timestamp: Date.now(),
    };

    console.log(`[Attestation] Created for transfer ${params.transferId}`);
    return attestation;
  }

  /**
   * Verify an attestation signature.
   * The destination chain adapter would call this before minting.
   */
  verifyAttestation(attestation: Attestation): boolean {
    const message = this.buildMessage(attestation);
    return this.verify(message, attestation.signature);
  }

  private buildMessage(params: {
    transferId: string;
    sourceChain: Chain;
    destinationChain: Chain;
    amount: string;
    recipientAddress: string;
    burnTxHash: string;
  }): string {
    return [
      params.transferId,
      params.sourceChain,
      params.destinationChain,
      params.amount,
      params.recipientAddress,
      params.burnTxHash,
    ].join(":");
  }

  private sign(message: string): string {
    const hmac = crypto.createHmac("sha256", this.privateKey);
    hmac.update(message);
    return hmac.digest("hex");
  }

  private verify(message: string, signature: string): boolean {
    const expected = this.sign(message);
    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expected, "hex")
    );
  }
}
