import { useQuery } from "@tanstack/react-query";
import { fetchChartData, CHART_PERIODS, type ChartData } from "@/lib/api";
import { useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import {
  ComposedChart, Line, Area, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceArea, BarChart, LineChart,
} from "recharts";

interface StockChartProps {
  symbol: string;
}

const INDICATORS = [
  { key: "sma20", label: "SMA 20",    color: "#f59e0b" },
  { key: "sma50", label: "SMA 50",    color: "#8b5cf6" },
  { key: "ema20", label: "EMA 20",    color: "#06b6d4" },
  { key: "bb",    label: "Bollinger", color: "#ec4899" },
] as const;

// ── Currency prefix ───────────────────────────────────────────────────────────
function currencyPrefix(symbol: string): string {
  return symbol.endsWith(".NS") || symbol.endsWith(".BO") ? "₹" : "$";
}

function fmtPrice(v: number, symbol: string): string {
  return `${currencyPrefix(symbol)}${v.toLocaleString(undefined, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;
}

function fmtVol(v: number): string {
  if (v >= 1e9) return (v / 1e9).toFixed(1) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return String(v);
}

// ── Rich custom tooltip ───────────────────────────────────────────────────────
function PriceTooltip({ active, payload, label, symbol, currentPrice }: any) {
  if (!active || !payload?.length) return null;

  const close    = payload.find((p: any) => p.dataKey === "close")?.value;
  const open     = payload.find((p: any) => p.dataKey === "open")?.value;
  const high     = payload.find((p: any) => p.dataKey === "high")?.value;
  const low      = payload.find((p: any) => p.dataKey === "low")?.value;
  const sma20    = payload.find((p: any) => p.dataKey === "sma20")?.value;
  const sma50    = payload.find((p: any) => p.dataKey === "sma50")?.value;
  const ema20    = payload.find((p: any) => p.dataKey === "ema20")?.value;
  const bb_upper = payload.find((p: any) => p.dataKey === "bb_upper")?.value;
  const bb_lower = payload.find((p: any) => p.dataKey === "bb_lower")?.value;

  const isLatest  = close !== undefined && currentPrice !== undefined &&
                    Math.abs(close - currentPrice) < 0.01;
  const changeAmt = open && close ? close - open : null;
  const changePct = open && changeAmt ? (changeAmt / open) * 100 : null;
  const dayUp     = changeAmt !== null ? changeAmt >= 0 : true;

  return (
    <div
      className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 text-xs min-w-[160px]"
      style={{ pointerEvents: "none" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-gray-100">
        <span className="font-semibold text-gray-700 text-[11px]">
          {label?.slice(5) || label}   {/* show MM-DD */}
        </span>
        {isLatest && (
          <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold">
            CURRENT
          </span>
        )}
      </div>

      {/* Price block */}
      {close != null && (
        <div className="mb-2">
          <div className="flex items-end justify-between">
            <span className="text-[13px] font-bold text-gray-900">
              {fmtPrice(close, symbol)}
            </span>
            {changePct != null && (
              <span className={`text-[11px] font-semibold ${dayUp ? "text-green-600" : "text-red-500"}`}>
                {dayUp ? "▲" : "▼"} {Math.abs(changePct).toFixed(2)}%
              </span>
            )}
          </div>
          {open != null && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1.5 text-[10px] text-gray-500">
              <span>Open  <span className="text-gray-800 font-medium">{fmtPrice(open, symbol)}</span></span>
              <span>High  <span className="text-green-600 font-medium">{high  != null ? fmtPrice(high,  symbol) : "—"}</span></span>
              <span>Change <span className={`font-medium ${dayUp ? "text-green-600" : "text-red-500"}`}>
                {changeAmt != null ? `${dayUp ? "+" : ""}${fmtPrice(changeAmt, symbol)}` : "—"}
              </span></span>
              <span>Low   <span className="text-red-500 font-medium">{low   != null ? fmtPrice(low,   symbol) : "—"}</span></span>
            </div>
          )}
        </div>
      )}

      {/* Indicators */}
      {(sma20 || sma50 || ema20 || bb_upper) && (
        <div className="border-t border-gray-100 pt-1.5 space-y-0.5 text-[10px]">
          {sma20    != null && <div className="flex justify-between"><span style={{ color:"#f59e0b" }}>● SMA 20</span><span className="text-gray-700 font-medium">{fmtPrice(sma20, symbol)}</span></div>}
          {sma50    != null && <div className="flex justify-between"><span style={{ color:"#8b5cf6" }}>● SMA 50</span><span className="text-gray-700 font-medium">{fmtPrice(sma50, symbol)}</span></div>}
          {ema20    != null && <div className="flex justify-between"><span style={{ color:"#06b6d4" }}>● EMA 20</span><span className="text-gray-700 font-medium">{fmtPrice(ema20, symbol)}</span></div>}
          {bb_upper != null && bb_lower != null && (
            <div className="flex justify-between">
              <span style={{ color:"#ec4899" }}>● BB Band</span>
              <span className="text-gray-700 font-medium">
                {fmtPrice(bb_lower, symbol)} – {fmtPrice(bb_upper, symbol)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Volume tooltip ────────────────────────────────────────────────────────────
function VolumeTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const vol    = payload.find((p: any) => p.dataKey === "volume")?.value;
  const vol_ma = payload.find((p: any) => p.dataKey === "vol_ma")?.value;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2.5 text-[10px]">
      <p className="font-semibold text-gray-600 mb-1">{label?.slice(5) || label}</p>
      {vol    != null && <p className="text-gray-800">Volume: <span className="font-bold">{fmtVol(vol)}</span></p>}
      {vol_ma != null && <p className="text-gray-500">20d avg: {fmtVol(vol_ma)}</p>}
    </div>
  );
}

// ── RSI tooltip ───────────────────────────────────────────────────────────────
function RSITooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const rsi = payload.find((p: any) => p.dataKey === "rsi")?.value;
  if (rsi == null) return null;
  const label_ = rsi > 70 ? "Overbought" : rsi < 30 ? "Oversold" : "Neutral";
  const color_  = rsi > 70 ? "#ef4444"   : rsi < 30 ? "#22c55e"  : "#f59e0b";
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2.5 text-[10px]">
      <p className="font-semibold text-gray-600 mb-1">{label?.slice(5) || label}</p>
      <p style={{ color: color_ }} className="font-bold">RSI: {rsi.toFixed(1)} — {label_}</p>
    </div>
  );
}

// ── Custom dot: current price marker ─────────────────────────────────────────
function CurrentPriceDot(props: any) {
  const { cx, cy, payload, data } = props;
  // Only render on the very last data point
  if (!data || payload?.date !== data[data.length - 1]?.date) return null;
  return (
    <g>
      {/* Outer pulse ring */}
      <circle cx={cx} cy={cy} r={8} fill="#3b82f6" opacity={0.2} />
      {/* Inner solid dot */}
      <circle cx={cx} cy={cy} r={4} fill="#3b82f6" stroke="#fff" strokeWidth={2} />
    </g>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function StockChart({ symbol }: StockChartProps) {
  const [period, setPeriod]               = useState("1y");
  const [activeIndicators, setActiveIndicators] = useState<Set<string>>(new Set(["sma20"]));
  const [showVolume, setShowVolume]       = useState(true);
  const [showRSI, setShowRSI]             = useState(false);

  const { data, isLoading, error } = useQuery<ChartData>({
    queryKey: ["chart", symbol, period],
    queryFn:  () => fetchChartData(symbol, period),
    retry: 1,
    refetchInterval: 30_000,
  });

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.dates.map((d, i) => ({
      date:      d.split(" ")[0],
      close:     data.close[i],
      open:      data.open?.[i]  ?? data.close[i],
      high:      data.high?.[i]  ?? data.close[i],
      low:       data.low?.[i]   ?? data.close[i],
      volume:    data.volume[i],
      sma20:     data.sma20?.[i],
      sma50:     data.sma50?.[i],
      ema20:     data.ema20?.[i],
      rsi:       data.rsi?.[i],
      macd:      data.macd?.[i],
      macd_sig:  data.macd_sig?.[i],
      macd_hist: data.macd_hist?.[i],
      bb_upper:  data.bb_upper?.[i],
      bb_lower:  data.bb_lower?.[i],
      bb_mid:    data.bb_mid?.[i],
      vol_ma:    data.vol_ma?.[i],
    }));
  }, [data]);

  // Derived values for markers
  const currentPrice   = chartData.length ? chartData[chartData.length - 1].close : null;
  const currentDate    = chartData.length ? chartData[chartData.length - 1].date  : null;
  const priceMin       = chartData.length ? Math.min(...chartData.map(d => d.low  ?? Infinity)) : 0;
  const priceMax       = chartData.length ? Math.max(...chartData.map(d => d.high ?? -Infinity)) : 0;
  const priceChange    = chartData.length > 1
    ? chartData[chartData.length - 1].close - chartData[0].close
    : 0;
  const priceChangePct = chartData.length > 1 && chartData[0].close > 0
    ? (priceChange / chartData[0].close) * 100
    : 0;
  const periodUp       = priceChange >= 0;

  // Shade last 20% of chart as "recent zone"
  const recentStartDate = chartData.length > 10
    ? chartData[Math.floor(chartData.length * 0.80)].date
    : null;

  // Volume bar colors (green if close >= open, red otherwise)
  const volumeData = useMemo(() => chartData.map(d => ({
    ...d,
    volumeUp:   (d.close >= d.open) ? d.volume : 0,
    volumeDown: (d.close <  d.open) ? d.volume : 0,
  })), [chartData]);

  const toggleIndicator = (key: string) => {
    setActiveIndicators((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const cur = currencyPrefix(symbol);

  return (
    <div className="bg-card rounded-lg border border-border">

      {/* ── Controls ── */}
      <div className="flex flex-wrap items-center gap-2 p-4 border-b border-border">
        {/* Period selector */}
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

        {/* Indicator toggles */}
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
            <span
              className="inline-block w-2 h-2 rounded-full mr-1"
              style={{ background: ind.color }}
            />
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

        {/* Period summary */}
        {currentPrice != null && (
          <div className="ml-auto flex items-center gap-2 text-xs">
            <span className="font-bold text-foreground tabular-nums">
              {fmtPrice(currentPrice, symbol)}
            </span>
            <span className={`font-semibold tabular-nums ${periodUp ? "text-green-600" : "text-red-500"}`}>
              {periodUp ? "▲" : "▼"} {Math.abs(priceChangePct).toFixed(2)}%
            </span>
            <span className="text-muted-foreground text-[10px]">({period})</span>
          </div>
        )}
      </div>

      {/* ── Chart area ── */}
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
          <div className="space-y-1">

            {/* ── Price Chart ── */}
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart
                data={chartData}
                margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
              >
                <defs>
                  {/* Blue gradient fill under price line */}
                  <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}  />
                  </linearGradient>
                  {/* Recent zone highlight */}
                  <linearGradient id="recentGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#f59e0b" stopOpacity={0.05} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.0}  />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(220 13% 91%)"
                  vertical={false}
                />

                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "hsl(220 9% 46%)" }}
                  stroke="hsl(220 13% 91%)"
                  tickFormatter={(v) => v.slice(5)}   // MM-DD
                  tickLine={false}
                  axisLine={false}
                />

                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 10, fill: "hsl(220 9% 46%)" }}
                  stroke="hsl(220 13% 91%)"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${cur}${v >= 1000 ? (v/1000).toFixed(0)+"k" : v.toFixed(0)}`}
                  width={54}
                />

                <Tooltip
                  content={
                    <PriceTooltip
                      symbol={symbol}
                      currentPrice={currentPrice}
                    />
                  }
                  cursor={{
                    stroke: "hsl(220 9% 46%)",
                    strokeWidth: 1,
                    strokeDasharray: "4 2",
                  }}
                />

                {/* ── Recent zone shading ── */}
                {recentStartDate && (
                  <ReferenceArea
                    x1={recentStartDate}
                    x2={currentDate ?? undefined}
                    fill="url(#recentGradient)"
                    ifOverflow="extendDomain"
                  />
                )}

                {/* ── Bollinger band fill ── */}
                {activeIndicators.has("bb") && (
                  <Area
                    type="monotone"
                    dataKey="bb_upper"
                    stroke="none"
                    fill="#ec4899"
                    fillOpacity={0.04}
                    name="BB Upper"
                    legendType="none"
                    dot={false}
                    activeDot={false}
                    isAnimationActive={false}
                  />
                )}

                {/* ── Area fill under price ── */}
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke="none"
                  fill="url(#priceGradient)"
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                  legendType="none"
                />

                {/* ── Main price line ── */}
                <Line
                  type="monotone"
                  dataKey="close"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={(props) => {
                    // Only draw dot on the last point (current price marker)
                    const isLast = props.index === chartData.length - 1;
                    if (!isLast) return <g key={props.key} />;
                    return (
                      <g key={props.key}>
                        <circle cx={props.cx} cy={props.cy} r={9}  fill="#3b82f6" opacity={0.15} />
                        <circle cx={props.cx} cy={props.cy} r={5}  fill="#3b82f6" stroke="#fff" strokeWidth={2} />
                      </g>
                    );
                  }}
                  activeDot={{
                    r: 5, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2,
                  }}
                  isAnimationActive={false}
                  name="Close"
                />

                {/* ── Indicators ── */}
                {activeIndicators.has("sma20") && (
                  <Line type="monotone" dataKey="sma20" stroke="#f59e0b"
                    dot={false} strokeWidth={1.5} name="SMA 20"
                    isAnimationActive={false}
                    activeDot={{ r: 3, fill: "#f59e0b" }}
                  />
                )}
                {activeIndicators.has("sma50") && (
                  <Line type="monotone" dataKey="sma50" stroke="#8b5cf6"
                    dot={false} strokeWidth={1.5} name="SMA 50"
                    isAnimationActive={false}
                    activeDot={{ r: 3, fill: "#8b5cf6" }}
                  />
                )}
                {activeIndicators.has("ema20") && (
                  <Line type="monotone" dataKey="ema20" stroke="#06b6d4"
                    dot={false} strokeWidth={1.5} name="EMA 20"
                    isAnimationActive={false}
                    activeDot={{ r: 3, fill: "#06b6d4" }}
                  />
                )}
                {activeIndicators.has("bb") && (
                  <>
                    <Line type="monotone" dataKey="bb_upper" stroke="#ec4899"
                      dot={false} strokeWidth={1} strokeDasharray="4 2"
                      name="BB Upper" isAnimationActive={false}
                    />
                    <Line type="monotone" dataKey="bb_lower" stroke="#ec4899"
                      dot={false} strokeWidth={1} strokeDasharray="4 2"
                      name="BB Lower" isAnimationActive={false}
                    />
                    <Line type="monotone" dataKey="bb_mid" stroke="#ec4899"
                      dot={false} strokeWidth={1} strokeOpacity={0.4}
                      name="BB Mid" isAnimationActive={false}
                    />
                  </>
                )}

                {/* ── Current price horizontal reference line ── */}
                {currentPrice != null && (
                  <ReferenceLine
                    y={currentPrice}
                    stroke="#3b82f6"
                    strokeDasharray="5 3"
                    strokeWidth={1}
                    label={{
                      value: `${cur}${currentPrice.toLocaleString(undefined, {
                        minimumFractionDigits: 2, maximumFractionDigits: 2,
                      })}`,
                      position: "right",
                      fontSize: 9,
                      fill: "#3b82f6",
                      fontWeight: 600,
                    }}
                  />
                )}

                {/* ── Period high / low reference lines ── */}
                {priceMax > 0 && (
                  <ReferenceLine
                    y={priceMax}
                    stroke="#22c55e"
                    strokeDasharray="3 4"
                    strokeOpacity={0.6}
                    strokeWidth={1}
                    label={{
                      value: `High ${cur}${priceMax.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                      position: "insideTopLeft",
                      fontSize: 9,
                      fill: "#22c55e",
                      opacity: 0.8,
                    }}
                  />
                )}
                {priceMin > 0 && (
                  <ReferenceLine
                    y={priceMin}
                    stroke="#ef4444"
                    strokeDasharray="3 4"
                    strokeOpacity={0.6}
                    strokeWidth={1}
                    label={{
                      value: `Low ${cur}${priceMin.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                      position: "insideBottomLeft",
                      fontSize: 9,
                      fill: "#ef4444",
                      opacity: 0.8,
                    }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>

            {/* ── Chart legend ── */}
            <div className="flex items-center gap-4 px-1 py-1 flex-wrap">
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="inline-block w-6 h-0.5 bg-blue-500 rounded" /> Price
              </span>
              {activeIndicators.has("sma20") && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className="inline-block w-6 h-0.5 bg-amber-400 rounded" /> SMA 20
                </span>
              )}
              {activeIndicators.has("sma50") && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className="inline-block w-6 h-0.5 bg-violet-500 rounded" /> SMA 50
                </span>
              )}
              {activeIndicators.has("ema20") && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className="inline-block w-6 h-0.5 bg-cyan-400 rounded" /> EMA 20
                </span>
              )}
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500 ring-2 ring-blue-200" />
                Current price
              </span>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500 opacity-60" />
                Period high
              </span>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="inline-block w-2 h-2 rounded-full bg-red-500 opacity-60" />
                Period low
              </span>
            </div>

            {/* ── Volume ── */}
            {showVolume && (
              <div className="mt-1">
                <p className="text-[9px] text-muted-foreground px-1 mb-1 uppercase tracking-wider">
                  Volume — green = up day, red = down day
                </p>
                <ResponsiveContainer width="100%" height={72}>
                  <ComposedChart
                    data={volumeData}
                    margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                  >
                    <XAxis dataKey="date" hide />
                    <YAxis
                      tick={{ fontSize: 9 }}
                      stroke="hsl(220 9% 46%)"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={fmtVol}
                      width={36}
                    />
                    <Tooltip content={<VolumeTooltip />} />
                    <Bar dataKey="volumeUp"   fill="#22c55e" opacity={0.7} isAnimationActive={false} />
                    <Bar dataKey="volumeDown" fill="#ef4444" opacity={0.7} isAnimationActive={false} />
                    <Line
                      type="monotone" dataKey="vol_ma"
                      stroke="hsl(220 9% 46%)" dot={false}
                      strokeWidth={1} isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── RSI ── */}
            {showRSI && (
              <div className="mt-1">
                <p className="text-[9px] text-muted-foreground px-1 mb-1 uppercase tracking-wider">
                  RSI — &lt;30 oversold (bullish), &gt;70 overbought (bearish)
                </p>
                <ResponsiveContainer width="100%" height={72}>
                  <ComposedChart
                    data={chartData}
                    margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" vertical={false} />
                    <XAxis dataKey="date" hide />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 9 }}
                      stroke="hsl(220 9% 46%)"
                      tickLine={false}
                      axisLine={false}
                      ticks={[30, 50, 70]}
                      width={36}
                    />
                    <Tooltip content={<RSITooltip />} />

                    {/* Overbought zone */}
                    <ReferenceArea y1={70} y2={100} fill="#ef4444" fillOpacity={0.06} />
                    {/* Oversold zone */}
                    <ReferenceArea y1={0}  y2={30}  fill="#22c55e" fillOpacity={0.06} />

                    <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 3" strokeOpacity={0.5}
                      label={{ value: "70", position: "right", fontSize: 8, fill: "#ef4444" }} />
                    <ReferenceLine y={30} stroke="#22c55e" strokeDasharray="4 3" strokeOpacity={0.5}
                      label={{ value: "30", position: "right", fontSize: 8, fill: "#22c55e" }} />
                    <ReferenceLine y={50} stroke="hsl(220 9% 46%)" strokeDasharray="2 4" strokeOpacity={0.4} />

                    <Line
                      type="monotone" dataKey="rsi"
                      stroke="#f59e0b" dot={false}
                      strokeWidth={1.5} name="RSI"
                      isAnimationActive={false}
                      activeDot={{ r: 3, fill: "#f59e0b" }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
 }