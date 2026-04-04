import { useState, useMemo, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { fetchPrediction, TIMEFRAMES, type PredictionResult } from "@/lib/api";
import {
  Loader2, Brain, Target, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle2, Info, ChevronDown, ChevronRight,
  Clock, Zap, Shield,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

interface PredictorProps {
  symbol: string;
}

// ── Model selection (unchanged from your original) ────────────────────────────
const selectBestModel = (symbol: string, timeframe: string): string => {
  const volatile = ["TSLA","NVDA","AMD","BTC-USD","ETH-USD","XRP-USD","SOL-USD","MRNA"];
  const tech     = ["NVDA","META","AMZN","GOOGL","NFLX","MSFT"];
  const stable   = ["KO","JNJ","PG","VZ","T","PEP","MCD","WMT","COST"];
  if (symbol.includes("USD") || symbol.includes("BTC") || symbol.includes("ETH")) return "gb";
  if (["1m","5m"].includes(timeframe)) return "lr";
  if (["15m","1h","4h"].includes(timeframe)) return volatile.includes(symbol) ? "gb" : "rf";
  if (["1d","1wk"].includes(timeframe)) {
    if (volatile.includes(symbol) || tech.includes(symbol)) return "gb";
    if (stable.includes(symbol)) return "lr";
    return "rf";
  }
  return "rf";
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPrice(price: number, symbol: string): string {
  const sym = symbol.endsWith(".NS") || symbol.endsWith(".BO") ? "₹" : "$";
  return `${sym}${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Convert R² (0–1) to a human label + color
function getAccuracyInfo(r2: number): {
  label: string; desc: string; color: string; bg: string; icon: JSX.Element;
} {
  if (r2 >= 0.90) return {
    label: "Excellent", desc: "Model predictions matched real prices very closely in testing",
    color: "text-green-700", bg: "bg-green-50 border-green-200",
    icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  };
  if (r2 >= 0.75) return {
    label: "Good", desc: "Predictions were reasonably close — suitable for trend direction",
    color: "text-blue-700", bg: "bg-blue-50 border-blue-200",
    icon: <CheckCircle2 className="h-4 w-4 text-blue-500" />,
  };
  if (r2 >= 0.50) return {
    label: "Fair", desc: "Captures the general trend but individual prices may differ",
    color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200",
    icon: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  };
  return {
    label: "Low", desc: "This stock is hard to predict — treat forecast as rough guidance only",
    color: "text-red-700", bg: "bg-red-50 border-red-200",
    icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
  };
}

// Plain-English model names
const MODEL_NAMES: Record<string, string> = {
  lr:    "Linear Regression",
  rf:    "Random Forest",
  gb:    "Gradient Boosting",
  ridge: "Ridge Regression",
  mlp:   "Neural Network",
  "Linear Regression": "Linear Regression",
  "Random Forest": "Random Forest",
  "Gradient Boosting": "Gradient Boosting",
  "Neural Network (MLP)": "Neural Network",
  "Ridge Regression": "Ridge Regression",
};

const MODEL_DESC: Record<string, string> = {
  lr:    "Simple & fast — best for stable, predictable stocks",
  rf:    "Balanced accuracy — uses many decision trees to reduce errors",
  gb:    "Most accurate — learns from each mistake to improve predictions",
  ridge: "Conservative — avoids overfitting by keeping predictions stable",
  mlp:   "Neural network — learns complex patterns from historical data",
};

// Timeframe descriptions for beginners
const TF_DESC: Record<string, string> = {
  "1m":  "Predicts next 60 minutes — for very active traders",
  "5m":  "Predicts next 4 hours — short-term trading",
  "15m": "Predicts next 8 hours — intraday view",
  "1h":  "Predicts next 2 days — swing trading",
  "4h":  "Predicts next 5 days — short-term swing",
  "1d":  "Predicts next 30 days — medium-term view (recommended for beginners)",
  "1wk": "Predicts next 12 weeks — long-term investing view",
};

// ── Step-by-step loading indicator ───────────────────────────────────────────

const LOADING_STEPS = [
  { icon: "📡", label: "Fetching historical data..." },
  { icon: "🔧", label: "Building feature matrix..." },
  { icon: "🧠", label: "Training AI model..." },
  { icon: "📊", label: "Generating forecast..." },
  { icon: "✅", label: "Almost done..." },
];

function LoadingSteps() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1));
    }, 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="py-8 flex flex-col items-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      <div className="space-y-1.5 w-full max-w-xs">
        {LOADING_STEPS.map((s, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 text-xs transition-all duration-300 ${
              i < step
                ? "text-muted-foreground line-through opacity-50"
                : i === step
                ? "text-foreground font-semibold"
                : "text-muted-foreground/40"
            }`}
          >
            <span>{s.icon}</span>
            <span>{s.label}</span>
            {i === step && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
            {i < step  && <CheckCircle2 className="h-3 w-3 text-green-500 ml-auto" />}
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground text-center max-w-[200px]">
        Training happens live on your data — this takes 5–15 seconds
      </p>
    </div>
  );
}

// ── Custom chart tooltip ──────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, symbol }: any) {
  if (!active || !payload?.length) return null;
  const hist = payload.find((p: any) => p.dataKey === "historical");
  const fore = payload.find((p: any) => p.dataKey === "forecast");
  const isForecast = !!fore?.value;
  return (
    <div className="bg-popover border border-border rounded-lg p-2.5 shadow-lg text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {hist?.value && (
        <p className="text-blue-600">Historical: {formatPrice(hist.value, symbol)}</p>
      )}
      {fore?.value && (
        <p className="text-green-600 font-semibold">
          AI Forecast: {formatPrice(fore.value, symbol)}
          <span className="text-[10px] text-muted-foreground ml-1">(estimated)</span>
        </p>
      )}
    </div>
  );
}

