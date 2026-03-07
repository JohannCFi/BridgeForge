// ============================================================
// BridgeForge – API Routes
// REST API that abstracts blockchain complexity for clients.
// Clients interact with simple endpoints, never with chains directly.
// ============================================================

import { Router, Request, Response } from "express";
import { BridgeEngine } from "../core/bridge";
import { TransferRequest, ApiResponse, Chain } from "../types";

export function createRouter(bridge: BridgeEngine): Router {
  const router = Router();

  /**
   * POST /api/transfer
   * Initiate a cross-chain transfer.
   *
   * The client just says: "move X tokens from chain A to chain B"
   * The bridge handles everything: burn, attestation, mint.
   *
   * Body: { sourceChain, destinationChain, senderAddress, recipientAddress, amount }
   */
  router.post("/transfer", async (req: Request, res: Response) => {
    try {
      const request: TransferRequest = {
        sourceChain: req.body.sourceChain,
        destinationChain: req.body.destinationChain,
        senderAddress: req.body.senderAddress,
        recipientAddress: req.body.recipientAddress,
        amount: req.body.amount,
        token: "testEURCV",
      };

      const transfer = await bridge.initiateTransfer(request);

      const response: ApiResponse = {
        success: true,
        data: transfer,
      };
      res.status(201).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
      res.status(400).json(response);
    }
  });

  /**
   * GET /api/transfer/:id
   * Check the status of a transfer.
   * Clients can poll this to track progress.
   */
  router.get("/transfer/:id", (req: Request, res: Response) => {
    const transfer = bridge.getTransfer(req.params.id);

    if (!transfer) {
      const response: ApiResponse = { success: false, error: "Transfer not found" };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse = { success: true, data: transfer };
    res.json(response);
  });

  /**
   * GET /api/transfers
   * List all transfers (for admin/debug).
   */
  router.get("/transfers", (_req: Request, res: Response) => {
    const transfers = bridge.getAllTransfers();
    const response: ApiResponse = { success: true, data: transfers };
    res.json(response);
  });

  /**
   * GET /api/chains
   * List supported chains. Useful for the frontend to build dropdowns.
   */
  router.get("/chains", (_req: Request, res: Response) => {
    const chains: Chain[] = ["ethereum", "solana", "xrpl", "stellar"];
    const response: ApiResponse = { success: true, data: chains };
    res.json(response);
  });

  /**
   * GET /api/health
   * Health check.
   */
  router.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  return router;
}
