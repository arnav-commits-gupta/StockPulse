// Configure this to point to your Flask backend
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5002";

export interface WatchlistItem {
  symbol: string;
  name: string;
}

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  change_pct: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  market_cap: number;
  pe_ratio: number;
  "52w_high": number;
  "52w_low": number;
  sector: string;
  currency: string;
  exchange: string;
}

export interface ChartData {
  dates: string[];
  close: number[];
  open: number[];
  high: number[];
  low: number[];
  volume: number[];
  sma20: (number | null)[];
  sma50: (number | null)[];
  ema20: (number | null)[];
  rsi: (number | null)[];
  macd: (number | null)[];
  macd_sig: (number | null)[];
  macd_hist: (number | null)[];
  bb_upper: (number | null)[];
  bb_lower: (number | null)[];
  bb_mid: (number | null)[];
  vol_ma: (number | null)[];
}

export interface PredictionResult {
  symbol: string;
  timeframe: string;
  tf_label: string;
  model: string;
  unit: string;
  metrics: {
    r2: number;
    mae: number;
    rmse: number;
    train_size: number;
    test_size: number;
  };
  history: {
    dates: string[];
    prices: number[];
  };
  forecast: {
    dates: string[];
    prices: number[];
  };
  candles_used: number;
}

export interface TimeframeConfig {
  key: string;
  label: string;
  unit: string;
  forecast: number;
}

export const WATCHLIST: WatchlistItem[] = [
  // Tech Giants
  { symbol: "AAPL", name: "Apple" },
  { symbol: "GOOGL", name: "Google" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "AMZN", name: "Amazon" },
  { symbol: "META", name: "Meta" },
  { symbol: "NVDA", name: "NVIDIA" },
  { symbol: "TSLA", name: "Tesla" },
  { symbol: "NFLX", name: "Netflix" },

  // Cloud & Software
  { symbol: "CRM", name: "Salesforce" },
  { symbol: "ADBE", name: "Adobe" },
  { symbol: "IBM", name: "IBM" },
  { symbol: "ORACLE", name: "Oracle" },
  { symbol: "INTC", name: "Intel" },
  { symbol: "AMD", name: "AMD" },

  // Financial Services
  { symbol: "JPM", name: "JPMorgan" },
  { symbol: "BAC", name: "Bank of America" },
  { symbol: "WFC", name: "Wells Fargo" },
  { symbol: "GS", name: "Goldman Sachs" },
  { symbol: "MS", name: "Morgan Stanley" },
  { symbol: "BLK", name: "BlackRock" },

  // Healthcare & Pharma
  { symbol: "JNJ", name: "Johnson & Johnson" },
  { symbol: "UNH", name: "UnitedHealth" },
  { symbol: "PFE", name: "Pfizer" },
  { symbol: "MRNA", name: "Moderna" },
  { symbol: "AZN", name: "AstraZeneca" },
  { symbol: "LLY", name: "Eli Lilly" },
  { symbol: "ABBV", name: "AbbVie" },

  // Energy
  { symbol: "XOM", name: "Exxon Mobil" },
  { symbol: "CVX", name: "Chevron" },
  { symbol: "COP", name: "ConocoPhillips" },
  { symbol: "MPC", name: "Marathon Petroleum" },
  { symbol: "SHEL", name: "Shell" },

  // Consumer & Retail
  { symbol: "WMT", name: "Walmart" },
  { symbol: "TGT", name: "Target" },
  { symbol: "COST", name: "Costco" },
  { symbol: "MCD", name: "McDonald's" },
  { symbol: "NKE", name: "Nike" },
  { symbol: "LULULEMON", name: "Lululemon" },
  { symbol: "KO", name: "Coca-Cola" },
  { symbol: "PEP", name: "PepsiCo" },

  // Industrial & Manufacturing
  { symbol: "BA", name: "Boeing" },
  { symbol: "CAT", name: "Caterpillar" },
  { symbol: "MMM", name: "3M" },
  { symbol: "DE", name: "Deere" },
  { symbol: "GE", name: "General Electric" },
  { symbol: "HON", name: "Honeywell" },

  // Real Estate & Construction
  { symbol: "DLR", name: "Digital Realty" },
  { symbol: "SPG", name: "Simon Property" },
  { symbol: "PLD", name: "Prologis" },
  { symbol: "EQR", name: "Equity Residential" },

  // Utilities
  { symbol: "NEE", name: "NextEra Energy" },
  { symbol: "DUK", name: "Duke Energy" },
  { symbol: "SO", name: "Southern Company" },

  // Telecom
  { symbol: "VZ", name: "Verizon" },
  { symbol: "T", name: "AT&T" },

  // Semiconductors & Chips
  { symbol: "QCOM", name: "Qualcomm" },
  { symbol: "ASML", name: "ASML" },
  { symbol: "TSM", name: "Taiwan Semiconductor" },
  { symbol: "AVGO", name: "Broadcom" },

  // Industrials & Transport
  { symbol: "UPS", name: "UPS" },
  { symbol: "FDX", name: "FedEx" },
  { symbol: "DAL", name: "Delta Air Lines" },

  // Cryptocurrencies
  { symbol: "BTC-USD", name: "Bitcoin" },
  { symbol: "ETH-USD", name: "Ethereum" },
  { symbol: "BNB-USD", name: "Binance Coin" },
  { symbol: "XRP-USD", name: "Ripple" },
  { symbol: "SOL-USD", name: "Solana" },

  // Indian Stocks (NSE)
  { symbol: "RELIANCE.NS", name: "Reliance" },
  { symbol: "TCS.NS", name: "TCS" },
  { symbol: "INFY.NS", name: "Infosys" },
  { symbol: "HDFCBANK.NS", name: "HDFC Bank" },
  { symbol: "ICICIBANK.NS", name: "ICICI Bank" },
  { symbol: "HINDUNILVR.NS", name: "Hindustan Unilever" },
  { symbol: "ITC.NS", name: "ITC" },
  { symbol: "SBIN.NS", name: "State Bank of India" },
  { symbol: "MARUTI.NS", name: "Maruti Suzuki" },
  { symbol: "BAJAJFINSV.NS", name: "Bajaj Finserv" },

  // UK & European Stocks
  { symbol: "NVO", name: "Novo Nordisk" },
  { symbol: "HSBA", name: "HSBC" },
];

