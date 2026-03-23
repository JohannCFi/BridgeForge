import type { Token } from "../types";

export interface TokenMeta {
  id: Token;
  name: string;
  symbol: string;
  fiatSymbol: string;
  fiatValue: string;
  color: string;
  icon: string;
}

export const TOKENS: TokenMeta[] = [
  {
    id: "EURCV",
    name: "EUR CoinVertible",
    symbol: "EURCV",
    fiatSymbol: "€",
    fiatValue: "1.00",
    color: "#3B82F6",
    icon: "/icons/EURCV.png",
  },
  {
    id: "USDCV",
    name: "USD CoinVertible",
    symbol: "USDCV",
    fiatSymbol: "$",
    fiatValue: "1.00",
    color: "#10B981",
    icon: "/icons/USDCV.png",
  },
];

export function getToken(id: Token): TokenMeta {
  return TOKENS.find((t) => t.id === id) ?? TOKENS[0];
}
