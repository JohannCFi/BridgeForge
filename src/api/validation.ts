import { z } from "zod";

const chains = ["ethereum", "solana", "xrpl", "stellar"] as const;

export const createTransferSchema = z.object({
  sourceChain: z.enum(chains),
  destChain: z.enum(chains),
  sourceAddress: z.string().min(1),
  destAddress: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d{1,6})?$/, "Invalid amount format"),
}).refine(data => data.sourceChain !== data.destChain, {
  message: "Source and destination chains must be different",
});

export const confirmBurnSchema = z.object({
  burnTxHash: z.string().min(1),
});

export const transfersQuerySchema = z.object({
  address: z.string().min(1).optional(),
  chain: z.enum(chains).optional(),
});

export const faucetSchema = z.object({
  chain: z.enum(chains),
  address: z.string().min(1),
});

export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type ConfirmBurnInput = z.infer<typeof confirmBurnSchema>;
