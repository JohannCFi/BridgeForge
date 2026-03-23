import { z } from "zod";

const chains = ["ethereum", "solana", "xrpl", "stellar"] as const;
const tokens = ["tEURCV", "tUSDCV", "EURCV", "USDCV"] as const;

export const createTransferSchema = z.object({
  sourceChain: z.enum(chains),
  destChain: z.enum(chains),
  sourceAddress: z.string().min(1),
  destAddress: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d{1,6})?$/, "Invalid amount format"),
  token: z.enum(tokens).default("tEURCV"),
}).refine(data => data.sourceChain !== data.destChain, {
  message: "Source and destination chains must be different",
});

export const confirmBurnSchema = z.object({
  burnTxHash: z.string().min(1),
});

export const transfersQuerySchema = z.object({
  address: z.string().min(1).optional(),
  chain: z.enum(chains).optional(),
  token: z.enum(tokens).optional(),
});

export const faucetSchema = z.object({
  chain: z.enum(chains),
  address: z.string().min(1),
  token: z.enum(tokens).default("tEURCV"),
});

export const balanceQuerySchema = z.object({
  token: z.enum(tokens).default("tEURCV"),
});

export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type ConfirmBurnInput = z.infer<typeof confirmBurnSchema>;
