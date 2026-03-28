import { useQuery } from "@tanstack/react-query";
import { fetchQuote, type StockQuote } from "@/lib/api";
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react";

interface QuoteCardProps {
  symbol: string;
}

function formatNumber(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toLocaleString();
}

export default function QuoteCard({ symbol }: QuoteCardProps) {
  const { data, isLoading, error } = useQuery<StockQuote>({
    queryKey: ["quote", symbol],
    queryFn: () => fetchQuote(symbol),
    refetchInterval: 30000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg border border-border p-6 flex items-center justify-center min-h-[120px]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-card rounded-lg border border-border p-6">
        <p className="text-sm text-muted-foreground">
          Unable to fetch quote for <span className="font-semibold text-foreground">{symbol}</span>.
          Make sure your Flask backend is running.
        </p>
      </div>
    );
  }

  const isUp = data.change >= 0;

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">{data.symbol}</h2>
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">{data.exchange}</span>
          </div>
          <p className="text-sm text-muted-foreground">{data.name}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-foreground">
            {data.currency === "USD" ? "$" : "₹"}{data.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className={`flex items-center gap-1 justify-end text-sm font-medium ${isUp ? "stock-up" : "stock-down"}`}>
            {isUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {isUp ? "+" : ""}{data.change.toFixed(2)} ({isUp ? "+" : ""}{data.change_pct}%)
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Open", value: data.open },
          { label: "High", value: data.high },
          { label: "Low", value: data.low },
          { label: "Volume", value: formatNumber(data.volume) },
          { label: "Market Cap", value: formatNumber(data.market_cap) },
          { label: "P/E Ratio", value: data.pe_ratio || "—" },
          { label: "52W High", value: data["52w_high"] },
          { label: "52W Low", value: data["52w_low"] },
        ].map((item) => (
          <div key={item.label}>
            <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{item.label}</div>
            <div className="text-sm font-medium text-foreground">{typeof item.value === "number" ? item.value.toLocaleString() : item.value}</div>
          </div>
        ))}
      </div>

      {data.sector !== "—" && (
        <div className="mt-3 pt-3 border-t border-border">
          <span className="text-[11px] text-muted-foreground">Sector: </span>
          <span className="text-xs font-medium text-foreground">{data.sector}</span>
        </div>
      )}
    </div>
  );
}
