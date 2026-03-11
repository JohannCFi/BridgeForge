import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "BridgeForge",
  projectId: "430458bbb0ea2f0289cf29d9f2a20838",
  chains: [sepolia],
});
