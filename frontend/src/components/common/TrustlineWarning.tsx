import type { Chain } from "../../types";

interface Props {
  chain: Chain;
  errorMessage?: string;
}

export function TrustlineWarning({ chain, errorMessage }: Props) {
  if (!errorMessage?.toLowerCase().includes("trustline")) return null;

  const instructions: Record<string, string> = {
    xrpl: "Open your XRPL wallet and create a trustline for tEURCV to the issuer address before bridging.",
    stellar: "Open your Stellar wallet and add the tEURCV asset from the issuer address before bridging.",
  };

  return (
    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
      <div className="flex items-start gap-2">
        <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.834-1.964-.834-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <div>
          <p className="text-amber-300 text-sm font-medium">Trustline Required</p>
          <p className="text-amber-200/70 text-xs mt-1">
            {instructions[chain] || `A trustline for tEURCV is required on ${chain}.`}
          </p>
        </div>
      </div>
    </div>
  );
}
