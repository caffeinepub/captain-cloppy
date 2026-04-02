import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Compass, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useBtcPrice } from "../hooks/useBtcPrice";
import {
  type OdinToken,
  type OdinTokensParams,
  formatMcapAsUsd,
  formatPriceAsSats,
  formatPriceDelta,
  getTokenImageUrl,
  getTokens,
} from "../lib/odinApi";
import { TokenDetailModal } from "./TokenDetailModal";

interface TokenExplorerPageProps {
  onSelectToken: (token: OdinToken) => void;
}

const SORT_OPTIONS: { label: string; value: string }[] = [
  { label: "Trending", value: "volume:desc" },
  { label: "New", value: "created_time:desc" },
  { label: "Top MCap", value: "marketcap:desc" },
  { label: "Price ↑", value: "price:asc" },
  { label: "Price ↓", value: "price:desc" },
];

type BondFilter = "all" | "bonded" | "unbonded";

const PAGE_SIZE = 20;

const SKELETON_IDS = [
  "sk1",
  "sk2",
  "sk3",
  "sk4",
  "sk5",
  "sk6",
  "sk7",
  "sk8",
] as const;

function TokenInitials({ ticker }: { ticker: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-primary/40 to-primary/10 text-xs font-bold text-primary drop-shadow-[0_0_4px_hsl(var(--primary)/0.3)]">
      {ticker.slice(0, 2).toUpperCase()}
    </div>
  );
}

function TokenImage({ token }: { token: OdinToken }) {
  const [imgError, setImgError] = useState(false);
  const imgUrl = getTokenImageUrl(token.id);

  if (!imgUrl || imgError) {
    return <TokenInitials ticker={token.ticker} />;
  }

  return (
    <img
      src={imgUrl}
      alt={token.ticker}
      className="h-full w-full rounded-full object-cover group-hover:scale-105 transition-transform duration-300"
      onError={() => setImgError(true)}
    />
  );
}

function TokenCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-3 md:p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full shrink-0" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
}

