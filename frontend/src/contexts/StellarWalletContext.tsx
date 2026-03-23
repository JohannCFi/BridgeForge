import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import {
  isConnected as freighterIsConnected,
  getAddress as freighterGetAddress,
  signTransaction as freighterSignTransaction,
  requestAccess as freighterRequestAccess,
  isAllowed as freighterIsAllowed,
} from "@stellar/freighter-api";
import type { ChainWallet, BurnParams } from "../hooks/useWallet";
import { STELLAR_ASSET_CODES } from "../config/chains";

const DEFAULT_ASSET_CODE = "tEURCV";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const HORIZON_URL = "https://horizon-testnet.stellar.org";

const StellarWalletContext = createContext<ChainWallet | null>(null);

export function StellarWalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const connect = useCallback(async () => {
    const connResult = await freighterIsConnected();
    if (!connResult.isConnected) {
      throw new Error("Freighter wallet not found. Please install the Freighter extension.");
    }

    const allowedResult = await freighterIsAllowed();
    if (!allowedResult.isAllowed) {
      const accessResult = await freighterRequestAccess();
      if (accessResult.error) {
        throw new Error(`Freighter access denied: ${accessResult.error}`);
      }
      setAddress(accessResult.address);
      setConnected(true);
      return;
    }

    const addrResult = await freighterGetAddress();
    if (addrResult.error) {
      throw new Error(`Freighter error: ${addrResult.error}`);
    }
    setAddress(addrResult.address);
    setConnected(true);
  }, []);

  const disconnect = useCallback(async () => {
    setAddress(null);
    setConnected(false);
  }, []);

  const signBurn = useCallback(
    async (params: BurnParams): Promise<string> => {
      if (!address) throw new Error("Stellar wallet not connected");

      const issuerPublicKey = params.tokenAddress;

      const accountRes = await fetch(`${HORIZON_URL}/accounts/${address}`);
      if (!accountRes.ok) throw new Error("Failed to load Stellar account");
      const accountData = await accountRes.json();
      const sequence = accountData.sequence;

      const StellarSdk = await import("@stellar/stellar-sdk");
      const account = new StellarSdk.Account(address, sequence);
      const assetCode = STELLAR_ASSET_CODES[params.token || ""] || params.token || DEFAULT_ASSET_CODE;
      const asset = new StellarSdk.Asset(assetCode, issuerPublicKey);

      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: issuerPublicKey,
            asset,
            amount: params.amount,
          })
        )
        .setTimeout(30)
        .build();

      const xdr = transaction.toXDR();

      const signResult = await freighterSignTransaction(xdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
      });

      if (signResult.error) {
        throw new Error(`Freighter signing error: ${signResult.error}`);
      }

      const signedTx = StellarSdk.TransactionBuilder.fromXDR(
        signResult.signedTxXdr,
        NETWORK_PASSPHRASE
      );

      const server = new StellarSdk.Horizon.Server(HORIZON_URL);
      const result = await server.submitTransaction(signedTx as InstanceType<typeof StellarSdk.Transaction>);
      return result.hash;
    },
    [address]
  );

  return (
    <StellarWalletContext.Provider value={{ address, connected, connect, disconnect, signBurn }}>
      {children}
    </StellarWalletContext.Provider>
  );
}

export function useStellarWalletContext(): ChainWallet {
  const ctx = useContext(StellarWalletContext);
  if (!ctx) throw new Error("useStellarWalletContext must be used within StellarWalletProvider");
  return ctx;
}
