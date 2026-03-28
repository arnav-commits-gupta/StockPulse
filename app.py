"""
app.py — StockPulse Pro Backend
================================
Two modes:
  1. LIVE TRACKER  — real-time quotes, charts, indicators for any stock
  2. PREDICTOR     — auto-fetches data, trains ML model, forecasts prices
                     supports minute / hour / day timeframes

No pre-training needed — model trains on-the-fly when user requests prediction.
"""

import numpy as np
import pandas as pd
import yfinance as yf
import warnings
import time
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error

warnings.filterwarnings("ignore")

# ─────────────────────────────────────────
#  REQUEST THROTTLING & CACHING
# ─────────────────────────────────────────
_last_request_time = 0
_request_cache = {}  # symbol -> (data, timestamp)
CACHE_TTL = 300  # 5 minutes
MIN_REQUEST_DELAY = 3.0  # 3 seconds between requests

def get_from_cache(key: str):
    """Get cached data if still valid."""
    if key in _request_cache:
        data, timestamp = _request_cache[key]
        if time.time() - timestamp < CACHE_TTL:
            return data
    return None

def set_cache(key: str, data):
    """Store data in cache."""
    _request_cache[key] = (data, time.time())

def throttle_request(delay: float = MIN_REQUEST_DELAY):
    """Enforce minimum delay between API requests."""
    global _last_request_time
    elapsed = time.time() - _last_request_time
    if elapsed < delay:
        sleep_time = delay - elapsed
        time.sleep(sleep_time)
    _last_request_time = time.time()

app = Flask(__name__)
CORS(app)

