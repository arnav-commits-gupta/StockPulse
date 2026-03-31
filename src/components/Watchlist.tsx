import { WATCHLIST, type WatchlistItem } from "@/lib/api";
import { Search } from "lucide-react";
import { useState } from "react";

interface WatchlistProps {
  selected: string;
  onSelect: (symbol: string) => void;
}

export default function Watchlist({ selected, onSelect }: WatchlistProps) {
  const [search, setSearch] = useState("");

  const filtered = WATCHLIST.filter(
    (s) =>
      s.symbol.toLowerCase().includes(search.toLowerCase()) ||
      s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border flex-shrink-0">
        <h2 className="text-sm font-semibold text-foreground mb-3">Watchlist</h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search stocks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs bg-secondary border-none rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scroll-smooth [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-muted-foreground/50 [&::-webkit-scrollbar-corner]:bg-transparent">
        {filtered.length === 0 && (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No stocks found
          </div>
        )}
        {filtered.map((item) => (
          <button
            key={item.symbol}
            onClick={() => onSelect(item.symbol)}
            className={`w-full text-left px-4 py-3 border-b border-border transition-all duration-200 hover:bg-secondary ${
              selected === item.symbol ? "bg-secondary" : ""
            }`}
          >
            <div className="text-xs font-semibold text-foreground">{item.symbol}</div>
            <div className="text-[11px] text-muted-foreground">{item.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
