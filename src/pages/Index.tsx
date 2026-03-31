import { useState } from "react";
import { Activity, BarChart3 } from "lucide-react";
import Watchlist from "@/components/Watchlist";
import QuoteCard from "@/components/QuoteCard";
import StockChart from "@/components/StockChart";
import Predictor from "@/components/Predictor";

type Tab = "tracker" | "predictor";

const Index = () => {
  const [symbol, setSymbol] = useState("AAPL");
  const [tab, setTab] = useState<Tab>("tracker");

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 border-r border-border bg-card flex-shrink-0 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-border flex-shrink-0">
          <h1 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
            <Activity className="h-4 w-4 text-accent" />
            StockPulse Pro
          </h1>
        </div>
        <Watchlist selected={symbol} onSelect={setSymbol} />
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden bg-background">
        {/* Tab bar */}
        <div className="sticky top-0 z-10 bg-background border-b border-border px-6 flex-shrink-0">
          <div className="flex gap-6">
            <button
              onClick={() => setTab("tracker")}
              className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                tab === "tracker"
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Activity className="h-3.5 w-3.5" />
              Live Tracker
            </button>
            <button
              onClick={() => setTab("predictor")}
              className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                tab === "predictor"
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Predictor
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-5xl">
            {tab === "tracker" ? (
              <div className="space-y-4">
                <QuoteCard symbol={symbol} />
                <StockChart symbol={symbol} />
              </div>
            ) : (
              <Predictor symbol={symbol} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
