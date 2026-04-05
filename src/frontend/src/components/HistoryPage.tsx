import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
  Wallet,
  Wifi,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { TradeStatus } from "../backend";
import { useBtcPrice } from "../hooks/useBtcPrice";
import { useGetTradeLogs } from "../hooks/useQueries";
import {
  type OdinToken,
  type OdinTrade,
  formatBtcWithUsd,
  formatDate,
  formatPriceAsSats,
  formatTokenAmount,
  getGlobalTrades,
  getToken,
  getUserTrades,
  parseOdinDate,
} from "../lib/odinApi";
import { TokenDetailModal } from "./TokenDetailModal";

interface HistoryPageProps {
  principal: string;
  onSetPrincipal: (p: string) => void;
  onSelectToken?: (token: OdinToken) => void;
  onViewTraderProfile?: (principal: string) => void;
}

function truncatePrincipal(p?: string): string {
  if (!p) return "\u2014";
  if (p.length <= 14) return p;
  return `${p.slice(0, 6)}...${p.slice(-4)}`;
}

function formatRelativeTime(raw: string | number | bigint): string {
  const d = parseOdinDate(raw);
  if (Number.isNaN(d.getTime())) return "\u2014";
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function TokenCell({
  tokenId,
  tokenTicker,
  onOpenDetail,
}: {
  tokenId?: string;
  tokenTicker: string;
  onOpenDetail: (tokenId: string) => void;
}) {
  if (!tokenId) {
    return (
      <span className="text-sm font-semibold text-foreground">
        {tokenTicker}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onOpenDetail(tokenId)}
      className="text-sm font-semibold text-primary hover:underline cursor-pointer transition-colors"
    >
      {tokenTicker}
    </button>
  );
}

const BondedCheck = () => (
  <svg
    viewBox="0 0 22 22"
    className="h-3.5 w-3.5 shrink-0 fill-[#1d9bf0]"
    role="img"
    aria-label="Bonded"
  >
    <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
  </svg>
);

export function HistoryPage({
  principal,
  onSetPrincipal: _onSetPrincipal,
  onSelectToken,
  onViewTraderProfile,
}: HistoryPageProps) {
  const [odinTrades, setOdinTrades] = useState<OdinTrade[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingOdin, setLoadingOdin] = useState(false);
  const [errorOdin, setErrorOdin] = useState("");
  const [filterQuery, setFilterQuery] = useState("");
  const [globalTrades, setGlobalTrades] = useState<OdinTrade[]>([]);
  const [globalCount, setGlobalCount] = useState(0);
  const [globalPage, setGlobalPage] = useState(1);
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  const [errorGlobal, setErrorGlobal] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [liveActive, setLiveActive] = useState(true);
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [detailToken, setDetailToken] = useState<OdinToken | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const { data: backendLogs, isLoading: loadingBackend } = useGetTradeLogs();
  const { btcUsd } = useBtcPrice();
  const PAGE_SIZE = 20;

  const fetchOdinTrades = useCallback(async (p: string, pg: number) => {
    if (!p) return;
    setLoadingOdin(true);
    setErrorOdin("");
    try {
      const { data, count } = await getUserTrades(p, pg, PAGE_SIZE);
      setOdinTrades(data);
      setTotalCount(count);
    } catch {
      setErrorOdin("Failed to load trades. Check principal ID.");
      setOdinTrades([]);
    } finally {
      setLoadingOdin(false);
    }
  }, []);

  const fetchGlobalTrades = useCallback(async (pg: number, silent = false) => {
    if (!silent) setLoadingGlobal(true);
    setErrorGlobal("");
    try {
      const { data, count } = await getGlobalTrades(pg, PAGE_SIZE);
      setGlobalTrades(data);
      setGlobalCount(count);
      setLastUpdated(new Date());
    } catch {
      if (!silent) setErrorGlobal("Failed to load global feed.");
      if (!silent) setGlobalTrades([]);
    } finally {
      if (!silent) setLoadingGlobal(false);
    }
  }, []);

  useEffect(() => {
    fetchOdinTrades(principal, page);
  }, [principal, page, fetchOdinTrades]);

  useEffect(() => {
    fetchGlobalTrades(globalPage);
  }, [globalPage, fetchGlobalTrades]);

  useEffect(() => {
    if (!liveActive) {
      if (liveIntervalRef.current) {
        clearInterval(liveIntervalRef.current);
        liveIntervalRef.current = null;
      }
      return;
    }
    if (globalPage !== 1) return;
    liveIntervalRef.current = setInterval(() => {
      fetchGlobalTrades(1, true);
    }, 15_000);
    return () => {
      if (liveIntervalRef.current) {
        clearInterval(liveIntervalRef.current);
        liveIntervalRef.current = null;
      }
    };
  }, [liveActive, globalPage, fetchGlobalTrades]);

  const handleOpenTokenDetail = async (tokenId: string) => {
    setLoadingDetail(true);
    setDetailOpen(true);
    try {
      const token = await getToken(tokenId);
      setDetailToken(token);
    } catch {
      setDetailToken(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const filteredOdin = odinTrades.filter(
    (t) =>
      !filterQuery ||
      (t.token_ticker ?? t.token)
        ?.toLowerCase()
        .includes(filterQuery.toLowerCase()),
  );

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const globalTotalPages = Math.max(1, Math.ceil(globalCount / PAGE_SIZE));

  const statusBadge = (status: TradeStatus) => {
    const map: Record<TradeStatus, string> = {
      [TradeStatus.pending]: "text-primary",
      [TradeStatus.completed]: "text-success",
      [TradeStatus.failed]: "text-destructive",
    };
    return (
      <span className={`text-[11px] font-semibold ${map[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="space-y-4 md:space-y-5">
      <Tabs defaultValue="odin" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList
            data-ocid="history.tabs"
            className="bg-muted/40 border border-border w-full sm:w-auto"
          >
            <TabsTrigger
              data-ocid="history.odin.tab"
              value="odin"
              className="flex-1 sm:flex-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs"
            >
              User Trades
            </TabsTrigger>
            <TabsTrigger
              data-ocid="history.backend.tab"
              value="backend"
              className="flex-1 sm:flex-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs"
            >
              Bot Logs
            </TabsTrigger>
            <TabsTrigger
              data-ocid="history.global.tab"
              value="global"
              className="flex-1 sm:flex-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs"
            >
              Global Feed
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                data-ocid="history.filter.search_input"
                placeholder="Filter by token"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="pl-8 h-8 text-sm sm:w-44 bg-muted/40 border-border"
              />
            </div>
            <Button
              type="button"
              data-ocid="history.refresh.button"
              variant="outline"
              size="sm"
              className="h-8 border-border bg-muted/40 shrink-0"
              onClick={() => fetchOdinTrades(principal, page)}
              disabled={!principal || loadingOdin}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loadingOdin ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>

        {/* User Trades - Mobile-friendly card layout */}
        <TabsContent
          value="odin"
          className="rounded-xl border border-border bg-card shadow-card overflow-hidden"
        >
          {loadingOdin ? (
            <div
              data-ocid="history.odin.loading_state"
              className="flex items-center justify-center h-40"
            >
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : errorOdin ? (
            <div
              data-ocid="history.odin.error_state"
              className="flex items-center justify-center h-32 text-sm text-destructive"
            >
              {errorOdin}
            </div>
          ) : !principal ? (
            <div
              data-ocid="history.odin.empty_state"
              className="flex flex-col items-center justify-center h-32 gap-2 opacity-60"
            >
              <Wallet className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground font-medium">
                Wallet connect coming soon
              </p>
              <p className="text-xs text-muted-foreground/70">
                Your trades will appear here once connected
              </p>
            </div>
          ) : filteredOdin.length === 0 ? (
            <div
              data-ocid="history.odin.empty_state"
              className="flex items-center justify-center h-32"
            >
              <p className="text-sm text-muted-foreground">No trades found.</p>
            </div>
          ) : (
            <>
              {/* Mobile-friendly card list */}
              <div
                className="divide-y divide-border"
                data-ocid="history.odin.list"
              >
                {filteredOdin.map((t, i) => {
                  const ticker =
                    t.token_ticker ??
                    (t.token_id ? t.token_id.slice(0, 8) : t.token);
                  return (
                    <div
                      key={t.id}
                      data-ocid={`history.odin.item.${i + 1}`}
                      className="px-4 py-3 hover:bg-muted/20 transition-colors active:bg-muted/30"
                    >
                      {/* Row 1: Token logo + ticker + bonded + BUY/SELL */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {t.token_id && (
                            <img
                              src={`https://api.odin.fun/v1/token/${t.token_id}/image`}
                              alt={ticker}
                              width={28}
                              height={28}
                              className="rounded-full shrink-0 object-cover bg-muted w-7 h-7"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                          )}
                          <div className="flex items-center gap-1 min-w-0">
                            <TokenCell
                              tokenId={t.token_id}
                              tokenTicker={ticker}
                              onOpenDetail={handleOpenTokenDetail}
                            />
                            {t.bonded && <BondedCheck />}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {t.buy ? (
                            <ArrowDownLeft className="h-3.5 w-3.5 text-success" />
                          ) : (
                            <ArrowUpRight className="h-3.5 w-3.5 text-destructive" />
                          )}
                          <span
                            className={`text-[11px] font-bold ${
                              t.buy ? "text-success" : "text-destructive"
                            }`}
                          >
                            {t.buy ? "BUY" : "SELL"}
                          </span>
                        </div>
                      </div>

                      {/* Row 2: Date/time + relative time */}
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(t.time)}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60 shrink-0 ml-2">
                          {formatRelativeTime(t.time)}
                        </span>
                      </div>

                      {/* Row 3: BTC + USD value */}
                      <div className="mt-1">
                        <span className="font-mono text-xs text-foreground">
                          {formatBtcWithUsd(t.amount_btc, btcUsd)}
                        </span>
                      </div>

                      {/* Row 4: Token amount + price in sats */}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          Amt: {formatTokenAmount(t.amount_token)}
                        </span>
                        <span className="text-[10px] text-muted-foreground/50">
                          .
                        </span>
                        <span className="text-[10px] text-primary font-mono">
                          {formatPriceAsSats(t.price)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 md:px-5 py-4 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    Page {page} of {totalPages} &middot; {totalCount} total
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      data-ocid="history.pagination_prev"
                      variant="outline"
                      size="sm"
                      className="h-7 border-border bg-muted/40"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      data-ocid="history.pagination_next"
                      variant="outline"
                      size="sm"
                      className="h-7 border-border bg-muted/40"
                      disabled={page >= totalPages}
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Backend Bot Logs */}
        <TabsContent
          value="backend"
          className="rounded-xl border border-border bg-card shadow-card overflow-hidden"
        >
          {loadingBackend ? (
            <div
              data-ocid="history.backend.loading_state"
              className="flex items-center justify-center h-40"
            >
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !backendLogs || backendLogs.length === 0 ? (
            <div
              data-ocid="history.backend.empty_state"
              className="flex flex-col items-center justify-center h-32"
            >
              <p className="text-sm text-muted-foreground">
                No bot trade logs yet.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Place a simulated order in Trading to see logs here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table
                data-ocid="history.backend.table"
                className="min-w-[600px]"
              >
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase">
                      Date/Time
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase">
                      Token
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase">
                      Type
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase text-right">
                      BTC (USD)
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase text-right">
                      Token Amt
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase text-right">
                      Price
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase">
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backendLogs.map((log, i) => (
                    <TableRow
                      key={`log-${log.tokenId}-${log.timestamp.toString()}`}
                      data-ocid={`history.backend.row.${i + 1}`}
                      className="border-border hover:bg-muted/30"
                    >
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {formatDate(log.timestamp)}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-semibold text-foreground">
                          {log.tokenId}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {log.tradeType === "buy" ? (
                            <ArrowDownLeft className="h-3.5 w-3.5 text-success" />
                          ) : (
                            <ArrowUpRight className="h-3.5 w-3.5 text-destructive" />
                          )}
                          <span
                            className={`text-[11px] font-semibold ${log.tradeType === "buy" ? "text-success" : "text-destructive"}`}
                          >
                            {log.tradeType.toUpperCase()}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-foreground">
                        {formatBtcWithUsd(log.amountBtc, btcUsd)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-foreground">
                        {formatTokenAmount(log.amountToken)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-primary">
                        {formatPriceAsSats(log.price)}
                      </TableCell>
                      <TableCell>{statusBadge(log.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Global Feed - Mobile-friendly card layout */}
        <TabsContent
          value="global"
          className="rounded-xl border border-border bg-card shadow-card overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 md:px-5 py-3 border-b border-border">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-muted-foreground truncate">
                Live global trade activity
              </span>
              {lastUpdated && (
                <span className="text-[10px] text-muted-foreground/60 shrink-0">
                  &middot;{" "}
                  {lastUpdated.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setLiveActive((v) => !v)}
                className={`flex items-center gap-1 text-[10px] font-semibold transition-colors ${
                  liveActive ? "text-success" : "text-muted-foreground"
                }`}
                title={liveActive ? "Live: ON" : "Live: OFF"}
              >
                <Wifi
                  className={`h-3 w-3 ${liveActive ? "animate-pulse" : ""}`}
                />
                {liveActive ? "LIVE" : "PAUSED"}
              </button>
              <Button
                type="button"
                data-ocid="history.global.refresh.button"
                variant="outline"
                size="sm"
                className="h-7 border-border bg-muted/40"
                onClick={() => {
                  setGlobalPage(1);
                  fetchGlobalTrades(1);
                }}
                disabled={loadingGlobal}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loadingGlobal ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          </div>

          {loadingGlobal ? (
            <div
              data-ocid="history.global.loading_state"
              className="flex items-center justify-center h-40"
            >
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : errorGlobal ? (
            <div
              data-ocid="history.global.error_state"
              className="flex items-center justify-center h-32 text-sm text-destructive"
            >
              {errorGlobal}
            </div>
          ) : globalTrades.length === 0 ? (
            <div
              data-ocid="history.global.empty_state"
              className="flex items-center justify-center h-32"
            >
              <p className="text-sm text-muted-foreground">No trades found.</p>
            </div>
          ) : (
            <>
              {/* Mobile-friendly card list */}
              <div
                className="divide-y divide-border"
                data-ocid="history.global.list"
              >
                {globalTrades.map((t, i) => {
                  const ticker =
                    t.token_ticker ??
                    (t.token_id ? t.token_id.slice(0, 8) : t.token);
                  const trader = t.user_username
                    ? t.user_username
                    : truncatePrincipal(t.user);
                  const counterparty = t.buy ? t.receiver : t.sender;
                  return (
                    <div
                      key={t.id}
                      data-ocid={`history.global.item.${i + 1}`}
                      className="px-4 py-3 hover:bg-muted/20 transition-colors active:bg-muted/30"
                    >
                      {/* Row 1: Token logo + ticker + BUY/SELL */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {t.token_id && (
                            <img
                              src={`https://api.odin.fun/v1/token/${t.token_id}/image`}
                              alt={ticker}
                              width={28}
                              height={28}
                              className="rounded-full shrink-0 object-cover bg-muted w-7 h-7"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                          )}
                          <div className="flex items-center gap-1 min-w-0">
                            <TokenCell
                              tokenId={t.token_id}
                              tokenTicker={ticker}
                              onOpenDetail={handleOpenTokenDetail}
                            />
                            {t.bonded && <BondedCheck />}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {t.buy ? (
                            <ArrowDownLeft className="h-3.5 w-3.5 text-success" />
                          ) : (
                            <ArrowUpRight className="h-3.5 w-3.5 text-destructive" />
                          )}
                          <span
                            className={`text-[11px] font-bold ${t.buy ? "text-success" : "text-destructive"}`}
                          >
                            {t.buy ? "BUY" : "SELL"}
                          </span>
                        </div>
                      </div>

                      {/* Row 2: Trader + relative time */}
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {t.user || t.user_username ? (
                            <button
                              type="button"
                              onClick={() =>
                                onViewTraderProfile?.(
                                  t.user || t.user_username || "",
                                )
                              }
                              className="text-xs text-muted-foreground hover:text-primary hover:underline transition-colors cursor-pointer truncate"
                            >
                              {trader}
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground truncate">
                              {trader}
                            </span>
                          )}
                          {counterparty && (
                            <span className="text-[10px] text-muted-foreground/60 font-mono shrink-0">
                              {t.buy ? "from" : "to"}{" "}
                              {truncatePrincipal(counterparty)}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground/60 shrink-0 ml-2">
                          {formatRelativeTime(t.time)}
                        </span>
                      </div>

                      {/* Row 3: Value in BTC + USD */}
                      <div className="mt-1">
                        <span className="font-mono text-xs text-foreground">
                          {formatBtcWithUsd(t.amount_btc, btcUsd)}
                        </span>
                      </div>

                      {/* Row 4: Token amount + price */}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          Amt: {formatTokenAmount(t.amount_token)}
                        </span>
                        <span className="text-[10px] text-muted-foreground/50">
                          .
                        </span>
                        <span className="text-[10px] text-primary font-mono">
                          {formatPriceAsSats(t.price)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 md:px-5 py-4 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  Page {globalPage} of {globalTotalPages} &middot; {globalCount}{" "}
                  total
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    data-ocid="history.global.pagination_prev"
                    variant="outline"
                    size="sm"
                    className="h-7 border-border bg-muted/40"
                    disabled={globalPage <= 1}
                    onClick={() => setGlobalPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    data-ocid="history.global.pagination_next"
                    variant="outline"
                    size="sm"
                    className="h-7 border-border bg-muted/40"
                    disabled={globalPage >= globalTotalPages}
                    onClick={() =>
                      setGlobalPage((p) => Math.min(globalTotalPages, p + 1))
                    }
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

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
        loading={loadingDetail}
      />
    </div>
  );
}
