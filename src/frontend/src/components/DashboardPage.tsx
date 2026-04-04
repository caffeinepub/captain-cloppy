import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useBtcPrice } from "../hooks/useBtcPrice";
import {
  type OdinToken,
  type OdinTrade,
  formatBtcWithUsd,
  formatMcapAsUsd,
  formatPriceAsSats,
  getGlobalTrades,
  getTokenImageUrl,
  getTokens,
  parseOdinDate,
} from "../lib/odinApi";
import { TokenDetailModal } from "./TokenDetailModal";

interface DashboardPageProps {
  principal: string;
  onSetPrincipal: (p: string) => void;
  onSelectToken?: (token: OdinToken) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatRelativeTime(raw: string | number | undefined): string {
  if (raw === undefined || raw === null) return "—";
  try {
    const d = parseOdinDate(raw);
    if (Number.isNaN(d.getTime())) return "—";
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return "—";
  }
}

function getPriceChangePercent(token: OdinToken): number | null {
  if (!token.price_1d || token.price_1d === 0) return null;
  return ((token.price - token.price_1d) / Math.abs(token.price_1d)) * 100;
}

// ─── Trending Token Card (visual) ───────────────────────────────────────────

function TrendingTokenCard({
  token,
  rank,
  onClick,
}: {
  token: OdinToken;
  rank: number;
  onClick: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const imgUrl = getTokenImageUrl(token.id);
  const { btcUsd } = useBtcPrice();
  const pct = getPriceChangePercent(token);
  const isUp = pct !== null && pct >= 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5 hover:border-primary/40 hover:bg-muted/20 transition-all duration-200 text-left w-full"
    >
      {/* Rank badge */}
      <span className="absolute top-2.5 right-2.5 text-[10px] font-bold text-muted-foreground/50">
        #{rank}
      </span>

      {/* Token identity */}
      <div className="flex items-center gap-2.5">
        <div className="h-10 w-10 shrink-0 rounded-full overflow-hidden bg-gradient-to-br from-primary/30 to-primary/10 ring-2 ring-primary/20 ring-offset-1 ring-offset-background group-hover:scale-105 transition-transform duration-200">
          {imgUrl && !imgError ? (
            <img
              src={imgUrl}
              alt={token.ticker}
              className="h-full w-full rounded-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-primary">
              {token.ticker.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-foreground truncate">
              {token.ticker}
            </span>
            {token.bonded && (
              <svg
                viewBox="0 0 22 22"
                className="h-3.5 w-3.5 shrink-0 fill-[#1d9bf0]"
                role="img"
                aria-label="Bonded"
              >
                <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
              </svg>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground truncate">
            {token.name}
          </p>
        </div>
      </div>

      {/* Price & change */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] text-muted-foreground mb-0.5">Price</p>
          <p className="font-mono text-xs font-bold text-primary">
            {formatPriceAsSats(token.price)}
          </p>
        </div>
        {pct !== null && (
          <div
            className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
              isUp
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-red-500/10 text-red-400"
            }`}
          >
            {isUp ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {Math.abs(pct).toFixed(1)}%
          </div>
        )}
      </div>

      {/* Market cap */}
      {token.marketcap && btcUsd && (
        <div className="flex items-center justify-between border-t border-border/50 pt-2 mt-0.5">
          <span className="text-[10px] text-muted-foreground">Mkt Cap</span>
          <span className="text-[10px] font-semibold text-foreground font-mono">
            {formatMcapAsUsd(token.marketcap, btcUsd)}
          </span>
        </div>
      )}
    </button>
  );
}

// ─── Mini Global Feed ────────────────────────────────────────────────────────

const FEED_SKELETON_IDS = ["f1", "f2", "f3", "f4", "f5"] as const;

function GlobalFeedMini() {
  const [trades, setTrades] = useState<OdinTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { btcUsd } = useBtcPrice();

  const fetchFeed = useCallback((isInitial = false) => {
    if (isInitial) setLoading(true);
    getGlobalTrades(1, 8)
      .then(({ data }) => {
        setTrades(data);
        setLastRefreshed(new Date());
      })
      .catch(() => {})
      .finally(() => {
        if (isInitial) setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchFeed(true);
  }, [fetchFeed]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (isLive) {
      intervalRef.current = setInterval(() => fetchFeed(false), 15_000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isLive, fetchFeed]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 md:p-5 shadow-card">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Activity className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">
          Mini Global Feed
        </h3>
        <div className="ml-auto flex items-center gap-2">
          {lastRefreshed && (
            <span className="text-[10px] text-muted-foreground/60 hidden sm:inline">
              {lastRefreshed.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsLive((v) => !v)}
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border transition-colors ${
              isLive
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : "bg-muted/40 text-muted-foreground border-border"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isLive ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground"
              }`}
            />
            {isLive ? "LIVE" : "PAUSED"}
          </button>
        </div>
      </div>

      {/* Feed list */}
      <div className="space-y-1.5">
        {loading
          ? FEED_SKELETON_IDS.map((id) => (
              <Skeleton key={id} className="h-12 w-full rounded-lg" />
            ))
          : trades.slice(0, 8).map((trade, i) => {
              const isBuy = trade.buy ?? false;
              const ticker = trade.token_ticker ?? trade.token_id ?? "—";
              const timestamp = trade.time ?? 0;
              const btcAmt = trade.amount_btc ?? 0;

              return (
                <div
                  key={trade.id ?? i}
                  className="flex items-center gap-2 rounded-lg bg-muted/20 border border-border/40 px-3 py-2 hover:bg-muted/40 transition-colors"
                  data-ocid={`dashboard.feed.item.${i + 1}`}
                >
                  {/* Buy/Sell badge */}
                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1.5 py-0 font-bold shrink-0 h-4 ${
                      isBuy
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : "bg-red-500/15 text-red-400 border-red-500/30"
                    }`}
                  >
                    {isBuy ? "BUY" : "SELL"}
                  </Badge>

                  {/* Token ticker */}
                  <span className="text-xs font-bold text-foreground min-w-[36px]">
                    {ticker.length > 8 ? `${ticker.slice(0, 6)}…` : ticker}
                  </span>

                  {/* Value */}
                  <span
                    className={`font-mono text-[10px] font-semibold flex-1 truncate ${
                      isBuy ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {formatBtcWithUsd(btcAmt, btcUsd)}
                  </span>

                  {/* Trader + time */}
                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-[9px] text-muted-foreground/70 font-mono">
                      {trade.user_username
                        ? trade.user_username.length > 10
                          ? `${trade.user_username.slice(0, 8)}…`
                          : trade.user_username
                        : trade.user
                          ? `${trade.user.slice(0, 6)}…`
                          : "—"}
                    </span>
                    <span className="text-[9px] text-muted-foreground/50">
                      {formatRelativeTime(timestamp)}
                    </span>
                  </div>
                </div>
              );
            })}
      </div>
    </div>
  );
}

// ─── Dashboard Page ──────────────────────────────────────────────────────────

const TRENDING_SKELETON_IDS = ["sk1", "sk2", "sk3", "sk4", "sk5"] as const;

export function DashboardPage({
  principal: _principal,
  onSetPrincipal: _onSetPrincipal,
  onSelectToken,
}: DashboardPageProps) {
  const [trendingTokens, setTrendingTokens] = useState<OdinToken[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(false);
  const [detailToken, setDetailToken] = useState<OdinToken | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    setLoadingTrending(true);
    getTokens({ limit: 6, sort: "volume:desc" })
      .then(({ data }) => setTrendingTokens(data))
      .catch(() => setTrendingTokens([]))
      .finally(() => setLoadingTrending(false));
  }, []);

  const handleTokenClick = (token: OdinToken) => {
    setDetailToken(token);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Trending Tokens — visual card grid */}
      <div className="rounded-xl border border-border bg-card p-4 md:p-5 shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Trending Tokens
          </h3>
          <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
            <Zap className="h-3 w-3" /> by volume
          </span>
        </div>

        {/* Responsive card grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {loadingTrending
            ? TRENDING_SKELETON_IDS.map((id) => (
                <Skeleton
                  key={id}
                  className="h-[130px] rounded-xl"
                  data-ocid="dashboard.trending.loading_state"
                />
              ))
            : trendingTokens.map((token, i) => (
                <div
                  key={token.id}
                  data-ocid={`dashboard.trending.item.${i + 1}`}
                >
                  <TrendingTokenCard
                    token={token}
                    rank={i + 1}
                    onClick={() => handleTokenClick(token)}
                  />
                </div>
              ))}
        </div>
      </div>

      {/* Mini Global Feed */}
      <GlobalFeedMini />

      {/* Token Detail Modal */}
      <TokenDetailModal
        token={detailToken}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onTrade={(token) => {
          setDetailOpen(false);
          if (onSelectToken) onSelectToken(token);
        }}
      />
    </div>
  );
}
