import { useQuery } from "@tanstack/react-query";
import { fetchChartData, CHART_PERIODS, type ChartData } from "@/lib/api";
import { useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, ComposedChart, Area,
} from "recharts";

interface StockChartProps {
  symbol: string;
}

const INDICATORS = [
  { key: "sma20", label: "SMA 20", color: "#f59e0b" },
  { key: "sma50", label: "SMA 50", color: "#8b5cf6" },
  { key: "ema20", label: "EMA 20", color: "#06b6d4" },
  { key: "bb", label: "Bollinger", color: "#ec4899" },
] as const;

export default function StockChart({ symbol }: StockChartProps) {
  const [period, setPeriod] = useState("1y");
  const [activeIndicators, setActiveIndicators] = useState<Set<string>>(new Set(["sma20"]));
  const [showVolume, setShowVolume] = useState(true);
  const [showRSI, setShowRSI] = useState(false);

  const { data, isLoading, error } = useQuery<ChartData>({
    queryKey: ["chart", symbol, period],
    queryFn: () => fetchChartData(symbol, period),
    retry: 1,
  });

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.dates.map((d, i) => ({
      date: d.split(" ")[0],
      close: data.close[i],
      open: data.open[i],
      high: data.high[i],
      low: data.low[i],
      volume: data.volume[i],
      sma20: data.sma20[i],
      sma50: data.sma50[i],
      ema20: data.ema20[i],
      rsi: data.rsi[i],
      macd: data.macd[i],
      macd_sig: data.macd_sig[i],
      macd_hist: data.macd_hist[i],
      bb_upper: data.bb_upper[i],
      bb_lower: data.bb_lower[i],
      bb_mid: data.bb_mid[i],
      vol_ma: data.vol_ma[i],
    }));
  }, [data]);

  const toggleIndicator = (key: string) => {
    setActiveIndicators((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <div className="bg-card rounded-lg border border-border">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 p-4 border-b border-border">
        <div className="flex gap-1">
          {CHART_PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                period === p.key
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-border mx-1" />

        {INDICATORS.map((ind) => (
          <button
            key={ind.key}
            onClick={() => toggleIndicator(ind.key)}
            className={`px-2 py-1 text-[11px] font-medium rounded border transition-colors ${
              activeIndicators.has(ind.key)
                ? "border-accent text-accent bg-accent/10"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {ind.label}
          </button>
        ))}

        <button
          onClick={() => setShowVolume(!showVolume)}
          className={`px-2 py-1 text-[11px] font-medium rounded border transition-colors ${
            showVolume
              ? "border-accent text-accent bg-accent/10"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          Volume
        </button>

        <button
          onClick={() => setShowRSI(!showRSI)}
          className={`px-2 py-1 text-[11px] font-medium rounded border transition-colors ${
            showRSI
              ? "border-accent text-accent bg-accent/10"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          RSI
        </button>
      </div>

      {/* Chart Area */}
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-[350px]">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error || !data ? (
          <div className="flex items-center justify-center h-[350px] text-sm text-muted-foreground">
            Unable to load chart. Is your backend running?
          </div>
        ) : (
          <div className="space-y-2">
            {/* Price Chart */}
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(220 9% 46%)" />
                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10 }} stroke="hsl(220 9% 46%)" />
                <Tooltip
                  contentStyle={{
                    background: "hsl(0 0% 100%)",
                    border: "1px solid hsl(220 13% 91%)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line type="monotone" dataKey="close" stroke="hsl(217 91% 60%)" dot={false} strokeWidth={1.5} name="Close" />
                {activeIndicators.has("sma20") && (
                  <Line type="monotone" dataKey="sma20" stroke="#f59e0b" dot={false} strokeWidth={1} name="SMA 20" />
                )}
                {activeIndicators.has("sma50") && (
                  <Line type="monotone" dataKey="sma50" stroke="#8b5cf6" dot={false} strokeWidth={1} name="SMA 50" />
                )}
                {activeIndicators.has("ema20") && (
                  <Line type="monotone" dataKey="ema20" stroke="#06b6d4" dot={false} strokeWidth={1} name="EMA 20" />
                )}
                {activeIndicators.has("bb") && (
                  <>
                    <Line type="monotone" dataKey="bb_upper" stroke="#ec4899" dot={false} strokeWidth={1} strokeDasharray="4 2" name="BB Upper" />
                    <Line type="monotone" dataKey="bb_lower" stroke="#ec4899" dot={false} strokeWidth={1} strokeDasharray="4 2" name="BB Lower" />
                    <Line type="monotone" dataKey="bb_mid" stroke="#ec4899" dot={false} strokeWidth={1} strokeOpacity={0.5} name="BB Mid" />
                  </>
                )}
              </ComposedChart>
            </ResponsiveContainer>

            {/* Volume */}
            {showVolume && (
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={chartData}>
                  <XAxis dataKey="date" tick={false} stroke="hsl(220 9% 46%)" />
                  <YAxis tick={{ fontSize: 9 }} stroke="hsl(220 9% 46%)" />
                  <Bar dataKey="volume" fill="hsl(220 13% 91%)" />
                  <Line type="monotone" dataKey="vol_ma" stroke="hsl(220 9% 46%)" dot={false} strokeWidth={1} />
                </BarChart>
              </ResponsiveContainer>
            )}

            {/* RSI */}
            {showRSI && (
              <ResponsiveContainer width="100%" height={80}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                  <XAxis dataKey="date" tick={false} stroke="hsl(220 9% 46%)" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} stroke="hsl(220 9% 46%)" ticks={[30, 50, 70]} />
                  <Line type="monotone" dataKey="rsi" stroke="#f59e0b" dot={false} strokeWidth={1.5} name="RSI" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
