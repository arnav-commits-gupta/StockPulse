import { useState, useMemo, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { fetchPrediction, TIMEFRAMES, type PredictionResult } from "@/lib/api";
import {
  Loader2, Brain, Target, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle2, ChevronDown, ChevronRight,
  Clock, Shield,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

interface PredictorProps {
  symbol: string;
}

// ── Model selection ───────────────────────────────────────────────────────────
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

// In Advanced mode the user picks the model manually
const ADVANCED_MODELS = [
  { key:"lr",    label:"Linear",   desc:"Fastest, works on any data"     },
  { key:"rf",    label:"Forest",   desc:"Balanced — good all-rounder"    },
  { key:"gb",    label:"Boost",    desc:"Most accurate, slightly slower"  },
  { key:"stack", label:"Ensemble", desc:"Best accuracy, slowest"          },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPrice(price: number, symbol: string): string {
  const s = symbol.endsWith(".NS") || symbol.endsWith(".BO") ? "₹" : "$";
  return `${s}${price.toLocaleString(undefined, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;
}

function getAccuracyInfo(r2: number) {
  if (r2 >= 0.90) return { label:"Excellent", color:"text-green-700", bg:"bg-green-50 border-green-200",   bar:"bg-green-500", icon:<CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> };
  if (r2 >= 0.75) return { label:"Good",      color:"text-blue-700",  bg:"bg-blue-50 border-blue-200",     bar:"bg-blue-500",  icon:<CheckCircle2 className="h-3.5 w-3.5 text-blue-500"  /> };
  if (r2 >= 0.50) return { label:"Fair",      color:"text-yellow-700",bg:"bg-yellow-50 border-yellow-200", bar:"bg-yellow-400",icon:<AlertTriangle className="h-3.5 w-3.5 text-yellow-500" /> };
  return           { label:"Low",       color:"text-red-700",   bg:"bg-red-50 border-red-200",       bar:"bg-red-400",   icon:<AlertTriangle className="h-3.5 w-3.5 text-red-500"   /> };
}

const MODEL_NAMES: Record<string, string> = {
  lr:"Linear Regression", rf:"Random Forest", gb:"Gradient Boosting",
  ridge:"Ridge Regression", mlp:"Neural Network", stack:"Stacking Ensemble",
  "Linear Regression":"Linear Regression","Random Forest":"Random Forest",
  "Gradient Boosting":"Gradient Boosting","Neural Network (MLP)":"Neural Network",
  "Ridge Regression":"Ridge Regression","Stacking Ensemble":"Stacking Ensemble",
  "Extra Trees":"Extra Trees",
};

// ── Grouped timeframe config ──────────────────────────────────────────────────

const TF_GROUPS = [
  {
    key:"short", label:"⚡ Short Term", desc:"For active traders — minutes to hours",
    color:"text-orange-600", activeBg:"bg-orange-500 text-white",
    hoverBg:"hover:bg-orange-50 hover:text-orange-700",
    tfs:[
      { key:"1m",  label:"1m",  desc:"Next 60 min" },
      { key:"5m",  label:"5m",  desc:"Next 4 hrs"  },
      { key:"15m", label:"15m", desc:"Next 8 hrs"  },
    ],
  },
  {
    key:"swing", label:"📊 Swing", desc:"For swing traders — hours to days",
    color:"text-blue-600", activeBg:"bg-blue-500 text-white",
    hoverBg:"hover:bg-blue-50 hover:text-blue-700",
    tfs:[
      { key:"1h", label:"1h", desc:"Next 2 days" },
      { key:"4h", label:"4h", desc:"Next 5 days" },
    ],
  },
  {
    key:"long", label:"📈 Long Term", desc:"For investors — weeks to months (best for beginners)",
    color:"text-green-600", activeBg:"bg-green-600 text-white",
    hoverBg:"hover:bg-green-50 hover:text-green-700",
    tfs:[
      { key:"1d",  label:"1d", desc:"Next 30 days" },
      { key:"1wk", label:"1w", desc:"Next 12 wks"  },
    ],
  },
] as const;

const TF_DESC: Record<string, string> = {
  "1m":"Predicts next 60 minutes — very active traders only",
  "5m":"Predicts next 4 hours — short-term trading",
  "15m":"Predicts next 8 hours — intraday view",
  "1h":"Predicts next 2 days — swing trading",
  "4h":"Predicts next 5 days — short-term swing",
  "1d":"Predicts next 30 days — recommended for beginners ✅",
  "1wk":"Predicts next 12 weeks — long-term investing view",
};

function getActiveGroup(tf: string) {
  return TF_GROUPS.find((g) => g.tfs.some((t) => t.key === tf)) ?? TF_GROUPS[2];
}

// ── Grouped timeframe selector ────────────────────────────────────────────────

function TimeframeSelector({ value, onChange }: { value: string; onChange: (tf: string) => void }) {
  const activeGroup = getActiveGroup(value);
  type Timeframe =
    | { readonly key: "1m"; readonly label: "1m"; readonly desc: "Next 60 min" }
    | { readonly key: "5m"; readonly label: "5m"; readonly desc: "Next 4 hrs" }
    | { readonly key: "15m"; readonly label: "15m"; readonly desc: "Next 8 hrs" }
    | { readonly key: "1h"; readonly label: "1h"; readonly desc: "Next 2 days" }
    | { readonly key: "4h"; readonly label: "4h"; readonly desc: "Next 5 days" }
    | { readonly key: "1d"; readonly label: "1d"; readonly desc: "Next 30 days" }
    | { readonly key: "1wk"; readonly label: "1w"; readonly desc: "Next 12 wks" };
  const allTfs = ([] as Timeframe[]).concat(...TF_GROUPS.map((g) => g.tfs as unknown as Timeframe[]));
  const activeTf = allTfs.find((t) => t.key === value);

  return (
    <div>
      <div className="flex items-center gap-1 mb-2.5">
        <Clock className="h-3 w-3 text-muted-foreground" />
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          How far ahead to predict
        </label>
      </div>
      <div className="space-y-2">
        {TF_GROUPS.map((group) => {
          const isGroupActive = group.key === activeGroup.key;
          return (
            <div key={group.key} className={`rounded-lg border transition-all duration-200 overflow-hidden ${
              isGroupActive ? "border-foreground/20 shadow-sm" : "border-border"
            }`}>
              <div className={`flex items-center gap-2 px-3 py-2 ${isGroupActive ? "bg-secondary/60" : ""}`}>
                <span className={`text-[11px] font-bold ${group.color}`}>{group.label}</span>
                <span className="text-[9px] text-muted-foreground flex-1">{group.desc}</span>
                <div className="flex gap-1">
                  {group.tfs.map((t) => {
                    const isActive = value === t.key;
                    return (
                      <button
                        key={t.key}
                        onClick={() => onChange(t.key)}
                        title={t.desc}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-all duration-150 ${
                          isActive
                            ? `${group.activeBg} border-transparent shadow-sm scale-105`
                            : `bg-background text-muted-foreground border-border ${group.hoverBg}`
                        }`}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {isGroupActive && activeTf && (
                <div className="px-3 py-1.5 border-t border-border/50 flex items-center gap-1.5">
                  <span className={`text-[10px] font-semibold ${group.color}`}>{activeTf.label}:</span>
                  <span className="text-[10px] text-muted-foreground">{TF_DESC[value]}</span>
                  {value === "1d" && (
                    <span className="ml-auto text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-semibold">
                      Recommended
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MODE TOGGLE — replaces the verbose "Auto-selected: Random
//  Forest (Advanced)" expandable block.
//
//  Auto     → app picks best model silently (default, beginner-friendly)
//  Advanced → user picks model manually (for experienced users)
// ═══════════════════════════════════════════════════════════════

function ModeToggle({
  mode,
  onModeChange,
  advancedModel,
  onAdvancedModelChange,
  autoModelName,
}: {
  mode: "auto" | "advanced";
  onModeChange: (m: "auto" | "advanced") => void;
  advancedModel: string;
  onAdvancedModelChange: (m: string) => void;
  autoModelName: string;
}) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">

      {/* Toggle row */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-secondary/30">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          Mode
        </span>

        {/* Two-button pill toggle */}
        <div className="flex rounded-md border border-border overflow-hidden">
          <button
            onClick={() => onModeChange("auto")}
            className={`px-3 py-1 text-xs font-semibold transition-colors ${
              mode === "auto"
                ? "bg-foreground text-background"
                : "bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            Auto
          </button>
          <button
            onClick={() => onModeChange("advanced")}
            className={`px-3 py-1 text-xs font-semibold transition-colors border-l border-border ${
              mode === "advanced"
                ? "bg-foreground text-background"
                : "bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            Advanced
          </button>
        </div>
      </div>

      {/* Body: changes based on mode */}
      {mode === "auto" ? (
        /* Auto mode — one silent line, no clutter */
        <div className="px-3 py-2 flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">
            Best model selected automatically
          </span>
          <span className="text-[10px] text-foreground font-semibold bg-secondary px-1.5 py-0.5 rounded ml-auto">
            {autoModelName}
          </span>
        </div>
      ) : (
        /* Advanced mode — compact 4-button model picker */
        <div className="px-3 py-2.5">
          <p className="text-[10px] text-muted-foreground mb-2">Pick model:</p>
          <div className="grid grid-cols-4 gap-1.5">
            {ADVANCED_MODELS.map((m) => (
              <button
                key={m.key}
                onClick={() => onAdvancedModelChange(m.key)}
                title={m.desc}
                className={`py-1.5 rounded-md border text-center transition-all ${
                  advancedModel === m.key
                    ? "bg-foreground text-background border-transparent font-semibold"
                    : "bg-background text-muted-foreground border-border hover:text-foreground hover:border-foreground/30"
                }`}
              >
                <p className="text-[10px] font-semibold">{m.label}</p>
                <p className="text-[8px] text-current opacity-60 leading-tight">{m.desc.split(",")[0]}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Loading steps ─────────────────────────────────────────────────────────────

const STEPS = [
  { icon:"📡", label:"Fetching historical data..." },
  { icon:"🔧", label:"Building feature matrix..."  },
  { icon:"🧠", label:"Training AI model..."         },
  { icon:"📊", label:"Generating forecast..."       },
  { icon:"✅", label:"Almost done..."               },
];

function LoadingSteps() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s+1, STEPS.length-1)), 1800);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="py-8 flex flex-col items-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      <div className="space-y-1.5 w-full max-w-xs">
        {STEPS.map((s, i) => (
          <div key={i} className={`flex items-center gap-2 text-xs transition-all duration-300 ${
            i < step   ? "text-muted-foreground line-through opacity-40"
            : i===step ? "text-foreground font-semibold"
            : "text-muted-foreground/30"
          }`}>
            <span>{s.icon}</span><span>{s.label}</span>
            {i===step && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
            {i < step  && <CheckCircle2 className="h-3 w-3 text-green-500 ml-auto" />}
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">Training on real data — takes 5–15 seconds</p>
    </div>
  );
}

// ── Chart tooltip ─────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, symbol }: any) {
  if (!active || !payload?.length) return null;
  const hist = payload.find((p: any) => p.dataKey === "historical");
  const fore = payload.find((p: any) => p.dataKey === "forecast");
  return (
    <div className="bg-popover border border-border rounded-lg p-2.5 shadow-lg text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {hist?.value && <p className="text-blue-600">Price: {formatPrice(hist.value, symbol)}</p>}
      {fore?.value && (
        <p className="text-green-600 font-semibold">
          Forecast: {formatPrice(fore.value, symbol)}
          <span className="text-muted-foreground font-normal ml-1 text-[10px]">estimated</span>
        </p>
      )}
    </div>
  );
}

// ── Forecast summary ──────────────────────────────────────────────────────────

function ForecastSummary({ result, symbol }: { result: PredictionResult; symbol: string }) {
  const current   = result.history.prices[result.history.prices.length - 1];
  const target    = result.forecast.prices[result.forecast.prices.length - 1];
  const change    = target - current;
  const changePct = (change / current) * 100;
  const isUp      = change >= 0;
  const acc       = getAccuracyInfo(result.metrics.r2);
  const tf        = TIMEFRAMES.find((t) => t.key === result.timeframe);
  const [showMore, setShowMore] = useState(false);

  const timeLabel = (() => {
    const n = result.forecast.prices.length;
    const u = result.unit || tf?.unit || "days";
    if (u.includes("min"))  return `next ${n} minutes`;
    if (u.includes("hour")) return `next ${n} hours`;
    if (u.includes("week")) return `next ${n} weeks`;
    return `next ${n} days`;
  })();

  return (
    <div className="mt-3 space-y-2">
      {/* Primary card */}
      <div className={`rounded-xl border-2 p-4 ${
        isUp ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"
      }`}>
        <div className="flex items-center gap-2 mb-3">
          {isUp
            ? <TrendingUp  className="h-5 w-5 text-green-600 flex-shrink-0" />
            : <TrendingDown className="h-5 w-5 text-red-500  flex-shrink-0" />
          }
          <span className={`text-base font-bold tracking-tight ${isUp ? "text-green-800" : "text-red-800"}`}>
            {isUp ? "📈" : "📉"} Prediction: Likely {isUp ? "UP" : "DOWN"}{" "}
            <span className="tabular-nums">({isUp ? "+" : ""}{changePct.toFixed(1)}%)</span>
          </span>
        </div>
        <div className={`flex items-center gap-2 text-sm font-semibold tabular-nums mb-3 ${
          isUp ? "text-green-700" : "text-red-700"
        }`}>
          <span className="text-base">{formatPrice(current, symbol)}</span>
          <span className="text-xl font-light">→</span>
          <span className="text-lg font-bold">{formatPrice(target, symbol)}</span>
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
            isUp ? "bg-green-200 text-green-800" : "bg-red-200 text-red-800"
          }`}>
            {isUp ? "+" : ""}{formatPrice(Math.abs(change), symbol)}
          </span>
        </div>
        <div className={`flex items-center justify-between pt-2.5 border-t ${
          isUp ? "border-green-200" : "border-red-200"
        }`}>
          <span className={`text-[11px] ${isUp ? "text-green-600" : "text-red-600"}`}>
            🕐 {timeLabel}
          </span>
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-semibold ${isUp ? "text-green-700" : "text-red-700"}`}>
              Confidence: {result.confidence}%
            </span>
            <div className="w-16 h-1.5 rounded-full bg-white/60 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${isUp ? "bg-green-500" : "bg-red-400"}`}
                style={{ width:`${result.confidence}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Accuracy bar */}
      <div className={`rounded-lg border p-2.5 flex items-center gap-2.5 ${acc.bg}`}>
        {acc.icon}
        <span className={`text-xs font-semibold ${acc.color}`}>Model accuracy: {acc.label}</span>
        <div className="flex-1 h-1 rounded-full bg-white/50 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${acc.bar}`}
            style={{ width:`${Math.min(100, result.metrics.r2*100)}%` }} />
        </div>
        <span className={`text-[10px] font-bold tabular-nums ${acc.color}`}>
          {(result.metrics.r2*100).toFixed(0)}%
        </span>
        <button
          onClick={() => setShowMore((o) => !o)}
          className={`text-[10px] ${acc.color} opacity-60 hover:opacity-100 flex items-center gap-0.5 flex-shrink-0`}
        >
          Details
          {showMore ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
      </div>

      {showMore && (
        <div className="rounded-lg border border-border bg-secondary/30 p-3">
          <div className="grid grid-cols-3 gap-3 text-center mb-2">
            {[
              { k:"R² Score",  v:String(result.metrics.r2),              tip:"1.0 = perfect, 0 = random"  },
              { k:"Avg Error", v:formatPrice(result.metrics.mae, symbol), tip:"Average price error"         },
              { k:"RMSE",      v:result.metrics.rmse.toFixed(2),          tip:"Penalises large errors more" },
            ].map((m) => (
              <div key={m.k} title={m.tip}>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{m.k}</p>
                <p className="text-xs font-bold text-foreground">{m.v}</p>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-muted-foreground text-center border-t border-border pt-2">
            {MODEL_NAMES[result.model] || result.model} · {result.candles_used} data points ·{" "}
            {result.metrics.train_size} train / {result.metrics.test_size} test
          </p>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
        ⚠️ AI estimate only · Not financial advice · Past patterns ≠ future results
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Predictor({ symbol }: PredictorProps) {
  const [timeframe, setTimeframe]         = useState("1d");
  const [mode, setMode]                   = useState<"auto" | "advanced">("auto");
  const [advancedModel, setAdvancedModel] = useState("gb");

  // Auto mode picks best model; Advanced uses user's choice
  const autoModel     = useMemo(() => selectBestModel(symbol, timeframe), [symbol, timeframe]);
  const selectedModel = mode === "auto" ? autoModel : advancedModel;
  const autoModelName = MODEL_NAMES[autoModel] || autoModel;
  const tf            = TIMEFRAMES.find((t) => t.key === timeframe);

  const mutation = useMutation({
    mutationFn: () => fetchPrediction(symbol, timeframe, selectedModel),
  });

  const result = mutation.data;

  const chartData = result
    ? [
        ...result.history.dates.map((d, i) => ({
          date: d.split("T")[0].split(" ")[0],
          historical: result.history.prices[i],
          forecast: null as number | null,
        })),
        ...result.forecast.dates.map((d, i) => ({
          date: d.split("T")[0].split(" ")[0],
          historical: null as number | null,
          forecast: result.forecast.prices[i],
        })),
      ]
    : [];

  if (chartData.length > 0 && result) {
    const hl = result.history.dates.length;
    if (hl > 0 && chartData[hl]) chartData[hl].historical = result.history.prices[hl - 1];
  }

  const lastForecast = result?.forecast.prices[result.forecast.prices.length - 1];
  const lastHist     = result?.history.prices[result.history.prices.length - 1];
  const forecastUp   = lastForecast !== undefined && lastHist !== undefined && lastForecast > lastHist;

  return (
    <div className="bg-card rounded-lg border border-border">

      {/* Header */}
      <div className="p-5 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-1">
          <Brain className="h-4 w-4" /> AI Price Predictor
        </h3>
        <p className="text-[11px] text-muted-foreground">
          Trains a machine learning model on{" "}
          {symbol.replace(".NS","").replace(".BO","")}'s price history and forecasts future prices
        </p>
      </div>

      <div className="p-5 space-y-4">

        {/* Grouped timeframe selector */}
        <TimeframeSelector value={timeframe} onChange={setTimeframe} />

        {/* ── AUTO / ADVANCED TOGGLE ── */}
        <ModeToggle
          mode={mode}
          onModeChange={setMode}
          advancedModel={advancedModel}
          onAdvancedModelChange={setAdvancedModel}
          autoModelName={autoModelName}
        />

        {/* Run button */}
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="w-full py-3 bg-foreground text-background rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {mutation.isPending
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Running AI model...</>
            : <><Brain className="h-4 w-4" /> {result ? "Re-run Prediction" : "Run Prediction"}</>
          }
        </button>

        {/* Error */}
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

        {/* Loading */}
        {mutation.isPending && <LoadingSteps />}

        {/* Results */}
        {result && !mutation.isPending && (
          <div>
            <div className="mb-1">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-semibold text-foreground">Price History + Forecast</p>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-0.5 bg-blue-500 rounded" /> Real
                  </span>
                  <span className="flex items-center gap-1">
                    <span
                      className="inline-block w-3 h-px rounded"
                      style={{ borderTop:`2px dashed ${forecastUp ? "#22c55e" : "#ef4444"}` }}
                    />
                    Forecast
                  </span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={210}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                  <XAxis dataKey="date" tick={{ fontSize:9 }} stroke="hsl(220 9% 46%)"
                    tickFormatter={(v) => v.slice(5)} />
                  <YAxis domain={["auto","auto"]} tick={{ fontSize:9 }} stroke="hsl(220 9% 46%)"
                    tickFormatter={(v) =>
                      symbol.endsWith(".NS") || symbol.endsWith(".BO")
                        ? `₹${v.toLocaleString()}` : `$${v.toFixed(0)}`
                    } />
                  <Tooltip content={<ChartTooltip symbol={symbol} />} />
                  {result.history.dates.length > 0 && (
                    <ReferenceLine
                      x={result.history.dates[result.history.dates.length-1].split("T")[0].split(" ")[0]}
                      stroke="hsl(220 9% 46%)" strokeDasharray="4 2"
                      label={{ value:"Now", position:"insideTopRight", fontSize:9, fill:"hsl(220 9% 46%)" }}
                    />
                  )}
                  <Line type="monotone" dataKey="historical" stroke="hsl(217 91% 60%)"
                    dot={false} strokeWidth={1.5} connectNulls={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="forecast"
                    stroke={forecastUp ? "#22c55e" : "#ef4444"}
                    dot={false} strokeWidth={2.5} strokeDasharray="6 3"
                    connectNulls={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <ForecastSummary result={result} symbol={symbol} />
          </div>
        )}

        {/* Empty state */}
        {!result && !mutation.isPending && !mutation.isError && (
          <div className="py-6 flex flex-col items-center gap-3 text-center">
            <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center">
              <Brain className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Ready to predict</p>
              <p className="text-[11px] text-muted-foreground mt-1 max-w-[240px]">
                Hit "Run Prediction" — the AI trains on{" "}
                {symbol.replace(".NS","").replace(".BO","")}'s history then forecasts the next{" "}
                {tf?.forecast} {tf?.unit}
              </p>
            </div>
            <div className="flex flex-col gap-1.5 w-full max-w-[260px]">
              {[
                { icon:<Shield        className="h-3 w-3 text-blue-500"   />, text:"Trains fresh on real market data"              },
                { icon:<Target        className="h-3 w-3 text-green-500"  />, text:"Shows accuracy so you know how reliable it is" },
                { icon:<AlertTriangle className="h-3 w-3 text-yellow-500" />, text:"Not financial advice — one of many tools"      },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px] text-muted-foreground bg-secondary/50 rounded px-2.5 py-1.5">
                  {item.icon}{item.text}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
