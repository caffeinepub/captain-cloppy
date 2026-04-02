import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import {
  type OdinToken,
  formatPriceAsSats,
  formatPriceDelta,
  getTokenImageUrl,
  getTokens,
} from "../lib/odinApi";
import { PrincipalBanner } from "./PrincipalBanner";
import { TokenDetailModal } from "./TokenDetailModal";

interface DashboardPageProps {
  principal: string;
  onSetPrincipal: (p: string) => void;
  onSelectToken?: (token: OdinToken) => void;
}

function TrendingTokenRow({
  token,
  onClick,
}: {
  token: OdinToken;
  onClick: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const imgUrl = getTokenImageUrl(token.id);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center justify-between px-3 py-2.5 hover:bg-muted/30 transition-colors rounded-lg md:px-4 cursor-pointer text-left"
    >
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 shrink-0 rounded-full overflow-hidden bg-gradient-to-br from-primary/30 to-primary/10 ring-2 ring-primary/20 ring-offset-1 ring-offset-background shadow-sm shadow-primary/10 group-hover:scale-110 transition-transform duration-200">
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
        <div>
          <p className="text-sm font-semibold text-foreground">
            {token.ticker}
          </p>
          <p className="text-xs text-muted-foreground">{token.name}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-mono text-xs font-semibold text-primary">
          {formatPriceAsSats(token.price)}
        </p>
        {token.price_1d !== undefined && (
          <p
            className={[
              "text-xs font-semibold",
              token.price_1d > 0
                ? "text-success"
                : token.price_1d < 0
                  ? "text-destructive"
                  : "text-muted-foreground",
            ].join(" ")}
          >
            {formatPriceDelta(token.price_1d)}
          </p>
        )}
      </div>
    </button>
  );
}

const SKELETON_IDS = ["sk1", "sk2", "sk3", "sk4", "sk5"] as const;

export function DashboardPage({
  principal,
  onSetPrincipal,
  onSelectToken,
}: DashboardPageProps) {
  const [trendingTokens, setTrendingTokens] = useState<OdinToken[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(false);

  // Token detail modal state
  const [detailToken, setDetailToken] = useState<OdinToken | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    setLoadingTrending(true);
    getTokens({ limit: 5, sort: "volume:desc" })
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
      {!principal && <PrincipalBanner onSet={onSetPrincipal} />}

      {/* Trending Tokens */}
      <div className="rounded-xl border border-border bg-card p-4 md:p-5 shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Trending Tokens
          </h3>
          <span className="ml-auto text-xs text-muted-foreground">
            Price in sats · click to view detail
          </span>
        </div>
        <div className="space-y-0.5">
          {loadingTrending
            ? SKELETON_IDS.map((id) => (
                <div
                  key={id}
                  data-ocid="dashboard.trending.loading_state"
                  className="flex items-center justify-between px-3 py-2.5 md:px-4"
                >
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-3.5 w-14" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <div className="space-y-1 text-right">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))
            : trendingTokens.map((token, i) => (
                <div
                  key={token.id}
                  data-ocid={`dashboard.trending.item.${i + 1}`}
                >
                  <TrendingTokenRow
                    token={token}
                    onClick={() => handleTokenClick(token)}
                  />
                </div>
              ))}
        </div>
      </div>

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