export const TIMEFRAMES: TimeframeConfig[] = [
  { key: "1m", label: "1 Minute", unit: "minutes", forecast: 60 },
  { key: "5m", label: "5 Minutes", unit: "5-min bars", forecast: 48 },
  { key: "15m", label: "15 Minutes", unit: "15-min bars", forecast: 32 },
  { key: "1h", label: "1 Hour", unit: "hours", forecast: 48 },
  { key: "4h", label: "4 Hours", unit: "4-hour bars", forecast: 30 },
  { key: "1d", label: "1 Day", unit: "days", forecast: 30 },
  { key: "1wk", label: "1 Week", unit: "weeks", forecast: 12 },
];

export const CHART_PERIODS = [
  { key: "1d", label: "1D" },
  { key: "5d", label: "5D" },
  { key: "1mo", label: "1M" },
  { key: "3mo", label: "3M" },
  { key: "6mo", label: "6M" },
  { key: "1y", label: "1Y" },
  { key: "2y", label: "2Y" },
  { key: "5y", label: "5Y" },
];

export const MODEL_OPTIONS = [
  { key: "lr", label: "Linear Regression", desc: "Fast" },
  { key: "rf", label: "Random Forest", desc: "Accurate" },
  { key: "gb", label: "Gradient Boosting", desc: "Best quality" },
];

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchQuote(symbol: string): Promise<StockQuote> {
  return apiFetch(`/api/quote?symbol=${encodeURIComponent(symbol)}`);
}

export async function fetchChartData(symbol: string, period: string): Promise<ChartData> {
  return apiFetch(`/api/chart?symbol=${encodeURIComponent(symbol)}&period=${period}`);
}

export async function fetchPrediction(
  symbol: string,
  timeframe: string,
  model: string,
  forecastN?: number
): Promise<PredictionResult> {
  return apiFetch("/api/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      symbol,
      timeframe,
      model,
      forecast_n: forecastN,
    }),
  });
}
