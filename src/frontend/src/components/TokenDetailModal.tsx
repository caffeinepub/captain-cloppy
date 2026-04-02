import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart2, ExternalLink, TrendingUp, Users, X } from "lucide-react";
import { useState } from "react";
import { useBtcPrice } from "../hooks/useBtcPrice";
import {
  type OdinToken,
  formatMcapAsUsd,
  formatPriceAsSats,
  formatVolumeAsUsd,
  getTokenImageUrl,
} from "../lib/odinApi";
import { TokenPriceChart } from "./TokenPriceChart";

interface TokenDetailModalProps {
  token: OdinToken | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTrade: (token: OdinToken) => void;
  /** Show loading skeleton while token data is being fetched */
  loading?: boolean;
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

export function TokenDetailModal({
  token,
  open,
  onOpenChange,
  onTrade,
  loading = false,
}: TokenDetailModalProps) {
  const priceChange = token?.price_1d
    ? ((token.price - token.price_1d) / Math.max(1, Math.abs(token.price_1d))) *
      100
    : null;

  const { btcUsd } = useBtcPrice();

  // All Odin tokens have 21,000,000 total supply
  const displaySupply = "21,000,000";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-full bg-card border-border p-0 overflow-hidden gap-0">
        {loading || !token ? (
          // Loading skeleton
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
            {loading && (
              <p className="text-xs text-center text-muted-foreground">
                Loading token data\u2026
              </p>
            )}
            {!loading && !token && (
              <p className="text-xs text-center text-destructive">
                Token not found.
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Header */}
            <DialogHeader className="px-5 pt-5 pb-4 border-b border-border">
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
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">odin.fun</span>
                </a>
              </div>
            </DialogHeader>

            <div className="px-5 py-4 space-y-4">
              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg bg-muted/30 border border-border px-3 py-2.5">
                  <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> Price
                  </p>
                  <p className="font-mono text-sm font-bold text-primary">
                    {formatPriceAsSats(token.price)}
                  </p>
                  {priceChange !== null && (
                    <p
                      className={`text-[10px] font-semibold mt-0.5 ${
                        priceChange > 0
                          ? "text-success"
                          : priceChange < 0
                            ? "text-destructive"
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
                    {token.marketcap
                      ? formatMcapAsUsd(token.marketcap, btcUsd)
                      : "\u2014"}
                  </p>
                </div>

                <div className="rounded-lg bg-muted/30 border border-border px-3 py-2.5">
                  <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                    <BarChart2 className="h-3 w-3" /> Total Volume
                  </p>
                  <p className="font-mono text-sm font-semibold text-foreground">
                    {token.volume
                      ? formatVolumeAsUsd(token.volume, btcUsd)
                      : "\u2014"}
                  </p>
                </div>

                <div className="rounded-lg bg-muted/30 border border-border px-3 py-2.5">
                  <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                    <Users className="h-3 w-3" /> Holders
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {token.holder_count?.toLocaleString() ?? "\u2014"}
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
              {!token.bonded && token.progress !== undefined && (
                <div className="rounded-lg bg-muted/30 border border-border px-3 py-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Bonding Curve Progress
                    </span>
                    <span className="text-xs font-bold text-amber-400">
                      {token.progress.toFixed(1)}%
                    </span>
                  </div>
                  <Progress
                    value={token.progress}
                    className="h-1.5 bg-muted/60"
                  />
                </div>
              )}

              {/* Price Chart */}
              <div className="rounded-lg border border-border bg-background/40 p-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                  Price Chart
                </p>
                <TokenPriceChart
                  tokenId={token.id}
                  currentPrice={token.price}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  className="flex-1 bg-success/90 hover:bg-success text-white font-semibold"
                  onClick={() => {
                    onTrade(token);
                    onOpenChange(false);
                  }}
                >
                  Trade {token.ticker}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-border"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
