import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "BridgeForge",
  projectId: "bridgeforge-demo", // WalletConnect project ID (placeholder for POC)
  chains: [sepolia],
});
