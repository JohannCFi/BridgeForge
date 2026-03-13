// ============================================================
// BridgeForge – API Routes (v1)
// REST API for the cross-chain bridge with Zod validation.
// ============================================================

import { Router, Request, Response } from "express";
import { TransferService } from "../services/transfer.js";
import { ChainStatusService } from "../services/chain-status.js";
import { Chain, ChainAdapter, ApiResponse } from "../types/index.js";
import { createTransferSchema, confirmBurnSchema, transfersQuerySchema } from "./validation.js";
import { chainConfigs } from "../config/index.js";

export function createRouter(
  transferService: TransferService,
  chainStatusService: ChainStatusService,
  adapters: Record<Chain, ChainAdapter>,
): Router {
  const router = Router();

  // === v1 routes ===

  /**
   * POST /api/v1/transfer
   * Register a transfer intent. Returns transfer in ready or rejected status.
   */
  router.post("/v1/transfer", async (req: Request, res: Response) => {
    try {
      const parsed = createTransferSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0].message });
        return;
      }

      const transfer = await transferService.createTransfer(parsed.data);
      res.status(201).json({ success: true, data: transfer } as ApiResponse);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  });

  /**
   * POST /api/v1/transfer/:id/confirm-burn
   * Confirm burn tx, verify on-chain, create attestation, enqueue mint.
   */
  router.post("/v1/transfer/:id/confirm-burn", async (req: Request, res: Response) => {
    try {
      const parsed = confirmBurnSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0].message });
        return;
      }

      const id = req.params.id as string;
      const transfer = await transferService.confirmBurn(id, parsed.data.burnTxHash);
      res.json({ success: true, data: transfer } as ApiResponse);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse);
    }
  });

  /**
   * GET /api/v1/transfer/:id
   * Check the status of a transfer.
   */
  router.get("/v1/transfer/:id", async (req: Request, res: Response) => {
    const transfer = await transferService.getTransfer(req.params.id as string);

    if (!transfer) {
      res.status(404).json({ success: false, error: "Transfer not found" } as ApiResponse);
      return;
    }

    res.json({ success: true, data: transfer } as ApiResponse);
  });

  /**
   * GET /api/v1/transfers
   * List transfers with optional filters.
   */
  router.get("/v1/transfers", async (req: Request, res: Response) => {
    const parsed = transfersQuerySchema.safeParse(req.query);
    const filters = parsed.success ? parsed.data : {};
    const transfers = await transferService.getTransfers(filters);
    res.json({ success: true, data: transfers } as ApiResponse);
  });

  /**
   * GET /api/v1/health
   * Returns chain health statuses.
   */
  router.get("/v1/health", async (_req: Request, res: Response) => {
    const status = await chainStatusService.getStatus();
    res.json({ success: true, data: status });
  });

  /**
   * GET /api/v1/balance/:chain/:address
   * Get EURCV balance for an address on a specific chain.
   */
  router.get("/v1/balance/:chain/:address", async (req: Request, res: Response) => {
    try {
      const chain = req.params.chain as Chain;
      const adapter = adapters[chain];
      if (!adapter) {
        res.status(400).json({ success: false, error: `Invalid chain: ${chain}` });
        return;
      }

      const balance = await adapter.getBalance(req.params.address as string);
      res.json({ success: true, data: { chain, address: req.params.address, balance } });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * GET /api/v1/config
   * Returns token addresses for each chain.
   */
  router.get("/v1/config", (_req: Request, res: Response) => {
    const config = Object.fromEntries(
      Object.entries(chainConfigs).map(([chain, cfg]) => [chain, { tokenAddress: cfg.tokenAddress }])
    );
    res.json({ success: true, data: config });
  });

  // === Legacy routes (redirect to v1) ===
  router.post("/transfer", (_req, res) => res.redirect(307, "/api/v1/transfer"));
  router.get("/transfers", (_req, res) => res.redirect("/api/v1/transfers"));
  router.get("/health", (_req, res) => res.redirect("/api/v1/health"));
  router.get("/config", (_req, res) => res.redirect("/api/v1/config"));

  return router;
}
