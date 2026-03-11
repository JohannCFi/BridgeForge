// ============================================================
// BridgeForge – API Routes
// REST API for the cross-chain bridge.
//
// v2 flow:
//   1. POST /api/transfer          → register intent (no burn yet)
//   2. (user burns via wallet)
//   3. POST /api/transfer/:id/confirm-burn → verify burn, attest, mint
// ============================================================

import { Router, Request, Response } from "express";
import { BridgeEngine } from "../core/bridge";
import { TransferRequest, ApiResponse, Chain } from "../types";

const VALID_CHAINS: Chain[] = ["ethereum", "solana", "xrpl", "stellar"];

export function createRouter(bridge: BridgeEngine): Router {
  const router = Router();

  /**
   * POST /api/transfer
   * Register a transfer intent. Returns a transfer ID.
   * The user must then execute the burn via their wallet
   * and call /confirm-burn with the tx hash.
   *
   * Body: { sourceChain, destinationChain, senderAddress, recipientAddress, amount }
   */
  router.post("/transfer", async (req: Request, res: Response) => {
    try {
      const {
        sourceChain,
        destinationChain,
        senderAddress,
        recipientAddress,
        amount,
      } = req.body;

      // Validate required fields
      const missing = [
        !sourceChain && "sourceChain",
        !destinationChain && "destinationChain",
        !senderAddress && "senderAddress",
        !recipientAddress && "recipientAddress",
        !amount && "amount",
      ].filter(Boolean);
      if (missing.length > 0) {
        res
          .status(400)
          .json({
            success: false,
            error: `Missing fields: ${missing.join(", ")}`,
          });
        return;
      }

      // Validate chains
      if (!VALID_CHAINS.includes(sourceChain)) {
        res
          .status(400)
          .json({
            success: false,
            error: `Invalid sourceChain: ${sourceChain}`,
          });
        return;
      }
      if (!VALID_CHAINS.includes(destinationChain)) {
        res
          .status(400)
          .json({
            success: false,
            error: `Invalid destinationChain: ${destinationChain}`,
          });
        return;
      }

      const request: TransferRequest = {
        sourceChain,
        destinationChain,
        senderAddress,
        recipientAddress,
        amount: String(amount),
        token: "testEURCV",
      };

      const transfer = bridge.registerTransfer(request);

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
   * POST /api/transfer/:id/confirm-burn
   * Confirm that the user has executed the burn transaction.
   * Backend verifies the burn, creates attestation, and mints on destination.
   *
   * Body: { burnTxHash }
   */
  router.post(
    "/transfer/:id/confirm-burn",
    async (req: Request, res: Response) => {
      try {
        const id = req.params.id as string;
        const { burnTxHash } = req.body;

        if (!burnTxHash) {
          res
            .status(400)
            .json({ success: false, error: "Missing burnTxHash" });
          return;
        }

        const transfer = await bridge.confirmBurn(id, burnTxHash);

        const response: ApiResponse = {
          success: true,
          data: transfer,
        };
        res.json(response);
      } catch (error) {
        const response: ApiResponse = {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
        res.status(400).json(response);
      }
    }
  );

  /**
   * GET /api/transfer/:id
   * Check the status of a transfer.
   */
  router.get("/transfer/:id", (req: Request, res: Response) => {
    const transfer = bridge.getTransfer(req.params.id as string);

    if (!transfer) {
      const response: ApiResponse = {
        success: false,
        error: "Transfer not found",
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse = { success: true, data: transfer };
    res.json(response);
  });

  /**
   * GET /api/transfers
   * List all transfers.
   */
  router.get("/transfers", (_req: Request, res: Response) => {
    const transfers = bridge.getAllTransfers();
    const response: ApiResponse = { success: true, data: transfers };
    res.json(response);
  });

  /**
   * GET /api/balance/:chain/:address
   * Get testEURCV balance for an address on a specific chain.
   */
  router.get(
    "/balance/:chain/:address",
    async (req: Request, res: Response) => {
      try {
        const chain = req.params.chain as Chain;
        const address = req.params.address as string;

        if (!VALID_CHAINS.includes(chain)) {
          res
            .status(400)
            .json({ success: false, error: `Invalid chain: ${chain}` });
          return;
        }

        const balance = await bridge.getBalance(chain, address);
        res.json({
          success: true,
          data: { chain, address, balance, token: "testEURCV" },
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  /**
   * GET /api/chains
   * List supported chains.
   */
  router.get("/chains", (_req: Request, res: Response) => {
    const chains: Chain[] = VALID_CHAINS;
    const response: ApiResponse = { success: true, data: chains };
    res.json(response);
  });

  /**
   * GET /api/config
   * Returns token addresses/issuers for each chain.
   * The frontend needs these to construct burn transactions.
   */
  router.get("/config", (_req: Request, res: Response) => {
    const config = bridge.getChainConfigs();
    res.json({ success: true, data: config });
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