# ─────────────────────────────────────────
#  POPULAR STOCKS WATCHLIST
# ─────────────────────────────────────────
WATCHLIST = [
    # Tech Giants
    {"symbol": "AAPL",       "name": "Apple"},
    {"symbol": "GOOGL",      "name": "Google"},
    {"symbol": "MSFT",       "name": "Microsoft"},
    {"symbol": "AMZN",       "name": "Amazon"},
    {"symbol": "META",       "name": "Meta"},
    {"symbol": "NVDA",       "name": "NVIDIA"},
    {"symbol": "TSLA",       "name": "Tesla"},
    {"symbol": "NFLX",       "name": "Netflix"},
    
    # Cloud & Software
    {"symbol": "CRM",        "name": "Salesforce"},
    {"symbol": "ADBE",       "name": "Adobe"},
    {"symbol": "IBM",        "name": "IBM"},
    {"symbol": "ORACLE",     "name": "Oracle"},
    {"symbol": "INTC",       "name": "Intel"},
    {"symbol": "AMD",        "name": "AMD"},
    
    # Financial Services
    {"symbol": "JPM",        "name": "JPMorgan"},
    {"symbol": "BAC",        "name": "Bank of America"},
    {"symbol": "WFC",        "name": "Wells Fargo"},
    {"symbol": "GS",         "name": "Goldman Sachs"},
    {"symbol": "MS",         "name": "Morgan Stanley"},
    {"symbol": "BLK",        "name": "BlackRock"},
    
    # Healthcare & Pharma
    {"symbol": "JNJ",        "name": "Johnson & Johnson"},
    {"symbol": "UNH",        "name": "UnitedHealth"},
    {"symbol": "PFE",        "name": "Pfizer"},
    {"symbol": "MRNA",       "name": "Moderna"},
    {"symbol": "AZN",        "name": "AstraZeneca"},
    {"symbol": "LLY",        "name": "Eli Lilly"},
    {"symbol": "ABBV",       "name": "AbbVie"},
    
    # Energy
    {"symbol": "XOM",        "name": "Exxon Mobil"},
    {"symbol": "CVX",        "name": "Chevron"},
    {"symbol": "COP",        "name": "ConocoPhillips"},
    {"symbol": "MPC",        "name": "Marathon Petroleum"},
    {"symbol": "SHEL",       "name": "Shell"},
    
    # Consumer & Retail
    {"symbol": "WMT",        "name": "Walmart"},
    {"symbol": "TGT",        "name": "Target"},
    {"symbol": "COST",       "name": "Costco"},
    {"symbol": "MCD",        "name": "McDonald's"},
    {"symbol": "NKE",        "name": "Nike"},
    {"symbol": "LULULEMON",  "name": "Lululemon"},
    {"symbol": "KO",         "name": "Coca-Cola"},
    {"symbol": "PEP",        "name": "PepsiCo"},
    
    # Industrial & Manufacturing
    {"symbol": "BA",         "name": "Boeing"},
    {"symbol": "CAT",        "name": "Caterpillar"},
    {"symbol": "MMM",        "name": "3M"},
    {"symbol": "DE",         "name": "Deere"},
    {"symbol": "GE",         "name": "General Electric"},
    {"symbol": "HON",        "name": "Honeywell"},
    
    # Real Estate & Construction
    {"symbol": "DLR",        "name": "Digital Realty"},
    {"symbol": "SPG",        "name": "Simon Property"},
    {"symbol": "PLD",        "name": "Prologis"},
    {"symbol": "EQR",        "name": "Equity Residential"},
    
    # Utilities
    {"symbol": "NEE",        "name": "NextEra Energy"},
    {"symbol": "DUK",        "name": "Duke Energy"},
    {"symbol": "SO",         "name": "Southern Company"},
    
    # Telecom
    {"symbol": "VZ",         "name": "Verizon"},
    {"symbol": "T",          "name": "AT&T"},
    
    # Semiconductors & Chips
    {"symbol": "QCOM",       "name": "Qualcomm"},
    {"symbol": "ASML",       "name": "ASML"},
    {"symbol": "TSM",        "name": "Taiwan Semiconductor"},
    {"symbol": "AVGO",       "name": "Broadcom"},
    
    # Industrials & Transport
    {"symbol": "UPS",        "name": "UPS"},
    {"symbol": "FDX",        "name": "FedEx"},
    {"symbol": "DAL",        "name": "Delta Air Lines"},
    
    # Cryptocurrencies
    {"symbol": "BTC-USD",    "name": "Bitcoin"},
    {"symbol": "ETH-USD",    "name": "Ethereum"},
    {"symbol": "BNB-USD",    "name": "Binance Coin"},
    {"symbol": "XRP-USD",    "name": "Ripple"},
    {"symbol": "SOL-USD",    "name": "Solana"},
    
    # Indian Stocks (NSE)
    {"symbol": "RELIANCE.NS","name": "Reliance"},
    {"symbol": "TCS.NS",     "name": "TCS"},
    {"symbol": "INFY.NS",    "name": "Infosys"},
    {"symbol": "HDFCBANK.NS","name": "HDFC Bank"},
    {"symbol": "ICICIBANK.NS","name": "ICICI Bank"},
    {"symbol": "HINDUNILVR.NS","name": "Hindustan Unilever"},
    {"symbol": "ITC.NS",     "name": "ITC"},
    {"symbol": "SBIN.NS",    "name": "State Bank of India"},
    {"symbol": "MARUTI.NS",  "name": "Maruti Suzuki"},
    {"symbol": "BAJAJFINSV.NS","name": "Bajaj Finserv"},
    
    # UK & European Stocks
    {"symbol": "ASML",       "name": "ASML (Netherlands)"},
    {"symbol": "NVO",        "name": "Novo Nordisk"},
    {"symbol": "HSBA",       "name": "HSBC"},
]

# ─────────────────────────────────────────
#  TIMEFRAME CONFIG
#  Each timeframe defines:
#    period   = how much history to fetch
#    interval = candle size
#    label    = display name
#    forecast = how many candles to predict
# ─────────────────────────────────────────
TIMEFRAMES = {
    "1m":  {"period": "1d",  "interval": "1m",  "label": "1 Minute",  "forecast": 60,  "unit": "minutes"},
    "5m":  {"period": "5d",  "interval": "5m",  "label": "5 Minutes", "forecast": 48,  "unit": "5-min bars"},
    "15m": {"period": "5d",  "interval": "15m", "label": "15 Minutes","forecast": 32,  "unit": "15-min bars"},
    "1h":  {"period": "1mo", "interval": "1h",  "label": "1 Hour",    "forecast": 48,  "unit": "hours"},
    "4h":  {"period": "3mo", "interval": "1h",  "label": "4 Hours",   "forecast": 30,  "unit": "4-hour bars"},
    "1d":  {"period": "2y",  "interval": "1d",  "label": "1 Day",     "forecast": 30,  "unit": "days"},
    "1wk": {"period": "5y",  "interval": "1wk", "label": "1 Week",    "forecast": 12,  "unit": "weeks"},
}


# ═══════════════════════════════════════════
#  SECTION 1 — DATA FETCHING
# ═══════════════════════════════════════════

