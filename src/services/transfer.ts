import prisma from "../db/client.js";
import { Chain, DOMAIN_IDS, BridgeMessage, ChainAdapter } from "../types/index.js";
import { AttestationService } from "./attestation.js";
import { Decimal } from "@prisma/client/runtime/library";
import { ethers } from "ethers";

export class TransferService {
  constructor(
    private adapters: Record<Chain, ChainAdapter>,
    private attestation: AttestationService,
    private enqueueMint: (transferId: string) => Promise<void>,
  ) {}

  async createTransfer(params: {
    sourceChain: Chain;
    destChain: Chain;
    sourceAddress: string;
    destAddress: string;
    amount: string;
  }) {
    // Pre-checks
    const sourceAdapter = this.adapters[params.sourceChain];
    const destAdapter = this.adapters[params.destChain];

    const sourceHealthy = await sourceAdapter.isHealthy();
    const destHealthy = await destAdapter.isHealthy();

    if (!sourceHealthy || !destHealthy) {
      return prisma.transfer.create({
        data: {
          ...this.mapParams(params),
          status: "rejected",
          errorLog: `Chain unavailable: ${!sourceHealthy ? params.sourceChain : params.destChain}`,
        },
      });
    }

    // Check trustline for XRPL/Stellar destinations
    if (destAdapter.hasTrustline) {
      const hasTrust = await destAdapter.hasTrustline(params.destAddress);
      if (!hasTrust) {
        return prisma.transfer.create({
          data: {
            ...this.mapParams(params),
            status: "rejected",
            errorLog: "Recipient has no trustline for EURCV on destination chain",
          },
        });
      }
    }

    return prisma.transfer.create({
      data: { ...this.mapParams(params), status: "ready" },
    });
  }

  async confirmBurn(transferId: string, burnTxHash: string) {
    const transfer = await prisma.transfer.findUniqueOrThrow({
      where: { id: transferId },
    });

    if (transfer.status !== "ready") {
      throw new Error(`Transfer ${transferId} is in status ${transfer.status}, expected ready`);
    }

    // Verify burn on source chain
    const adapter = this.adapters[transfer.sourceChain as Chain];
    const proof = await adapter.verifyBurn(burnTxHash);

    if (!proof.valid) {
      throw new Error("Burn verification failed");
    }

    if (parseFloat(proof.amount) !== parseFloat(transfer.amount.toString())) {
      throw new Error(`Amount mismatch: expected ${transfer.amount}, got ${proof.amount}`);
    }

    // Update to burn_confirmed
    await prisma.transfer.update({
      where: { id: transferId },
      data: {
        status: "burn_confirmed",
        burnTxHash,
        burnConfirmedAt: new Date(),
      },
    });

    // Create attestation
    // For ETH source: transferId comes from BurnForBridge event (keccak256(domain, nonce))
    // For XRPL/Stellar source: transferId = keccak256(domain, UUID) — backend generates
    const onChainTransferId = proof.transferId || ethers.keccak256(
      ethers.solidityPacked(["uint32", "string"], [DOMAIN_IDS[transfer.sourceChain as Chain], transferId])
    );

    // Encode addresses to bytes32: ETH addresses pad directly, XRPL/Stellar addresses hash
    const senderBytes32 = this.addressToBytes32(transfer.sourceAddress, transfer.sourceChain as Chain);
    const recipientBytes32 = this.addressToBytes32(transfer.destAddress, transfer.destChain as Chain);

    const message: BridgeMessage = {
      version: 1,
      transferId: onChainTransferId,
      sourceDomain: DOMAIN_IDS[transfer.sourceChain as Chain],
      destDomain: DOMAIN_IDS[transfer.destChain as Chain],
      sender: senderBytes32,
      recipient: recipientBytes32,
      amount: transfer.amount.toString(),
      burnTxHash: ethers.zeroPadValue(burnTxHash.startsWith("0x") ? burnTxHash : `0x${burnTxHash}`, 32),
    };

    const signature = await this.attestation.signMessage(message);
    const messageHash = this.attestation.computeMessageHash(message);

    await prisma.transfer.update({
      where: { id: transferId },
      data: {
        status: "attested",
        attestation: Buffer.from(signature),
        messageHash,
      },
    });

    // Enqueue mint job
    await this.enqueueMint(transferId);

    return prisma.transfer.findUniqueOrThrow({ where: { id: transferId } });
  }

  async getTransfer(id: string) {
    return prisma.transfer.findUnique({ where: { id } });
  }

  async getTransfers(filters?: { address?: string; chain?: string }) {
    const where: any = {};
    if (filters?.address) {
      where.OR = [
        { sourceAddress: filters.address },
        { destAddress: filters.address },
      ];
      if (filters?.chain) {
        where.OR = [
          { sourceAddress: filters.address, sourceChain: filters.chain },
          { destAddress: filters.address, destChain: filters.chain },
        ];
      }
    }
    return prisma.transfer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async expireStaleTransfers() {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    await prisma.transfer.updateMany({
      where: {
        status: "ready",
        createdAt: { lt: thirtyMinutesAgo },
      },
      data: { status: "expired" },
    });
  }

  /** Convert any chain address to a 32-byte representation.
   *  ETH: zero-pad the 20-byte address to 32 bytes.
   *  XRPL/Stellar: keccak256 hash of the address string (not reversible, used only for attestation). */
  private addressToBytes32(address: string, chain: Chain): string {
    if (chain === "ethereum") {
      return ethers.zeroPadValue(address, 32);
    }
    // For non-EVM chains, hash the address to get a deterministic bytes32
    return ethers.keccak256(ethers.toUtf8Bytes(address));
  }

  private mapParams(params: {
    sourceChain: string; destChain: string;
    sourceAddress: string; destAddress: string; amount: string;
  }) {
    return {
      sourceChain: params.sourceChain,
      destChain: params.destChain,
      sourceAddress: params.sourceAddress,
      destAddress: params.destAddress,
      amount: new Decimal(params.amount),
    };
  }
}
