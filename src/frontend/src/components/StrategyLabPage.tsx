import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  BookOpen,
  ChartLine,
  FlaskConical,
  Loader2,
  Pencil,
  Plus,
  TestTube2,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { type OdinToken, getTokenImageUrl } from "../lib/odinApi";

const BASE_URL = "https://api.odin.fun/v1";

// ─── Types ──────────────────────────────────────────────────────────────────

interface CandleData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  time: number;
}

interface BacktestResult {
  totalReturn: number;
  numTrades: number;
  winRate: number;
  maxDrawdown: number;
  finalBalance: number;
  initialBalance: number;
  trades: { time: number; type: "buy" | "sell"; price: number; pnl?: number }[];
}

interface PaperTrade {
  id: string;
  tokenId: string;
  ticker: string;
  tokenName: string;
  amount: number;
  entryPrice: number; // in sats
  timestamp: number;
}

interface SavedStrategy {
  id: string;
  name: string;
  tokenId: string;
  ticker: string;
  tokenName: string;
  buyDropPct: number;
  sellRisePct: number;
  stopLossPct: number;
  dcaEnabled: boolean;
  dcaAmount: number;
  dcaIntervalHours: number;
  active: boolean;
  createdAt: number;
}

// ─── localStorage helpers ───────────────────────────────────────────────────

const PAPER_TRADES_KEY = "captain_cloppy_paper_trades";
const STRATEGIES_KEY = "captain_cloppy_strategies";

function loadPaperTrades(): PaperTrade[] {
  try {
    return JSON.parse(localStorage.getItem(PAPER_TRADES_KEY) || "[]");
  } catch {
    return [];
  }
}

function savePaperTrades(trades: PaperTrade[]) {
  localStorage.setItem(PAPER_TRADES_KEY, JSON.stringify(trades));
}

