import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import type { ChainWallet, BurnParams } from "../hooks/useWallet";

const CURRENCY_CODE = "7445555243560000000000000000000000000000";

const XrplWalletContext = createContext<ChainWallet | null>(null);

export function XrplWalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [activeWallet, setActiveWallet] = useState<"crossmark" | "gemwallet" | null>(null);

  const connect = useCallback(async (walletId?: string) => {
    if (walletId === "crossmark") {
      const sdk = (await import("@crossmarkio/sdk")).default;
      const addr = await sdk.methods.getAddress();
      if (!addr) throw new Error("Crossmark: failed to get address. Is the extension installed and unlocked?");
      setAddress(addr);
      setConnected(true);
      setActiveWallet("crossmark");
      return;
    }

    if (walletId === "gemwallet") {
      const { isInstalled, getAddress } = await import("@gemwallet/api");
      const installCheck = await isInstalled();
      if (!installCheck.result.isInstalled) {
        throw new Error("GemWallet extension not found. Please install it.");
      }
      const addrRes = await getAddress();
      if (addrRes.type === "reject" || !addrRes.result?.address) {
        throw new Error("GemWallet: address request rejected.");
      }
      setAddress(addrRes.result.address);
      setConnected(true);
      setActiveWallet("gemwallet");
      return;
    }

    throw new Error("Please select Crossmark or GemWallet.");
  }, []);

  const disconnect = useCallback(async () => {
    setAddress(null);
    setConnected(false);
    setActiveWallet(null);
  }, []);

  const signBurn = useCallback(
    async (params: BurnParams): Promise<string> => {
      if (!address) throw new Error("XRPL wallet not connected");

      const payment = {
        TransactionType: "Payment" as const,
        Account: address,
        Destination: params.tokenAddress,
        Amount: {
          currency: CURRENCY_CODE,
          issuer: params.tokenAddress,
          value: params.amount,
        },
      };

      if (activeWallet === "crossmark") {
        const sdk = (await import("@crossmarkio/sdk")).default;
        const res = await sdk.async.signAndSubmitAndWait(payment);
        const txResp = res.response.data.resp;
        const hash = (txResp as unknown as { result?: { hash?: string } }).result?.hash
          ?? (txResp as unknown as { hash?: string }).hash
          ?? "";
        if (!hash) throw new Error("Crossmark: no transaction hash in response");
        return hash;
      }

      if (activeWallet === "gemwallet") {
        const { submitTransaction } = await import("@gemwallet/api");
        const res = await submitTransaction({ transaction: payment });
        if (res.type === "reject" || !res.result?.hash) {
          throw new Error("GemWallet: transaction rejected.");
        }
        return res.result.hash;
      }

      throw new Error("No XRPL wallet available for signing");
    },
    [address, activeWallet]
  );

  return (
    <XrplWalletContext.Provider value={{ address, connected, connect, disconnect, signBurn }}>
      {children}
    </XrplWalletContext.Provider>
  );
}

export function useXrplWalletContext(): ChainWallet {
  const ctx = useContext(XrplWalletContext);
  if (!ctx) throw new Error("useXrplWalletContext must be used within XrplWalletProvider");
  return ctx;
}
