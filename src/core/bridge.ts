// ============================================================
// BridgeForge – Bridge Engine
// Orchestrates the full burn → attest → mint flow.
// This is the heart of the bridge, inspired by CCTP's flow.
// ============================================================

import { randomUUID } from "crypto";
import {
  Chain,
  ChainAdapter,
  Transfer,
  TransferRequest,
  BurnEvent,
} from "../types";
import { AttestationService } from "../services/attestation";

export class BridgeEngine {
  private adapters: Record<Chain, ChainAdapter>;
  private attestationService: AttestationService;
  private transfers: Map<string, Transfer> = new Map();

  constructor(
    adapters: Record<Chain, ChainAdapter>,
    attestationService: AttestationService
  ) {
    this.adapters = adapters;
    this.attestationService = attestationService;
  }

  /**
   * Start listening for burn events on all chains.
   * When a burn is detected, the bridge automatically
   * creates an attestation and mints on the destination chain.
   */
  startListening(): void {
    for (const [chain, adapter] of Object.entries(this.adapters)) {
      adapter.listenForBurns((event: BurnEvent) => {
        console.log(`[Bridge] Burn detected on ${chain}: ${event.txHash}`);
        // In a full implementation, we'd match this event
        // to a pending transfer and proceed with attestation + mint.
      });
    }
    console.log("[Bridge] Listening for burns on all chains");
  }

  /**
   * Initiate a cross-chain transfer.
   * Full flow: validate → burn → attest → mint
   *
   * This mirrors CCTP's depositForBurn → attestation → receiveMessage
   */
  async initiateTransfer(request: TransferRequest): Promise<Transfer> {
    // 1. Validate
    this.validateRequest(request);

    // 2. Create transfer record
    const transfer: Transfer = {
      ...request,
      id: randomUUID(),
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.transfers.set(transfer.id, transfer);
    console.log(`[Bridge] Transfer ${transfer.id} created: ${request.sourceChain} → ${request.destinationChain}`);

    try {
      // 3. Burn on source chain
      transfer.status = "burning";
      transfer.updatedAt = new Date();

      const sourceAdapter = this.adapters[request.sourceChain];
      const burnTxHash = await sourceAdapter.burn(request.senderAddress, request.amount);

      transfer.status = "burned";
      transfer.burnTxHash = burnTxHash;
      transfer.updatedAt = new Date();
      console.log(`[Bridge] Burn confirmed: ${burnTxHash}`);

      // 4. Create attestation (our backend = the attester, like Circle in CCTP)
      transfer.status = "attesting";
      transfer.updatedAt = new Date();

      const attestation = this.attestationService.createAttestation({
        transferId: transfer.id,
        sourceChain: request.sourceChain,
        destinationChain: request.destinationChain,
        amount: request.amount,
        recipientAddress: request.recipientAddress,
        burnTxHash,
      });

      transfer.attestation = attestation;
      transfer.status = "attested";
      transfer.updatedAt = new Date();

      // 5. Verify attestation & mint on destination chain
      const isValid = this.attestationService.verifyAttestation(attestation);
      if (!isValid) {
        throw new Error("Attestation verification failed");
      }

      transfer.status = "minting";
      transfer.updatedAt = new Date();

      const destAdapter = this.adapters[request.destinationChain];
      const mintTxHash = await destAdapter.mint(request.recipientAddress, request.amount);

      transfer.status = "completed";
      transfer.mintTxHash = mintTxHash;
      transfer.updatedAt = new Date();
      console.log(`[Bridge] Transfer ${transfer.id} completed! Mint tx: ${mintTxHash}`);
    } catch (error) {
      transfer.status = "failed";
      transfer.updatedAt = new Date();
      console.error(`[Bridge] Transfer ${transfer.id} failed:`, error);
      throw error;
    }

    return transfer;
  }

  /** Get a transfer by ID */
  getTransfer(id: string): Transfer | undefined {
    return this.transfers.get(id);
  }

  /** Get all transfers */
  getAllTransfers(): Transfer[] {
    return Array.from(this.transfers.values());
  }

  private validateRequest(request: TransferRequest): void {
    if (request.sourceChain === request.destinationChain) {
      throw new Error("Source and destination chains must be different");
    }

    const amount = parseFloat(request.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error("Amount must be a positive number");
    }

    const destAdapter = this.adapters[request.destinationChain];
    if (!destAdapter.isValidAddress(request.recipientAddress)) {
      throw new Error(`Invalid address for ${request.destinationChain}: ${request.recipientAddress}`);
    }
  }
}
