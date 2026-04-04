import { useState, useEffect, useCallback } from "react";
import { Search, TrendingUp, TrendingDown, Minus, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WatchlistItem {
  symbol: string;
  name:   string;
}

interface LiveQuote {
  price:      number;
  change:     number;
  change_pct: number;
  currency?:  string;
}

interface WatchlistProps {
  selected: string;
  onSelect: (symbol: string) => void;
}

// ── Grouped categories ────────────────────────────────────────────────────────
// Each group has an emoji, label, and list of stocks.
// Add/remove stocks here to customise what appears in each section.

const GROUPS: { key: string; label: string; emoji: string; items: WatchlistItem[] }[] = [
  {
    key:   "indices",
    label: "Indices",
    emoji: "📈",
    items: [
      { symbol: "^NSEI",    name: "Nifty 50"       },
      { symbol: "^BSESN",   name: "Sensex"         },
      { symbol: "^CNXBANK", name: "Bank Nifty"      },
      { symbol: "^CNXIT",   name: "Nifty IT"        },
      { symbol: "SPY",      name: "S&P 500 ETF"     },
      { symbol: "QQQ",      name: "Nasdaq ETF"      },
    ],
  },
  {
    key:   "nse",
    label: "🇮🇳 NSE Stocks",
    emoji: "🇮🇳",
    items: [
      { symbol: "RELIANCE.NS",   name: "Reliance"          },
      { symbol: "TCS.NS",        name: "TCS"               },
      { symbol: "HDFCBANK.NS",   name: "HDFC Bank"         },
      { symbol: "INFY.NS",       name: "Infosys"           },
      { symbol: "ICICIBANK.NS",  name: "ICICI Bank"        },
      { symbol: "HINDUNILVR.NS", name: "Hindustan Unilever"},
      { symbol: "ITC.NS",        name: "ITC"               },
      { symbol: "SBIN.NS",       name: "State Bank"        },
      { symbol: "BAJFINANCE.NS", name: "Bajaj Finance"     },
      { symbol: "MARUTI.NS",     name: "Maruti Suzuki"     },
      { symbol: "SUNPHARMA.NS",  name: "Sun Pharma"        },
      { symbol: "TATAMOTORS.NS", name: "Tata Motors"       },
      { symbol: "TITAN.NS",      name: "Titan"             },
      { symbol: "WIPRO.NS",      name: "Wipro"             },
      { symbol: "HCLTECH.NS",    name: "HCL Tech"          },
      { symbol: "ADANIENT.NS",   name: "Adani Enterprises" },
      { symbol: "NTPC.NS",       name: "NTPC"              },
      { symbol: "LT.NS",         name: "L&T"               },
      { symbol: "BHARTIARTL.NS", name: "Bharti Airtel"     },
      { symbol: "COALINDIA.NS",  name: "Coal India"        },
    ],
  },
  {
    key:   "us",
    label: "🇺🇸 US Stocks",
    emoji: "🇺🇸",
    items: [
      { symbol: "AAPL",  name: "Apple"      },
      { symbol: "MSFT",  name: "Microsoft"  },
      { symbol: "GOOGL", name: "Alphabet"   },
      { symbol: "AMZN",  name: "Amazon"     },
      { symbol: "NVDA",  name: "NVIDIA"     },
      { symbol: "META",  name: "Meta"       },
      { symbol: "TSLA",  name: "Tesla"      },
      { symbol: "NFLX",  name: "Netflix"    },
      { symbol: "JPM",   name: "JPMorgan"   },
      { symbol: "V",     name: "Visa"       },
      { symbol: "UNH",   name: "UnitedHealth"},
      { symbol: "LLY",   name: "Eli Lilly"  },
      { symbol: "XOM",   name: "Exxon"      },
      { symbol: "AVGO",  name: "Broadcom"   },
      { symbol: "AMD",   name: "AMD"        },
    ],
  },
  {
    key:   "crypto",
    label: "Crypto",
    emoji: "🪙",
    items: [
      { symbol: "BTC-USD",  name: "Bitcoin"   },
      { symbol: "ETH-USD",  name: "Ethereum"  },
      { symbol: "BNB-USD",  name: "BNB"       },
      { symbol: "SOL-USD",  name: "Solana"    },
      { symbol: "XRP-USD",  name: "Ripple"    },
      { symbol: "ADA-USD",  name: "Cardano"   },
      { symbol: "DOGE-USD", name: "Dogecoin"  },
      { symbol: "AVAX-USD", name: "Avalanche" },
    ],
  },
];

// Flat list of all symbols for search
const ALL_ITEMS: WatchlistItem[] = GROUPS.flatMap((g) => g.items);

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5002";

function formatPrice(price: number, currency?: string): string {
  const symbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : "";
  if (price >= 1_000_000) return `${symbol}${(price / 1_000_000).toFixed(2)}M`;
  if (price >= 1_000)     return `${symbol}${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (price >= 1)         return `${symbol}${price.toFixed(2)}`;
  return `${symbol}${price.toFixed(4)}`;   // crypto sub-dollar
}

function getCurrency(symbol: string): string {
  if (symbol.endsWith(".NS") || symbol.endsWith(".BO") || symbol.startsWith("^NSEI") || symbol.startsWith("^BSESN") || symbol.startsWith("^CNX") || symbol.startsWith("^NSE")) return "INR";
  if (symbol.endsWith("-USD")) return "USD";
  return "USD";
}

function getExchangeBadge(symbol: string): { label: string; color: string } {
  if (symbol.endsWith(".NS") || symbol.startsWith("^NSEI") || symbol.startsWith("^CNX") || symbol.startsWith("^NSE")) return { label: "NSE", color: "bg-blue-100 text-blue-700" };
  if (symbol.startsWith("^BSESN") || symbol.endsWith(".BO")) return { label: "BSE", color: "bg-orange-100 text-orange-700" };
  if (symbol.endsWith("-USD")) return { label: "CRYPTO", color: "bg-purple-100 text-purple-700" };
  if (symbol === "SPY" || symbol === "QQQ") return { label: "ETF", color: "bg-gray-100 text-gray-600" };
  return { label: "US", color: "bg-green-100 text-green-700" };
}

// ── Live price hook — fetches one symbol at a time, rate-limited ──────────────

function useLivePrices(symbols: string[]) {
  const [prices, setPrices] = useState<Record<string, LiveQuote>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchOne = useCallback(async (symbol: string) => {
    try {
      const r = await fetch(`${BASE_URL}/api/quote?symbol=${encodeURIComponent(symbol)}`);
      if (!r.ok) return;
      const d = await r.json();
      if (d.price) {
        setPrices((prev) => ({
          ...prev,
          [symbol]: {
            price:      d.price,
            change:     d.change,
            change_pct: d.change_pct,
            currency:   d.currency || getCurrency(symbol),
          },
        }));
      }
    } catch {
      // silently ignore fetch errors
    }
  }, []);

  const fetchAll = useCallback(async (syms: string[]) => {
    setLoading((prev) => {
      const next = { ...prev };
      syms.forEach((s) => (next[s] = true));
      return next;
    });

    // Fetch in batches of 5 with a 300ms gap to avoid hammering backend
    for (let i = 0; i < syms.length; i += 5) {
      const batch = syms.slice(i, i + 5);
      await Promise.allSettled(batch.map(fetchOne));
      if (i + 5 < syms.length) await new Promise((res) => setTimeout(res, 300));
    }

    setLoading({});
    setLastUpdated(new Date());
  }, [fetchOne]);

  // Initial fetch
  useEffect(() => {
    if (symbols.length === 0) return;
    fetchAll(symbols);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh every 15 seconds
  useEffect(() => {
    if (symbols.length === 0) return;
    const id = setInterval(() => fetchAll(symbols), 15_000);
    return () => clearInterval(id);
  }, [symbols, fetchAll]);

  return { prices, loading, lastUpdated, refresh: () => fetchAll(symbols) };
}

// ── Group row component ───────────────────────────────────────────────────────

function GroupSection({
  group,
  selected,
  onSelect,
  prices,
  loading,
  search,
}: {
  group: typeof GROUPS[0];
  selected: string;
  onSelect: (s: string) => void;
  prices: Record<string, LiveQuote>;
  loading: Record<string, boolean>;
  search: string;
}) {
  const [open, setOpen] = useState(true);

  const filtered = search
    ? group.items.filter(
        (it) =>
          it.symbol.toLowerCase().includes(search.toLowerCase()) ||
          it.name.toLowerCase().includes(search.toLowerCase()),
      )
    : group.items;

  if (filtered.length === 0) return null;

  return (
    <div className="mb-1">
      {/* Group header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 flex-shrink-0" />
        )}
        <span>{group.emoji} {group.label}</span>
        <span className="ml-auto text-[9px] opacity-60">{filtered.length}</span>
      </button>

      {/* Items */}
      {open && (
        <div>
          {filtered.map((item) => {
            const q        = prices[item.symbol];
            const isUp     = q ? q.change_pct >= 0 : null;
            const badge    = getExchangeBadge(item.symbol);
            const isActive = selected === item.symbol;
            const currency = q?.currency || getCurrency(item.symbol);

            return (
              <button
                key={item.symbol}
                onClick={() => onSelect(item.symbol)}
                className={`w-full text-left px-3 py-2.5 border-b border-border/50 transition-all duration-150
                  hover:bg-secondary/80 active:scale-[0.99]
                  ${isActive ? "bg-secondary border-l-2 border-l-foreground" : ""}
                `}
              >
                <div className="flex items-start justify-between gap-1">
                  {/* Left: name + exchange badge */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs font-semibold text-foreground truncate">
                        {item.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span
                        className={`text-[9px] font-medium px-1 py-0.5 rounded ${badge.color}`}
                      >
                        {badge.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {item.symbol.replace(".NS","").replace(".BO","").replace("-USD","")}
                      </span>
                    </div>
                  </div>

                  {/* Right: price + change */}
                  <div className="text-right flex-shrink-0">
                    {loading[item.symbol] && !q ? (
                      <div className="flex flex-col items-end gap-1">
                        <div className="h-3 w-14 bg-muted animate-pulse rounded" />
                        <div className="h-2.5 w-10 bg-muted animate-pulse rounded" />
                      </div>
                    ) : q ? (
                      <>
                        <div className="text-xs font-semibold text-foreground tabular-nums">
                          {formatPrice(q.price, currency)}
                        </div>
                        <div
                          className={`flex items-center justify-end gap-0.5 text-[10px] font-medium tabular-nums ${
                            isUp === true
                              ? "text-green-600"
                              : isUp === false
                              ? "text-red-500"
                              : "text-muted-foreground"
                          }`}
                        >
                          {isUp === true ? (
                            <TrendingUp className="h-2.5 w-2.5" />
                          ) : isUp === false ? (
                            <TrendingDown className="h-2.5 w-2.5" />
                          ) : (
                            <Minus className="h-2.5 w-2.5" />
                          )}
                          <span>
                            {q.change_pct >= 0 ? "+" : ""}
                            {q.change_pct.toFixed(2)}%
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="text-[10px] text-muted-foreground">—</div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Watchlist component ──────────────────────────────────────────────────

export default function Watchlist({ selected, onSelect }: WatchlistProps) {
  const [search, setSearch] = useState("");

  // Collect all symbols across all groups
  const allSymbols = GROUPS.flatMap((g) => g.items.map((i) => i.symbol));

  const { prices, loading, lastUpdated, refresh } = useLivePrices(allSymbols);

  // When searching, show flat filtered list; otherwise show grouped view
  const isSearching = search.trim().length > 0;

  const searchResults = isSearching
    ? ALL_ITEMS.filter(
        (it) =>
          it.symbol.toLowerCase().includes(search.toLowerCase()) ||
          it.name.toLowerCase().includes(search.toLowerCase()),
      )
    : [];

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ── */}
      <div className="p-3 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-sm font-semibold text-foreground">Watchlist</h2>
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="text-[9px] text-muted-foreground">
                {lastUpdated.toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit", second:"2-digit" })}
              </span>
            )}
            <button
              onClick={refresh}
              title="Refresh prices"
              className="p-1 rounded hover:bg-secondary transition-colors"
            >
              <RefreshCw className="h-3 w-3 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
        </div>

        {/* Search box */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or ticker..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs bg-secondary border-none rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Live prices summary bar */}
        {!isSearching && (
          <div className="mt-2 flex gap-2 overflow-x-auto scrollbar-none">
            {[
              { symbol: "^NSEI",   label: "Nifty" },
              { symbol: "^BSESN",  label: "Sensex" },
              { symbol: "BTC-USD", label: "BTC" },
            ].map(({ symbol, label }) => {
              const q = prices[symbol];
              const up = q ? q.change_pct >= 0 : null;
              return (
                <button
                  key={symbol}
                  onClick={() => onSelect(symbol)}
                  className="flex-shrink-0 flex flex-col items-start px-2 py-1 rounded bg-secondary hover:bg-secondary/80 transition-colors"
                >
                  <span className="text-[9px] text-muted-foreground font-medium">{label}</span>
                  {q ? (
                    <span
                      className={`text-[10px] font-semibold tabular-nums ${up ? "text-green-600" : "text-red-500"}`}
                    >
                      {up ? "▲" : "▼"} {Math.abs(q.change_pct).toFixed(2)}%
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Scrollable list ── */}
      <div className="flex-1 overflow-y-auto scroll-smooth [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-muted-foreground/50">

        {/* Search results — flat list */}
        {isSearching && (
          <div>
            {searchResults.length === 0 ? (
              <div className="p-6 text-center">
                <div className="text-2xl mb-1">🔍</div>
                <div className="text-xs text-muted-foreground">No stocks found for "{search}"</div>
              </div>
            ) : (
              searchResults.map((item) => {
                const q        = prices[item.symbol];
                const isUp     = q ? q.change_pct >= 0 : null;
                const badge    = getExchangeBadge(item.symbol);
                const isActive = selected === item.symbol;
                const currency = q?.currency || getCurrency(item.symbol);
                return (
                  <button
                    key={item.symbol}
                    onClick={() => onSelect(item.symbol)}
                    className={`w-full text-left px-3 py-2.5 border-b border-border/50 transition-all duration-150 hover:bg-secondary/80 ${isActive ? "bg-secondary border-l-2 border-l-foreground" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-foreground truncate mb-0.5">{item.name}</div>
                        <div className="flex items-center gap-1">
                          <span className={`text-[9px] font-medium px-1 py-0.5 rounded ${badge.color}`}>{badge.label}</span>
                          <span className="text-[10px] text-muted-foreground">{item.symbol}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {q ? (
                          <>
                            <div className="text-xs font-semibold text-foreground tabular-nums">{formatPrice(q.price, currency)}</div>
                            <div className={`text-[10px] font-medium tabular-nums ${isUp ? "text-green-600" : "text-red-500"}`}>
                              {q.change_pct >= 0 ? "+" : ""}{q.change_pct.toFixed(2)}%
                            </div>
                          </>
                        ) : (
                          <div className="h-3 w-12 bg-muted animate-pulse rounded" />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Grouped view */}
        {!isSearching && (
          <div className="pb-4">
            {GROUPS.map((group) => (
              <GroupSection
                key={group.key}
                group={group}
                selected={selected}
                onSelect={onSelect}
                prices={prices}
                loading={loading}
                search={search}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Footer: auto-refresh notice ── */}
      <div className="px-3 py-2 border-t border-border flex-shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
          </span>
          <span className="text-[9px] text-muted-foreground">Auto-refreshes every 15s</span>
        </div>
        <span className="text-[9px] text-muted-foreground">
          {Object.keys(prices).length}/{allSymbols.length} loaded
        </span>
      </div>
    </div>
  );
}