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

/** All available tokens.
 * tEURCV / tUSDCV are testnet versions. EURCV / USDCV are production SG Forge tokens.
 * Tokens without configured contract addresses on a chain will show balance "0"
 * and the faucet will indicate they are not yet deployed.
 */
export const TOKENS: TokenMeta[] = [
  {
    id: "tEURCV",
    name: "EUR CoinVertible (test)",
    symbol: "tEURCV",
    fiatSymbol: "€",
    fiatValue: "1.00",
    color: "#3B82F6",
    icon: "/icons/EURCV.png",
  },
  {
    id: "tUSDCV",
    name: "USD CoinVertible (test)",
    symbol: "tUSDCV",
    fiatSymbol: "$",
    fiatValue: "1.00",
    color: "#10B981",
    icon: "/icons/USDCV.png",
  },
  {
    id: "EURCV",
    name: "EUR CoinVertible",
    symbol: "EURCV",
    fiatSymbol: "€",
    fiatValue: "1.00",
    color: "#2563EB",
    icon: "/icons/EURCV.png",
  },
  {
    id: "USDCV",
    name: "USD CoinVertible",
    symbol: "USDCV",
    fiatSymbol: "$",
    fiatValue: "1.00",
    color: "#059669",
    icon: "/icons/USDCV.png",
  },
];

export function getToken(id: Token): TokenMeta {
  return TOKENS.find((t) => t.id === id) ?? TOKENS[0];
}
