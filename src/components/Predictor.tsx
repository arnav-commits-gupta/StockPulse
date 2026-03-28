import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { fetchPrediction, TIMEFRAMES, MODEL_OPTIONS, type PredictionResult } from "@/lib/api";
import { Loader2, Brain, BarChart3, Target } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

interface PredictorProps {
  symbol: string;
}

export default function Predictor({ symbol }: PredictorProps) {
  const [timeframe, setTimeframe] = useState("1d");
  const [model, setModel] = useState("lr");

  const mutation = useMutation({
    mutationFn: () => fetchPrediction(symbol, timeframe, model),
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

  // Bridge: add last historical price to first forecast point
  if (chartData.length > 0 && result) {
    const histLen = result.history.dates.length;
    if (histLen > 0 && chartData[histLen]) {
      chartData[histLen].historical = result.history.prices[histLen - 1];
    }
  }

  return (
    <div className="bg-card rounded-lg border border-border">
      <div className="p-6 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
          <Brain className="h-4 w-4 text-accent" />
          ML Price Predictor
        </h3>

        {/* Timeframe */}
        <div className="mb-4">
          <label className="text-[11px] text-muted-foreground uppercase tracking-wide block mb-2">Timeframe</label>
          <div className="flex flex-wrap gap-1.5">
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
        </div>

        {/* Model */}
        <div className="mb-4">
          <label className="text-[11px] text-muted-foreground uppercase tracking-wide block mb-2">Model</label>
          <div className="flex gap-2">
            {MODEL_OPTIONS.map((m) => (
              <button
                key={m.key}
                onClick={() => setModel(m.key)}
                className={`flex-1 px-3 py-2 text-xs rounded border transition-colors ${
                  model === m.key
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
                }`}
              >
                <div className="font-medium">{m.label}</div>
                <div className="text-[10px] mt-0.5 opacity-70">{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Run button */}
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="w-full py-2.5 bg-foreground text-background rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Training model...
            </>
          ) : (
            <>
              <Brain className="h-4 w-4" />
              Run Prediction
            </>
          )}
        </button>

        {mutation.isError && (
          <p className="mt-3 text-xs text-destructive">
            {(mutation.error as Error).message}
          </p>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="p-6">
          {/* Metrics */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-secondary rounded-md p-3 text-center">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center justify-center gap-1">
                <Target className="h-3 w-3" /> R² Score
              </div>
              <div className="text-lg font-bold text-foreground mt-1">{result.metrics.r2}</div>
            </div>
            <div className="bg-secondary rounded-md p-3 text-center">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center justify-center gap-1">
                <BarChart3 className="h-3 w-3" /> MAE
              </div>
              <div className="text-lg font-bold text-foreground mt-1">{result.metrics.mae}</div>
            </div>
            <div className="bg-secondary rounded-md p-3 text-center">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">RMSE</div>
              <div className="text-lg font-bold text-foreground mt-1">{result.metrics.rmse}</div>
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground mb-2">
            {result.model} model · {result.candles_used} candles · {result.metrics.train_size} train / {result.metrics.test_size} test
          </div>

          {/* Forecast chart */}
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="hsl(220 9% 46%)" />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10 }} stroke="hsl(220 9% 46%)" />
              <Tooltip
                contentStyle={{
                  background: "hsl(0 0% 100%)",
                  border: "1px solid hsl(220 13% 91%)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Line type="monotone" dataKey="historical" stroke="hsl(217 91% 60%)" dot={false} strokeWidth={1.5} name="Historical" />
              <Line type="monotone" dataKey="forecast" stroke="hsl(142 71% 45%)" dot={false} strokeWidth={2} strokeDasharray="6 3" name="Forecast" />
            </LineChart>
          </ResponsiveContainer>

          {/* Forecast summary */}
          <div className="mt-4 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Forecasting {result.forecast.prices.length} {result.unit}
            </span>
            <span className="font-medium text-foreground">
              Last: ${result.forecast.prices[result.forecast.prices.length - 1]?.toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