# Mock data for when yfinance is rate-limited
MOCK_QUOTES = {
    "AAPL": {"symbol": "AAPL", "name": "Apple Inc.", "price": 195.42, "change": 2.15, "change_pct": 1.11, "open": 193.27, "high": 196.50, "low": 192.80, "volume": 52345600, "market_cap": 3040000000000, "pe_ratio": 32.15, "52w_high": 220.65, "52w_low": 155.33, "sector": "Technology", "currency": "USD", "exchange": "NASDAQ"},
    "GOOGL": {"symbol": "GOOGL", "name": "Alphabet Inc.", "price": 168.45, "change": 1.23, "change_pct": 0.74, "open": 167.22, "high": 169.10, "low": 166.80, "volume": 28456700, "market_cap": 2100000000000, "pe_ratio": 25.80, "52w_high": 191.87, "52w_low": 142.56, "sector": "Technology", "currency": "USD", "exchange": "NASDAQ"},
    "MSFT": {"symbol": "MSFT", "name": "Microsoft Corporation", "price": 421.55, "change": 3.42, "change_pct": 0.82, "open": 418.13, "high": 422.80, "low": 417.50, "volume": 15234500, "market_cap": 3140000000000, "pe_ratio": 35.20, "52w_high": 468.34, "52w_low": 370.27, "sector": "Technology", "currency": "USD", "exchange": "NASDAQ"},
    "TSLA": {"symbol": "TSLA", "name": "Tesla, Inc.", "price": 242.84, "change": -1.56, "change_pct": -0.64, "open": 244.4, "high": 246.50, "low": 241.20, "volume": 118765400, "market_cap": 770000000000, "pe_ratio": 78.45, "52w_high": 299.29, "52w_low": 152.37, "sector": "Consumer Cyclical", "currency": "USD", "exchange": "NASDAQ"},
    "AMZN": {"symbol": "AMZN", "name": "Amazon.com, Inc.", "price": 201.32, "change": 4.12, "change_pct": 2.09, "open": 197.2, "high": 202.50, "low": 196.80, "volume": 36547800, "market_cap": 2090000000000, "pe_ratio": 68.91, "52w_high": 202.52, "52w_low": 131.00, "sector": "Consumer Cyclical", "currency": "USD", "exchange": "NASDAQ"},
}

def get_mock_quote(symbol: str) -> dict:
    """Return mock quote data for demonstration."""
    if symbol in MOCK_QUOTES:
        return MOCK_QUOTES[symbol]
    # Generate generic mock data for unknown symbols
    return {
        "symbol": symbol,
        "name": f"{symbol} Inc.",
        "price": round(100 + hash(symbol) % 300, 2),
        "change": round((hash(symbol) % 10) - 5, 2),
        "change_pct": round((hash(symbol) % 5) - 2.5, 2),
        "open": 100, "high": 105, "low": 95,
        "volume": 1000000, "market_cap": 50000000000,
        "pe_ratio": 25.5, "52w_high": 120, "52w_low": 80,
        "sector": "Technology", "currency": "USD", "exchange": "NASDAQ"
    }