// ── Forecast summary card ─────────────────────────────────────────────────────

function ForecastSummary({
  result, symbol,
}: {
  result: PredictionResult; symbol: string;
}) {
  const lastHistorical = result.history.prices[result.history.prices.length - 1];
  const lastForecast   = result.forecast.prices[result.forecast.prices.length - 1];
  const midForecast    = result.forecast.prices[Math.floor(result.forecast.prices.length / 2)];
  const change         = lastForecast - lastHistorical;
  const changePct      = (change / lastHistorical) * 100;
  const isUp           = change >= 0;
  const tf             = TIMEFRAMES.find((t) => t.key === result.timeframe);
  const acc            = getAccuracyInfo(result.metrics.r2);
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="space-y-3 mt-4">

      {/* Main forecast result */}
      <div className={`rounded-lg border p-4 ${isUp ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className={`text-[10px] font-semibold uppercase tracking-wide ${isUp ? "text-green-700" : "text-red-700"}`}>
              {isUp ? "📈 AI predicts UPWARD movement" : "📉 AI predicts DOWNWARD movement"}
            </p>
            <p className={`text-xs mt-0.5 ${isUp ? "text-green-600" : "text-red-600"}`}>
              over the next {result.forecast.prices.length} {result.unit}
            </p>
          </div>
          {isUp ? (
            <TrendingUp className="h-5 w-5 text-green-500 flex-shrink-0" />
          ) : (
            <TrendingDown className="h-5 w-5 text-red-500 flex-shrink-0" />
          )}
        </div>

        {/* Price targets */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          {[
            { label: "Current", val: lastHistorical, sub: "right now" },
            { label: "Mid-point", val: midForecast,  sub: "halfway through" },
            { label: "Target",   val: lastForecast,  sub: "end of forecast" },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <p className="text-[9px] text-muted-foreground">{item.sub}</p>
              <p className="text-sm font-bold text-foreground tabular-nums">
                {formatPrice(item.val, symbol)}
              </p>
              <p className="text-[10px] text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Expected change */}
        <div className={`mt-3 text-center py-1.5 rounded ${isUp ? "bg-green-100" : "bg-red-100"}`}>
          <span className={`text-xs font-bold ${isUp ? "text-green-700" : "text-red-700"}`}>
            Expected change: {isUp ? "+" : ""}{formatPrice(Math.abs(change), symbol)}{" "}
            ({isUp ? "+" : ""}{changePct.toFixed(1)}%)
          </span>
        </div>
      </div>

      {/* Accuracy card */}
      <div className={`rounded-lg border p-3 ${acc.bg}`}>
        <div className="flex items-center gap-2 mb-1">
          {acc.icon}
          <span className={`text-xs font-bold ${acc.color}`}>
            Model Accuracy: {acc.label} ({(result.metrics.r2 * 100).toFixed(0)}%)
          </span>
        </div>
        <p className={`text-[11px] ${acc.color} opacity-80`}>{acc.desc}</p>

        {/* Progress bar for accuracy */}
        <div className="mt-2 h-1.5 bg-white/60 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              result.metrics.r2 >= 0.9 ? "bg-green-500"
              : result.metrics.r2 >= 0.75 ? "bg-blue-500"
              : result.metrics.r2 >= 0.5 ? "bg-yellow-500"
              : "bg-red-500"
            }`}
            style={{ width: `${Math.min(100, result.metrics.r2 * 100)}%` }}
          />
        </div>

        {/* Expandable technical details */}
        <button
          onClick={() => setShowDetails((o) => !o)}
          className={`mt-2 flex items-center gap-1 text-[10px] ${acc.color} opacity-60 hover:opacity-100`}
        >
          {showDetails ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {showDetails ? "Hide" : "Show"} technical details
        </button>
        {showDetails && (
          <div className={`mt-2 pt-2 border-t border-current/10 grid grid-cols-3 gap-2 text-center`}>
            {[
              { key: "R² Score", val: result.metrics.r2, tip: "1.0 = perfect prediction, 0 = random" },
              { key: "MAE",      val: result.metrics.mae.toFixed(2), tip: "Average price error in same units as stock" },
              { key: "RMSE",     val: result.metrics.rmse.toFixed(2), tip: "Penalises large errors more — lower is better" },
            ].map((m) => (
              <div key={m.key} title={m.tip}>
                <p className={`text-[9px] ${acc.color} opacity-60 uppercase`}>{m.key}</p>
                <p className={`text-xs font-bold ${acc.color}`}>{m.val}</p>
              </div>
            ))}
            <div className="col-span-3">
              <p className={`text-[9px] ${acc.color} opacity-60`}>
                Model: {MODEL_NAMES[result.model] || result.model} · {result.candles_used} data points ·{" "}
                {result.metrics.train_size} train / {result.metrics.test_size} test
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0 mt-0.5" />
        <p className="text-[10px] text-yellow-800 leading-relaxed">
          <span className="font-semibold">Not financial advice.</span> This is an AI model trained on historical price patterns.
          Stock markets are unpredictable — past patterns do not guarantee future results.
          Always do your own research before making investment decisions.
        </p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Predictor({ symbol }: PredictorProps) {
  const [timeframe, setTimeframe] = useState("1d");
  const [showModelInfo, setShowModelInfo] = useState(false);

  const selectedModel = useMemo(() => selectBestModel(symbol, timeframe), [symbol, timeframe]);
  const modelName     = MODEL_NAMES[selectedModel] || selectedModel;
  const modelDesc     = MODEL_DESC[selectedModel] || "";
  const tfDesc        = TF_DESC[timeframe] || "";
  const tf            = TIMEFRAMES.find((t) => t.key === timeframe);

  const mutation = useMutation({
    mutationFn: () => fetchPrediction(symbol, timeframe, selectedModel),
  });

  const result = mutation.data;

  // Build chart data
  const chartData = result
    ? [
        ...result.history.dates.map((d, i) => ({
          date: d.split("T")[0].split(" ")[0],
          historical: result.history.prices[i],
          forecast:   null as number | null,
        })),
        ...result.forecast.dates.map((d, i) => ({
          date: d.split("T")[0].split(" ")[0],
          historical: null as number | null,
          forecast:   result.forecast.prices[i],
        })),
      ]
    : [];

  // Bridge: connect historical to forecast
  if (chartData.length > 0 && result) {
    const hl = result.history.dates.length;
    if (hl > 0 && chartData[hl]) {
      chartData[hl].historical = result.history.prices[hl - 1];
    }
  }

  const lastForecast = result?.forecast.prices[result.forecast.prices.length - 1];
  const lastHist     = result?.history.prices[result.history.prices.length - 1];
  const forecastUp   = lastForecast !== undefined && lastHist !== undefined && lastForecast > lastHist;

  return (
    <div className="bg-card rounded-lg border border-border">

      {/* ── Header ── */}
      <div className="p-5 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-1">
          <Brain className="h-4 w-4" />
          AI Price Predictor
        </h3>
        <p className="text-[11px] text-muted-foreground">
          Trains a machine learning model on {symbol}'s price history and forecasts future prices
        </p>
      </div>

      <div className="p-5 space-y-5">

        {/* ── Timeframe selector ── */}
        <div>
          <div className="flex items-center gap-1 mb-2">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              How far ahead to predict
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.key}
                onClick={() => setTimeframe(tf.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  timeframe === tf.key
                    ? "bg-foreground text-background"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
          {/* Plain-English timeframe description */}
          <p className="text-[11px] text-muted-foreground bg-secondary/50 rounded px-2.5 py-1.5">
            💡 {tfDesc}
          </p>
        </div>

        {/* ── Auto-selected model info ── */}
        <div className="rounded-lg border border-border p-3">
          <button
            onClick={() => setShowModelInfo((o) => !o)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-foreground" />
              <span className="text-xs font-semibold text-foreground">
                Auto-selected: {modelName}
              </span>
              <span className="text-[9px] bg-foreground text-background px-1.5 py-0.5 rounded">
                {selectedModel === "gb" ? "Best" : selectedModel === "rf" ? "Advanced" : "Standard"}
              </span>
            </div>
            {showModelInfo
              ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            }
          </button>
          {showModelInfo && (
            <div className="mt-2 pt-2 border-t border-border space-y-1.5">
              <p className="text-[11px] text-muted-foreground">{modelDesc}</p>
              <div className="grid grid-cols-3 gap-1.5 mt-2">
                {[
                  { key: "lr",    name: "Linear",   desc: "Fastest", badge: "Standard" },
                  { key: "rf",    name: "Random Forest", desc: "Balanced", badge: "Advanced" },
                  { key: "gb",    name: "Gradient Boost", desc: "Most accurate", badge: "Best" },
                ].map((m) => (
                  <div
                    key={m.key}
                    className={`p-2 rounded border text-center text-[10px] ${
                      selectedModel === m.key
                        ? "border-foreground bg-foreground/5"
                        : "border-border opacity-50"
                    }`}
                  >
                    <p className="font-semibold">{m.name}</p>
                    <p className="text-muted-foreground">{m.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Run button ── */}
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="w-full py-3 bg-foreground text-background rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Running AI model...
            </>
          ) : (
            <>
              <Brain className="h-4 w-4" />
              {result ? "Re-run Prediction" : "Run Prediction"}
            </>
          )}
        </button>

        {/* ── Error ── */}
        {mutation.isError && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-red-700">Prediction failed</p>
              <p className="text-[11px] text-red-600 mt-0.5">
                {(mutation.error as Error).message || "Make sure your backend is running"}
              </p>
            </div>
          </div>
        )}

        {/* ── Loading steps ── */}
        {mutation.isPending && <LoadingSteps />}

        {/* ── Results ── */}
        {result && !mutation.isPending && (
          <div>
            {/* Chart */}
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-foreground">
                  Price Chart + AI Forecast
                </p>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-0.5 bg-blue-500 rounded" /> Historical
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-0.5 bg-green-500 rounded border-dashed" /> AI Forecast
                  </span>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9 }}
                    stroke="hsl(220 9% 46%)"
                    tickFormatter={(v) => v.slice(5)}  // show MM-DD only
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    tick={{ fontSize: 9 }}
                    stroke="hsl(220 9% 46%)"
                    tickFormatter={(v) =>
                      symbol.endsWith(".NS") || symbol.endsWith(".BO")
                        ? `₹${v.toLocaleString()}`
                        : `$${v.toFixed(0)}`
                    }
                  />
                  <Tooltip content={<ChartTooltip symbol={symbol} />} />
                  {/* Vertical line separating historical from forecast */}
                  {result.history.dates.length > 0 && (
                    <ReferenceLine
                      x={result.history.dates[result.history.dates.length - 1].split("T")[0].split(" ")[0]}
                      stroke="hsl(220 9% 46%)"
                      strokeDasharray="4 2"
                      label={{ value: "Today", position: "insideTopRight", fontSize: 9, fill: "hsl(220 9% 46%)" }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="historical"
                    stroke="hsl(217 91% 60%)"
                    dot={false}
                    strokeWidth={1.5}
                    name="Historical"
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    stroke={forecastUp ? "#22c55e" : "#ef4444"}
                    dot={false}
                    strokeWidth={2.5}
                    strokeDasharray="6 3"
                    name="Forecast"
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>

              {/* Chart legend explanation */}
              <p className="text-[10px] text-muted-foreground text-center mt-1">
                Blue line = real historical prices · Dashed line = AI forecast (estimated)
              </p>
            </div>

            {/* Forecast summary, accuracy, disclaimer */}
            <ForecastSummary result={result} symbol={symbol} />
          </div>
        )}

        {/* ── First-time empty state ── */}
        {!result && !mutation.isPending && !mutation.isError && (
          <div className="py-6 flex flex-col items-center gap-3 text-center">
            <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center">
              <Brain className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Ready to predict</p>
              <p className="text-[11px] text-muted-foreground mt-1 max-w-[240px]">
                Click "Run Prediction" and the AI will train on {symbol}'s price history
                then forecast the next {tf?.forecast} {tf?.unit}
              </p>
            </div>
            <div className="flex flex-col gap-1.5 w-full max-w-[260px]">
              {[
                { icon: <Shield className="h-3 w-3 text-blue-500" />, text: "Trains fresh on real market data" },
                { icon: <Target className="h-3 w-3 text-green-500" />, text: "Shows accuracy score so you know how reliable it is" },
                { icon: <AlertTriangle className="h-3 w-3 text-yellow-500" />, text: "Not financial advice — use as one of many tools" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px] text-muted-foreground bg-secondary/50 rounded px-2.5 py-1.5">
                  {item.icon}
                  {item.text}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}