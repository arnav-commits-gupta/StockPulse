import { useEffect, useState, useCallback } from "react";
import { useSocket } from "@/hooks/useSocket";
import RealtimeStock from "./RealtimeStock";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface DashboardStock {
  symbol: string;
  name: string;
}

export default function RealtimeDashboard() {
  const [stocks, setStocks] = useState<DashboardStock[]>([
    { symbol: "AAPL", name: "Apple Inc." },
    { symbol: "GOOGL", name: "Alphabet Inc." },
    { symbol: "MSFT", name: "Microsoft" },
    { symbol: "TSLA", name: "Tesla" },
    { symbol: "AMZN", name: "Amazon" },
  ]);

  const [newSymbol, setNewSymbol] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const { socket, isConnected, on } = useSocket();

  // Monitor socket connection status
  useEffect(() => {
    const unsubConnect = on("connected", (data) => {
      console.log("[Dashboard] Connected to backend:", data);
      setConnectionStatus("connected");
    });

    const unsubDisconnect = on("disconnect", () => {
      setConnectionStatus("disconnected");
    });

    return () => {
      unsubConnect?.();
      unsubDisconnect?.();
    };
  }, [on]);

  // Add new stock to dashboard
  const handleAddStock = useCallback(() => {
    if (!newSymbol.trim()) return;

    const symbol = newSymbol.toUpperCase();
    if (stocks.some((s) => s.symbol === symbol)) {
      alert(`${symbol} is already in your dashboard`);
      return;
    }

    setStocks((prev) => [
      ...prev,
      { symbol, name: symbol },
    ]);
    setNewSymbol("");
  }, [newSymbol, stocks]);

  // Remove stock from dashboard
  const handleRemoveStock = useCallback((symbol: string) => {
    setStocks((prev) => prev.filter((s) => s.symbol !== symbol));
  }, []);

  // Handle Enter key in input
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddStock();
    }
  };

  const statusColor =
    connectionStatus === "connected"
      ? "bg-green-500"
      : connectionStatus === "connecting"
        ? "bg-yellow-500"
        : "bg-red-500";

  const statusText =
    connectionStatus === "connected"
      ? "🔴 LIVE"
      : connectionStatus === "connecting"
        ? "⚠️ CONNECTING"
        : "❌ DISCONNECTED";

  return (
    <div className="space-y-6">
      {/* Header with Status */}
      <div className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-4 border-b border-border z-40">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              StockPulse Real-Time Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              Live updates for {stocks.length} stocks
            </p>
          </div>
          <Badge variant={connectionStatus === "connected" ? "default" : "secondary"}>
            {statusText}
          </Badge>
        </div>

        {/* Add Stock Input */}
        <div className="flex gap-2">
          <Input
            placeholder="Add stock symbol (e.g., AAPL, GOOGL, MSFT)"
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1"
          />
          <Button onClick={handleAddStock} disabled={!newSymbol.trim()}>
            Add Stock
          </Button>
        </div>
      </div>

      {/* Dashboard Grid */}
      {stocks.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground mb-4">No stocks in your dashboard</p>
          <p className="text-sm text-muted-foreground">
            Add stocks above to start monitoring real-time prices
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stocks.map((stock) => (
            <div key={stock.symbol} className="relative">
              <RealtimeStock symbol={stock.symbol} name={stock.name} />
              <button
                onClick={() => handleRemoveStock(stock.symbol)}
                className="absolute top-2 right-2 p-1 hover:bg-destructive/20 rounded-full transition-colors"
                aria-label="Remove from dashboard"
              >
                <X className="w-4 h-4 text-destructive" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Connection Info */}
      <Card className="p-4 bg-muted/50">
        <div className="flex items-center gap-2 text-sm">
          <div
            className={`w-2 h-2 rounded-full ${statusColor}`}
            aria-label={`Connection status: ${connectionStatus}`}
          />
          <span className="text-muted-foreground">
            {connectionStatus === "connected"
              ? "Connected to real-time backend - updates every 3 seconds"
              : connectionStatus === "connecting"
                ? "Attempting to connect to backend..."
                : "Disconnected from backend - using cached data"}
          </span>
        </div>
      </Card>
    </div>
  );
}