function loadStrategies(): SavedStrategy[] {
  try {
    return JSON.parse(localStorage.getItem(STRATEGIES_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveStrategies(strategies: SavedStrategy[]) {
  localStorage.setItem(STRATEGIES_KEY, JSON.stringify(strategies));
}

// ─── Token Selector ──────────────────────────────────────────────────────────

interface TokenSelectorProps {
  selected: OdinToken | null;
  onSelect: (token: OdinToken) => void;
  placeholder?: string;
  inputId?: string;
}

function TokenSelector({
  selected,
  onSelect,
  placeholder = "Search token ticker...",
  inputId,
}: TokenSelectorProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OdinToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `${BASE_URL}/tokens?search=${encodeURIComponent(q)}&sort=market_cap&order=desc&limit=20`,
      );
      if (res.ok) {
        const json = await res.json();
        const data: OdinToken[] = (json.data ?? []).sort(
          (a: OdinToken, b: OdinToken) =>
            (b.marketcap ?? 0) - (a.marketcap ?? 0),
        );
        setResults(data);
        setOpen(data.length > 0);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const handleSelect = (token: OdinToken) => {
    onSelect(token);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      {selected ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
          <img
            src={getTokenImageUrl(selected.id)}
            alt={selected.ticker}
            className="h-6 w-6 rounded-full object-cover bg-muted"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
          <span className="text-sm font-semibold text-foreground">
            {selected.ticker}
          </span>
          <span className="text-xs text-muted-foreground truncate flex-1">
            {selected.name}
          </span>
          <button
            type="button"
            onClick={handleClear}
            className="ml-auto text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Input
            id={inputId}
            value={query}
            onChange={handleInput}
            placeholder={placeholder}
            className="bg-muted/40 border-border pr-8"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
        </div>
      )}

      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border bg-popover shadow-lg max-h-48 overflow-y-auto">
          {results.map((token) => (
            <button
              key={token.id}
              type="button"
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/60 transition-colors"
              onClick={() => handleSelect(token)}
            >
              <img
                src={getTokenImageUrl(token.id)}
                alt={token.ticker}
                className="h-6 w-6 rounded-full object-cover bg-muted flex-shrink-0"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
              <span className="text-sm font-semibold text-foreground">
                {token.ticker}
              </span>
              <span className="text-xs text-muted-foreground truncate flex-1">
                {token.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Backtest Tab ─────────────────────────────────────────────────────────────

type StrategyType = "buy_dip" | "sell_pump" | "dca";
type SimPeriod = "24h" | "7d" | "30d";

function BacktestTab() {
  const [token, setToken] = useState<OdinToken | null>(null);
  const [entryPrice, setEntryPrice] = useState("");
  const [strategyType, setStrategyType] = useState<StrategyType>("buy_dip");
  const [triggerPct, setTriggerPct] = useState("5");
  const [period, setPeriod] = useState<SimPeriod>("7d");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [usedSimulated, setUsedSimulated] = useState(false);

  const runBacktest = async () => {
    if (!token) {
      toast.error("Select a token first");
      return;
    }
    const entry = Number.parseFloat(entryPrice);
    const trigger = Number.parseFloat(triggerPct);
    if (!Number.isFinite(entry) || entry <= 0) {
      toast.error("Enter a valid entry price in sats");
      return;
    }
    if (!Number.isFinite(trigger) || trigger <= 0) {
      toast.error("Enter a valid trigger percentage");
      return;
    }

    setRunning(true);
    setResult(null);

    try {
      // Determine candle interval and limit based on period
      let limit: number;
      let interval: string;
      if (period === "24h") {
        interval = "1h";
        limit = 24;
      } else if (period === "7d") {
        interval = "1h";
        limit = 168;
      } else {
        interval = "1h";
        limit = 720;
      }

      let candles: CandleData[] = [];
      let simulatedFallback = false;

      try {
        const res = await fetch(
          `${BASE_URL}/tokens/${encodeURIComponent(token.id)}/candles?interval=${interval}&limit=${limit}`,
        );
        if (res.ok) {
          const json = await res.json();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rawCandles: CandleData[] = (json.data ?? json ?? []).map(
            (c: any) => ({
              open: Number(c.open) / 1000,
              high: Number(c.high) / 1000,
              low: Number(c.low) / 1000,
              close: Number(c.close) / 1000,
              volume: Number(c.volume),
              time: Number(c.time),
            }),
          );
          if (rawCandles.length >= 2) {
            candles = rawCandles.sort((a, b) => a.time - b.time);
          }
        }
      } catch {
        // network error — fall through to simulated data
      }

      if (candles.length < 2) {
        // Fallback: generate simulated candles based on entry price
        simulatedFallback = true;
        const now = Math.floor(Date.now() / 1000);
        const intervalSecs = 3600;
        let price = entry;
        const generated: CandleData[] = [];
        for (let i = limit; i >= 0; i--) {
          const volatility = price * 0.04;
          const open = price;
          const close = price + (Math.random() - 0.48) * volatility;
          const high = Math.max(open, close) + Math.random() * volatility * 0.5;
          const low = Math.min(open, close) - Math.random() * volatility * 0.5;
          generated.push({
            time: now - i * intervalSecs,
            open: Math.max(0.000001, open),
            high: Math.max(0.000001, high),
            low: Math.max(0.000001, low),
            close: Math.max(0.000001, close),
            volume: Math.random() * 1000,
          });
          price = Math.max(0.000001, close);
        }
        candles = generated;
      }

      setUsedSimulated(simulatedFallback);

      // Run simulation
      const backtestResult = simulateStrategy(
        candles,
        entry,
        strategyType,
        trigger,
      );
      setResult(backtestResult);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to run backtest",
      );
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Token
          </Label>
          <TokenSelector
            selected={token}
            onSelect={setToken}
            placeholder="Search token by ticker..."
          />
        </div>

        {token && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor="bt-entry"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Entry Price (sats)
                </Label>
                <Input
                  id="bt-entry"
                  data-ocid="backtest.entry.input"
                  type="number"
                  min="0"
                  step="0.000001"
                  placeholder="e.g. 0.05"
                  value={entryPrice}
                  onChange={(e) => setEntryPrice(e.target.value)}
                  className="bg-muted/40 border-border"
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="bt-trigger"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Trigger %
                </Label>
                <div className="relative">
                  <Input
                    id="bt-trigger"
                    data-ocid="backtest.trigger.input"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={triggerPct}
                    onChange={(e) => setTriggerPct(e.target.value)}
                    className="pr-6 bg-muted/40 border-border"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    %
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Strategy Type
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { value: "buy_dip", label: "Buy the Dip" },
                    { value: "sell_pump", label: "Sell the Pump" },
                    { value: "dca", label: "DCA" },
                  ] as { value: StrategyType; label: string }[]
                ).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    data-ocid={`backtest.strategy.${value}.toggle`}
                    onClick={() => setStrategyType(value)}
                    className={[
                      "rounded-lg py-2 text-xs font-semibold transition-all border",
                      strategyType === value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/40 text-muted-foreground hover:text-foreground",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Simulation Period
              </Label>
              <Select
                value={period}
                onValueChange={(v) => setPeriod(v as SimPeriod)}
              >
                <SelectTrigger
                  data-ocid="backtest.period.select"
                  className="bg-muted/40 border-border"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24 hours</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              type="button"
              data-ocid="backtest.run.primary_button"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={runBacktest}
              disabled={running}
            >
              {running ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running Backtest...
                </>
              ) : (
                <>
                  <ChartLine className="mr-2 h-4 w-4" />
                  Run Backtest
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {running && (
        <div data-ocid="backtest.loading_state" className="space-y-3">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      )}

      {result && !running && (
        <div data-ocid="backtest.result.card" className="space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              Backtest Results
            </span>
            <span className="text-xs text-muted-foreground">
              &mdash; {token?.ticker} &middot; {period}
            </span>
          </div>

          {usedSimulated && (
            <p className="text-xs text-yellow-500/80 bg-yellow-500/10 rounded px-3 py-2">
              Live candle data unavailable for this token. Results are based on
              simulated price data using your entry price as a seed.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Total Return
                </p>
                <p
                  className={`text-xl font-bold ${
                    result.totalReturn >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {result.totalReturn >= 0 ? "+" : ""}
                  {result.totalReturn.toFixed(2)}%
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Trades Executed
                </p>
                <p className="text-xl font-bold text-foreground">
                  {result.numTrades}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Win Rate
                </p>
                <p
                  className={`text-xl font-bold ${
                    result.winRate >= 50 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {result.winRate.toFixed(1)}%
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Max Drawdown
                </p>
                <p className="text-xl font-bold text-red-400">
                  -{result.maxDrawdown.toFixed(2)}%
                </p>
              </CardContent>
            </Card>
          </div>

          {result.numTrades === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              No trades triggered in this period. Try adjusting your trigger
              percentage.
            </p>
          )}

          {result.trades.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Trade Log
              </p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {result.trades.slice(0, 20).map((t, i) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: stable list
                    key={i}
                    className="flex items-center justify-between text-xs py-1 border-b border-border/50"
                  >
                    <span
                      className={
                        t.type === "buy" ? "text-green-400" : "text-red-400"
                      }
                    >
                      {t.type.toUpperCase()}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(t.time).toLocaleDateString()}
                    </span>
                    <span className="text-foreground font-medium">
                      {t.price.toFixed(4)} sats
                    </span>
                    {t.pnl !== undefined && (
                      <span
                        className={
                          t.pnl >= 0 ? "text-green-400" : "text-red-400"
                        }
                      >
                        {t.pnl >= 0 ? "+" : ""}
                        {t.pnl.toFixed(2)}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Backtest Simulation Engine ───────────────────────────────────────────────

function simulateStrategy(
  candles: CandleData[],
  entryPrice: number,
  strategyType: StrategyType,
  triggerPct: number,
): BacktestResult {
  const trades: BacktestResult["trades"] = [];
  let balance = 10000; // 10000 sats starting capital
  const initialBalance = balance;
  let inPosition = false;
  let buyPrice = 0;
  let peakBalance = balance;
  let maxDrawdown = 0;
  let wins = 0;
  let losses = 0;
  let dcaNextIdx = 0;

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    const priceDrop =
      prev.close > 0 ? ((prev.close - curr.low) / prev.close) * 100 : 0;
    const priceRise =
      prev.close > 0 ? ((curr.high - prev.close) / prev.close) * 100 : 0;

    if (strategyType === "buy_dip") {
      if (!inPosition && priceDrop >= triggerPct) {
        // Buy at dip
        buyPrice = curr.low;
        inPosition = true;
        trades.push({ time: curr.time, type: "buy", price: curr.low });
      } else if (inPosition && priceRise >= triggerPct) {
        // Sell at pump
        const pnl = ((curr.high - buyPrice) / buyPrice) * 100;
        const gain = balance * (pnl / 100);
        balance += gain;
        if (pnl > 0) wins++;
        else losses++;
        trades.push({ time: curr.time, type: "sell", price: curr.high, pnl });
        inPosition = false;
      }
    } else if (strategyType === "sell_pump") {
      if (!inPosition && i === 1) {
        // Start with a position for sell_pump
        buyPrice = entryPrice > 0 ? entryPrice : candles[0].close;
        inPosition = true;
      }
      if (inPosition && priceRise >= triggerPct) {
        const pnl = ((curr.high - buyPrice) / buyPrice) * 100;
        const gain = balance * (pnl / 100);
        balance += gain;
        if (pnl > 0) wins++;
        else losses++;
        trades.push({ time: curr.time, type: "sell", price: curr.high, pnl });
        inPosition = false;
      } else if (!inPosition && priceDrop >= triggerPct) {
        // Re-enter after dip
        buyPrice = curr.low;
        inPosition = true;
        trades.push({ time: curr.time, type: "buy", price: curr.low });
      }
    } else if (strategyType === "dca") {
      // DCA: buy every N candles (triggerPct is used as interval in candles)
      const interval = Math.max(1, Math.round(triggerPct));
      if (i >= dcaNextIdx) {
        if (inPosition) {
          const pnl = ((curr.close - buyPrice) / buyPrice) * 100;
          const gain = balance * (pnl / 100);
          balance += gain;
          if (pnl > 0) wins++;
          else losses++;
          trades.push({
            time: curr.time,
            type: "sell",
            price: curr.close,
            pnl,
          });
          inPosition = false;
        }
        buyPrice = curr.close;
        inPosition = true;
        dcaNextIdx = i + interval;
        trades.push({ time: curr.time, type: "buy", price: curr.close });
      }
    }

    // Track max drawdown
    if (balance > peakBalance) peakBalance = balance;
    const dd =
      peakBalance > 0 ? ((peakBalance - balance) / peakBalance) * 100 : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  // Close any open position at last candle close
  if (inPosition && candles.length > 0) {
    const lastClose = candles[candles.length - 1].close;
    const pnl = ((lastClose - buyPrice) / buyPrice) * 100;
    const gain = balance * (pnl / 100);
    balance += gain;
    if (pnl > 0) wins++;
    else losses++;
    trades.push({
      time: candles[candles.length - 1].time,
      type: "sell",
      price: lastClose,
      pnl,
    });
  }

  const totalTrades = wins + losses;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const totalReturn = ((balance - initialBalance) / initialBalance) * 100;

  return {
    totalReturn,
    numTrades: trades.filter((t) => t.type === "sell").length,
    winRate,
    maxDrawdown,
    finalBalance: balance,
    initialBalance,
    trades,
  };
}

// ─── Paper Trading Tab ────────────────────────────────────────────────────────

function PaperTradingTab() {
  const [token, setToken] = useState<OdinToken | null>(null);
  const [amount, setAmount] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [positions, setPositions] = useState<PaperTrade[]>(loadPaperTrades);
  const [currentPrices, setCurrentPrices] = useState<Record<string, number>>(
    {},
  );
  const [fetchingPrices, setFetchingPrices] = useState(false);

  // Fetch current prices for all open positions
  const fetchPrices = useCallback(async (trades: PaperTrade[]) => {
    const uniqueIds = [...new Set(trades.map((t) => t.tokenId))];
    if (uniqueIds.length === 0) return;
    setFetchingPrices(true);
    const prices: Record<string, number> = {};
    await Promise.all(
      uniqueIds.map(async (id) => {
        try {
          const res = await fetch(
            `${BASE_URL}/tokens/${encodeURIComponent(id)}`,
          );
          if (res.ok) {
            const json = await res.json();
            const t = json.data ?? json;
            if (t?.price) prices[id] = t.price / 1000; // milli-sat to sats
          }
        } catch {
          // ignore
        }
      }),
    );
    setCurrentPrices(prices);
    setFetchingPrices(false);
  }, []);

  useEffect(() => {
    if (positions.length > 0) {
      fetchPrices(positions);
    }
  }, [positions, fetchPrices]);

  const addPosition = () => {
    if (!token) {
      toast.error("Select a token first");
      return;
    }
    const qty = Number.parseFloat(amount);
    const price = Number.parseFloat(entryPrice);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Enter a valid token amount");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      toast.error("Enter a valid entry price in sats");
      return;
    }

    const newTrade: PaperTrade = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tokenId: token.id,
      ticker: token.ticker,
      tokenName: token.name,
      amount: qty,
      entryPrice: price,
      timestamp: Date.now(),
    };

    const updated = [...positions, newTrade];
    setPositions(updated);
    savePaperTrades(updated);
    setToken(null);
    setAmount("");
    setEntryPrice("");
    toast.success(`Position added: ${token.ticker}`);
  };

  const closePosition = (id: string) => {
    const updated = positions.filter((p) => p.id !== id);
    setPositions(updated);
    savePaperTrades(updated);
    toast.success("Position closed");
  };

  // Calculate portfolio P&L
  const totalPnlPct =
    positions.length > 0
      ? positions.reduce((sum, p) => {
          const curr = currentPrices[p.tokenId];
          if (!curr) return sum;
          return sum + ((curr - p.entryPrice) / p.entryPrice) * 100;
        }, 0) / positions.length
      : 0;

  const totalPnlSats = positions.reduce((sum, p) => {
    const curr = currentPrices[p.tokenId];
    if (!curr) return sum;
    return sum + (curr - p.entryPrice) * p.amount;
  }, 0);

  return (
    <div className="space-y-5">
      {/* Summary */}
      {positions.length > 0 && (
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Portfolio P&amp;L
                </p>
                <p
                  className={`text-xl font-bold mt-0.5 ${
                    totalPnlPct >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {totalPnlPct >= 0 ? "+" : ""}
                  {totalPnlPct.toFixed(2)}%
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Total P&amp;L (sats)
                </p>
                <p
                  className={`text-base font-bold mt-0.5 ${
                    totalPnlSats >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {totalPnlSats >= 0 ? "+" : ""}
                  {totalPnlSats.toFixed(4)} sats
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Position Form */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-foreground">
            Add Simulated Position
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Token
            </Label>
            <TokenSelector
              selected={token}
              onSelect={setToken}
              placeholder="Search token..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label
                htmlFor="pt-amount"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Amount (tokens)
              </Label>
              <Input
                id="pt-amount"
                data-ocid="paper.amount.input"
                type="number"
                min="0"
                placeholder="1000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-muted/40 border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="pt-entry"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Entry Price (sats)
              </Label>
              <Input
                id="pt-entry"
                data-ocid="paper.entry.input"
                type="number"
                min="0"
                step="0.000001"
                placeholder="0.05"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                className="bg-muted/40 border-border"
              />
            </div>
          </div>
          <Button
            type="button"
            data-ocid="paper.add.primary_button"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={addPosition}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Position
          </Button>
        </CardContent>
      </Card>

      {/* Open Positions */}
      {positions.length === 0 ? (
        <div
          data-ocid="paper.empty_state"
          className="rounded-xl border border-border bg-card p-8 text-center"
        >
          <p className="text-sm text-muted-foreground">
            No open positions yet.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Add a simulated position above to track paper P&amp;L.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Open Positions
            </p>
            {fetchingPrices && (
              <div
                data-ocid="paper.loading_state"
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <Loader2 className="h-3 w-3 animate-spin" />
                Updating prices
              </div>
            )}
          </div>
          {positions.map((pos, i) => {
            const curr = currentPrices[pos.tokenId];
            const pnlPct =
              curr != null
                ? ((curr - pos.entryPrice) / pos.entryPrice) * 100
                : null;
            const pnlSats =
              curr != null ? (curr - pos.entryPrice) * pos.amount : null;
            const isProfit = pnlPct != null && pnlPct >= 0;

            return (
              <div
                key={pos.id}
                data-ocid={`paper.position.item.${i + 1}`}
                className="rounded-xl border border-border bg-card p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={getTokenImageUrl(pos.tokenId)}
                      alt={pos.ticker}
                      className="h-8 w-8 rounded-full object-cover bg-muted flex-shrink-0"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display =
                          "none";
                      }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {pos.ticker}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {pos.amount.toLocaleString()} tokens
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {pnlPct != null ? (
                      <>
                        <p
                          className={`text-sm font-bold ${
                            isProfit ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {isProfit ? "+" : ""}
                          {pnlPct.toFixed(2)}%
                        </p>
                        <p
                          className={`text-[11px] ${
                            isProfit ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {pnlSats != null && pnlSats >= 0 ? "+" : ""}
                          {pnlSats?.toFixed(4) ?? "—"} sats
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">Fetching</p>
                    )}
                  </div>
                </div>
                <div className="mt-2.5 flex items-center justify-between">
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>
                      Entry{" "}
                      <span className="text-foreground font-medium">
                        {pos.entryPrice.toFixed(6)} sats
                      </span>
                    </span>
                    <span>
                      Now{" "}
                      <span className="text-foreground font-medium">
                        {curr != null ? `${curr.toFixed(6)} sats` : "—"}
                      </span>
                    </span>
                  </div>
                  <button
                    type="button"
                    data-ocid={`paper.close.delete_button.${i + 1}`}
                    onClick={() => closePosition(pos.id)}
                    className="text-xs text-destructive hover:text-destructive/80 transition-colors font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Strategy Builder Tab ─────────────────────────────────────────────────────

const defaultStrategyForm = (): Omit<SavedStrategy, "id" | "createdAt"> => ({
  name: "",
  tokenId: "",
  ticker: "",
  tokenName: "",
  buyDropPct: 5,
  sellRisePct: 10,
  stopLossPct: 5,
  dcaEnabled: false,
  dcaAmount: 1000,
  dcaIntervalHours: 24,
  active: false,
});

function StrategyBuilderTab() {
  const [strategies, setStrategies] = useState<SavedStrategy[]>(loadStrategies);
  const [formToken, setFormToken] = useState<OdinToken | null>(null);
  const [form, setForm] = useState(defaultStrategyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const handleTokenSelect = (token: OdinToken) => {
    setFormToken(token);
    setForm((prev) => ({
      ...prev,
      tokenId: token.id,
      ticker: token.ticker,
      tokenName: token.name,
    }));
  };

  const handleFormTokenClear = () => {
    setFormToken(null);
    setForm((prev) => ({ ...prev, tokenId: "", ticker: "", tokenName: "" }));
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error("Strategy name is required");
      return;
    }
    if (!form.tokenId.trim()) {
      toast.error("Select a token for this strategy");
      return;
    }

    let updated: SavedStrategy[];
    if (editingId) {
      updated = strategies.map((s) =>
        s.id === editingId ? { ...s, ...form } : s,
      );
      toast.success("Strategy updated");
    } else {
      const newStrategy: SavedStrategy = {
        ...form,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: Date.now(),
      };
      updated = [...strategies, newStrategy];
      toast.success("Strategy saved");
    }

    setStrategies(updated);
    saveStrategies(updated);
    setForm(defaultStrategyForm());
    setFormToken(null);
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (strategy: SavedStrategy) => {
    setForm({
      name: strategy.name,
      tokenId: strategy.tokenId,
      ticker: strategy.ticker,
      tokenName: strategy.tokenName,
      buyDropPct: strategy.buyDropPct,
      sellRisePct: strategy.sellRisePct,
      stopLossPct: strategy.stopLossPct,
      dcaEnabled: strategy.dcaEnabled,
      dcaAmount: strategy.dcaAmount,
      dcaIntervalHours: strategy.dcaIntervalHours,
      active: strategy.active,
    });
    setFormToken({
      id: strategy.tokenId,
      name: strategy.tokenName,
      ticker: strategy.ticker,
      price: 0,
    });
    setEditingId(strategy.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    const updated = strategies.filter((s) => s.id !== id);
    setStrategies(updated);
    saveStrategies(updated);
    toast.success("Strategy deleted");
  };

  const handleToggleActive = (id: string) => {
    const updated = strategies.map((s) =>
      s.id === id ? { ...s, active: !s.active } : s,
    );
    setStrategies(updated);
    saveStrategies(updated);
  };

  const handleCancel = () => {
    setForm(defaultStrategyForm());
    setFormToken(null);
    setEditingId(null);
    setShowForm(false);
  };

  return (
    <div className="space-y-5">
      {/* Actions row */}
      {!showForm && (
        <Button
          type="button"
          data-ocid="strategy.new.primary_button"
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => setShowForm(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Strategy
        </Button>
      )}

      {/* Strategy Form */}
      {showForm && (
        <Card data-ocid="strategy.form.card" className="bg-card border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-foreground">
              {editingId ? "Edit Strategy" : "New Strategy"}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {/* Name */}
            <div className="space-y-1.5">
              <Label
                htmlFor="sb-name"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Strategy Name
              </Label>
              <Input
                id="sb-name"
                data-ocid="strategy.name.input"
                placeholder="My DCA Strategy"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
                className="bg-muted/40 border-border"
              />
            </div>

            {/* Token */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Token
              </Label>
              <TokenSelector
                selected={formToken}
                onSelect={handleTokenSelect}
                placeholder="Search token..."
              />
              {formToken && (
                <button
                  type="button"
                  onClick={handleFormTokenClear}
                  className="hidden"
                />
              )}
            </div>

            {/* Conditions */}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label
                  htmlFor="sb-buy"
                  className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Buy Drop %
                </Label>
                <div className="relative">
                  <Input
                    id="sb-buy"
                    data-ocid="strategy.buy_drop.input"
                    type="number"
                    min="0.1"
                    step="0.5"
                    value={form.buyDropPct}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        buyDropPct: Number.parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="pr-5 bg-muted/40 border-border text-xs"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                    %
                  </span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="sb-sell"
                  className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Sell Rise %
                </Label>
                <div className="relative">
                  <Input
                    id="sb-sell"
                    data-ocid="strategy.sell_rise.input"
                    type="number"
                    min="0.1"
                    step="0.5"
                    value={form.sellRisePct}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        sellRisePct: Number.parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="pr-5 bg-muted/40 border-border text-xs"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                    %
                  </span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="sb-stoploss"
                  className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Stop Loss %
                </Label>
                <div className="relative">
                  <Input
                    id="sb-stoploss"
                    data-ocid="strategy.stop_loss.input"
                    type="number"
                    min="0.1"
                    step="0.5"
                    value={form.stopLossPct}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        stopLossPct: Number.parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="pr-5 bg-muted/40 border-border text-xs"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                    %
                  </span>
                </div>
              </div>
            </div>

            {/* DCA */}
            <div className="rounded-lg bg-muted/30 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">DCA</p>
                  <p className="text-[11px] text-muted-foreground">
                    Dollar Cost Average
                  </p>
                </div>
                <Switch
                  data-ocid="strategy.dca.switch"
                  checked={form.dcaEnabled}
                  onCheckedChange={(v) =>
                    setForm((prev) => ({ ...prev, dcaEnabled: v }))
                  }
                />
              </div>
              {form.dcaEnabled && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label
                      htmlFor="sb-dca-amt"
                      className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      DCA Amount (sats)
                    </Label>
                    <Input
                      id="sb-dca-amt"
                      data-ocid="strategy.dca_amount.input"
                      type="number"
                      min="1"
                      value={form.dcaAmount}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          dcaAmount: Number.parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="bg-muted/40 border-border text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="sb-dca-int"
                      className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      Interval (hours)
                    </Label>
                    <Input
                      id="sb-dca-int"
                      data-ocid="strategy.dca_interval.input"
                      type="number"
                      min="1"
                      value={form.dcaIntervalHours}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          dcaIntervalHours:
                            Number.parseInt(e.target.value, 10) || 1,
                        }))
                      }
                      className="bg-muted/40 border-border text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Form actions */}
            <div className="flex gap-2">
              <Button
                type="button"
                data-ocid="strategy.cancel.cancel_button"
                variant="outline"
                className="flex-1 border-border"
                onClick={handleCancel}
              >
                Cancel
              </Button>
              <Button
                type="button"
                data-ocid="strategy.save.save_button"
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleSave}
              >
                {editingId ? "Update" : "Save Strategy"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Saved Strategies List */}
      {strategies.length === 0 && !showForm ? (
        <div
          data-ocid="strategy.empty_state"
          className="rounded-xl border border-border bg-card p-8 text-center"
        >
          <FlaskConical className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">No strategies saved.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Click "New Strategy" to create your first strategy.
          </p>
        </div>
      ) : strategies.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Saved Strategies
          </p>
          {strategies.map((s, i) => (
            <div
              key={s.id}
              data-ocid={`strategy.item.${i + 1}`}
              className={[
                "rounded-xl border bg-card p-3 transition-colors",
                s.active ? "border-primary/30" : "border-border",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">
                      {s.name}
                    </p>
                    <span
                      className={`text-[11px] font-semibold ${
                        s.active ? "text-green-400" : "text-muted-foreground"
                      }`}
                    >
                      {s.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <img
                      src={getTokenImageUrl(s.tokenId)}
                      alt={s.ticker}
                      className="h-4 w-4 rounded-full object-cover bg-muted"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display =
                          "none";
                      }}
                    />
                    <span className="text-xs text-primary font-medium">
                      {s.ticker}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Buy -{s.buyDropPct}% / Sell +{s.sellRisePct}% / SL{" "}
                    {s.stopLossPct}%
                    {s.dcaEnabled && (
                      <span className="ml-1.5 text-primary">· DCA</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Switch
                    data-ocid={`strategy.active.switch.${i + 1}`}
                    checked={s.active}
                    onCheckedChange={() => handleToggleActive(s.id)}
                  />
                  <button
                    type="button"
                    data-ocid={`strategy.edit.edit_button.${i + 1}`}
                    onClick={() => handleEdit(s)}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                    title="Edit"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    data-ocid={`strategy.delete.delete_button.${i + 1}`}
                    onClick={() => handleDelete(s.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function StrategyLabPage() {
  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
          <FlaskConical className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Strategy Lab
          </h2>
          <p className="text-xs text-muted-foreground">
            Backtest strategies, simulate paper trades, and build your playbook
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0">
          <div className="h-2 w-2 rounded-full bg-amber-400 mt-1" />
        </div>
        <p className="text-xs text-amber-400/90">
          Strategy Lab is a simulation tool only. No real trades are executed.
          Results are based on historical Odin.fun candle data and do not
          guarantee future performance.
        </p>
      </div>

      {/* How It Works */}
      <div className="rounded-lg border border-border/50 bg-card/40 p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">
            How It Works
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Backtest */}
          <div className="flex flex-col gap-1.5 rounded-md border border-border/40 bg-background/40 p-3">
            <div className="flex items-center gap-2">
              <ChartLine className="h-4 w-4 text-blue-400 flex-shrink-0" />
              <span className="text-xs font-semibold text-foreground">
                Backtest
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Pick a token and set entry/exit conditions (e.g. "buy when price
              drops 10%, sell when it rises 15%"). The engine replays those
              rules against real Odin.fun historical candle data and reports
              P&L, win rate, and max drawdown — so you can see how the strategy
              would have performed before risking real funds.
            </p>
          </div>
          {/* Paper Trading */}
          <div className="flex flex-col gap-1.5 rounded-md border border-border/40 bg-background/40 p-3">
            <div className="flex items-center gap-2">
              <TestTube2 className="h-4 w-4 text-green-400 flex-shrink-0" />
              <span className="text-xs font-semibold text-foreground">
                Paper Trading
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Open simulated positions at the current live price with virtual
              funds — no wallet signature required. The app tracks your entry
              price and shows real-time unrealized P&L as the market moves.
              Close the position whenever you like to lock in the simulated
              result.
            </p>
          </div>
          {/* Strategy Builder */}
          <div className="flex flex-col gap-1.5 rounded-md border border-border/40 bg-background/40 p-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-400 flex-shrink-0" />
              <span className="text-xs font-semibold text-foreground">
                Strategy Builder
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Define and save named strategies with specific buy-drop %,
              sell-rise %, stop-loss %, and optional DCA settings. Saved
              strategies can be loaded directly into the Backtest tab to test
              them, keeping your playbook organised in one place.
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground/70 pt-1">
          <span className="text-amber-400 font-medium">Note:</span> Strategy Lab
          is a planning and simulation tool. Captain Cloppy cannot auto-execute
          trades — every real trade on Odin.fun requires a manual wallet
          signature.
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="backtest" className="w-full">
        <TabsList
          data-ocid="strategy_lab.tab"
          className="grid w-full grid-cols-3 bg-muted/40"
        >
          <TabsTrigger
            value="backtest"
            className="data-[state=active]:bg-card text-xs"
          >
            <ChartLine className="mr-1.5 h-3.5 w-3.5" />
            Backtest
          </TabsTrigger>
          <TabsTrigger
            value="paper"
            className="data-[state=active]:bg-card text-xs"
          >
            <TrendingUp className="mr-1.5 h-3.5 w-3.5" />
            Paper Trading
          </TabsTrigger>
          <TabsTrigger
            value="builder"
            className="data-[state=active]:bg-card text-xs"
          >
            <TrendingDown className="mr-1.5 h-3.5 w-3.5" />
            Builder
          </TabsTrigger>
        </TabsList>

        <TabsContent value="backtest" className="mt-5">
          <BacktestTab />
        </TabsContent>

        <TabsContent value="paper" className="mt-5">
          <PaperTradingTab />
        </TabsContent>

        <TabsContent value="builder" className="mt-5">
          <StrategyBuilderTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
