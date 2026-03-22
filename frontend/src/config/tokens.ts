import type { Token } from "../types";

export interface TokenMeta {
  id: Token;
  name: string;
  symbol: string;
  fiatSymbol: string;
  fiatValue: string;
  color: string;
}

export const TOKENS: TokenMeta[] = [
  {
    id: "tEURCV",
    name: "EUR CoinVertible",
    symbol: "tEURCV",
    fiatSymbol: "€",
    fiatValue: "1.00",
    color: "#3B82F6", // blue
  },
  {
    id: "tUSDCV",
    name: "USD CoinVertible",
    symbol: "tUSDCV",
    fiatSymbol: "$",
    fiatValue: "1.00",
    color: "#10B981", // green
  },
];

export function getToken(id: Token): TokenMeta {
  return TOKENS.find((t) => t.id === id) ?? TOKENS[0];
}
