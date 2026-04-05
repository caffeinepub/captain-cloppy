import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart2,
  ExternalLink,
  Globe,
  RefreshCw,
  Send,
  TrendingUp,
  Twitter,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useBtcPrice } from "../hooks/useBtcPrice";
import {
  type OdinToken,
  formatBtcWithUsd,
  formatMcapAsUsd,
  formatPriceAsSats,
  formatVolumeAsUsd,
  getTokenImageUrl,
  parseOdinDate,
} from "../lib/odinApi";
import { TokenPriceChart } from "./TokenPriceChart";

const ODIN_TOKEN_AMOUNT_DIVISOR = 100_000_000_000;

interface TokenDetailModalProps {
  token: OdinToken | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTrade: (token: OdinToken) => void;
  loading?: boolean;
}

interface TokenTrade {
  id: string;
  user: string;
  token: string;
  created_at?: string | number;
  time?: string | number;
  timestamp?: string | number;
  ts?: string | number;
  is_buy?: boolean;
  buy?: boolean;
  type?: string;
  trade_type?: string;
  token_amount?: number;
  amount_token?: number;
  btc_amount?: number;
  amount_btc?: number;
  user_username?: string;
  username?: string;
  user_name?: string;
  receiver?: string;
  sender?: string;
}

function TokenInitials({ ticker }: { ticker: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-primary/40 to-primary/10 text-sm font-bold text-primary">
      {ticker.slice(0, 2).toUpperCase()}
    </div>
  );
}

function TokenImage({ token }: { token: OdinToken }) {
  const [imgError, setImgError] = useState(false);
  const imgUrl = getTokenImageUrl(token.id);
  if (!imgUrl || imgError) return <TokenInitials ticker={token.ticker} />;
  return (
    <img
      src={imgUrl}
      alt={token.ticker}
      className="h-full w-full rounded-full object-cover"
      onError={() => setImgError(true)}
    />
  );
}

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

function formatTokenAmt(raw: number | undefined | null): string {
  const safeRaw = raw ?? 0;
  if (!Number.isFinite(safeRaw) || safeRaw <= 0) return "0";
  const amount = safeRaw / ODIN_TOKEN_AMOUNT_DIVISOR;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(2)}K`;
  if (amount < 1 && amount > 0) return amount.toFixed(4);
  return amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** Abbreviate a principal/address: first 6 chars + … + last 4 chars */
function abbreviatePrincipal(p: string): string {
  if (!p || p.length <= 12) return p;
  return `${p.slice(0, 6)}…${p.slice(-4)}`;
}

/** Normalize a URL: add https:// if missing */
function normalizeUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `https://${url}`;
}

/** Normalize a Twitter handle/URL to a full profile URL */
function normalizeTwitter(handle: string): string {
  if (!handle) return handle;
  if (handle.startsWith("http")) return handle;
  const clean = handle.replace(/^@/, "");
  return `https://twitter.com/${clean}`;
}

/** Normalize a Telegram handle/URL to a full link */
function normalizeTelegram(handle: string): string {
  if (!handle) return handle;
  if (handle.startsWith("http")) return handle;
  const clean = handle.replace(/^@/, "");
  return `https://t.me/${clean}`;
}

