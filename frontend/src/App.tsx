import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Sidebar } from "./components/layout/Sidebar";
import { BeamsBackground } from "./components/layout/BeamsBackground";
import { BridgePanel } from "./components/bridge/BridgePanel";
import { AssetsPanel } from "./components/assets/AssetsPanel";
import { TransactionsPanel } from "./components/transactions/TransactionsPanel";

type Tab = "assets" | "bridge" | "transactions";

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("bridge");

  return (
    <div className="min-h-screen bg-black text-white">
      <BeamsBackground />
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Top bar with Connect Wallet */}
      <header className="fixed top-0 right-0 left-60 h-14 flex items-center justify-end px-6 z-40">
        <ConnectButton.Custom>
          {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
            const connected = mounted && account && chain;
            return (
              <div className={`flex items-center gap-2 ${!mounted ? "opacity-0 pointer-events-none" : ""}`}>
                {connected ? (
                  <>
                    <button
                      onClick={openChainModal}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800/80 border border-white/[0.08] hover:bg-zinc-700 transition-colors text-xs text-zinc-300 cursor-pointer"
                    >
                      {chain.hasIcon && chain.iconUrl && (
                        <img src={chain.iconUrl} alt={chain.name ?? ""} className="w-4 h-4 rounded-full" />
                      )}
                      {chain.name}
                    </button>
                    <button
                      onClick={openAccountModal}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/80 border border-white/[0.08] hover:bg-zinc-700 transition-colors text-xs text-zinc-300 font-mono cursor-pointer"
                    >
                      {account.displayName}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={openConnectModal}
                    className="px-4 py-1.5 rounded-lg bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors cursor-pointer"
                  >
                    Connect Wallet
                  </button>
                )}
              </div>
            );
          }}
        </ConnectButton.Custom>
      </header>

      {/* Main content */}
      <main className="ml-60 min-h-screen flex items-start justify-center pt-20 px-8 relative z-10">
        {activeTab === "assets" && <AssetsPanel />}
        {activeTab === "bridge" && <BridgePanel />}
        {activeTab === "transactions" && <TransactionsPanel />}
      </main>
    </div>
  );
}

export default App;
