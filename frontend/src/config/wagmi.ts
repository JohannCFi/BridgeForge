import { createConfig, http, createStorage } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [
    injected({ shimDisconnect: true }),
    walletConnect({
      projectId: "430458bbb0ea2f0289cf29d9f2a20838",
      showQrModal: true,
    }),
  ],
  storage: createStorage({ storage: sessionStorage }),
  transports: {
    [sepolia.id]: http(import.meta.env.VITE_ALCHEMY_SEPOLIA_URL),
  },
});
