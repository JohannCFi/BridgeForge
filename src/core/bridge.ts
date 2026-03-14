// ============================================================
// BridgeForge – Bridge Engine
// Orchestrates the full burn → attest → mint flow.
//
// New flow (v2): user-initiated burns
// 1. Frontend registers a transfer intent (pending)
// 2. User signs the burn tx via their own wallet
// 3. Frontend confirms the burn with the tx hash
// 4. Backend verifies the burn, creates attestation, mints
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
import { chainConfigs } from "../config";

/** Max retries for mint on destination chain */
const MINT_MAX_RETRIES = 3;
const MINT_RETRY_DELAY_MS = 5_000;

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
   * For Ethereum, BridgeBurn events contain destination info,
   * so we can auto-process them. For other chains, we log
   * the event (the frontend must call confirmBurn explicitly).
   */
  startListening(): void {
    for (const [chain, adapter] of Object.entries(this.adapters)) {
      adapter.listenForBurns((event: BurnEvent) => {
        console.log(`[Bridge] Burn detected on ${chain}: ${event.txHash}`);
        this.handleDetectedBurn(event);
      });
    }
    console.log("[Bridge] Listening for burns on all chains");
  }

  /**
   * Handle a burn detected by an event listener.
   * If the burn matches a pending transfer, auto-confirm it.
   * If it's an Ethereum BridgeBurn with destination info, create a new transfer.
   */
  private async handleDetectedBurn(event: BurnEvent): Promise<void> {
    // Try to match to a pending transfer by burn tx hash
    const pending = Array.from(this.transfers.values()).find(
      (t) =>
        t.status === "burning" &&
        t.sourceChain === event.chain &&
        t.burnTxHash === event.txHash
    );

    if (pending) {
      // Already registered, proceed with attestation + mint
      await this.processAttestAndMint(pending);
      return;
    }

    // For Ethereum BridgeBurn events with destination info, auto-create transfer
    if (
      event.chain === "ethereum" &&
      event.destinationChain &&
      event.recipientAddress
    ) {
      console.log(
        `[Bridge] Auto-creating transfer from Ethereum BridgeBurn event`
      );
      const transfer: Transfer = {
        id: randomUUID(),
        sourceChain: event.chain,
        destinationChain: event.destinationChain as Chain,
        senderAddress: event.sender,
        recipientAddress: event.recipientAddress,
        amount: event.amount,
        token: "testEURCV",
        status: "burned",
        burnTxHash: event.txHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.transfers.set(transfer.id, transfer);
      await this.processAttestAndMint(transfer);
    }
  }

  /**
   * Register a transfer intent. The user hasn't burned yet.
   * Returns a transfer ID that the frontend uses to confirm the burn later.
   */
  registerTransfer(request: TransferRequest): Transfer {
    this.validateRequest(request);

    const transfer: Transfer = {
      ...request,
      id: randomUUID(),
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.transfers.set(transfer.id, transfer);
    console.log(
      `[Bridge] Transfer ${transfer.id} registered: ${request.sourceChain} → ${request.destinationChain}`
    );

    return transfer;
  }

  /**
   * Confirm that the user has executed the burn.
   * Backend verifies the burn tx, creates attestation, and mints.
   */
  async confirmBurn(transferId: string, burnTxHash: string): Promise<Transfer> {
    const transfer = this.transfers.get(transferId);
    if (!transfer) {
      throw new Error("Transfer not found");
    }
    if (transfer.status !== "pending") {
      throw new Error(
        `Transfer is in '${transfer.status}' state, expected 'pending'`
      );
    }

    try {
      // 1. Update status
      transfer.status = "burning";
      transfer.burnTxHash = burnTxHash;
      transfer.updatedAt = new Date();

      // 2. Verify the burn tx on-chain
      const sourceAdapter = this.adapters[transfer.sourceChain];
      const verification = await sourceAdapter.verifyBurn(burnTxHash);

      if (!verification.confirmed) {
        throw new Error("Burn transaction not confirmed on-chain");
      }

      // 3. Verify amount matches (with tolerance for decimals)
      const expectedAmount = parseFloat(transfer.amount);
      const actualAmount = parseFloat(verification.amount);
      if (Math.abs(expectedAmount - actualAmount) > 0.000001) {
        throw new Error(
          `Burn amount mismatch: expected ${transfer.amount}, got ${verification.amount}`
        );
      }

      transfer.status = "burned";
      transfer.updatedAt = new Date();
      console.log(`[Bridge] Burn verified: ${burnTxHash}`);

      // 4. Attest + mint
      await this.processAttestAndMint(transfer);
    } catch (error) {
      transfer.status = "failed";
      transfer.updatedAt = new Date();
      console.error(`[Bridge] Transfer ${transfer.id} failed:`, error);
      throw error;
    }

    return transfer;
  }

  /**
   * Attestation + mint flow (shared between confirmBurn and auto-detect).
   * Includes retry logic for mint failures.
   */
  private async processAttestAndMint(transfer: Transfer): Promise<void> {
    // 1. Create attestation
    transfer.status = "attesting";
    transfer.updatedAt = new Date();

    const attestation = this.attestationService.createAttestation({
      transferId: transfer.id,
      sourceChain: transfer.sourceChain,
      destinationChain: transfer.destinationChain,
      amount: transfer.amount,
      recipientAddress: transfer.recipientAddress,
      burnTxHash: transfer.burnTxHash!,
    });

    transfer.attestation = attestation;
    transfer.status = "attested";
    transfer.updatedAt = new Date();

    // 2. Verify attestation
    const isValid = this.attestationService.verifyAttestation(attestation);
    if (!isValid) {
      transfer.status = "failed";
      transfer.updatedAt = new Date();
      throw new Error("Attestation verification failed");
    }

    // 3. Mint on destination with retries
    transfer.status = "minting";
    transfer.updatedAt = new Date();

    const destAdapter = this.adapters[transfer.destinationChain];
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MINT_MAX_RETRIES; attempt++) {
      try {
        const mintTxHash = await destAdapter.mint(
          transfer.recipientAddress,
          transfer.amount
        );
        transfer.status = "completed";
        transfer.mintTxHash = mintTxHash;
        transfer.updatedAt = new Date();
        console.log(
          `[Bridge] Transfer ${transfer.id} completed! Mint tx: ${mintTxHash}`
        );
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(
          `[Bridge] Mint attempt ${attempt}/${MINT_MAX_RETRIES} failed:`,
          lastError.message
        );
        if (attempt < MINT_MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, MINT_RETRY_DELAY_MS));
        }
      }
    }

    transfer.status = "failed";
    transfer.updatedAt = new Date();
    throw new Error(
      `Mint failed after ${MINT_MAX_RETRIES} attempts: ${lastError?.message}`
    );
  }

  /** Get a transfer by ID */
  getTransfer(id: string): Transfer | undefined {
    return this.transfers.get(id);
  }

  /** Get all transfers */
  getAllTransfers(): Transfer[] {
    return Array.from(this.transfers.values());
  }

  /** Get token balance for an address on a specific chain */
  async getBalance(chain: Chain, address: string): Promise<string> {
    const adapter = this.adapters[chain];
    return adapter.getBalance(address);
  }

  /** Get chain configs needed by frontend to construct burn transactions */
  getChainConfigs(): Record<Chain, { tokenAddress: string }> {
    return {
      ethereum: { tokenAddress: chainConfigs.ethereum.tokenAddress },
      solana: { tokenAddress: chainConfigs.solana.tokenAddress },
      xrpl: { tokenAddress: chainConfigs.xrpl.tokenAddress },
      stellar: { tokenAddress: chainConfigs.stellar.tokenAddress },
    };
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
      throw new Error(
        `Invalid address for ${request.destinationChain}: ${request.recipientAddress}`
      );
    }
  }
}