export function TokenExplorerPage({ onSelectToken }: TokenExplorerPageProps) {
  const [tokens, setTokens] = useState<OdinToken[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState("volume:desc");
  const [bondFilter, setBondFilter] = useState<BondFilter>("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal state
  const [detailToken, setDetailToken] = useState<OdinToken | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { btcUsd } = useBtcPrice();

  const fetchTokens = useCallback(async (params: OdinTokensParams) => {
    setLoading(true);
    try {
      const result = await getTokens(params);
      setTokens(result.data);
      setTotalCount(result.count);
    } catch {
      setTokens([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params: OdinTokensParams = {
      page,
      limit: PAGE_SIZE,
      sort,
      ...(bondFilter === "bonded" && { bonded: true }),
      ...(bondFilter === "unbonded" && { bonded: false }),
      ...(search && { search }),
    };
    fetchTokens(params);
  }, [page, sort, bondFilter, search, fetchTokens]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  const handleRefresh = () => {
    const params: OdinTokensParams = {
      page,
      limit: PAGE_SIZE,
      sort,
      ...(bondFilter === "bonded" && { bonded: true }),
      ...(bondFilter === "unbonded" && { bonded: false }),
      ...(search && { search }),
    };
    fetchTokens(params);
  };

  const handleTokenClick = (token: OdinToken) => {
    setDetailToken(token);
    setDetailOpen(true);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="space-y-4 md:space-y-5">
      {/* Header controls */}
      <div className="flex flex-col gap-3">
        {/* Top row: sort + refresh */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Sort selector — scrollable on mobile */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1 overflow-x-auto flex-1 min-w-0">
            {SORT_OPTIONS.map((opt) => (
              <button
                type="button"
                key={opt.value}
                data-ocid={`explorer.sort.${opt.value.replace(":", "_")}.toggle`}
                onClick={() => {
                  setSort(opt.value);
                  setPage(1);
                }}
                className={[
                  "rounded-md px-2.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap shrink-0",
                  sort === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <Button
            type="button"
            data-ocid="explorer.refresh.button"
            variant="outline"
            size="sm"
            className="h-9 border-border bg-muted/40 shrink-0"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>

        {/* Bottom row: bond filter + search */}
        <div className="flex items-center gap-2">
          {/* Bond filter */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1 shrink-0">
            {(["all", "bonded", "unbonded"] as BondFilter[]).map((f) => (
              <button
                type="button"
                key={f}
                data-ocid={`explorer.bond_filter.${f}.toggle`}
                onClick={() => {
                  setBondFilter(f);
                  setPage(1);
                }}
                className={[
                  "rounded-md px-2.5 py-1.5 text-xs font-semibold capitalize transition-all",
                  bondFilter === f
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex-1">
            <Input
              data-ocid="explorer.search_input"
              placeholder="Search tokens…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-9 bg-muted/40 border-border text-sm w-full"
            />
          </div>
        </div>
      </div>

      {/* Token grid */}
      {loading ? (
        <div
          data-ocid="explorer.loading_state"
          className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-3 xl:grid-cols-4"
        >
          {SKELETON_IDS.map((id) => (
            <TokenCardSkeleton key={id} />
          ))}
        </div>
      ) : tokens.length === 0 ? (
        <div
          data-ocid="explorer.empty_state"
          className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 gap-3"
        >
          <Compass className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No tokens found.</p>
          {search && (
            <p className="text-xs text-muted-foreground">
              Try a different search term.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {tokens.map((token, i) => (
            <button
              type="button"
              key={token.id}
              data-ocid={`explorer.token.item.${i + 1}`}
              onClick={() => handleTokenClick(token)}
              className="group rounded-xl border border-border bg-card p-3 md:p-4 text-left transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 active:scale-[0.98]"
            >
              {/* Token header */}
              <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
                <div className="h-9 w-9 md:h-10 md:w-10 shrink-0 rounded-full overflow-hidden ring-2 ring-primary/30 ring-offset-1 ring-offset-background shadow-md shadow-primary/10">
                  <TokenImage token={token} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="truncate text-sm font-bold text-foreground">
                      {token.ticker}
                    </p>
                    {token.bonded && (
                      <svg
                        viewBox="0 0 22 22"
                        className="h-4 w-4 shrink-0 fill-[#1d9bf0]"
                        role="img"
                        aria-label="Bonded"
                      >
                        <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
                      </svg>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {token.name}
                  </p>
                </div>
              </div>

              {/* Price in sats */}
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-xs text-muted-foreground">Price</span>
                <span className="font-mono text-xs font-semibold text-primary truncate ml-1">
                  {formatPriceAsSats(token.price)}
                </span>
              </div>

              {/* 24h change */}
              {token.price_1d !== undefined && (
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-xs text-muted-foreground">24h</span>
                  <span
                    className={[
                      "font-mono text-xs font-semibold",
                      token.price_1d > 0
                        ? "text-success"
                        : token.price_1d < 0
                          ? "text-destructive"
                          : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {formatPriceDelta(token.price_1d)}
                  </span>
                </div>
              )}

              {/* MCap in sats */}
              {token.marketcap !== undefined && (
                <div className="hidden sm:flex items-baseline justify-between mb-1.5">
                  <span className="text-xs text-muted-foreground">MCap</span>
                  <span className="font-mono text-xs text-foreground">
                    {formatMcapAsUsd(token.marketcap, btcUsd)}
                  </span>
                </div>
              )}

              {/* Holders */}
              {token.holder_count !== undefined && (
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-xs text-muted-foreground">Holders</span>
                  <span className="text-xs text-foreground">
                    {token.holder_count.toLocaleString()}
                  </span>
                </div>
              )}

              {/* Bonding progress */}
              {!token.bonded && token.progress !== undefined && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      Bonding
                    </span>
                    <span className="text-[10px] font-semibold text-amber-400">
                      {token.progress.toFixed(1)}%
                    </span>
                  </div>
                  <Progress
                    value={token.progress}
                    className="h-1 bg-muted/60"
                  />
                </div>
              )}

              {/* Chart hint */}
              <div className="mt-2 pt-2 border-t border-border/50">
                <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                  <svg
                    className="h-3 w-3"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <title>Chart</title>
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                  Click for chart
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && tokens.length > 0 && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground">
            <span className="hidden sm:inline">
              {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, totalCount)} of {totalCount} tokens
            </span>
            <span className="sm:hidden">
              {page}/{totalPages}
            </span>
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              data-ocid="explorer.pagination_prev"
              variant="outline"
              size="sm"
              className="h-8 border-border bg-muted/40"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              type="button"
              data-ocid="explorer.pagination_next"
              variant="outline"
              size="sm"
              className="h-8 border-border bg-muted/40"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Token Detail Modal with Price Chart */}
      <TokenDetailModal
        token={detailToken}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onTrade={(token) => {
          onSelectToken(token);
        }}
      />
    </div>
  );
}
