import { useState } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { BeamsBackground } from "./components/layout/BeamsBackground";
import { BridgePanel } from "./components/bridge/BridgePanel";
import { AssetsPanel } from "./components/assets/AssetsPanel";
import { TransactionsPanel } from "./components/transactions/TransactionsPanel";
import { FaucetPanel } from "./components/faucet/FaucetPanel";
import { LandingPage } from "./components/landing/LandingPage";
import type { Token } from "./types";

type Tab = "assets" | "bridge" | "transactions" | "faucet";
type View = "landing" | "app";

function App() {
  const [view, setView] = useState<View>("landing");
  const [activeTab, setActiveTab] = useState<Tab>("bridge");
  const [selectedToken, setSelectedToken] = useState<Token>("tEURCV");

  if (view === "landing") {
    return <LandingPage onLaunchApp={() => setView("app")} />;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <BeamsBackground />
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main content */}
      <main className="ml-0 md:ml-60 min-h-screen flex items-start justify-center pt-6 md:pt-20 px-4 md:px-8 pb-20 md:pb-0 relative z-10">
        {activeTab === "assets" && <AssetsPanel />}
        {activeTab === "bridge" && <BridgePanel selectedToken={selectedToken} onTokenChange={setSelectedToken} />}
        {activeTab === "transactions" && <TransactionsPanel />}
        {activeTab === "faucet" && <FaucetPanel selectedToken={selectedToken} onTokenChange={setSelectedToken} />}
      </main>
    </div>
  );
}

export default App;
