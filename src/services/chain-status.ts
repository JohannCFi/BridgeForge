import prisma from "../db/client.js";
import { Chain, ChainAdapter } from "../types/index.js";

export class ChainStatusService {
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(private adapters: Record<Chain, ChainAdapter>) {}

  async start(pollIntervalMs = 30_000): Promise<void> {
    // Initialize chain_status rows
    for (const chain of Object.keys(this.adapters) as Chain[]) {
      await prisma.chainStatus.upsert({
        where: { chain },
        create: { chain, isHealthy: true },
        update: {},
      });
    }

    // Poll immediately, then on interval
    await this.pollAll();
    this.interval = setInterval(() => this.pollAll(), pollIntervalMs);
  }

  stop(): void {
    if (this.interval) clearInterval(this.interval);
  }

  private async pollAll(): Promise<void> {
    for (const [chain, adapter] of Object.entries(this.adapters)) {
      try {
        const healthy = await adapter.isHealthy();
        await prisma.chainStatus.update({
          where: { chain },
          data: {
            isHealthy: healthy,
            lastCheckedAt: new Date(),
            errorMessage: healthy ? null : "Health check returned false",
          },
        });
      } catch (err) {
        await prisma.chainStatus.update({
          where: { chain },
          data: {
            isHealthy: false,
            lastCheckedAt: new Date(),
            errorMessage: `Health check error: ${err}`,
          },
        });
      }
    }
  }

  async getStatus(): Promise<Record<string, boolean>> {
    const rows = await prisma.chainStatus.findMany();
    return Object.fromEntries(rows.map((r) => [r.chain, r.isHealthy]));
  }
}