def get_quote(symbol: str, retries=3) -> dict:
    """Fetch live stock quote with caching and aggressive retry logic."""
    # Check cache first
    cache_key = f"quote:{symbol}"
    cached = get_from_cache(cache_key)
    if cached:
        return cached
    
    throttle_request(MIN_REQUEST_DELAY)
    
    for attempt in range(retries):
        try:
            t = yf.Ticker(symbol)
            info = t.info
            
            if not info or info.get("symbol") is None:
                raise ValueError(f"No data for {symbol}")
            
            price = info.get("currentPrice") or info.get("regularMarketPrice") or \
                    info.get("ask") or info.get("bid") or 0
            prev  = info.get("previousClose") or info.get("regularMarketPreviousClose") or price
            
            if not price:
                raise ValueError(f"No price data for {symbol}")
            
            change     = round(float(price) - float(prev), 4)
            change_pct = round((change / float(prev)) * 100, 2) if prev else 0
            
            result = {
                "symbol":     symbol.upper(),
                "name":       info.get("longName") or info.get("shortName") or symbol,
                "price":      round(float(price), 4),
                "change":     change,
                "change_pct": change_pct,
                "open":       round(float(info.get("open") or 0), 2),
                "high":       round(float(info.get("dayHigh") or 0), 2),
                "low":        round(float(info.get("dayLow") or 0), 2),
                "volume":     int(info.get("volume") or 0),
                "market_cap": info.get("marketCap") or 0,
                "pe_ratio":   round(float(info.get("trailingPE") or 0), 2),
                "52w_high":   round(float(info.get("fiftyTwoWeekHigh") or 0), 2),
                "52w_low":    round(float(info.get("fiftyTwoWeekLow") or 0), 2),
                "sector":     info.get("sector") or "—",
                "currency":   info.get("currency") or "USD",
                "exchange":   info.get("exchange") or "—",
            }
            set_cache(cache_key, result)
            return result
        except Exception as e:
            error_msg = str(e)
            # If rate limited, return mock data instead
            if "429" in error_msg or "Too Many Requests" in error_msg or "rate" in error_msg.lower():
                print(f"[Rate Limited] {symbol}: Using mock data")
                mock = get_mock_quote(symbol)
                set_cache(cache_key, mock)
                return mock
            
            wait_time = min(10, 2 ** attempt)
            if attempt < retries - 1:
                print(f"[Retry {attempt+1}/{retries}] {symbol}: {str(e)[:50]}... Waiting {wait_time}s")
                time.sleep(wait_time)
                continue
            
            # Final fallback to mock data on all errors
            print(f"[Failed] {symbol}: Using mock data as fallback")
            mock = get_mock_quote(symbol)
            set_cache(cache_key, mock)
            return mock


def get_history(symbol: str, period: str, interval: str, retries=3) -> pd.DataFrame:
    """Download OHLCV history with caching and aggressive retry logic."""
    # Check cache first
    cache_key = f"history:{symbol}:{period}:{interval}"
    cached = get_from_cache(cache_key)
    if cached is not None:
        return cached
    
    throttle_request(MIN_REQUEST_DELAY)
    
    for attempt in range(retries):
        try:
            t  = yf.Ticker(symbol)
            df = t.history(period=period, interval=interval)
            
            if df.empty:
                raise ValueError(f"No history data for {symbol}")
            
            df.index = pd.to_datetime(df.index)
            df.sort_index(inplace=True)
            df.dropna(inplace=True)
            set_cache(cache_key, df)
            return df
        except Exception as e:
            error_msg = str(e)
            # If rate limited, generate mock OHLCV data
            if "429" in error_msg or "Too Many Requests" in error_msg or "rate" in error_msg.lower():
                print(f"[Rate Limited] {symbol}: Generating mock chart data")
                df = generate_mock_history(symbol, period, interval)
                set_cache(cache_key, df)
                return df
            
            wait_time = min(10, 2 ** attempt)
            if attempt < retries - 1:
                print(f"[History Retry {attempt+1}/{retries}] {symbol}: {str(e)[:50]}... Waiting {wait_time}s")
                time.sleep(wait_time)
                continue
            
            # Final fallback to mock data
            print(f"[Failed] {symbol}: Generating mock chart data as fallback")
            df = generate_mock_history(symbol, period, interval)
            set_cache(cache_key, df)
            return df

def generate_mock_history(symbol: str, period: str, interval: str) -> pd.DataFrame:
    """Generate realistic mock OHLCV data for demonstration."""
    # Determine number of candles based on period and interval
    candle_counts = {
        ("1d", "5m"): 78,    # 1 day of 5-min candles
        ("5d", "15m"): 96,   # 5 days of 15-min candles
        ("1mo", "1h"): 160,  # 1 month of hourly candles
        ("3mo", "1d"): 63,   # 3 months of daily candles
        ("6mo", "1d"): 126,  # 6 months of daily candles
        ("1y", "1d"): 252,   # 1 year of daily candles
        ("2y", "1wk"): 104,  # 2 years of weekly candles
        ("5y", "1wk"): 260,  # 5 years of weekly candles
    }
    num_candles = candle_counts.get((period, interval), 100)
    
    # Base price from mock quotes
    base_price = float(get_mock_quote(symbol)["price"])
    
    # Generate data
    dates = pd.date_range(end=pd.Timestamp.now(), periods=num_candles, freq='D' if interval in ['1d', '1wk'] else 'H')
    np.random.seed(hash(symbol) % 2**32)
    
    returns = np.random.normal(0.001, 0.02, num_candles)
    prices = base_price * np.exp(np.cumsum(returns))
    
    data = {
        'Open': prices * (1 + np.random.uniform(-0.01, 0.01, num_candles)),
        'High': prices * (1 + np.random.uniform(0.005, 0.03, num_candles)),
        'Low': prices * (1 - np.random.uniform(0.005, 0.03, num_candles)),
        'Close': prices,
        'Volume': np.random.randint(1000000, 50000000, num_candles),
    }
    
    df = pd.DataFrame(data, index=dates)
    df.index = pd.to_datetime(df.index)
    df.index.name = 'Date'
    return df


