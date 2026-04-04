import { useQuery } from "@tanstack/react-query";
import { fetchQuote, type StockQuote } from "@/lib/api";
import {
  TrendingUp, TrendingDown, Loader2, Info,
  Activity, BarChart2, AlertTriangle, CheckCircle2,
  MinusCircle, HelpCircle,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface QuoteCardProps {
  symbol: string;
}

interface ExplainData {
  signal:     string;   // "BUY" | "SELL" | "NEUTRAL"
  bull_pct:   number;
  bear_pct:   number;
  confidence: number;
  summary:    string;
  reasons: {
    factor:        string;
    detail:        string;
    signal:        string;
    weight:        string;
    what_it_means: string;
  }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5002";

function formatNumber(n: number): string {
  if (!n || n === 0) return "—";
  if (n >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (n >= 1e9)  return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6)  return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3)  return (n / 1e3).toFixed(1) + "K";
  return n.toLocaleString();
}

function formatPrice(price: number, currency: string): string {
  const sym = currency === "INR" ? "₹" : "$";
  return `${sym}${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Tooltip component (plain-English popover on hover) ────────────────────────

function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative inline-flex items-center">
      <button
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        <HelpCircle className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute left-5 top-0 z-50 w-56 p-2.5 bg-popover border border-border rounded-lg shadow-lg text-[11px] text-popover-foreground leading-relaxed">
          {text}
        </div>
      )}
    </div>
  );
}

// ── Signal banner ─────────────────────────────────────────────────────────────

function SignalBanner({ explain }: { explain: ExplainData }) {
  const isBuy     = explain.signal === "BUY";
  const isSell    = explain.signal === "SELL";
  const isNeutral = explain.signal === "NEUTRAL";

  const config = isBuy
    ? { bg: "bg-green-50 border-green-200", text: "text-green-800",
        badge: "bg-green-100 text-green-800 border-green-300",
        icon: <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />,
        label: "BUY SIGNAL", emoji: "🟢" }
    : isSell
    ? { bg: "bg-red-50 border-red-200", text: "text-red-800",
        badge: "bg-red-100 text-red-800 border-red-300",
        icon: <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />,
        label: "SELL SIGNAL", emoji: "🔴" }
    : { bg: "bg-yellow-50 border-yellow-200", text: "text-yellow-800",
        badge: "bg-yellow-100 text-yellow-800 border-yellow-300",
        icon: <MinusCircle className="h-4 w-4 text-yellow-600 flex-shrink-0" />,
        label: "NEUTRAL", emoji: "🟡" };

  const [showReasons, setShowReasons] = useState(false);

  return (
    <div className={`rounded-lg border p-3 mb-4 ${config.bg}`}>
      {/* Top row: signal + confidence */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          {config.icon}
          <span className={`text-xs font-bold tracking-wide ${config.text}`}>
            {config.emoji} {config.label}
          </span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${config.badge}`}>
            {explain.confidence}% confidence
          </span>
        </div>
        <button
          onClick={() => setShowReasons((o) => !o)}
          className={`text-[10px] font-medium underline underline-offset-2 ${config.text} opacity-70 hover:opacity-100`}
        >
          {showReasons ? "Hide reasons ▲" : "Why? ▼"}
        </button>
      </div>

      {/* Plain-English summary */}
      <p className={`text-[11px] leading-relaxed ${config.text}`}>
        {explain.summary}
      </p>

      {/* Bull / bear bar */}
      <div className="mt-2 flex items-center gap-2">
        <span className="text-[9px] text-green-700 font-medium w-6 text-right">{explain.bull_pct.toFixed(0)}%</span>
        <div className="flex-1 h-1.5 rounded-full bg-red-200 overflow-hidden">
          <div
            className="h-full rounded-full bg-green-500 transition-all duration-500"
            style={{ width: `${explain.bull_pct}%` }}
          />
        </div>
        <span className="text-[9px] text-red-600 font-medium w-6">{explain.bear_pct.toFixed(0)}%</span>
      </div>

      {/* Expandable reasons */}
      {showReasons && (
        <div className="mt-3 space-y-1.5 border-t border-current/10 pt-2">
          <p className={`text-[10px] font-semibold ${config.text} opacity-70 mb-1`}>
            What's driving this signal:
          </p>
          {explain.reasons.map((r, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="text-[10px] mt-0.5 flex-shrink-0">
                {r.signal === "bullish" ? "🟢" : r.signal === "bearish" ? "🔴" : "⚪"}
              </span>
              <div>
                <span className={`text-[10px] font-semibold ${config.text}`}>{r.factor}: </span>
                <span className={`text-[10px] ${config.text} opacity-80`}>{r.detail}</span>
                <div className={`text-[9px] ${config.text} opacity-60 italic`}>{r.what_it_means}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Stat cell with optional tooltip ──────────────────────────────────────────

function StatCell({
  label, value, tooltip, highlight,
}: {
  label: string;
  value: string | number;
  tooltip?: string;
  highlight?: "up" | "down" | null;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      <span
        className={`text-sm font-semibold mt-0.5 ${
          highlight === "up"
            ? "text-green-600"
            : highlight === "down"
            ? "text-red-500"
            : "text-foreground"
        }`}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
    </div>
  );
}

// ── RSI plain-English helper ──────────────────────────────────────────────────

function getRsiLabel(rsi: number | null): { label: string; color: string; desc: string } | null {
  if (rsi === null || rsi === undefined) return null;
  if (rsi < 30)  return { label: "Oversold",   color: "text-green-600 bg-green-50 border-green-200", desc: "Heavily sold — potential bounce" };
  if (rsi < 45)  return { label: "Bearish",     color: "text-red-500  bg-red-50   border-red-200",   desc: "Selling pressure dominant" };
  if (rsi < 55)  return { label: "Neutral",     color: "text-yellow-600 bg-yellow-50 border-yellow-200", desc: "Balanced buy & sell pressure" };
  if (rsi < 70)  return { label: "Bullish",     color: "text-green-600 bg-green-50 border-green-200", desc: "Buying pressure dominant" };
  return           { label: "Overbought", color: "text-red-500  bg-red-50   border-red-200",   desc: "Heavily bought — may pull back" };
}

// ── Main component ────────────────────────────────────────────────────────────

export default function QuoteCard({ symbol }: QuoteCardProps) {
  const { data, isLoading, error } = useQuery<StockQuote>({
    queryKey: ["quote", symbol],
    queryFn:  () => fetchQuote(symbol),
    refetchInterval: 15_000,   // refresh every 15s
    retry: 1,
  });

  // Fetch explanation (signal) from /api/explain
  const { data: explain } = useQuery<ExplainData>({
    queryKey: ["explain", symbol],
    queryFn: async () => {
      const r = await fetch(`${BASE_URL}/api/explain?symbol=${encodeURIComponent(symbol)}&period=3mo`);
      if (!r.ok) throw new Error("explain failed");
      return r.json();
    },
    staleTime: 5 * 60_000,   // signal doesn't need refreshing as often
    retry: 1,
    enabled: !!symbol,
  });

  // ── Loading state ───────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="bg-card rounded-lg border border-border p-6 flex items-center justify-center min-h-[140px]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Fetching live price...</span>
        </div>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="bg-card rounded-lg border border-border p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground mb-1">
              Unable to fetch quote for <span className="font-bold">{symbol}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Make sure your Flask backend is running on port 5002.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isUp       = data.change >= 0;
  const currency   = data.currency || (symbol.endsWith(".NS") || symbol.endsWith(".BO") ? "INR" : "USD");

  // Derive RSI from explain reasons if available
  const rsiReason  = explain?.reasons?.find((r) => r.factor?.toLowerCase().includes("rsi"));
  const rsiValue   = rsiReason
    ? parseFloat(rsiReason.detail?.match(/RSI=?(\d+\.?\d*)/)?.[1] || "0") || null
    : null;
  const rsiInfo    = getRsiLabel(rsiValue);

  // Trend label from SMA reasons
  const smaReason  = explain?.reasons?.find((r) => r.factor?.toLowerCase().includes("sma20"));
  const trendUp    = smaReason?.signal === "bullish";
  const trendDown  = smaReason?.signal === "bearish";

  return (
    <div className="bg-card rounded-lg border border-border p-5">

      {/* ── Row 1: Symbol + Price ── */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-foreground">
              {symbol.replace(".NS","").replace(".BO","").replace("-USD","")}
            </h2>
            <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded font-medium">
              {data.exchange || (symbol.endsWith(".NS") ? "NSE" : symbol.endsWith(".BO") ? "BSE" : "—")}
            </span>
            {/* Trend pill */}
            {smaReason && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${
                  trendUp
                    ? "bg-green-50 text-green-700 border-green-200"
                    : trendDown
                    ? "bg-red-50 text-red-600 border-red-200"
                    : "bg-gray-50 text-gray-500 border-gray-200"
                }`}
              >
                {trendUp ? "↑ Uptrend" : trendDown ? "↓ Downtrend" : "Sideways"}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{data.name}</p>
        </div>

        <div className="text-right">
          <div className="text-2xl font-bold text-foreground tabular-nums">
            {formatPrice(data.price, currency)}
          </div>
          <div
            className={`flex items-center gap-1 justify-end text-sm font-semibold mt-0.5 ${
              isUp ? "text-green-600" : "text-red-500"
            }`}
          >
            {isUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            <span>
              {isUp ? "+" : ""}{data.change.toFixed(2)}{" "}
              <span className="text-xs">({isUp ? "+" : ""}{data.change_pct}%)</span>
            </span>
          </div>
          {/* Plain English today's movement */}
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {isUp
              ? `Stock is UP today ▲`
              : `Stock is DOWN today ▼`}
          </p>
        </div>
      </div>

      {/* ── Signal Banner (loads async) ── */}
      {explain && <SignalBanner explain={explain} />}

      {/* ── Quick indicator pills ── */}
      <div className="flex flex-wrap gap-2 mb-4">
        {/* RSI pill */}
        {rsiInfo && (
          <div className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded border ${rsiInfo.color}`}>
            <Activity className="h-3 w-3" />
            <span>RSI: {rsiInfo.label}</span>
            <InfoTooltip text={`RSI measures buying/selling momentum. ${rsiInfo.desc}. Values below 30 = oversold, above 70 = overbought.`} />
          </div>
        )}

        {/* MACD pill */}
        {(() => {
          const macdR = explain?.reasons?.find((r) => r.factor?.toLowerCase().includes("macd"));
          if (!macdR) return null;
          const up = macdR.signal === "bullish";
          const neutral = macdR.signal === "neutral";
          return (
            <div className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded border ${
              up ? "bg-green-50 text-green-700 border-green-200"
                 : neutral ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                 : "bg-red-50 text-red-600 border-red-200"
            }`}>
              <BarChart2 className="h-3 w-3" />
              <span>MACD: {up ? "Bullish" : neutral ? "Neutral" : "Bearish"}</span>
              <InfoTooltip text="MACD shows the trend's momentum. Bullish means short-term price is rising faster than long-term — a positive sign." />
            </div>
          );
        })()}

        {/* Volume pill */}
        {(() => {
          const volR = explain?.reasons?.find((r) => r.factor?.toLowerCase().includes("volume"));
          if (!volR) return null;
          const confirming = volR.signal === "confirming";
          const cautious   = volR.signal === "cautious";
          return (
            <div className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded border ${
              confirming ? "bg-blue-50 text-blue-700 border-blue-200"
                         : cautious ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                         : "bg-gray-50 text-gray-600 border-gray-200"
            }`}>
              <BarChart2 className="h-3 w-3" />
              <span>Volume: {confirming ? "High (confirms move)" : cautious ? "Low (weak move)" : "Normal"}</span>
              <InfoTooltip text="High volume confirms a price move is genuine. Low volume moves can reverse quickly." />
            </div>
          );
        })()}
      </div>

      {/* ── Stats grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 mb-4">
        <StatCell
          label="Open"
          value={formatPrice(data.open, currency)}
          tooltip="The price this stock opened at today when the market started trading."
        />
        <StatCell
          label="High"
          value={formatPrice(data.high, currency)}
          tooltip="The highest price reached today. If the current price is near here, the stock may face resistance."
          highlight={data.price >= data.high * 0.99 ? "up" : null}
        />
        <StatCell
          label="Low"
          value={formatPrice(data.low, currency)}
          tooltip="The lowest price today. If price is near here, it may find support and bounce."
          highlight={data.price <= data.low * 1.01 ? "down" : null}
        />
        <StatCell
          label="Volume"
          value={formatNumber(data.volume)}
          tooltip="Number of shares traded today. Higher than usual means stronger conviction in the move."
        />
        <StatCell
          label="Market Cap"
          value={formatNumber(data.market_cap)}
          tooltip="Total value of the company (price × all shares). Large cap = more stable. Small cap = more volatile."
        />
        <StatCell
          label="P/E Ratio"
          value={data.pe_ratio || "—"}
          tooltip="Price-to-Earnings ratio. How much investors pay for ₹1 of profit. Lower = potentially cheaper. >50 = expensive, <15 = cheap."
        />
        <StatCell
          label="52W High"
          value={data["52w_high"] ? formatPrice(data["52w_high"], currency) : "—"}
          tooltip="Highest price in the last 52 weeks (1 year). If the stock is near this level, it may struggle to go higher."
          highlight={data["52w_high"] && data.price >= data["52w_high"] * 0.97 ? "up" : null}
        />
        <StatCell
          label="52W Low"
          value={data["52w_low"] ? formatPrice(data["52w_low"], currency) : "—"}
          tooltip="Lowest price in the last 52 weeks (1 year). If near this level, the stock may be a bargain — or in trouble."
          highlight={data["52w_low"] && data.price <= data["52w_low"] * 1.03 ? "down" : null}
        />
      </div>

      {/* ── 52W position bar ── */}
      {data["52w_high"] && data["52w_low"] && data["52w_high"] > data["52w_low"] && (
        <div className="mb-4">
          <div className="flex justify-between text-[9px] text-muted-foreground mb-1">
            <span>52W Low: {formatPrice(data["52w_low"], currency)}</span>
            <span className="font-medium text-foreground text-[9px]">
              {(((data.price - data["52w_low"]) / (data["52w_high"] - data["52w_low"])) * 100).toFixed(0)}% from low
            </span>
            <span>52W High: {formatPrice(data["52w_high"], currency)}</span>
          </div>
          <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${isUp ? "bg-green-500" : "bg-red-400"}`}
              style={{
                width: `${Math.min(100, Math.max(2, ((data.price - data["52w_low"]) / (data["52w_high"] - data["52w_low"])) * 100))}%`,
              }}
            />
          </div>
          <p className="text-[9px] text-muted-foreground mt-1">
            ← Where the price sits within its 1-year range →
          </p>
        </div>
      )}

      {/* ── Sector + data freshness ── */}
      <div className="pt-3 border-t border-border flex items-center justify-between flex-wrap gap-2">
        {data.sector && data.sector !== "—" && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">Sector:</span>
            <span className="text-[10px] font-semibold text-foreground bg-secondary px-2 py-0.5 rounded">
              {data.sector}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1 text-[9px] text-muted-foreground ml-auto">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
          </span>
          Live · refreshes every 15s
        </div>
      </div>
    </div>
  );
}