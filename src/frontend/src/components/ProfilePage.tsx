import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Copy,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useBtcPrice } from "../hooks/useBtcPrice";
import {
  ODIN_TOKEN_AMOUNT_DIVISOR,
  type OdinBalance,
  type OdinToken,
  type OdinTrade,
  SATS_PER_BTC,
  formatBtcWithUsd,
  formatDate,
  formatMcapAsUsd,
  formatPriceAsSats,
  formatTokenAmount,
  getTokens,
  getUserBalances,
  getUserTrades,
  parseOdinDate,
} from "../lib/odinApi";
import { TokenDetailModal } from "./TokenDetailModal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OdinUserProfile {
  id?: string;
  username?: string;
  created_time?: string;
  btc_balance?: number;
  volume?: number;
  trade_count?: number;
}

interface PnlData {
  realizedPnlBtc: number; // in BTC
  unrealizedPnlBtc: number; // in BTC
  totalInvestedBtc: number; // in BTC
  totalReturnedBtc: number; // in BTC
  roiPercent: number;
}

interface TradeStats {
  totalBuys: number;
  totalSells: number;
  totalTrades: number;
  avgTradeSizeBtc: number;
  mostTradedToken: string;
  mostTradedTokenId: string;
  biggestWinBtc: number;
  biggestWinToken: string;
  biggestLossBtc: number;
  biggestLossToken: string;
  totalVolumeBtc: number;
  firstTradeDate: Date | null;
}