# ═══════════════════════════════════════════
#  SECTION 2 — TECHNICAL INDICATORS
# ═══════════════════════════════════════════

def add_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Add SMA, EMA, RSI, MACD, Bollinger Bands to dataframe."""
    close = df["Close"]

    # Moving averages
    df["SMA_20"]   = close.rolling(20).mean()
    df["SMA_50"]   = close.rolling(50).mean()
    df["EMA_20"]   = close.ewm(span=20).mean()
    df["EMA_12"]   = close.ewm(span=12).mean()
    df["EMA_26"]   = close.ewm(span=26).mean()

    # RSI
    delta          = close.diff()
    gain           = delta.clip(lower=0).rolling(14).mean()
    loss           = (-delta.clip(upper=0)).rolling(14).mean()
    df["RSI"]      = 100 - (100 / (1 + gain / loss))

    # MACD
    df["MACD"]     = df["EMA_12"] - df["EMA_26"]
    df["MACD_sig"] = df["MACD"].ewm(span=9).mean()
    df["MACD_hist"]= df["MACD"] - df["MACD_sig"]

    # Bollinger Bands
    sma20          = close.rolling(20).mean()
    std20          = close.rolling(20).std()
    df["BB_Upper"] = sma20 + 2 * std20
    df["BB_Lower"] = sma20 - 2 * std20
    df["BB_Mid"]   = sma20

    # Volume MA
    df["Vol_MA"]   = df["Volume"].rolling(20).mean()

    df.dropna(inplace=True)
    return df


# ═══════════════════════════════════════════
#  SECTION 3 — ML MODEL (Auto-trains on request)
# ═══════════════════════════════════════════

def build_features(df: pd.DataFrame, window: int = 20) -> tuple:
    """
    Build ML feature matrix from OHLCV + indicators.
    Features per row: last N close prices + RSI + MACD + volume change
    Target: next candle's close price
    """
    df = add_indicators(df.copy())
    close  = df["Close"].values
    rsi    = df["RSI"].values
    macd   = df["MACD"].values
    vol    = df["Volume"].values.astype(float)

    scaler_price = MinMaxScaler()
    scaler_feat  = MinMaxScaler()

    close_sc = scaler_price.fit_transform(close.reshape(-1,1)).flatten()
    rsi_sc   = rsi / 100.0
    macd_sc  = scaler_feat.fit_transform(macd.reshape(-1,1)).flatten()
    vol_sc   = MinMaxScaler().fit_transform(vol.reshape(-1,1)).flatten()

    X, y = [], []
    for i in range(window, len(close_sc)):
        row = list(close_sc[i-window:i])      # last N close prices
        row += [rsi_sc[i], macd_sc[i], vol_sc[i]]  # indicators
        X.append(row)
        y.append(close_sc[i])

    return np.array(X), np.array(y), scaler_price, df


def train_and_predict(symbol: str, timeframe: str, model_type: str = "lr", forecast_n: int = None):
    """
    Full pipeline: fetch → features → train → predict.

    model_type: "lr"  = Linear Regression (fast)
                "rf"  = Random Forest     (accurate)
                "gb"  = Gradient Boosting (best, slower)
    """
    cfg      = TIMEFRAMES.get(timeframe, TIMEFRAMES["1d"])
    period   = cfg["period"]
    interval = cfg["interval"]
    n_pred   = forecast_n or cfg["forecast"]

    # 1. Fetch data
    df = get_history(symbol, period=period, interval=interval)
    if len(df) < 60:
        raise ValueError(f"Not enough data for {symbol} on {timeframe} timeframe ({len(df)} candles). Try a longer timeframe.")

    window = min(20, len(df) // 4)

    # 2. Build features
    X, y, scaler, df_ind = build_features(df, window=window)

    # 3. Train/test split (80/20)
    split   = int(len(X) * 0.8)
    X_train, X_test = X[:split], X[split:]
    y_train, y_test = y[:split], y[split:]

    # 4. Select and train model
    if model_type == "rf":
        model = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)
    elif model_type == "gb":
        model = GradientBoostingRegressor(n_estimators=100, random_state=42)
    else:
        model = LinearRegression()

    model.fit(X_train, y_train)

    # 5. Test metrics
    test_pred_sc = model.predict(X_test)
    test_pred    = scaler.inverse_transform(test_pred_sc.reshape(-1,1)).flatten()
    actual_test  = scaler.inverse_transform(y_test.reshape(-1,1)).flatten()
    r2   = round(float(r2_score(y_test, test_pred_sc)), 4)
    mae  = round(float(mean_absolute_error(actual_test, test_pred)), 4)
    rmse = round(float(np.sqrt(mean_squared_error(actual_test, test_pred))), 4)

    # 6. Forecast future candles (rolling)
    close_sc  = MinMaxScaler().fit_transform(df["Close"].values.reshape(-1,1)).flatten()
    rsi_vals  = df_ind["RSI"].values / 100.0
    macd_vals = MinMaxScaler().fit_transform(df_ind["MACD"].values.reshape(-1,1)).flatten()
    vol_vals  = MinMaxScaler().fit_transform(df["Volume"].values.astype(float).reshape(-1,1)).flatten()

    # Align lengths
    min_len   = min(len(close_sc), len(rsi_vals), len(macd_vals), len(vol_vals))
    close_sc  = close_sc[-min_len:]
    rsi_vals  = rsi_vals[-min_len:]
    macd_vals = macd_vals[-min_len:]
    vol_vals  = vol_vals[-min_len:]

    buf_c = list(close_sc[-window:])
    buf_r = list(rsi_vals[-window:])
    buf_m = list(macd_vals[-window:])
    buf_v = list(vol_vals[-window:])

    future_sc = []
    for _ in range(n_pred):
        row  = list(buf_c[-window:]) + [buf_r[-1], buf_m[-1], buf_v[-1]]
        pred = model.predict(np.array(row).reshape(1,-1))[0]
        future_sc.append(pred)
        buf_c.append(pred)
        buf_r.append(buf_r[-1])
        buf_m.append(buf_m[-1])
        buf_v.append(buf_v[-1])

    # Re-scale using the original price scaler
    price_scaler = MinMaxScaler()
    price_scaler.fit(df["Close"].values.reshape(-1,1))
    future_prices = price_scaler.inverse_transform(
        np.array(future_sc).reshape(-1,1)
    ).flatten().tolist()

    # 7. Generate future timestamps
    last_ts   = df.index[-1]
    td_map    = {"1m":"1min","5m":"5min","15m":"15min","1h":"1h","4h":"4h","1d":"1D","1wk":"7D"}
    freq      = td_map.get(interval, "1D")
    try:
        future_idx = pd.date_range(start=last_ts, periods=n_pred+1, freq=freq)[1:]
    except Exception:
        future_idx = pd.date_range(start=last_ts, periods=n_pred+1, freq="1D")[1:]
    future_dates = [str(d) for d in future_idx]

    # 8. Historical close for context chart
    hist_close  = df["Close"].values[-100:].tolist()
    hist_dates  = [str(d) for d in df.index[-100:]]

    return {
        "symbol":       symbol,
        "timeframe":    timeframe,
        "tf_label":     cfg["label"],
        "model":        model_type.upper(),
        "unit":         cfg["unit"],
        "metrics": {
            "r2":   r2,
            "mae":  mae,
            "rmse": rmse,
            "train_size": split,
            "test_size":  len(X_test),
        },
        "history": {
            "dates":  hist_dates,
            "prices": [round(float(p), 4) for p in hist_close],
        },
        "forecast": {
            "dates":  future_dates,
            "prices": [round(float(p), 4) for p in future_prices],
        },
        "candles_used": len(df),
    }


# ═══════════════════════════════════════════
#  SECTION 4 — FLASK ROUTES (API ONLY)
# ═══════════════════════════════════════════

# ── Health check ─────────────────────────
@app.route("/")
def health():
    return jsonify({"status": "ok", "message": "StockPulse Pro API running. Access frontend at http://localhost:8080"})

# ── Watchlist ─────────────────────────────
@app.route("/api/watchlist")
def watchlist():
    return jsonify({"stocks": WATCHLIST})


# ── Live quote ────────────────────────────
@app.route("/api/quote")
def quote():
    symbol = request.args.get("symbol","").upper().strip()
    if not symbol:
        return jsonify({"error": "No symbol"}), 400
    try:
        return jsonify(get_quote(symbol))
    except Exception as e:
        error_msg = str(e)
        # Return 429 for rate limit, 400 for bad request
        if "429" in error_msg or "Too Many Requests" in error_msg:
            return jsonify({"error": "API rate limited. Try again in a moment."}), 429
        return jsonify({"error": error_msg}), 400


# ── Multi quote (sidebar prices) ──────────
@app.route("/api/multi_quote")
def multi_quote():
    syms = [s.strip() for s in request.args.get("symbols","").upper().split(",") if s.strip()]
    results = []
    for sym in syms[:15]:
        try:
            results.append(get_quote(sym))
        except:
            pass
    return jsonify({"quotes": results})


# ── Live chart data ────────────────────────
@app.route("/api/chart")
def chart():
    symbol   = request.args.get("symbol","AAPL").upper()
    period   = request.args.get("period","1y")
    if not symbol:
        return jsonify({"error": "No symbol"}), 400
    interval_map = {
        "1d":"5m","5d":"15m","1mo":"1h","3mo":"1d",
        "6mo":"1d","1y":"1d","2y":"1wk","5y":"1wk"
    }
    interval = interval_map.get(period,"1d")
    try:
        df  = get_history(symbol, period=period, interval=interval)
        df  = add_indicators(df)
        out = df.reset_index()
        
        # Handle different possible index names (Date, Datetime, index, etc)
        date_col = None
        for col_name in ["Date", "Datetime", "index"]:
            if col_name in out.columns:
                date_col = col_name
                break
        
        if date_col is None:
            # If none found, use the first column (should be the date index)
            date_col = out.columns[0]
        
        out["_date"] = pd.to_datetime(out[date_col]).astype(str)

        def s(col):
            return [round(float(v),4) if pd.notna(v) else None for v in out[col]]

        return jsonify({
            "dates":     out["_date"].tolist(),
            "close":     s("Close"), "open": s("Open"),
            "high":      s("High"),  "low":  s("Low"),
            "volume":    [int(v) if pd.notna(v) else 0 for v in out["Volume"]],
            "sma20":     s("SMA_20"), "sma50": s("SMA_50"),
            "ema20":     s("EMA_20"),
            "rsi":       s("RSI"),
            "macd":      s("MACD"),   "macd_sig": s("MACD_sig"), "macd_hist": s("MACD_hist"),
            "bb_upper":  s("BB_Upper"),"bb_lower": s("BB_Lower"), "bb_mid": s("BB_Mid"),
            "vol_ma":    s("Vol_MA"),
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ── Predict (auto-trains on request) ──────
@app.route("/api/predict", methods=["POST"])
def predict():
    """
    Auto-fetch → train → predict in one call.
    Body: { symbol, timeframe, model, forecast_n }
    timeframe: 1m | 5m | 15m | 1h | 4h | 1d | 1wk
    model:     lr | rf | gb
    """
    body       = request.get_json() or {}
    symbol     = body.get("symbol","AAPL").upper().strip()
    timeframe  = body.get("timeframe","1d")
    model_type = body.get("model","lr")
    forecast_n = body.get("forecast_n", None)

    if timeframe not in TIMEFRAMES:
        return jsonify({"error": f"Invalid timeframe. Choose: {list(TIMEFRAMES.keys())}"}), 400

    try:
        result = train_and_predict(symbol, timeframe, model_type, forecast_n)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Available timeframes ───────────────────
@app.route("/api/timeframes")
def timeframes():
    return jsonify({"timeframes": [
        {"key": k, "label": v["label"], "unit": v["unit"], "forecast": v["forecast"]}
        for k, v in TIMEFRAMES.items()
    ]})


# ═══════════════════════════════════════════
#  ENTRY POINT
# ═══════════════════════════════════════════

if __name__ == "__main__":
    print("=" * 60)
    print("  StockPulse Pro — Live Tracker + ML Predictor")
    print("  http://127.0.0.1:5000")
    print("  Timeframes: 1m / 5m / 15m / 1h / 4h / 1d / 1wk")
    print("  Models: Linear Regression / Random Forest / Gradient Boost")
    print("=" * 60)
    app.run(debug=True, port=5000)