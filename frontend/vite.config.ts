import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    nodePolyfills({ include: ["buffer", "crypto"], globals: { Buffer: true } }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:3000",
    },
  },
  build: {
    // Increase memory headroom for Render free tier
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          ethers: ["ethers"],
          solana: ["@solana/web3.js", "@solana/spl-token"],
          wagmi: ["wagmi", "viem", "@rainbow-me/rainbowkit"],
          three: ["three", "@react-three/fiber", "@react-three/drei"],
        },
      },
    },
  },
});