interface ProfilePageProps {
  principal: string;
  onSelectToken?: (token: OdinToken) => void;
  onBack?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BASE_URL = "https://api.odin.fun/v1";

async function getUserProfile(
  principal: string,
): Promise<OdinUserProfile | null> {
  if (!principal.trim()) return null;
  try {
    const res = await fetch(
      `${BASE_URL}/user/${encodeURIComponent(principal)}`,
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? json ?? null;
  } catch {
    return null;
  }
}

function truncatePrincipal(p?: string): string {
  if (!p) return "—";
  if (p.length <= 16) return p;
  return `${p.slice(0, 8)}...${p.slice(-6)}`;
}

function msatsToBtc(msats: number): number {
  if (!Number.isFinite(msats) || msats <= 0) return 0;
  return msats / 1_000 / SATS_PER_BTC;
}

function btcToUsd(btc: number, btcUsd: number | null): number {
  if (!btcUsd || btcUsd <= 0) return 0;
  return btc * btcUsd;
}

function formatUsd(usd: number): string {
  if (!Number.isFinite(usd) || usd === 0) return "$0.00";
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(2)}K`;
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  return `$${usd.toFixed(4)}`;
}

function formatBtcCompact(btc: number): string {
  if (!Number.isFinite(btc) || btc === 0) return "0 BTC";
  if (Math.abs(btc) >= 1) return `${btc.toFixed(4)} BTC`;
  if (Math.abs(btc) >= 0.001) return `${btc.toFixed(6)} BTC`;
  return `${btc.toFixed(8)} BTC`;
}

function formatRelativeTime(raw: string | number | bigint): string {
  const d = parseOdinDate(raw);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── PnL Calculator ──────────────────────────────────────────────────────────

function calculatePnl(
  trades: OdinTrade[],
  balances: OdinBalance[],
  tokens: OdinToken[],
): PnlData {
  // Sort trades oldest first
  const sorted = [...trades].sort((a, b) => {
    const da = parseOdinDate(a.time).getTime();
    const db = parseOdinDate(b.time).getTime();
    return da - db;
  });

  // FIFO matching per token
  const buyQueues: Record<string, number[]> = {}; // tokenId -> array of btc cost per trade
  let realizedPnlBtc = 0;
  let totalInvestedBtc = 0;
  let totalReturnedBtc = 0;

  for (const t of sorted) {
    const tokenId = t.token_id ?? t.token;
    const tradeBtc = msatsToBtc(t.amount_btc);
    if (!tokenId) continue;

    if (t.buy) {
      totalInvestedBtc += tradeBtc;
      if (!buyQueues[tokenId]) buyQueues[tokenId] = [];
      buyQueues[tokenId].push(tradeBtc);
    } else {
      totalReturnedBtc += tradeBtc;
      const queue = buyQueues[tokenId];
      if (queue && queue.length > 0) {
        const buyCost = queue.shift() ?? 0;
        realizedPnlBtc += tradeBtc - buyCost;
      } else {
        // No matching buy — treat as pure gain
        realizedPnlBtc += tradeBtc;
      }
    }
  }

  // Unrealized PnL: current holdings value vs cost basis
  let unrealizedPnlBtc = 0;
  for (const balance of balances) {
    const remaining = buyQueues[balance.id];
    if (!remaining || remaining.length === 0) continue;
    const totalBuyCost = remaining.reduce((a, b) => a + b, 0);
    const token = tokens.find((t) => t.id === balance.id);
    if (!token?.price) continue;
    // current price in BTC
    const tokenAmt = balance.balance / ODIN_TOKEN_AMOUNT_DIVISOR;
    const priceInBtc = token.price / 1_000 / SATS_PER_BTC;
    const currentValue = tokenAmt * priceInBtc;
    unrealizedPnlBtc += currentValue - totalBuyCost;
  }

  const roiPercent =
    totalInvestedBtc > 0 ? (realizedPnlBtc / totalInvestedBtc) * 100 : 0;

  return {
    realizedPnlBtc,
    unrealizedPnlBtc,
    totalInvestedBtc,
    totalReturnedBtc,
    roiPercent,
  };
}

function calculateTradeStats(trades: OdinTrade[]): TradeStats {
  if (trades.length === 0) {
    return {
      totalBuys: 0,
      totalSells: 0,
      totalTrades: 0,
      avgTradeSizeBtc: 0,
      mostTradedToken: "—",
      mostTradedTokenId: "",
      biggestWinBtc: 0,
      biggestWinToken: "—",
      biggestLossBtc: 0,
      biggestLossToken: "—",
      totalVolumeBtc: 0,
      firstTradeDate: null,
    };
  }

  let totalBuys = 0;
  let totalSells = 0;
  let totalVolumeBtc = 0;
  const tokenCounts: Record<string, number> = {};
  let biggestWinBtc = 0;
  let biggestWinToken = "—";
  let biggestLossBtc = 0;
  let biggestLossToken = "—";
  let firstTradeDate: Date | null = null;

  for (const t of trades) {
    const btc = msatsToBtc(t.amount_btc);
    totalVolumeBtc += btc;
    const tokenKey = t.token_id ?? t.token;
    const ticker = t.token_ticker ?? tokenKey ?? "?";

    if (t.buy) {
      totalBuys++;
    } else {
      totalSells++;
      // Track biggest win/loss on sell trades
      if (btc > biggestWinBtc) {
        biggestWinBtc = btc;
        biggestWinToken = ticker;
      }
    }

    if (tokenKey) {
      tokenCounts[tokenKey] = (tokenCounts[tokenKey] ?? 0) + 1;
    }

    const d = parseOdinDate(t.time);
    if (!Number.isNaN(d.getTime())) {
      if (!firstTradeDate || d < firstTradeDate) firstTradeDate = d;
    }
  }

  // Biggest loss: sell with smallest value
  const sells = trades.filter((t) => !t.buy);
  if (sells.length > 0) {
    const minSell = sells.reduce((min, t) =>
      msatsToBtc(t.amount_btc) < msatsToBtc(min.amount_btc) ? t : min,
    );
    biggestLossBtc = msatsToBtc(minSell.amount_btc);
    biggestLossToken =
      minSell.token_ticker ?? minSell.token_id ?? minSell.token ?? "—";
  }

  // Most traded token
  let mostTradedToken = "—";
  let mostTradedTokenId = "";
  let maxCount = 0;
  for (const [id, count] of Object.entries(tokenCounts)) {
    if (count > maxCount) {
      maxCount = count;
      mostTradedTokenId = id;
      const matchedTrade = trades.find((t) => (t.token_id ?? t.token) === id);
      mostTradedToken = matchedTrade?.token_ticker ?? id.slice(0, 8);
    }
  }

  const totalTrades = totalBuys + totalSells;
  const avgTradeSizeBtc = totalTrades > 0 ? totalVolumeBtc / totalTrades : 0;

  return {
    totalBuys,
    totalSells,
    totalTrades,
    avgTradeSizeBtc,
    mostTradedToken,
    mostTradedTokenId,
    biggestWinBtc,
    biggestWinToken,
    biggestLossBtc,
    biggestLossToken,
    totalVolumeBtc,
    firstTradeDate,
  };
}

// ─── Activity Heatmap ────────────────────────────────────────────────────────

function buildHeatmapData(trades: OdinTrade[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of trades) {
    const d = parseOdinDate(t.time);
    if (Number.isNaN(d.getTime())) continue;
    const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

function getHeatmapColor(count: number): string {
  if (count === 0) return "bg-muted/30";
  if (count <= 2) return "bg-success/25";
  if (count <= 5) return "bg-success/55";
  return "bg-success/90";
}

function ActivityHeatmap({
  trades,
  maxWeeks,
}: { trades: OdinTrade[]; maxWeeks?: number }) {
  const heatmap = useMemo(() => buildHeatmapData(trades), [trades]);

  // Build 52 weeks of dates going back from today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDay = new Date(today);
  startDay.setDate(startDay.getDate() - 364); // 52 weeks
  // Align to Sunday
  startDay.setDate(startDay.getDate() - startDay.getDay());

  const weeks: Array<Array<{ date: Date; key: string; count: number }>> = [];
  let current = new Date(startDay);

  while (current <= today) {
    const week: Array<{ date: Date; key: string; count: number }> = [];
    for (let d = 0; d < 7; d++) {
      const key = current.toISOString().slice(0, 10);
      week.push({ date: new Date(current), key, count: heatmap.get(key) ?? 0 });
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
  }

  // Month labels
  const monthLabels: Array<{ label: string; colIndex: number }> = [];
  let lastMonth = -1;
  weeks.forEach((week, i) => {
    const m = week[0].date.getMonth();
    if (m !== lastMonth) {
      monthLabels.push({
        label: week[0].date.toLocaleString("en-US", { month: "short" }),
        colIndex: i,
      });
      lastMonth = m;
    }
  });

  const maxCount = Math.max(...Array.from(heatmap.values()), 1);
  const displayWeeks = maxWeeks ? weeks.slice(-maxWeeks) : weeks;
  // Recompute month labels for displayed weeks
  const filteredMonthLabels: Array<{ label: string; colIndex: number }> = [];
  let lastMonthFiltered = -1;
  displayWeeks.forEach((week, i) => {
    const m = week[0].date.getMonth();
    if (m !== lastMonthFiltered) {
      filteredMonthLabels.push({
        label: week[0].date.toLocaleString("en-US", { month: "short" }),
        colIndex: i,
      });
      lastMonthFiltered = m;
    }
  });

  return (
    <div className="w-full">
      <div className="min-w-0">
        {/* Month labels */}
        <div className="flex gap-0.5 mb-1 ml-7 relative h-4">
          {filteredMonthLabels.map(({ label, colIndex }) => (
            <span
              key={`${label}-${colIndex}`}
              className="absolute text-[9px] text-muted-foreground"
              style={{ left: `${colIndex * 11}px` }}
            >
              {label}
            </span>
          ))}
        </div>
        <div className="flex gap-0.5">
          {/* Day labels */}
          <div className="flex flex-col gap-0.5 mr-1">
            {(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const).map(
              (d, i) => (
                <span
                  key={d}
                  className="text-[9px] text-muted-foreground w-5 h-2.5 flex items-center justify-center"
                >
                  {i % 2 === 1 ? d[0] : ""}
                </span>
              ),
            )}
          </div>
          {/* Grid */}
          <div className="flex gap-0.5 flex-wrap">
            {displayWeeks.map((week) => (
              <div key={week[0].key} className="flex flex-col gap-0.5">
                {week.map(({ key, count, date }) => (
                  <div
                    key={key}
                    title={`${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}: ${count} trade${count !== 1 ? "s" : ""}`}
                    className={`w-2.5 h-2.5 rounded-sm ${getHeatmapColor(count)} transition-colors cursor-default`}
                    style={{
                      opacity:
                        count > 0 ? 0.3 + (count / maxCount) * 0.7 : undefined,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Legend */}
      <div className="flex items-center gap-1 mt-2 justify-end">
        <span className="text-[9px] text-muted-foreground">Less</span>
        {[0, 1, 3, 5, 7].map((c) => (
          <div
            key={c}
            className={`w-2.5 h-2.5 rounded-sm ${getHeatmapColor(c)}`}
          />
        ))}
        <span className="text-[9px] text-muted-foreground">More</span>
      </div>
    </div>
  );
}

// ─── Donut Chart ─────────────────────────────────────────────────────────────

interface DonutSegment {
  value: number;
  color: string;
  label: string;
}

function DonutChart({
  segments,
  size = 120,
}: { segments: DonutSegment[]; size?: number }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return null;

  const r = (size - 16) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const arcs = segments.map((seg) => {
    const pct = seg.value / total;
    const arc = {
      seg,
      pct,
      dashOffset: offset,
      dashArray: pct * circumference,
    };
    offset += pct * circumference;
    return arc;
  });

  return (
    <svg
      width={size}
      height={size}
      className="-rotate-90"
      role="img"
      aria-label="Portfolio allocation chart"
    >
      {arcs.map(({ seg, dashArray, dashOffset }) => (
        <circle
          key={seg.label}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={seg.color}
          strokeWidth={8}
          strokeDasharray={`${dashArray} ${circumference - dashArray}`}
          strokeDashoffset={-dashOffset}
          className="transition-all"
        />
      ))}
    </svg>
  );
}

const CHART_COLORS = [
  "oklch(0.78 0.14 70)",
  "oklch(0.65 0.18 145)",
  "oklch(0.56 0.18 260)",
  "oklch(0.72 0.12 200)",
  "oklch(0.62 0.22 25)",
  "oklch(0.75 0.15 300)",
  "oklch(0.68 0.16 40)",
  "oklch(0.60 0.20 180)",
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  subValue,
  trend,
  loading,
}: {
  label: string;
  value: string;
  subValue?: string;
  trend?: "up" | "down" | "neutral";
  loading?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/20 border border-border/50 min-w-0">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      {loading ? (
        <Skeleton className="h-5 w-20" />
      ) : (
        <div className="flex items-center gap-1.5">
          {trend === "up" && (
            <TrendingUp className="h-3 w-3 text-success shrink-0" />
          )}
          {trend === "down" && (
            <TrendingDown className="h-3 w-3 text-destructive shrink-0" />
          )}
          <span
            className={`text-sm font-bold font-mono truncate max-w-full overflow-hidden block ${
              trend === "up"
                ? "text-success"
                : trend === "down"
                  ? "text-destructive"
                  : "text-foreground"
            }`}
          >
            {value}
          </span>
        </div>
      )}
      {subValue && !loading && (
        <span className="text-[10px] text-muted-foreground truncate block">
          {subValue}
        </span>
      )}
    </div>
  );
}

function BondedCheck() {
  return (
    <svg
      viewBox="0 0 22 22"
      className="h-3.5 w-3.5 shrink-0 fill-[#1d9bf0]"
      role="img"
      aria-label="Bonded"
    >
      <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
    </svg>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ProfilePage({
  principal,
  onSelectToken,
  onBack,
}: ProfilePageProps) {
  const { btcUsd } = useBtcPrice();

  // Data states
  const [profile, setProfile] = useState<OdinUserProfile | null>(null);
  const [allTrades, setAllTrades] = useState<OdinTrade[]>([]);
  const [balances, setBalances] = useState<OdinBalance[]>([]);
  const [tokens, setTokens] = useState<OdinToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Trade history tab pagination/filter
  const [historyPage, setHistoryPage] = useState(1);
  const [historyFilter, setHistoryFilter] = useState<"all" | "buy" | "sell">(
    "all",
  );
  const [historyTrades, setHistoryTrades] = useState<OdinTrade[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Token detail modal
  const [detailToken, setDetailToken] = useState<OdinToken | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const HISTORY_PAGE_SIZE = 20;
  const loadedRef = useRef("");

  // ── Fetch profile data ──────────────────────────────────────────────────────
  const fetchProfileData = useCallback(async (p: string) => {
    if (!p.trim()) return;
    setLoading(true);
    setError("");
    try {
      const [profileData, balanceData, tokenData, tradeData] =
        await Promise.all([
          getUserProfile(p),
          getUserBalances(p).catch(() => [] as OdinBalance[]),
          getTokens({ limit: 100, sort: "market_cap:desc" }).catch(() => ({
            data: [] as OdinToken[],
            count: 0,
          })),
          getUserTrades(p, 1, 500).catch(() => ({
            data: [] as OdinTrade[],
            count: 0,
          })),
        ]);

      setProfile(profileData);
      setBalances(balanceData);
      setTokens(tokenData.data);
      setAllTrades(tradeData.data);
    } catch {
      setError("Failed to load profile data.");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch paginated history ─────────────────────────────────────────────────
  const fetchHistory = useCallback(
    async (p: string, page: number, filter: "all" | "buy" | "sell") => {
      if (!p.trim()) return;
      setHistoryLoading(true);
      try {
        const { data, count } = await getUserTrades(p, page, HISTORY_PAGE_SIZE);
        const filtered =
          filter === "all"
            ? data
            : data.filter((t) => (filter === "buy" ? t.buy : !t.buy));
        setHistoryTrades(filtered);
        setHistoryTotal(count);
      } catch {
        setHistoryTrades([]);
      } finally {
        setHistoryLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!principal || loadedRef.current === principal) return;
    loadedRef.current = principal;
    fetchProfileData(principal);
  }, [principal, fetchProfileData]);

  useEffect(() => {
    if (!principal) return;
    fetchHistory(principal, historyPage, historyFilter);
  }, [principal, historyPage, historyFilter, fetchHistory]);

  // ── Computed data ───────────────────────────────────────────────────────────
  const stats = useMemo(() => calculateTradeStats(allTrades), [allTrades]);
  const pnl = useMemo(
    () => calculatePnl(allTrades, balances, tokens),
    [allTrades, balances, tokens],
  );

  // Portfolio value from balances
  const portfolioData = useMemo(() => {
    return balances
      .map((b) => {
        const token = tokens.find((t) => t.id === b.id);
        const priceInBtc = token?.price
          ? token.price / 1_000 / SATS_PER_BTC
          : 0;
        const tokenAmt = b.balance / ODIN_TOKEN_AMOUNT_DIVISOR;
        const valueBtc = tokenAmt * priceInBtc;
        const valueUsd = btcToUsd(valueBtc, btcUsd);
        return {
          id: b.id,
          ticker: b.ticker || token?.ticker || b.id.slice(0, 6),
          name: b.name || token?.name || b.id,
          balance: b.balance,
          valueUsd,
          valueBtc,
          token,
        };
      })
      .filter((item) => item.valueUsd > 0)
      .sort((a, b) => b.valueUsd - a.valueUsd);
  }, [balances, tokens, btcUsd]);

  const totalPortfolioUsd = portfolioData.reduce((s, p) => s + p.valueUsd, 0);

  const donutSegments: DonutSegment[] = portfolioData
    .slice(0, 8)
    .map((item, i) => ({
      value: item.valueUsd,
      color: CHART_COLORS[i % CHART_COLORS.length],
      label: item.ticker,
    }));

  const historyTotalPages = Math.max(
    1,
    Math.ceil(historyTotal / HISTORY_PAGE_SIZE),
  );

  const displayName = profile?.username ?? truncatePrincipal(principal);
  const initials = (
    profile?.username?.[0] ??
    principal?.[0] ??
    "?"
  ).toUpperCase();

  // ── Token detail ─────────────────────────────────────────────────────────────
  const handleOpenTokenDetail = async (tokenId: string) => {
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const found = tokens.find((t) => t.id === tokenId);
      if (found) {
        setDetailToken(found);
      } else {
        const { getToken } = await import("../lib/odinApi");
        const t = await getToken(tokenId);
        setDetailToken(t);
      }
    } catch {
      setDetailToken(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // ── Wallet not connected ─────────────────────────────────────────────────────
  if (!principal) {
    return (
      <div
        data-ocid="profile.empty_state"
        className="flex flex-col items-center justify-center min-h-[60vh] gap-4 opacity-60"
      >
        <div className="h-16 w-16 rounded-full bg-muted/40 flex items-center justify-center">
          <Wallet className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-base font-medium text-muted-foreground">
          Wallet connect coming soon
        </p>
        <p className="text-sm text-muted-foreground/70 text-center max-w-xs">
          Connect your wallet to view your trading profile, portfolio, and
          statistics.
        </p>
      </div>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div data-ocid="profile.loading_state" className="space-y-4">
        <Card className="border-border bg-card">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-60" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div
        data-ocid="profile.error_state"
        className="flex flex-col items-center justify-center min-h-[40vh] gap-3"
      >
        <p className="text-destructive text-sm">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchProfileData(principal)}
          className="border-border"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-5 pb-4 w-full max-w-full overflow-x-hidden">
      {/* ── Back Button ───────────────────────────────────────────────────── */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-ocid="profile.back.button"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
      )}
      {/* ── A. Identity Header ─────────────────────────────────────────────── */}
      <Card
        data-ocid="profile.card"
        className="border-border bg-card shadow-card overflow-hidden"
      >
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="h-14 w-14 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center">
                <span className="text-xl font-bold text-primary">
                  {initials}
                </span>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-success border-2 border-card" />
            </div>

            {/* Identity info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-foreground truncate">
                  {displayName}
                </h2>
                <span className="text-[10px] font-semibold text-primary border border-primary/30 rounded px-1.5 py-0.5">
                  Trader
                </span>
              </div>
              {/* Full principal with copy */}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground font-mono break-all min-w-0 flex-1">
                  {principal}
                </span>
                <button
                  type="button"
                  data-ocid="profile.copy.button"
                  onClick={() => {
                    navigator.clipboard
                      .writeText(principal)
                      .then(() => toast.success("Principal ID copied!"));
                  }}
                  className="flex-shrink-0 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Copy principal ID"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </div>
              {/* Member since */}
              {stats.firstTradeDate && (
                <p className="text-xs text-muted-foreground mt-1">
                  Member since{" "}
                  {stats.firstTradeDate.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              )}
            </div>

            {/* Mobile volume summary - visible only on mobile */}
            <div className="flex sm:hidden items-center gap-3 mt-1">
              <span className="text-xs text-muted-foreground">
                Vol:{" "}
                <span className="text-foreground font-mono font-semibold">
                  {formatUsd(btcToUsd(stats.totalVolumeBtc, btcUsd))}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">
                <span className="text-foreground font-semibold">
                  {stats.totalTrades}
                </span>{" "}
                trades
              </span>
            </div>

            {/* Volume summary */}
            <div className="flex flex-col items-end gap-1 shrink-0 hidden sm:flex">
              <span className="text-xs text-muted-foreground">
                Total Volume
              </span>
              <span className="text-sm font-bold font-mono text-foreground">
                {formatUsd(btcToUsd(stats.totalVolumeBtc, btcUsd))}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {stats.totalTrades} trades
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── B. Financial Summary ───────────────────────────────────────────── */}
      <div
        data-ocid="profile.section"
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5"
      >
        <StatCard
          label="Portfolio Value"
          value={formatUsd(totalPortfolioUsd)}
          subValue={`${portfolioData.length} token${portfolioData.length !== 1 ? "s" : ""}`}
          loading={loading}
        />
        <StatCard
          label="Total Volume"
          value={formatUsd(btcToUsd(stats.totalVolumeBtc, btcUsd))}
          subValue={formatBtcCompact(stats.totalVolumeBtc)}
          loading={loading}
        />
        <StatCard
          label="Total Trades"
          value={String(stats.totalTrades)}
          subValue={`${stats.totalBuys}B / ${stats.totalSells}S`}
          loading={loading}
        />
        <StatCard
          label="Win Rate"
          value={
            stats.totalTrades > 0
              ? `${Math.round((stats.totalBuys / stats.totalTrades) * 100)}%`
              : "—"
          }
          subValue="Buys vs total"
          loading={loading}
        />
      </div>

      {/* ── C. PnL Section ────────────────────────────────────────────────── */}
      <Card className="border-border bg-card shadow-card">
        <CardHeader className="px-5 py-3 border-b border-border">
          <CardTitle className="text-sm font-bold text-foreground">
            PnL Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Realized PnL
              </span>
              <span
                className={`text-base font-bold font-mono break-words ${
                  pnl.realizedPnlBtc >= 0 ? "text-success" : "text-destructive"
                }`}
              >
                {pnl.realizedPnlBtc >= 0 ? "+" : ""}
                {formatBtcCompact(pnl.realizedPnlBtc)}
              </span>
              <span className="text-xs text-muted-foreground">
                {pnl.realizedPnlBtc >= 0 ? "+" : ""}
                {formatUsd(btcToUsd(pnl.realizedPnlBtc, btcUsd))}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Unrealized PnL
              </span>
              <span
                className={`text-base font-bold font-mono break-words ${
                  pnl.unrealizedPnlBtc >= 0
                    ? "text-success"
                    : "text-destructive"
                }`}
              >
                {pnl.unrealizedPnlBtc >= 0 ? "+" : ""}
                {formatBtcCompact(pnl.unrealizedPnlBtc)}
              </span>
              <span className="text-xs text-muted-foreground">
                {pnl.unrealizedPnlBtc >= 0 ? "+" : ""}
                {formatUsd(btcToUsd(pnl.unrealizedPnlBtc, btcUsd))}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                ROI
              </span>
              <span
                className={`text-base font-bold font-mono break-words ${
                  pnl.roiPercent >= 0 ? "text-success" : "text-destructive"
                }`}
              >
                {pnl.roiPercent >= 0 ? "+" : ""}
                {pnl.roiPercent.toFixed(2)}%
              </span>
              <span className="text-xs text-muted-foreground">
                Based on realized trades
              </span>
            </div>
          </div>
          {/* Invested vs Returned bar */}
          {pnl.totalInvestedBtc > 0 && (
            <div className="mt-4 space-y-1.5">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Invested: {formatBtcCompact(pnl.totalInvestedBtc)}</span>
                <span>Returned: {formatBtcCompact(pnl.totalReturnedBtc)}</span>
              </div>
              <Progress
                value={Math.min(
                  100,
                  (pnl.totalReturnedBtc / pnl.totalInvestedBtc) * 100,
                )}
                className="h-1.5 bg-muted"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── D. Trading Stats Grid ─────────────────────────────────────────── */}
      <Card className="border-border bg-card shadow-card">
        <CardHeader className="px-5 py-3 border-b border-border">
          <CardTitle className="text-sm font-bold text-foreground">
            Trading Stats
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            <StatCard label="Total Buys" value={String(stats.totalBuys)} />
            <StatCard label="Total Sells" value={String(stats.totalSells)} />
            <StatCard
              label="Avg Trade Size"
              value={formatBtcCompact(stats.avgTradeSizeBtc)}
              subValue={formatUsd(btcToUsd(stats.avgTradeSizeBtc, btcUsd))}
            />
            <StatCard label="Most Traded" value={stats.mostTradedToken} />
            <StatCard
              label="Biggest Win"
              value={formatBtcCompact(stats.biggestWinBtc)}
              subValue={stats.biggestWinToken}
              trend="up"
            />
            <StatCard
              label="Biggest Loss"
              value={formatBtcCompact(stats.biggestLossBtc)}
              subValue={stats.biggestLossToken}
              trend="down"
            />
            <StatCard
              label="Total Invested"
              value={formatBtcCompact(pnl.totalInvestedBtc)}
              subValue={formatUsd(btcToUsd(pnl.totalInvestedBtc, btcUsd))}
            />
            <StatCard
              label="Total Returned"
              value={formatBtcCompact(pnl.totalReturnedBtc)}
              subValue={formatUsd(btcToUsd(pnl.totalReturnedBtc, btcUsd))}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── E. Portfolio Breakdown ────────────────────────────────────────── */}
      <Card className="border-border bg-card shadow-card">
        <CardHeader className="px-5 py-3 border-b border-border">
          <CardTitle className="text-sm font-bold text-foreground">
            Portfolio Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {portfolioData.length === 0 ? (
            <div
              data-ocid="profile.portfolio.empty_state"
              className="flex items-center justify-center h-24 text-sm text-muted-foreground"
            >
              No token holdings found.
            </div>
          ) : (
            <div className="flex flex-col md:flex-row gap-6">
              {/* Donut chart */}
              <div className="flex flex-col items-center gap-3 shrink-0">
                <div className="relative">
                  <DonutChart segments={donutSegments} size={120} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[10px] text-muted-foreground">
                      Total
                    </span>
                    <span className="text-sm font-bold text-foreground">
                      {formatUsd(totalPortfolioUsd)}
                    </span>
                  </div>
                </div>
                {/* Legend */}
                <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center max-w-[180px]">
                  {donutSegments.map((seg, i) => (
                    <div key={seg.label} className="flex items-center gap-1">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{
                          background: CHART_COLORS[i % CHART_COLORS.length],
                        }}
                      />
                      <span className="text-[10px] text-muted-foreground">
                        {seg.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Holdings table - mobile card list */}
              <div className="flex-1">
                <div className="md:hidden space-y-2">
                  {portfolioData.map((item, i) => (
                    <div
                      key={item.id}
                      data-ocid={`profile.portfolio.item.${i + 1}`}
                      className="flex items-center justify-between gap-2 py-2 border-b border-border/50 last:border-0"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] text-muted-foreground w-4 shrink-0">
                          {i + 1}
                        </span>
                        <img
                          src={`https://api.odin.fun/v1/token/${item.id}/image`}
                          alt={item.ticker}
                          className="h-6 w-6 rounded-full object-cover bg-muted shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenTokenDetail(item.id)}
                              className="text-xs font-semibold text-primary hover:underline cursor-pointer truncate"
                            >
                              {item.ticker}
                            </button>
                            {item.token?.bonded && <BondedCheck />}
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {formatTokenAmount(item.balance)}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end shrink-0 max-w-[110px]">
                        <span className="text-xs font-mono text-foreground font-semibold">
                          {formatUsd(item.valueUsd)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {totalPortfolioUsd > 0
                            ? `${((item.valueUsd / totalPortfolioUsd) * 100).toFixed(1)}%`
                            : "—"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1.5 pr-3 text-muted-foreground font-semibold text-[10px] uppercase">
                          #
                        </th>
                        <th className="text-left py-1.5 pr-3 text-muted-foreground font-semibold text-[10px] uppercase">
                          Token
                        </th>
                        <th className="text-right py-1.5 pr-3 text-muted-foreground font-semibold text-[10px] uppercase">
                          Balance
                        </th>
                        <th className="text-right py-1.5 pr-3 text-muted-foreground font-semibold text-[10px] uppercase">
                          Value
                        </th>
                        <th className="text-right py-1.5 text-muted-foreground font-semibold text-[10px] uppercase">
                          %
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {portfolioData.map((item, i) => (
                        <tr
                          key={item.id}
                          data-ocid={`profile.portfolio.item.${i + 1}`}
                          className="hover:bg-muted/20 transition-colors"
                        >
                          <td className="py-2 pr-3 text-muted-foreground">
                            {i + 1}
                          </td>
                          <td className="py-2 pr-3">
                            <div className="flex items-center gap-2">
                              <img
                                src={`https://api.odin.fun/v1/token/${item.id}/image`}
                                alt={item.ticker}
                                className="h-5 w-5 rounded-full object-cover bg-muted shrink-0"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display =
                                    "none";
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => handleOpenTokenDetail(item.id)}
                                className="font-semibold text-primary hover:underline cursor-pointer"
                              >
                                {item.ticker}
                              </button>
                              {item.token?.bonded && <BondedCheck />}
                            </div>
                          </td>
                          <td className="py-2 pr-3 text-right font-mono text-muted-foreground">
                            {formatTokenAmount(item.balance)}
                          </td>
                          <td className="py-2 pr-3 text-right font-mono text-foreground">
                            {formatUsd(item.valueUsd)}
                          </td>
                          <td className="py-2 text-right text-muted-foreground">
                            {totalPortfolioUsd > 0
                              ? `${((item.valueUsd / totalPortfolioUsd) * 100).toFixed(1)}%`
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── F. Activity Heatmap ───────────────────────────────────────────── */}
      <Card className="border-border bg-card shadow-card">
        <CardHeader className="px-5 py-3 border-b border-border">
          <CardTitle className="text-sm font-bold text-foreground">
            Activity Heatmap
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {allTrades.length === 0 ? (
            <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
              No trade activity yet.
            </div>
          ) : (
            <>
              <div className="md:hidden">
                <ActivityHeatmap trades={allTrades} maxWeeks={12} />
              </div>
              <div className="hidden md:block overflow-x-auto">
                <ActivityHeatmap trades={allTrades} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <Card className="border-border bg-card shadow-card overflow-hidden">
        <CardHeader className="px-5 py-3 border-b border-border">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-sm font-bold text-foreground">
              Trade History
            </CardTitle>
            {/* Filter tabs */}
            <Tabs
              value={historyFilter}
              onValueChange={(v) => {
                setHistoryFilter(v as "all" | "buy" | "sell");
                setHistoryPage(1);
              }}
            >
              <TabsList
                data-ocid="profile.history.tab"
                className="h-7 bg-muted/40 border border-border"
              >
                <TabsTrigger
                  value="all"
                  data-ocid="profile.history.all.tab"
                  className="text-[10px] h-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  All
                </TabsTrigger>
                <TabsTrigger
                  value="buy"
                  data-ocid="profile.history.buy.tab"
                  className="text-[10px] h-6 data-[state=active]:bg-success data-[state=active]:text-success-foreground"
                >
                  Buy
                </TabsTrigger>
                <TabsTrigger
                  value="sell"
                  data-ocid="profile.history.sell.tab"
                  className="text-[10px] h-6 data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground"
                >
                  Sell
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>

        {historyLoading ? (
          <div
            data-ocid="profile.history.loading_state"
            className="flex items-center justify-center h-32"
          >
            <div className="h-5 w-5 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
          </div>
        ) : historyTrades.length === 0 ? (
          <div
            data-ocid="profile.history.empty_state"
            className="flex items-center justify-center h-32 text-sm text-muted-foreground"
          >
            No trades found.
          </div>
        ) : (
          <>
            <div
              className="divide-y divide-border"
              data-ocid="profile.history.list"
            >
              {historyTrades.map((t, i) => {
                const ticker =
                  t.token_ticker ??
                  (t.token_id ? t.token_id.slice(0, 8) : t.token);
                return (
                  <div
                    key={t.id}
                    data-ocid={`profile.history.item.${i + 1}`}
                    className={`px-4 py-3.5 hover:bg-muted/30 transition-colors ${t.buy ? "border-l-2 border-success/40" : "border-l-2 border-destructive/40"}`}
                  >
                    {/* Row 1: Logo + ticker + badge + value */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {t.token_id && (
                          <img
                            src={`https://api.odin.fun/v1/token/${t.token_id}/image`}
                            alt={ticker}
                            className="rounded-full shrink-0 object-cover bg-muted w-7 h-7 ring-1 ring-border/40"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                "none";
                            }}
                          />
                        )}
                        <div className="flex items-center gap-1 min-w-0">
                          <button
                            type="button"
                            onClick={() =>
                              t.token_id && handleOpenTokenDetail(t.token_id)
                            }
                            className="text-sm font-semibold text-primary hover:underline cursor-pointer transition-colors truncate"
                            disabled={!t.token_id}
                          >
                            {ticker}
                          </button>
                          {t.bonded && <BondedCheck />}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            t.buy
                              ? "bg-success/15 text-success"
                              : "bg-destructive/15 text-destructive"
                          }`}
                        >
                          {t.buy ? "BUY" : "SELL"}
                        </span>
                        <span className="font-mono text-xs text-foreground">
                          {formatBtcWithUsd(t.amount_btc, btcUsd)}
                        </span>
                      </div>
                    </div>
                    {/* Row 2: Date · relative time */}
                    <div className="flex items-center gap-1 mt-1.5 pl-9">
                      <span className="text-[11px] text-muted-foreground">
                        {formatDate(t.time)}
                      </span>
                      <span className="text-[11px] text-muted-foreground/50">
                        ·
                      </span>
                      <span className="text-[11px] text-muted-foreground/60">
                        {formatRelativeTime(t.time)}
                      </span>
                    </div>
                    {/* Row 3: Amount @ price */}
                    <div className="flex items-center gap-1.5 mt-0.5 pl-9">
                      <span className="text-[11px] text-muted-foreground">
                        {formatTokenAmount(t.amount_token)}
                      </span>
                      <span className="text-[11px] text-muted-foreground/40">
                        @
                      </span>
                      <span className="text-[11px] text-primary font-mono">
                        {formatPriceAsSats(t.price)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {historyTotalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  Page {historyPage} of {historyTotalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    data-ocid="profile.history.pagination_prev"
                    variant="outline"
                    size="sm"
                    className="h-7 border-border bg-muted/40"
                    disabled={historyPage <= 1}
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    data-ocid="profile.history.pagination_next"
                    variant="outline"
                    size="sm"
                    className="h-7 border-border bg-muted/40"
                    disabled={historyPage >= historyTotalPages}
                    onClick={() =>
                      setHistoryPage((p) => Math.min(historyTotalPages, p + 1))
                    }
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <TokenDetailModal
        token={detailToken}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setDetailToken(null);
        }}
        onTrade={(token) => {
          setDetailOpen(false);
          if (onSelectToken) onSelectToken(token);
        }}
        loading={detailLoading}
      />
    </div>
  );
}
