import { StrictMode, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// RainbowKit provider kept for potential future use but connect flow is handled by our WalletModal
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletConnectWalletAdapter } from "@walletconnect/solana-adapter";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import "@rainbow-me/rainbowkit/styles.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./index.css";
import App from "./App";
import { wagmiConfig } from "./config/wagmi";

const queryClient = new QueryClient();
const SOLANA_RPC = "https://api.devnet.solana.com";

function Providers({ children }: { children: React.ReactNode }) {
  // Phantom & Solflare auto-register via wallet-standard — no explicit adapter needed.
  // Only WalletConnect needs a manual adapter since it doesn't auto-register.
  const solanaWallets = useMemo(
    () => [
      new WalletConnectWalletAdapter({
        network: WalletAdapterNetwork.Devnet,
        options: {
          projectId: "430458bbb0ea2f0289cf29d9f2a20838",
        },
      }),
    ],
    []
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#fff",
            accentColorForeground: "#000",
            borderRadius: "large",
            overlayBlur: "small",
          })}
        >
          <ConnectionProvider endpoint={SOLANA_RPC}>
            <SolanaWalletProvider wallets={solanaWallets} autoConnect>
              {children}
            </SolanaWalletProvider>
          </ConnectionProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>
);
