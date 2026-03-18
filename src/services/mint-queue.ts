import Bull from "bull";
import prisma from "../db/client.js";
import { Chain, ChainAdapter } from "../types/index.js";

export class MintQueue {
  private queue: Bull.Queue;

  constructor(
    redisUrl: string,
    private adapters: Record<Chain, ChainAdapter>,
  ) {
    this.queue = new Bull("mint-execution", redisUrl, {
      defaultJobOptions: {
        attempts: 10,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });

    this.queue.process(async (job) => {
      await this.processMint(job.data.transferId);
    });

    this.queue.on("failed", async (job, err) => {
      if (job.attemptsMade >= (job.opts.attempts || 10)) {
        await this.initiateRefund(job.data.transferId);
      }
    });
  }

  async enqueue(transferId: string): Promise<void> {
    await prisma.transfer.update({
      where: { id: transferId },
      data: { status: "minting" },
    });
    await this.queue.add({ transferId });
  }

  private async processMint(transferId: string): Promise<void> {
    const transfer = await prisma.transfer.findUniqueOrThrow({
      where: { id: transferId },
    });

    const adapter = this.adapters[transfer.destChain as Chain];
    const result = await adapter.executeMint(transfer.destAddress, transfer.amount.toString());

    if (!result.success) {
      await prisma.transfer.update({
        where: { id: transferId },
        data: { retryCount: { increment: 1 }, errorLog: `Mint attempt failed` },
      });
      throw new Error(`Mint failed for transfer ${transferId}`);
    }

    await prisma.transfer.update({
      where: { id: transferId },
      data: {
        status: "completed",
        mintTxHash: result.txHash,
        mintConfirmedAt: new Date(),
      },
    });

    await prisma.usedNonce.create({
      data: { transferId, chain: transfer.destChain },
    });
  }

  private async initiateRefund(transferId: string): Promise<void> {
    const transfer = await prisma.transfer.findUniqueOrThrow({
      where: { id: transferId },
    });

    await prisma.transfer.update({
      where: { id: transferId },
      data: { status: "mint_failed" },
    });

    try {
      await prisma.transfer.update({
        where: { id: transferId },
        data: { status: "refunding" },
      });

      const sourceAdapter = this.adapters[transfer.sourceChain as Chain];
      const result = await sourceAdapter.refund(
        transfer.sourceAddress,
        transfer.amount.toString(),
      );

      if (result.success) {
        await prisma.transfer.update({
          where: { id: transferId },
          data: {
            status: "refunded",
            refundTxHash: result.txHash,
            refundAt: new Date(),
          },
        });
      } else {
        throw new Error("Refund tx failed");
      }
    } catch (err) {
      await prisma.transfer.update({
        where: { id: transferId },
        data: {
          status: "refund_failed",
          errorLog: `Refund failed: ${err}`,
        },
      });
    }
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
