// ============================================================
// BridgeForge – Entry Point
// Starts the Express server with PostgreSQL, Bull, and new services.
// ============================================================

import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createAdapters } from "./chains/index.js";
import { AttestationService } from "./services/attestation.js";
import { TransferService } from "./services/transfer.js";
import { MintQueue } from "./services/mint-queue.js";
import { ChainStatusService } from "./services/chain-status.js";
import { createRouter } from "./api/routes.js";
import { serverConfig, operatorKeys } from "./config/index.js";
import prisma from "./db/client.js";

async function main() {
  console.log("=== BridgeForge – EURCV Cross-Chain Bridge ===\n");

  // 1. Initialize chain adapters
  console.log("Initializing chain adapters...");
  const adapters = createAdapters();

  // 2. Initialize attestation service (ECDSA)
  const attestationService = new AttestationService(operatorKeys.attestation);
  console.log(`[Attestation] Attester address: ${attestationService.getAttesterAddress()}`);

  // 3. Initialize Redis/Bull mint queue
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  const mintQueue = new MintQueue(redisUrl, adapters);

  // 4. Initialize transfer service
  const transferService = new TransferService(
    adapters,
    attestationService,
    (transferId) => mintQueue.enqueue(transferId),
  );

  // 5. Initialize chain status service and start polling
  const chainStatusService = new ChainStatusService(adapters);
  await chainStatusService.start();

  // 6. Set up expiry cron (every 5 minutes)
  const expiryInterval = setInterval(() => {
    transferService.expireStaleTransfers().catch(console.error);
  }, 5 * 60 * 1000);

  // 7. Start Express server
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/api", createRouter(transferService, chainStatusService, adapters));

  // Serve frontend static files in production
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const frontendDist = path.join(__dirname, "..", "frontend", "dist");
  app.use(express.static(frontendDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });

  const server = app.listen(serverConfig.port, serverConfig.host, () => {
    console.log(`\n[Server] Running on http://${serverConfig.host}:${serverConfig.port}`);
    console.log("[Server] API v1 endpoints:");
    console.log("  POST /api/v1/transfer              – Register transfer intent");
    console.log("  POST /api/v1/transfer/:id/confirm-burn – Confirm burn & start mint");
    console.log("  GET  /api/v1/transfer/:id           – Check transfer status");
    console.log("  GET  /api/v1/transfers              – List transfers");
    console.log("  GET  /api/v1/health                 – Chain health status");
    console.log("  GET  /api/v1/balance/:chain/:addr   – Get balance");
    console.log("  GET  /api/v1/config                 – Token addresses");
    console.log("  POST /api/v1/faucet                 – Mint test tokens");
  });

  // Graceful shutdown
  async function shutdown() {
    console.log("\n[Server] Shutting down...");
    clearInterval(expiryInterval);
    chainStatusService.stop();
    await mintQueue.close();
    await prisma.$disconnect();
    server.close();
    process.exit(0);
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch(console.error);
