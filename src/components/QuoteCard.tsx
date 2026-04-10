import { useQuery } from "@tanstack/react-query";
import { fetchQuote, type StockQuote } from "@/lib/api";
import {
  TrendingUp, TrendingDown, Loader2,
  Activity, BarChart2, AlertTriangle, CheckCircle2,
  MinusCircle, HelpCircle, ChevronDown, ChevronRight,
  Lightbulb,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface QuoteCardProps {
  symbol: string;
}

interface ExplainData {
  signal:     string;
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
  return `${sym}${price.toLocaleString(undefined, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
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

// ── Stat cell ─────────────────────────────────────────────────────────────────

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
      <span className={`text-sm font-semibold mt-0.5 ${
        highlight === "up"   ? "text-green-600"
        : highlight === "down" ? "text-red-500"
        : "text-foreground"
      }`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
    </div>
  );
}

// ── RSI label ─────────────────────────────────────────────────────────────────

function getRsiLabel(rsi: number | null) {
  if (rsi === null || rsi === undefined) return null;
  if (rsi < 30)  return { label:"Oversold",   color:"text-green-600 bg-green-50 border-green-200",  desc:"Heavily sold — potential bounce" };
  if (rsi < 45)  return { label:"Bearish",    color:"text-red-500  bg-red-50   border-red-200",    desc:"Selling pressure dominant" };
  if (rsi < 55)  return { label:"Neutral",    color:"text-yellow-600 bg-yellow-50 border-yellow-200", desc:"Balanced buy & sell pressure" };
  if (rsi < 70)  return { label:"Bullish",    color:"text-green-600 bg-green-50 border-green-200",  desc:"Buying pressure dominant" };
  return           { label:"Overbought", color:"text-red-500  bg-red-50   border-red-200",    desc:"Heavily bought — may pull back" };
}

// ═══════════════════════════════════════════════════════════════
//  "WHY THIS PREDICTION?" — The trust-building section
//
//  Converts raw indicator data into plain-English story bullets
//  that explain exactly why the AI gave this signal.
// ═══════════════════════════════════════════════════════════════

// Maps a reason into a plain-English bullet sentence
function reasonToStory(r: ExplainData["reasons"][0], currency: string): {
  text: string;
  emoji: string;
  sentiment: "positive" | "negative" | "neutral";
} {
  const up   = r.signal === "bullish"   || r.signal === "confirming";
  const down = r.signal === "bearish"   || r.signal === "cautious";
  const neutral = !up && !down;
  const emoji = up ? "📈" : down ? "📉" : "➡️";
  const sentiment: "positive" | "negative" | "neutral" = up ? "positive" : down ? "negative" : "neutral";

  // Parse the detail field to extract numbers for richer sentences
  const detail = r.detail || "";
  const factor = r.factor || "";

  // RSI
  if (factor.toLowerCase().includes("rsi")) {
    const rsiMatch = detail.match(/(\d+\.?\d*)/);
    const rsiVal   = rsiMatch ? parseFloat(rsiMatch[1]) : null;
    if (rsiVal !== null) {
      if (rsiVal < 30) return { emoji: "📈", sentiment: "positive", text: `RSI is ${rsiVal.toFixed(0)} — stock has been heavily sold and often rebounds from here` };
      if (rsiVal > 70) return { emoji: "📉", sentiment: "negative", text: `RSI is ${rsiVal.toFixed(0)} — stock has been heavily bought and may be due for a pullback` };
      if (rsiVal > 55) return { emoji: "📈", sentiment: "positive", text: `RSI is ${rsiVal.toFixed(0)} — buyers are in control, momentum is positive` };
      if (rsiVal < 45) return { emoji: "📉", sentiment: "negative", text: `RSI is ${rsiVal.toFixed(0)} — sellers have the edge, momentum is negative` };
      return { emoji: "➡️", sentiment: "neutral", text: `RSI is ${rsiVal.toFixed(0)} — no strong trend direction yet` };
    }
  }

  // MACD
  if (factor.toLowerCase().includes("macd")) {
    if (up)      return { emoji: "📈", sentiment: "positive", text: "Short-term momentum is accelerating upward (MACD crossed above signal line)" };
    if (down)    return { emoji: "📉", sentiment: "negative", text: "Short-term momentum is slowing down (MACD crossed below signal line)" };
    return         { emoji: "➡️", sentiment: "neutral",  text: "Momentum is at a crossroads — watch for a breakout in either direction" };
  }

  // SMA / price vs moving average
  if (factor.toLowerCase().includes("sma20")) {
    const pctMatch = detail.match(/([+-]?\d+\.?\d*)%/);
    const pct      = pctMatch ? parseFloat(pctMatch[1]) : null;
    if (up)   return { emoji: "📈", sentiment: "positive", text: `Price is ${pct ? `${Math.abs(pct).toFixed(1)}% above` : "above"} its 20-day average — short-term uptrend intact` };
    return          { emoji: "📉", sentiment: "negative", text: `Price is ${pct ? `${Math.abs(pct).toFixed(1)}% below` : "below"} its 20-day average — short-term downtrend` };
  }
  if (factor.toLowerCase().includes("sma50")) {
    if (up)   return { emoji: "📈", sentiment: "positive", text: "Price is above its 50-day average — medium-term trend is healthy" };
    return          { emoji: "📉", sentiment: "negative", text: "Price is below its 50-day average — medium-term trend is weakening" };
  }

  // Bollinger Bands
  if (factor.toLowerCase().includes("bb") || factor.toLowerCase().includes("bollinger")) {
    if (factor.toLowerCase().includes("below lower")) return { emoji: "📈", sentiment: "positive", text: "Price broke below the Bollinger lower band — statistically rare, often bounces back" };
    if (factor.toLowerCase().includes("above upper")) return { emoji: "📉", sentiment: "negative", text: "Price broke above the Bollinger upper band — statistically stretched, pullback likely" };
    if (up)   return { emoji: "📈", sentiment: "positive", text: "Price near lower Bollinger band — potential support zone" };
    return          { emoji: "📉", sentiment: "negative", text: "Price near upper Bollinger band — potential resistance zone" };
  }

  // Volume
  if (factor.toLowerCase().includes("volume")) {
    const ratioMatch = detail.match(/(\d+\.?\d*)x/);
    const ratio      = ratioMatch ? parseFloat(ratioMatch[1]) : null;
    if (r.signal === "confirming" && ratio && ratio > 2)
      return { emoji: "💪", sentiment: "positive", text: `Volume is ${ratio.toFixed(1)}× higher than usual — strong conviction behind this move` };
    if (r.signal === "confirming")
      return { emoji: "✅", sentiment: "positive", text: "Trading volume is healthy — the current price move is well-supported" };
    if (r.signal === "cautious")
      return { emoji: "⚠️", sentiment: "neutral",  text: "Volume is thin — price moves on low volume can reverse quickly, be cautious" };
    return   { emoji: "➡️", sentiment: "neutral",  text: "Volume is normal — no unusual activity detected" };
  }

  // Fallback: use original detail
  return { emoji, sentiment, text: detail || factor };
}

function WhyThisPrediction({ explain, currency }: { explain: ExplainData; currency: string }) {
  const [expanded, setExpanded] = useState(true);

  const isBuy     = explain.signal === "BUY";
  const isSell    = explain.signal === "SELL";

  // Convert all reasons to story bullets
  const bullets = explain.reasons.map((r) => ({
    ...reasonToStory(r, currency),
    weight: r.weight,
    raw:    r,
  }));

  // Sort: high-weight first
  const weightOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const sorted = [...bullets].sort(
    (a, b) => (weightOrder[a.weight] ?? 2) - (weightOrder[b.weight] ?? 2)
  );

  // Signal color scheme
  const scheme = isBuy
    ? { border: "border-green-200", bg: "bg-green-50",
        title: "text-green-800",   badge: "bg-green-100 text-green-800" }
    : isSell
    ? { border: "border-red-200",   bg: "bg-red-50",
        title: "text-red-800",     badge: "bg-red-100 text-red-800" }
    : { border: "border-yellow-200", bg: "bg-yellow-50",
        title: "text-yellow-800",  badge: "bg-yellow-100 text-yellow-800" };

  return (
    <div className={`rounded-xl border-2 ${scheme.border} ${scheme.bg} mb-4 overflow-hidden`}>

      {/* ── Header row ── */}
      <button
        onClick={() => setExpanded((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <Lightbulb className={`h-4 w-4 ${scheme.title}`} />
          <span className={`text-sm font-bold ${scheme.title}`}>
            Why this prediction?
          </span>
          {/* Signal pill */}
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${scheme.badge}`}>
            {isBuy ? "🟢 BUY" : isSell ? "🔴 SELL" : "🟡 NEUTRAL"} · {explain.confidence}% confidence
          </span>
        </div>
        {expanded
          ? <ChevronDown  className={`h-4 w-4 ${scheme.title} opacity-60`} />
          : <ChevronRight className={`h-4 w-4 ${scheme.title} opacity-60`} />
        }
      </button>

      {/* ── Story bullets ── */}
      {expanded && (
        <div className="px-4 pb-4 space-y-2">

          {/* One-line summary */}
          <p className={`text-[11px] leading-relaxed ${scheme.title} opacity-80 mb-3`}>
            {explain.summary}
          </p>

          {/* Bullet reasons */}
          {sorted.map((b, i) => (
            <div
              key={i}
              className={`flex items-start gap-2.5 p-2.5 rounded-lg transition-colors ${
                b.sentiment === "positive"
                  ? "bg-green-100/60"
                  : b.sentiment === "negative"
                  ? "bg-red-100/60"
                  : "bg-white/60"
              }`}
            >
              {/* Emoji */}
              <span className="text-base flex-shrink-0 leading-none mt-0.5">{b.emoji}</span>

              <div className="flex-1 min-w-0">
                {/* Plain-English sentence */}
                <p className={`text-[11px] font-medium leading-snug ${
                  b.sentiment === "positive" ? "text-green-800"
                  : b.sentiment === "negative" ? "text-red-800"
                  : "text-gray-700"
                }`}>
                  {b.text}
                </p>

                {/* Weight badge */}
                {b.weight === "high" && (
                  <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide">
                    Key signal
                  </span>
                )}
              </div>

              {/* Strength dot */}
              <div
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${
                  b.weight === "high"   ? "bg-gray-500"
                  : b.weight === "medium" ? "bg-gray-300"
                  : "bg-gray-200"
                }`}
                title={`${b.weight} weight signal`}
              />
            </div>
          ))}

          {/* Bull / bear balance bar */}
          <div className="mt-3 pt-2 border-t border-current/10">
            <div className="flex items-center justify-between text-[9px] mb-1">
              <span className="text-green-700 font-semibold">
                🟢 Bullish signals {explain.bull_pct.toFixed(0)}%
              </span>
              <span className="text-red-600 font-semibold">
                {explain.bear_pct.toFixed(0)}% Bearish signals 🔴
              </span>
            </div>
            <div className="h-2 rounded-full bg-red-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-700"
                style={{ width: `${explain.bull_pct}%` }}
              />
            </div>
            <p className={`text-[9px] mt-1 text-center ${scheme.title} opacity-50`}>
              Based on {explain.reasons.length} technical indicators
              · Not financial advice
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function QuoteCard({ symbol }: QuoteCardProps) {
  const { data, isLoading, error } = useQuery<StockQuote>({
    queryKey:        ["quote", symbol],
    queryFn:         () => fetchQuote(symbol),
    refetchInterval: 15_000,
    retry: 1,
  });

  const { data: explain } = useQuery<ExplainData>({
    queryKey: ["explain", symbol],
    queryFn:  async () => {
      const r = await fetch(
        `${BASE_URL}/api/explain?symbol=${encodeURIComponent(symbol)}&period=3mo`
      );
      if (!r.ok) throw new Error("explain failed");
      return r.json();
    },
    staleTime: 5 * 60_000,
    retry: 1,
    enabled: !!symbol,
  });

  // ── Loading ────────────────────────────────────────────────────────────────
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

  // ── Error ──────────────────────────────────────────────────────────────────
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

  const isUp     = data.change >= 0;
  const currency = data.currency || (
    symbol.endsWith(".NS") || symbol.endsWith(".BO") ? "INR" : "USD"
  );

  // Derive RSI from explain
  const rsiReason = explain?.reasons?.find((r) =>
    r.factor?.toLowerCase().includes("rsi")
  );
  const rsiValue  = rsiReason
    ? parseFloat(rsiReason.detail?.match(/(\d+\.?\d*)/)?.[1] || "0") || null
    : null;
  const rsiInfo   = getRsiLabel(rsiValue);

  // Trend from SMA
  const smaReason = explain?.reasons?.find((r) =>
    r.factor?.toLowerCase().includes("sma20")
  );
  const trendUp   = smaReason?.signal === "bullish";
  const trendDown = smaReason?.signal === "bearish";

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
            {smaReason && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${
                trendUp
                  ? "bg-green-50 text-green-700 border-green-200"
                  : trendDown
                  ? "bg-red-50 text-red-600 border-red-200"
                  : "bg-gray-50 text-gray-500 border-gray-200"
              }`}>
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
          <div className={`flex items-center gap-1 justify-end text-sm font-semibold mt-0.5 ${
            isUp ? "text-green-600" : "text-red-500"
          }`}>
            {isUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            <span>
              {isUp ? "+" : ""}{data.change.toFixed(2)}{" "}
              <span className="text-xs">({isUp ? "+" : ""}{data.change_pct}%)</span>
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {isUp ? "Stock is UP today ▲" : "Stock is DOWN today ▼"}
          </p>
        </div>
      </div>

      {/* ── WHY THIS PREDICTION — main new section ── */}
      {explain && (
        <WhyThisPrediction explain={explain} currency={currency} />
      )}

      {/* ── Quick indicator pills ── */}
      <div className="flex flex-wrap gap-2 mb-4">
        {rsiInfo && (
          <div className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded border ${rsiInfo.color}`}>
            <Activity className="h-3 w-3" />
            <span>RSI: {rsiInfo.label}</span>
            <InfoTooltip text={`RSI measures buying/selling momentum. ${rsiInfo.desc}. Values below 30 = oversold, above 70 = overbought.`} />
          </div>
        )}
        {(() => {
          const macdR   = explain?.reasons?.find((r) => r.factor?.toLowerCase().includes("macd"));
          if (!macdR) return null;
          const up      = macdR.signal === "bullish";
          const neutral = macdR.signal === "neutral";
          return (
            <div className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded border ${
              up ? "bg-green-50 text-green-700 border-green-200"
                 : neutral ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                 : "bg-red-50 text-red-600 border-red-200"
            }`}>
              <BarChart2 className="h-3 w-3" />
              <span>MACD: {up ? "Bullish" : neutral ? "Neutral" : "Bearish"}</span>
              <InfoTooltip text="MACD shows the trend's momentum. Bullish means short-term price is rising faster than long-term." />
            </div>
          );
        })()}
        {(() => {
          const volR       = explain?.reasons?.find((r) => r.factor?.toLowerCase().includes("volume"));
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
        <StatCell label="Open"       value={formatPrice(data.open, currency)}
          tooltip="The price this stock opened at today when the market started trading." />
        <StatCell label="High"       value={formatPrice(data.high, currency)}
          tooltip="The highest price reached today. If near here, the stock may face resistance."
          highlight={data.price >= data.high * 0.99 ? "up" : null} />
        <StatCell label="Low"        value={formatPrice(data.low, currency)}
          tooltip="The lowest price today. If near here, it may find support and bounce."
          highlight={data.price <= data.low * 1.01 ? "down" : null} />
        <StatCell label="Volume"     value={formatNumber(data.volume)}
          tooltip="Number of shares traded today. Higher than usual means stronger conviction." />
        <StatCell label="Market Cap" value={formatNumber(data.market_cap)}
          tooltip="Total value of the company. Large cap = more stable. Small cap = more volatile." />
        <StatCell label="P/E Ratio"  value={data.pe_ratio || "—"}
          tooltip="Price-to-Earnings ratio. How much investors pay per ₹1 of profit. >50 = expensive, <15 = cheap." />
        <StatCell label="52W High"   value={data["52w_high"] ? formatPrice(data["52w_high"], currency) : "—"}
          tooltip="Highest price in the last 52 weeks. If near here, the stock may struggle to go higher."
          highlight={data["52w_high"] && data.price >= data["52w_high"] * 0.97 ? "up" : null} />
        <StatCell label="52W Low"    value={data["52w_low"]  ? formatPrice(data["52w_low"],  currency) : "—"}
          tooltip="Lowest price in the last 52 weeks. If near here, the stock may be a bargain — or in trouble."
          highlight={data["52w_low"]  && data.price <= data["52w_low"]  * 1.03 ? "down" : null} />
      </div>

      {/* ── 52W range bar ── */}
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
                width: `${Math.min(100, Math.max(2,
                  ((data.price - data["52w_low"]) / (data["52w_high"] - data["52w_low"])) * 100
                ))}%`,
              }}
            />
          </div>
          <p className="text-[9px] text-muted-foreground mt-1">
            ← Where the price sits within its 1-year range →
          </p>
        </div>
      )}

      {/* ── Footer ── */}
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