export function TokenDetailModal({
  token,
  open,
  onOpenChange,
  onTrade,
  loading = false,
}: TokenDetailModalProps) {
  const [activeTab, setActiveTab] = useState("chart");
  const [trades, setTrades] = useState<TokenTrade[]>([]);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [tradesError, setTradesError] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  // Full token detail (with social links) fetched from /token/{id}
  const [tokenDetail, setTokenDetail] = useState<OdinToken | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { btcUsd } = useBtcPrice();

  const displayToken = tokenDetail ?? token;

  const priceChange = displayToken?.price_1d
    ? ((displayToken.price - displayToken.price_1d) /
        Math.max(1, Math.abs(displayToken.price_1d))) *
      100
    : null;

  const displaySupply = "21,000,000";

  // Fetch full token detail (includes twitter/website/telegram)
  useEffect(() => {
    if (!open || !token) {
      setTokenDetail(null);
      return;
    }
    fetch(`https://api.odin.fun/v1/token/${encodeURIComponent(token.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json) setTokenDetail(json.data ?? json);
      })
      .catch(() => {
        /* ignore */
      });
  }, [open, token]);

  const fetchTrades = useCallback((tokenId: string, isInitial = false) => {
    if (isInitial) setTradesLoading(true);
    setTradesError(false);
    fetch(`https://api.odin.fun/v1/token/${tokenId}/trades?limit=20`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((json) => {
        const raw: any[] = Array.isArray(json.data)
          ? json.data
          : Array.isArray(json)
            ? json
            : [];

        const normalized: TokenTrade[] = raw.map((t: any) => {
          // Aggressively extract BTC amount — try every possible field name
          const rawBtc =
            t.amount_btc ??
            t.btc_amount ??
            t.btc ??
            t.value ??
            t.btc_value ??
            0;
          // Aggressively extract token amount
          const rawToken =
            t.amount_token ??
            t.token_amount ??
            t.token_amt ??
            t.qty ??
            t.token_qty ??
            0;
          // Extract is_buy — handle string "buy"/"sell" variants too
          const isBuy =
            t.is_buy ??
            t.buy ??
            (t.type === "buy" ? true : t.type === "sell" ? false : undefined) ??
            (t.trade_type === "buy"
              ? true
              : t.trade_type === "sell"
                ? false
                : undefined) ??
            false;
          // Extract timestamp
          const ts = t.created_at ?? t.time ?? t.timestamp ?? t.ts ?? 0;
          // Extract username
          const username =
            t.user_username ?? t.username ?? t.user_name ?? t.user ?? "";

          return {
            ...t,
            amount_btc:
              typeof rawBtc === "string"
                ? Number.parseFloat(rawBtc) || 0
                : Number(rawBtc) || 0,
            amount_token:
              typeof rawToken === "string"
                ? Number.parseFloat(rawToken) || 0
                : Number(rawToken) || 0,
            is_buy: isBuy,
            created_at: ts,
            user_username: username,
          };
        });

        setTrades(normalized);
        setLastRefreshed(new Date());
      })
      .catch(() => setTradesError(true))
      .finally(() => {
        if (isInitial) setTradesLoading(false);
      });
  }, []);

  // Fetch token trades when feed tab is active + auto-refresh every 15s
  useEffect(() => {
    if (activeTab !== "feed" || !token) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Initial fetch
    fetchTrades(token.id, true);

    // Set up auto-refresh every 15 seconds
    intervalRef.current = setInterval(() => {
      fetchTrades(token.id, false);
    }, 15_000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [activeTab, token, fetchTrades]);

  // Reset tab when modal opens
  useEffect(() => {
    if (open) setActiveTab("chart");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl w-full bg-card border-border p-0 overflow-hidden gap-0 flex flex-col max-h-[90vh]"
        data-ocid="token_detail.dialog"
      >
        {loading || !token ? (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full shrink-0" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-3.5 w-40" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {["a", "b", "c", "d"].map((k) => (
                <Skeleton key={k} className="h-16 rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-48 rounded-lg" />
          </div>
        ) : (
          <>
            {/* Header */}
            <DialogHeader className="px-5 pt-5 pb-4 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 shrink-0 rounded-full overflow-hidden ring-2 ring-primary/30 ring-offset-2 ring-offset-background">
                  <TokenImage token={token} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <DialogTitle className="text-lg font-bold text-foreground">
                      {token.ticker}
                    </DialogTitle>
                    {token.bonded && (
                      <svg
                        viewBox="0 0 22 22"
                        className="h-5 w-5 shrink-0 fill-[#1d9bf0]"
                        role="img"
                        aria-label="Bonded"
                      >
                        <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
                      </svg>
                    )}
                    {!token.bonded && (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-400/10 text-amber-400 border border-amber-400/30">
                        Bonding
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {token.name}
                  </p>
                </div>
                <a
                  href={`https://odin.fun/token/${token.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors shrink-0"
                  data-ocid="token_detail.link"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">odin.fun</span>
                </a>
              </div>
            </DialogHeader>

            {/* Tabs */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="flex flex-col flex-1 overflow-hidden"
              >
                <TabsList
                  className="mx-5 mt-4 mb-0 h-9 bg-muted/40 rounded-lg shrink-0"
                  data-ocid="token_detail.tab"
                >
                  <TabsTrigger
                    value="chart"
                    className="flex-1 text-xs font-semibold"
                  >
                    Chart
                  </TabsTrigger>
                  <TabsTrigger
                    value="overview"
                    className="flex-1 text-xs font-semibold"
                  >
                    Overview
                  </TabsTrigger>
                  <TabsTrigger
                    value="feed"
                    className="flex-1 text-xs font-semibold"
                  >
                    Feed
                  </TabsTrigger>
                </TabsList>

                {/* Chart tab */}
                <TabsContent
                  value="chart"
                  className="flex-1 overflow-y-auto px-5 py-4 space-y-4 mt-0"
                >
                  <div className="rounded-lg border border-border bg-background/40 p-3">
                    <TokenPriceChart
                      tokenId={token.id}
                      currentPrice={token.price}
                    />
                  </div>
                  {/* Price summary below chart */}
                  <div className="flex items-center justify-between rounded-lg bg-muted/30 border border-border px-4 py-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">
                        Current Price
                      </p>
                      <p className="font-mono text-lg font-bold text-primary">
                        {formatPriceAsSats(token.price)}
                      </p>
                    </div>
                    {priceChange !== null && (
                      <div
                        className={`flex items-center gap-1 text-sm font-bold rounded-full px-3 py-1 ${
                          priceChange > 0
                            ? "bg-emerald-500/10 text-emerald-400"
                            : priceChange < 0
                              ? "bg-red-500/10 text-red-400"
                              : "bg-muted/40 text-muted-foreground"
                        }`}
                      >
                        <TrendingUp className="h-3.5 w-3.5" />
                        {priceChange > 0 ? "+" : ""}
                        {priceChange.toFixed(2)}% 24h
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Overview tab */}
                <TabsContent
                  value="overview"
                  className="flex-1 overflow-y-auto px-5 py-4 space-y-4 mt-0"
                >
                  {/* Stats grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-lg bg-muted/30 border border-border px-3 py-2.5">
                      <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" /> Price
                      </p>
                      <p className="font-mono text-sm font-bold text-primary">
                        {formatPriceAsSats(displayToken?.price ?? token.price)}
                      </p>
                      {priceChange !== null && (
                        <p
                          className={`text-[10px] font-semibold mt-0.5 ${
                            priceChange > 0
                              ? "text-emerald-400"
                              : priceChange < 0
                                ? "text-red-400"
                                : "text-muted-foreground"
                          }`}
                        >
                          {priceChange > 0 ? "+" : ""}
                          {priceChange.toFixed(2)}% 24h
                        </p>
                      )}
                    </div>

                    <div className="rounded-lg bg-muted/30 border border-border px-3 py-2.5">
                      <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                        <BarChart2 className="h-3 w-3" /> Market Cap
                      </p>
                      <p className="font-mono text-sm font-semibold text-foreground">
                        {(displayToken?.marketcap ?? token.marketcap)
                          ? formatMcapAsUsd(
                              displayToken?.marketcap ?? token.marketcap,
                              btcUsd,
                            )
                          : "—"}
                      </p>
                    </div>

                    <div className="rounded-lg bg-muted/30 border border-border px-3 py-2.5">
                      <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                        <BarChart2 className="h-3 w-3" /> Total Volume
                      </p>
                      <p className="font-mono text-sm font-semibold text-foreground">
                        {(displayToken?.volume ?? token.volume)
                          ? formatVolumeAsUsd(
                              displayToken?.volume ?? token.volume,
                              btcUsd,
                            )
                          : "—"}
                      </p>
                    </div>

                    <div className="rounded-lg bg-muted/30 border border-border px-3 py-2.5">
                      <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                        <Users className="h-3 w-3" /> Holders
                      </p>
                      <p className="text-sm font-semibold text-foreground">
                        {(
                          displayToken?.holder_count ?? token.holder_count
                        )?.toLocaleString() ?? "—"}
                      </p>
                    </div>
                  </div>

                  {/* Supply info */}
                  <div className="rounded-lg bg-muted/30 border border-border px-3 py-2.5 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Total Supply
                    </span>
                    <span className="font-mono text-sm font-semibold text-foreground">
                      {displaySupply}
                    </span>
                  </div>

                  {/* Bonding progress */}
                  {!(displayToken?.bonded ?? token.bonded) &&
                    (displayToken?.progress ?? token.progress) !==
                      undefined && (
                      <div className="rounded-lg bg-muted/30 border border-border px-3 py-2.5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            Bonding Curve Progress
                          </span>
                          <span className="text-xs font-bold text-amber-400">
                            {(displayToken?.progress ??
                              token.progress)!.toFixed(1)}
                            %
                          </span>
                        </div>
                        <Progress
                          value={displayToken?.progress ?? token.progress}
                          className="h-1.5 bg-muted/60"
                        />
                      </div>
                    )}

                  {/* Social Links */}
                  {(displayToken?.twitter ||
                    displayToken?.website ||
                    displayToken?.telegram) && (
                    <div className="rounded-lg bg-muted/30 border border-border px-3 py-3 space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Links
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {displayToken.twitter && (
                          <a
                            href={normalizeTwitter(displayToken.twitter)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs font-medium text-sky-400 hover:text-sky-300 bg-sky-500/10 border border-sky-500/20 rounded-full px-3 py-1.5 transition-colors"
                          >
                            <Twitter className="h-3.5 w-3.5" />
                            Twitter
                          </a>
                        )}
                        {displayToken.website && (
                          <a
                            href={normalizeUrl(displayToken.website)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs font-medium text-violet-400 hover:text-violet-300 bg-violet-500/10 border border-violet-500/20 rounded-full px-3 py-1.5 transition-colors"
                          >
                            <Globe className="h-3.5 w-3.5" />
                            Website
                          </a>
                        )}
                        {displayToken.telegram && (
                          <a
                            href={normalizeTelegram(displayToken.telegram)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1.5 transition-colors"
                          >
                            <Send className="h-3.5 w-3.5" />
                            Telegram
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* Feed tab */}
                <TabsContent
                  value="feed"
                  className="flex-1 overflow-hidden px-5 py-4 mt-0 flex flex-col"
                >
                  {/* Feed header with refresh indicator */}
                  <div className="flex items-center justify-between mb-3 shrink-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Recent Trades
                    </p>
                    <div className="flex items-center gap-2">
                      {lastRefreshed && (
                        <span className="text-[10px] text-muted-foreground/60">
                          Updated{" "}
                          {lastRefreshed.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => token && fetchTrades(token.id, true)}
                        className="flex items-center gap-1 text-[10px] text-primary/70 hover:text-primary transition-colors"
                        data-ocid="token_detail.secondary_button"
                      >
                        <RefreshCw className="h-3 w-3" />
                        <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-1.5 py-0.5">
                          LIVE
                        </span>
                      </button>
                    </div>
                  </div>

                  {tradesLoading ? (
                    <div
                      className="space-y-2"
                      data-ocid="token_detail.loading_state"
                    >
                      {[1, 2, 3, 4, 5].map((k) => (
                        <Skeleton key={k} className="h-16 w-full rounded-lg" />
                      ))}
                    </div>
                  ) : tradesError ? (
                    <div
                      className="text-center py-8 text-sm text-destructive"
                      data-ocid="token_detail.error_state"
                    >
                      Failed to load trades
                    </div>
                  ) : trades.length === 0 ? (
                    <div
                      className="text-center py-8 text-sm text-muted-foreground"
                      data-ocid="token_detail.empty_state"
                    >
                      No trades found
                    </div>
                  ) : (
                    <div
                      className="space-y-1.5 overflow-y-auto flex-1"
                      data-ocid="token_detail.list"
                    >
                      {trades.map((trade, i) => {
                        const isBuy = trade.is_buy ?? trade.buy ?? false;
                        // NaN-safe extraction with double fallback
                        const tokenAmt =
                          Number(
                            trade.amount_token ?? trade.token_amount ?? 0,
                          ) || 0;
                        const btcAmt =
                          Number(trade.amount_btc ?? trade.btc_amount ?? 0) ||
                          0;
                        const timestamp =
                          trade.created_at ??
                          trade.time ??
                          trade.timestamp ??
                          trade.ts ??
                          0;
                        const username =
                          trade.user_username ??
                          trade.username ??
                          trade.user_name ??
                          trade.user ??
                          "";

                        // Send/receive direction detection
                        const hasReceiver = !!trade.receiver;
                        const hasSender = !!trade.sender;
                        const directionLabel = hasReceiver
                          ? `→ ${abbreviatePrincipal(trade.receiver!)}`
                          : hasSender
                            ? `← ${abbreviatePrincipal(trade.sender!)}`
                            : null;

                        return (
                          <div
                            key={trade.id ?? i}
                            className="rounded-lg bg-muted/30 border border-border px-3 py-2 text-xs"
                            data-ocid={`token_detail.item.${i + 1}`}
                          >
                            {/* Row 1: badge + token amount + time */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge
                                  className={`text-[10px] px-1.5 py-0 font-bold shrink-0 ${
                                    isBuy
                                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                      : "bg-red-500/15 text-red-400 border-red-500/30"
                                  }`}
                                  variant="outline"
                                >
                                  {isBuy ? "BUY" : "SELL"}
                                </Badge>
                                <span className="font-mono font-semibold text-foreground">
                                  {formatTokenAmt(tokenAmt)}
                                </span>
                                <span className="text-muted-foreground">
                                  {token.ticker}
                                </span>
                              </div>
                              <span className="text-muted-foreground/60 text-[10px] whitespace-nowrap">
                                {formatRelativeTime(timestamp)}
                              </span>
                            </div>

                            {/* Row 2: username + direction + BTC+USD value */}
                            <div className="flex items-center justify-between mt-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-muted-foreground/70 truncate max-w-[100px]">
                                  {username
                                    ? username.length > 14
                                      ? `${username.slice(0, 8)}…${username.slice(-4)}`
                                      : username
                                    : "—"}
                                </span>
                                {directionLabel && (
                                  <span className="text-[10px] text-sky-400/80 font-mono whitespace-nowrap">
                                    {directionLabel}
                                  </span>
                                )}
                              </div>
                              <span
                                className={`font-mono font-semibold shrink-0 ${
                                  isBuy ? "text-emerald-400" : "text-red-400"
                                }`}
                              >
                                {formatBtcWithUsd(btcAmt, btcUsd)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            {/* Fixed footer */}
            <div className="px-5 py-4 border-t border-border shrink-0">
              <Button
                type="button"
                data-ocid="token_detail.primary_button"
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold h-11"
                onClick={() => {
                  onTrade(token);
                  onOpenChange(false);
                }}
              >
                Trade {token.ticker}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
