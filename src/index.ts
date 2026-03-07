// ============================================================
// BridgeForge – Entry Point
// Starts the Express server and initializes the bridge engine.
// ============================================================

import "dotenv/config";
import express from "express";
import cors from "cors";
import { createAdapters } from "./chains";
import { AttestationService } from "./services/attestation";
import { BridgeEngine } from "./core/bridge";
import { createRouter } from "./api/routes";
import { serverConfig } from "./config";

async function main() {
  console.log("=== BridgeForge – testEURCV Cross-Chain Bridge ===\n");

  // 1. Initialize chain adapters
  console.log("Initializing chain adapters...");
  const adapters = createAdapters();

  // 2. Initialize attestation service
  const attestationService = new AttestationService();

  // 3. Initialize bridge engine
  const bridge = new BridgeEngine(adapters, attestationService);

  // 4. Start listening for burn events
  bridge.startListening();

  // 5. Start Express server
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/api", createRouter(bridge));

  app.listen(serverConfig.port, serverConfig.host, () => {
    console.log(`\n[Server] Running on http://${serverConfig.host}:${serverConfig.port}`);
    console.log("[Server] Endpoints:");
    console.log("  POST /api/transfer       – Initiate a cross-chain transfer");
    console.log("  GET  /api/transfer/:id   – Check transfer status");
    console.log("  GET  /api/transfers      – List all transfers");
    console.log("  GET  /api/chains         – List supported chains");
    console.log("  GET  /api/health         – Health check");
  });
}

main().catch(console.error);
