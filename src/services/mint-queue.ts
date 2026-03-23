import Bull from "bull";
import prisma from "../db/client.js";
import { Chain, Token, ChainAdapter } from "../types/index.js";
import { getTokenContext } from "../config/index.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("MintQueue");

const MINT_ATTEMPTS = 10;
const REFUND_ATTEMPTS = 5;
const REFUND_DELAY_MS = 10_000;

export class MintQueue {
  private queue: Bull.Queue;
  private refundQueue: Bull.Queue;

  constructor(
    redisUrl: string,
    private adapters: Record<Chain, ChainAdapter>,
  ) {
    // Main mint queue with exponential backoff
    this.queue = new Bull("mint-execution", redisUrl, {
      defaultJobOptions: {
        attempts: MINT_ATTEMPTS,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });

    // Separate refund queue with its own retry logic
    this.refundQueue = new Bull("refund-execution", redisUrl, {
      defaultJobOptions: {
        attempts: REFUND_ATTEMPTS,
        backoff: { type: "exponential", delay: REFUND_DELAY_MS },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });

    this.queue.process(async (job) => {
      await this.processMint(job.data.transferId);
    });

    this.queue.on("failed", async (job, err) => {
      log.error("Mint attempt failed", { transferId: job.data.transferId, attempt: job.attemptsMade, maxAttempts: MINT_ATTEMPTS, error: err.message });
      if (job.attemptsMade >= (job.opts.attempts || MINT_ATTEMPTS)) {
        log.warn("All mint attempts exhausted, initiating refund", { transferId: job.data.transferId });
        await this.enqueueRefund(job.data.transferId);
      }
    });

    this.refundQueue.process(async (job) => {
      await this.processRefund(job.data.transferId);
    });

    this.refundQueue.on("failed", async (job, err) => {
      log.error("Refund attempt failed", { transferId: job.data.transferId, attempt: job.attemptsMade, maxAttempts: REFUND_ATTEMPTS, error: err.message });
      if (job.attemptsMade >= (job.opts.attempts || REFUND_ATTEMPTS)) {
        log.error("CRITICAL: All refund attempts exhausted — manual intervention required", { transferId: job.data.transferId });
        await prisma.transfer.update({
          where: { id: job.data.transferId },
          data: {
            status: "refund_failed",
            errorLog: `All ${REFUND_ATTEMPTS} refund attempts failed. Last error: ${err.message}. Manual intervention required.`,
          },
        });
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

  private async enqueueRefund(transferId: string): Promise<void> {
    await prisma.transfer.update({
      where: { id: transferId },
      data: { status: "mint_failed" },
    });
    await this.refundQueue.add({ transferId });
  }

  private async processMint(transferId: string): Promise<void> {
    const transfer = await prisma.transfer.findUniqueOrThrow({
      where: { id: transferId },
    });

    // Guard: only mint if still in "minting" status (prevents double-mint)
    if (transfer.status !== "minting") {
      log.warn("Skipping mint: unexpected status", { transferId, status: transfer.status });
      return;
    }

    const adapter = this.adapters[transfer.destChain as Chain];
    const token = (transfer.token || "tEURCV") as Token;
    const tokenCtx = getTokenContext(token, transfer.destChain as Chain);
    const result = await adapter.executeMint(transfer.destAddress, transfer.amount.toString(), tokenCtx);

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

  private async processRefund(transferId: string): Promise<void> {
    const transfer = await prisma.transfer.findUniqueOrThrow({
      where: { id: transferId },
    });

    await prisma.transfer.update({
      where: { id: transferId },
      data: { status: "refunding" },
    });

    const sourceAdapter = this.adapters[transfer.sourceChain as Chain];
    const refundToken = (transfer.token || "tEURCV") as Token;
    const refundTokenCtx = getTokenContext(refundToken, transfer.sourceChain as Chain);
    const result = await sourceAdapter.refund(
      transfer.sourceAddress,
      transfer.amount.toString(),
      refundTokenCtx,
    );

    if (!result.success) {
      throw new Error(`Refund tx failed for transfer ${transferId}`);
    }

    await prisma.transfer.update({
      where: { id: transferId },
      data: {
        status: "refunded",
        refundTxHash: result.txHash,
        refundAt: new Date(),
      },
    });

    log.info("Refund successful", { transferId, txHash: result.txHash });
  }

  async close(): Promise<void> {
    await this.queue.close();
    await this.refundQueue.close();
  }
}
