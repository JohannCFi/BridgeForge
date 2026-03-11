import { useState } from "react";
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
