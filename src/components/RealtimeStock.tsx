import { useEffect, useState } from "react";
import { useSocket } from "@/hooks/useSocket";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

interface RealtimeStockProps {
  symbol: string;
  name?: string;
}

export default function RealtimeStock({ symbol, name }: RealtimeStockProps) {
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const { subscribeQuote } = useSocket();

  useEffect(() => {
    setLoading(true);

    // Subscribe to real-time updates
    const unsubscribe = subscribeQuote(symbol, (data) => {
      console.log(`[${symbol}] Real-time update:`, data);
      setQuote(data);
      setIsLive(true);
      setLoading(false);
    });

    // Fallback: fetch initial quote from REST API
    const fetchInitial = async () => {
      try {
        const res = await fetch(
          `http://127.0.0.1:5000/api/quote?symbol=${symbol}`
        );
        if (res.ok) {
          const data = await res.json();
          setQuote(data);
          setLoading(false);
        }
      } catch (error) {
        console.error(`Failed to fetch quote for ${symbol}:`, error);
        setLoading(false);
      }
    };

    // Try WebSocket first, fallback to REST after 2 seconds
    const timeout = setTimeout(fetchInitial, 2000);

    return () => {
      clearTimeout(timeout);
      unsubscribe?.();
    };
  }, [symbol, subscribeQuote]);

  if (loading) {
    return (
      <Card className="p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-muted rounded w-1/2"></div>
          <div className="h-8 bg-muted rounded w-3/4"></div>
        </div>
      </Card>
    );
  }

  if (!quote) {
    return (
      <Card className="p-4">
        <div className="text-sm text-muted-foreground">No data available</div>
      </Card>
    );
  }

  const isPositive = quote.change >= 0;
  const changePercent = quote.change_pct || 0;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground">
            {symbol}
          </div>
          <div className="text-xs text-muted-foreground">{name || quote.name}</div>
        </div>
        <Badge variant={isLive ? "default" : "secondary"} className="text-xs">
          {isLive ? "🔴 LIVE" : "Cached"}
        </Badge>
      </div>

      <div className="space-y-1">
        <div className="text-2xl font-bold text-foreground">
          ${quote.price?.toFixed(2) || "N/A"}
        </div>
        <div
          className={`flex items-center gap-1 text-sm font-medium ${
            isPositive ? "text-green-600" : "text-red-600"
          }`}
        >
          {isPositive ? (
            <TrendingUp className="w-4 h-4" />
          ) : (
            <TrendingDown className="w-4 h-4" />
          )}
          <span>
            {isPositive ? "+" : ""}{quote.change?.toFixed(2) || "0"} (
            {isPositive ? "+" : ""}
            {changePercent.toFixed(2)}%)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-muted-foreground">Open</div>
          <div className="font-semibold">${quote.open?.toFixed(2) || "N/A"}</div>
        </div>
        <div>
          <div className="text-muted-foreground">High</div>
          <div className="font-semibold">${quote.high?.toFixed(2) || "N/A"}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Low</div>
          <div className="font-semibold">${quote.low?.toFixed(2) || "N/A"}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Volume</div>
          <div className="font-semibold">
            {quote.volume ? (quote.volume / 1e6).toFixed(1) + "M" : "N/A"}
          </div>
        </div>
      </div>

      {quote.pe_ratio && (
        <div className="text-xs pt-2 border-t border-border">
          <div className="text-muted-foreground">P/E Ratio</div>
          <div className="font-semibold">{quote.pe_ratio.toFixed(2)}</div>
        </div>
      )}
    </Card>
  );
}
