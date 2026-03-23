// ============================================================
// BridgeForge – Entry Point
// Starts the Express server with PostgreSQL, Bull, and new services.
// ============================================================

import "dotenv/config";
import express from "express";
import cors from "cors";

import { createAdapters } from "./chains/index.js";
import { AttestationService } from "./services/attestation.js";
import { TransferService } from "./services/transfer.js";
import { MintQueue } from "./services/mint-queue.js";
import { ChainStatusService } from "./services/chain-status.js";
import { createRouter } from "./api/routes.js";
import { serverConfig, operatorKeys } from "./config/index.js";
import prisma from "./db/client.js";
import { createLogger } from "./utils/logger.js";

const log = createLogger("Server");

/** Validate critical environment variables on startup */
function validateEnv(): void {
  const required: Record<string, string | undefined> = {
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    ATTESTATION_PRIVATE_KEY: process.env.ATTESTATION_PRIVATE_KEY,
    ETHEREUM_RPC_URL: process.env.ETHEREUM_RPC_URL,
    ETHEREUM_TOKEN_ADDRESS: process.env.ETHEREUM_TOKEN_ADDRESS,
    ETHEREUM_PRIVATE_KEY: process.env.ETHEREUM_PRIVATE_KEY,
  };

  const optional: Record<string, string | undefined> = {
    SOLANA_TOKEN_ADDRESS: process.env.SOLANA_TOKEN_ADDRESS,
    SOLANA_PRIVATE_KEY: process.env.SOLANA_PRIVATE_KEY,
    XRPL_ISSUER_ADDRESS: process.env.XRPL_ISSUER_ADDRESS,
    XRPL_PRIVATE_KEY: process.env.XRPL_PRIVATE_KEY,
    STELLAR_ISSUER_ADDRESS: process.env.STELLAR_ISSUER_ADDRESS,
    STELLAR_PRIVATE_KEY: process.env.STELLAR_PRIVATE_KEY,
  };

  const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    log.error("Missing required env vars", { vars: missing });
    process.exit(1);
  }

  const missingOptional = Object.entries(optional).filter(([, v]) => !v).map(([k]) => k);
  if (missingOptional.length > 0) {
    log.warn("Missing optional env vars (some chains may be disabled)", { vars: missingOptional });
  }
}

async function main() {
  log.info("=== BridgeForge – EURCV Cross-Chain Bridge ===");

  // 0. Validate environment
  validateEnv();

  // 1. Initialize chain adapters
  log.info("Initializing chain adapters...");
  const adapters = createAdapters();

  // 2. Initialize attestation service (ECDSA)
  const attestationService = new AttestationService(operatorKeys.attestation);
  log.info("Attestation service ready", { attester: attestationService.getAttesterAddress() });

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
    transferService.expireStaleTransfers().catch((e) => log.error("Expiry cron failed", { error: String(e) }));
  }, 5 * 60 * 1000);

  // 7. Start Express server
  const app = express();

  // CORS: only allow frontend origins
  const allowedOrigins = [
    "https://bridgeforge-1.onrender.com",
    "http://localhost:5173",
    "http://localhost:4173",
  ];
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, curl, health checks)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked: ${origin}`));
      }
    },
  }));

  // Limit JSON body size to 10kb
  app.use(express.json({ limit: "10kb" }));
  app.use("/api", createRouter(transferService, chainStatusService, adapters));

  // Health check root (frontend is deployed separately)
  app.get("/", (_req, res) => {
    res.json({ status: "ok", service: "bridgeforge-api" });
  });

  const server = app.listen(serverConfig.port, serverConfig.host, () => {
    log.info("Server started", { host: serverConfig.host, port: serverConfig.port });
  });

  // Graceful shutdown
  async function shutdown() {
    log.info("Shutting down...");
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

main().catch((e) => {
  log.error("Fatal startup error", { error: String(e) });
  process.exit(1);
});
