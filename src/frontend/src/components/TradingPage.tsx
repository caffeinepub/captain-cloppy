import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowDownUp,
  ChevronDown,
  Loader2,
  RefreshCw,
  Settings2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { TradeStatus, TradeType } from "../backend";
import { useBtcPrice } from "../hooks/useBtcPrice";
import { useAddTradeLog } from "../hooks/useQueries";
import {
  ODIN_PRICE_DIVISOR,
  type OdinToken,
  type OdinTrade,
  SATS_PER_BTC,
  formatMcapAsUsd,
  formatPriceAsSats,
  getTokenImageUrl,
} from "../lib/odinApi";
import { TokenPriceChart } from "./TokenPriceChart";

interface TradingPageProps {
  principal: string;
  onSetPrincipal: (p: string) => void;
  initialToken?: OdinToken;
}

type OrderType = "market" | "limit" | "recurring";
type DcaInterval = "hourly" | "daily" | "weekly";

const BUY_PRESETS = [
  { label: "0.001", value: 0.001 },
  { label: "0.01", value: 0.01 },
  { label: "0.05", value: 0.05 },
  { label: "0.1", value: 0.1 },
];

const SELL_PRESETS = [
  { label: "25%", value: 0.25 },
  { label: "50%", value: 0.5 },
  { label: "75%", value: 0.75 },
  { label: "MAX", value: 1.0 },
];

// AMM constants — defined outside component to avoid re-creation on every render
const TOKEN_AMM_DIVISOR = 100_000_000_000; // raw token units
const SWAP_FEE_RATE = 0.01; // 1% swap fee, matching Odin.fun

// AMM constant product: tokens received when buying with BTC
// btcReserve and tokenReserve are raw API values (milli-sats and raw token units)
// btcInBtc is in BTC (float)
function calcAmmBuyTokens(
  btcInBtc: number,
  btcReserveMilliSats: number,
  tokenReserveRaw: number,
): number {
  if (btcReserveMilliSats <= 0 || tokenReserveRaw <= 0) return 0;
  // Convert btcIn to milli-sats (same unit as btc_liquidity from API)
  // Apply 1% swap fee: only (1 - fee) of the input enters the AMM pool
  const btcInMilliSats = btcInBtc * 100_000_000 * 1000 * (1 - SWAP_FEE_RATE);
  const tokensOutRaw =
    (tokenReserveRaw * btcInMilliSats) / (btcReserveMilliSats + btcInMilliSats);
  return tokensOutRaw / TOKEN_AMM_DIVISOR;
}

// AMM constant product: BTC received when selling tokens
// tokenInDisplay is display amount (float, e.g. 8500000)
function calcAmmSellBtc(
  tokenInDisplay: number,
  btcReserveMilliSats: number,
  tokenReserveRaw: number,
): number {
  if (btcReserveMilliSats <= 0 || tokenReserveRaw <= 0) return 0;
  // Apply 1% swap fee: only (1 - fee) of the token input enters the AMM pool
  const tokenInRaw = tokenInDisplay * TOKEN_AMM_DIVISOR * (1 - SWAP_FEE_RATE);
  const btcOutMilliSats =
    (btcReserveMilliSats * tokenInRaw) / (tokenReserveRaw + tokenInRaw);
  return btcOutMilliSats / 1000 / 100_000_000; // convert to BTC
}

function formatUsd(usd: number): string {
  if (usd === 0) return "$0";
  if (usd < 0.01) return `$${usd.toFixed(6)}`;
  if (usd < 1) return `$${usd.toFixed(4)}`;
  if (usd >= 1000)
    return `$${usd.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return `$${usd.toFixed(2)}`;
}

function TokenImage({ token }: { token: OdinToken }) {
  const [err, setErr] = useState(false);
  const url = getTokenImageUrl(token.id);
  if (!url || err) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-primary/40 to-primary/10 text-xs font-bold text-primary">
        {token.ticker.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={token.ticker}
      className="h-full w-full rounded-full object-cover"
      onError={() => setErr(true)}
    />
  );
}

function BondedCheckmark() {
  return (
    <svg
      viewBox="0 0 22 22"
      className="h-4 w-4 shrink-0 fill-[#1d9bf0]"
      role="img"
      aria-label="Bonded"
    >
      <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
    </svg>
  );
}

function formatRelativeTime(timeStr: string | number): string {
  const time =
    typeof timeStr === "number" ? timeStr * 1000 : new Date(timeStr).getTime();
  const diff = (Date.now() - time) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatTokenAmt(amount: number, ticker: string): string {
  const divisor = 100_000_000_000;
  const val = amount / divisor;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M ${ticker}`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(2)}K ${ticker}`;
  return `${val.toFixed(2)} ${ticker}`;
}

function shortenAddress(addr: string): string {
  if (!addr) return "";
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

interface RecentTradesProps {
  tokenId: string;
  ticker: string;
  btcUsd: number;
}

function RecentTrades({ tokenId, ticker, btcUsd }: RecentTradesProps) {
  const [trades, setTrades] = useState<OdinTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchTrades = useCallback(async () => {
    try {
      const res = await fetch(
        `https://api.odin.fun/v1/tokens/${tokenId}/trades?limit=15`,
      );
      if (!res.ok) throw new Error("fetch failed");
      const json = await res.json();
      const raw: OdinTrade[] = (json.data ?? json ?? []).map(
        (t: OdinTrade) => ({
          ...t,
          token_ticker: ticker,
        }),
      );
      setTrades(raw);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [tokenId, ticker]);

  useEffect(() => {
    setLoading(true);
    fetchTrades();
    const id = setInterval(fetchTrades, 10_000);
    return () => clearInterval(id);
  }, [fetchTrades]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Recent Trades</h3>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            fetchTrades();
          }}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Refresh trades"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Header row */}
      <div className="grid grid-cols-4 gap-2 px-2 pb-1.5 border-b border-border/50">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
          Side
        </span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider text-right">
          Amount
        </span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider text-right">
          Price
        </span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider text-right">
          Time
        </span>
      </div>

      {loading ? (
        <div
          className="space-y-2 mt-2"
          data-ocid="trading.recent_trades.loading_state"
        >
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i.toString()} className="h-7 w-full rounded" />
          ))}
        </div>
      ) : error || trades.length === 0 ? (
        <div
          className="py-8 text-center text-sm text-muted-foreground"
          data-ocid="trading.recent_trades.empty_state"
        >
          No trades available
        </div>
      ) : (
        <div className="divide-y divide-border/30">
          {trades.map((trade) => {
            const isBuy = trade.buy;
            const priceInSats = trade.price / ODIN_PRICE_DIVISOR;
            const displayName =
              trade.user_username || shortenAddress(trade.user);
            // Calculate USD value from amount_btc (milli-sats)
            const tradeUsd =
              btcUsd > 0 ? (trade.amount_btc / 1000 / 100_000_000) * btcUsd : 0;
            return (
              <div
                key={trade.id}
                className="grid grid-cols-4 gap-2 px-2 py-1.5 hover:bg-muted/20 transition-colors"
                data-ocid="trading.recent_trade.row"
              >
                <div className="flex flex-col gap-0.5">
                  <span
                    className={`text-xs font-semibold ${
                      isBuy ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {isBuy ? "BUY" : "SELL"}
                  </span>
                  <span className="text-[10px] text-blue-400 truncate">
                    {displayName}
                  </span>
                </div>
                <div className="text-right flex flex-col gap-0.5">
                  <span className="text-xs text-foreground font-mono">
                    {formatTokenAmt(trade.amount_token, ticker)}
                  </span>
                  {tradeUsd > 0 && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {formatUsd(tradeUsd)}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground font-mono">
                    {priceInSats.toFixed(2)}s
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground">
                    {formatRelativeTime(trade.time)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function TradingPage({
  principal,
  onSetPrincipal: _onSetPrincipal,
  initialToken,
}: TradingPageProps) {
  // Token state
  const [tokens, setTokens] = useState<OdinToken[]>([]);
  const [selectedToken, setSelectedToken] = useState<OdinToken | null>(
    initialToken ?? null,
  );

  // Trade form state
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [btcAmount, setBtcAmount] = useState("");
  const [tokenAmount, setTokenAmount] = useState("");
  const [slippage, setSlippage] = useState("0.5");
  const [limitPrice, setLimitPrice] = useState("");
  const [dcaInterval, setDcaInterval] = useState<DcaInterval>("daily");
  const [dcaOrders, setDcaOrders] = useState("5");
  const [showChart, setShowChart] = useState(true);
  const [slippageOpen, setSlippageOpen] = useState(false);

  // AMM liquidity data for accurate token amount estimation
  const [tokenDetail, setTokenDetail] = useState<{
    btc_liquidity: number;
    token_liquidity: number;
  } | null>(null);

  const addTradeLog = useAddTradeLog();
  const initialTokenRef = useRef(initialToken);
  const { btcUsd } = useBtcPrice();
  const btcUsdSafe = btcUsd ?? 0;

  // -----------------------------------------------------------------------
  // Load top tokens by market cap and auto-select #1 on mount
  // -----------------------------------------------------------------------
  const loadAndAutoSelectToken = useCallback(async () => {
    try {
      const res = await fetch(
        "https://api.odin.fun/v1/tokens?limit=30&sort=market_cap:desc",
      );
      if (!res.ok) throw new Error("fetch failed");
      const json = await res.json();
      const raw: OdinToken[] = (json.data ?? json ?? []).map(
        (t: OdinToken) => ({
          ...t,
          marketcap: t.marketcap ?? (t as any).market_cap ?? 0,
        }),
      );
      // Sort descending by marketcap
      raw.sort((a, b) => (b.marketcap ?? 0) - (a.marketcap ?? 0));
      setTokens(raw);
      // Auto-select the top token if no initialToken was provided
      if (!initialTokenRef.current && raw.length > 0) {
        setSelectedToken(raw[0]);
        // Fetch liquidity detail for the auto-selected token
        try {
          const detailRes = await fetch(
            `https://api.odin.fun/v1/token/${raw[0].id}`,
          );
          if (detailRes.ok) {
            const detailData = await detailRes.json();
            if (
              detailData.btc_liquidity != null &&
              detailData.token_liquidity != null
            ) {
              setTokenDetail({
                btc_liquidity: detailData.btc_liquidity,
                token_liquidity: Number(detailData.token_liquidity),
              });
            }
          }
        } catch {
          /* ignore */
        }
      }
    } catch {
      setTokens([]);
    }
  }, []);

  // Auto-load on mount
  useEffect(() => {
    loadAndAutoSelectToken();
  }, [loadAndAutoSelectToken]);

  // Sync initialToken when it changes
  useEffect(() => {
    if (initialToken && initialToken.id !== initialTokenRef.current?.id) {
      initialTokenRef.current = initialToken;
      setSelectedToken(initialToken);
      setTokenDetail(null);
      // Fetch liquidity for the new initialToken
      fetch(`https://api.odin.fun/v1/token/${initialToken.id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.btc_liquidity != null && data?.token_liquidity != null) {
            setTokenDetail({
              btc_liquidity: data.btc_liquidity,
              token_liquidity: Number(data.token_liquidity),
            });
          }
        })
        .catch(() => {});
    }
  }, [initialToken]);

  const handleSelectToken = useCallback(async (token: OdinToken) => {
    setSelectedToken(token);
    setBtcAmount("");
    setTokenAmount("");
    setTokenDetail(null);
    try {
      const res = await fetch(`https://api.odin.fun/v1/token/${token.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.btc_liquidity != null && data.token_liquidity != null) {
          setTokenDetail({
            btc_liquidity: data.btc_liquidity,
            token_liquidity: Number(data.token_liquidity),
          });
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  // suppress unused warning — kept for potential future use
  void tokens;
  void handleSelectToken;

  // Price in BTC per token
  const priceInBtcPerToken = selectedToken
    ? selectedToken.price / ODIN_PRICE_DIVISOR / SATS_PER_BTC
    : 0;

  // USD price of selected token
  const tokenUsdPrice =
    priceInBtcPerToken > 0 && btcUsdSafe > 0
      ? priceInBtcPerToken * btcUsdSafe
      : 0;

  // Two-way sync: btcAmount changes -> update tokenAmount using AMM formula
  const handleBtcAmountChange = (val: string) => {
    setBtcAmount(val);
    if (val && !Number.isNaN(Number(val)) && Number(val) > 0) {
      let toks = 0;
      if (
        tokenDetail &&
        tokenDetail.btc_liquidity > 0 &&
        tokenDetail.token_liquidity > 0
      ) {
        toks = calcAmmBuyTokens(
          Number(val),
          tokenDetail.btc_liquidity,
          tokenDetail.token_liquidity,
        );
      } else if (priceInBtcPerToken > 0) {
        toks = Number(val) / priceInBtcPerToken;
      }
      setTokenAmount(toks > 0 ? toks.toFixed(2) : "");
    } else {
      setTokenAmount("");
    }
  };

  // Two-way sync: tokenAmount changes -> update btcAmount using AMM inverse
  const handleTokenAmountChange = (val: string) => {
    setTokenAmount(val);
    if (val && !Number.isNaN(Number(val)) && Number(val) > 0) {
      let btc = 0;
      if (
        tokenDetail &&
        tokenDetail.btc_liquidity > 0 &&
        tokenDetail.token_liquidity > 0
      ) {
        btc = calcAmmSellBtc(
          Number(val),
          tokenDetail.btc_liquidity,
          tokenDetail.token_liquidity,
        );
      } else if (priceInBtcPerToken > 0) {
        btc = Number(val) * priceInBtcPerToken;
      }
      setBtcAmount(btc > 0 ? btc.toFixed(8) : "");
    } else {
      setBtcAmount("");
    }
  };

  const handleBuyPreset = (btcVal: number) => {
    handleBtcAmountChange(String(btcVal));
  };

  const handleSellPreset = (pct: number) => {
    // Use 21,000,000 as approximate max supply for preset
    const tokenAmt = 21_000_000 * pct;
    handleTokenAmountChange(String(Math.round(tokenAmt)));
  };

  // AMM-based price impact calculation
  const priceImpact = (() => {
    if (!selectedToken || !btcAmount) return null;
    const orderBtc = Number(btcAmount);
    if (Number.isNaN(orderBtc) || orderBtc <= 0) return null;

    // Use AMM-based price impact if liquidity data available
    if (
      tokenDetail &&
      tokenDetail.btc_liquidity > 0 &&
      tokenDetail.token_liquidity > 0
    ) {
      const btcReserve = tokenDetail.btc_liquidity; // milli-sats
      const tokenReserve = tokenDetail.token_liquidity; // raw
      const btcInMilliSats = orderBtc * 100_000_000 * 1000;
      const priceBefore = btcReserve / tokenReserve;
      const tokensOut =
        (tokenReserve * btcInMilliSats) / (btcReserve + btcInMilliSats);
      const priceAfter =
        (btcReserve + btcInMilliSats) / (tokenReserve - tokensOut);
      const impact = ((priceAfter - priceBefore) / priceBefore) * 100;
      return Math.min(impact, 99);
    }

    // Fallback: use market cap estimate
    const mcapInBtc = selectedToken.marketcap
      ? selectedToken.marketcap / 1000 / SATS_PER_BTC
      : null;
    if (!mcapInBtc || mcapInBtc <= 0) return null;
    const impact = (orderBtc / (mcapInBtc * 0.2)) * 100;
    return impact;
  })();

  // USD equivalent helpers for the form
  const payUsd = (() => {
    const isBuy = tradeType === "buy";
    if (isBuy) {
      const btc = Number(btcAmount);
      if (!btcAmount || Number.isNaN(btc) || btc <= 0) return null;
      return btc * btcUsdSafe;
    }
    // Sell: top input is token amount, compute BTC then USD
    const toks = Number(tokenAmount);
    if (
      !tokenAmount ||
      Number.isNaN(toks) ||
      toks <= 0 ||
      priceInBtcPerToken <= 0
    )
      return null;
    return toks * priceInBtcPerToken * btcUsdSafe;
  })();

  const receiveUsd = (() => {
    const isBuy = tradeType === "buy";
    if (isBuy) {
      // Receive tokens — estimate USD
      const toks = Number(tokenAmount);
      if (!tokenAmount || Number.isNaN(toks) || toks <= 0 || tokenUsdPrice <= 0)
        return null;
      return toks * tokenUsdPrice;
    }
    // Sell: receive BTC
    const btc = Number(btcAmount);
    if (!btcAmount || Number.isNaN(btc) || btc <= 0) return null;
    return btc * btcUsdSafe;
  })();

  // Swap fee (1% of the input value)
  const swapFeeUsd = (() => {
    if (!btcUsdSafe) return null;
    const isBuy = tradeType === "buy";
    if (isBuy) {
      const btc = Number(btcAmount);
      if (!btcAmount || Number.isNaN(btc) || btc <= 0) return null;
      return btc * SWAP_FEE_RATE * btcUsdSafe;
    }
    // Sell: fee on the token amount expressed in USD
    const toks = Number(tokenAmount);
    if (!tokenAmount || Number.isNaN(toks) || toks <= 0 || tokenUsdPrice <= 0)
      return null;
    return toks * tokenUsdPrice * SWAP_FEE_RATE;
  })();

  const handlePlaceOrder = async () => {
    if (!principal || !selectedToken) return;
    const orderAmount =
      tradeType === "buy" ? Number(btcAmount) : Number(tokenAmount);
    if (Number.isNaN(orderAmount) || orderAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    try {
      const price = selectedToken.price ?? 0;
      const amtBtc =
        tradeType === "buy" ? Number(btcAmount) : Number(btcAmount);
      const amtToken =
        tradeType === "buy" ? Number(tokenAmount) : Number(tokenAmount);
      await addTradeLog.mutateAsync({
        status: TradeStatus.pending,
        tokenId: selectedToken.id,
        tradeType: tradeType === "buy" ? TradeType.buy : TradeType.sell,
        amountToken: amtToken,
        timestamp: BigInt(Date.now()) * 1_000_000n,
        amountBtc: amtBtc,
        price,
      });
      const label =
        orderType === "limit"
          ? "Limit"
          : orderType === "recurring"
            ? "Recurring"
            : "Market";
      toast.success(
        `Simulated ${label} ${tradeType.toUpperCase()} placed for ${selectedToken.ticker}`,
      );
      setBtcAmount("");
      setTokenAmount("");
    } catch {
      toast.error("Failed to place simulated order");
    }
  };

  const priceChange = selectedToken?.price_1d
    ? ((selectedToken.price - selectedToken.price_1d) /
        Math.max(1, Math.abs(selectedToken.price_1d))) *
      100
    : null;

  const isBuy = tradeType === "buy";

  // -----------------------------------------------------------------------
  // Selected token header bar (shown instead of selector)
  // -----------------------------------------------------------------------
  const TokenHeaderBar = selectedToken ? (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
      <div className="h-9 w-9 shrink-0 rounded-full overflow-hidden ring-1 ring-primary/20">
        <TokenImage token={selectedToken} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-foreground">
            {selectedToken.ticker}
          </span>
          {selectedToken.bonded && <BondedCheckmark />}
          {priceChange !== null && (
            <span
              className={`text-xs font-semibold ml-1 ${
                priceChange > 0
                  ? "text-emerald-400"
                  : priceChange < 0
                    ? "text-red-400"
                    : "text-muted-foreground"
              }`}
            >
              {priceChange > 0 ? "+" : ""}
              {priceChange.toFixed(2)}%
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {selectedToken.name}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs font-mono font-semibold text-foreground">
          {formatPriceAsSats(selectedToken.price)}
        </p>
        {tokenUsdPrice > 0 && (
          <p className="text-[10px] text-muted-foreground font-mono">
            {formatUsd(tokenUsdPrice)}
          </p>
        )}
      </div>
    </div>
  ) : (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      <span className="text-sm text-muted-foreground">Loading...</span>
    </div>
  );

  // -----------------------------------------------------------------------
  // Token Info Bar
  // -----------------------------------------------------------------------
  const TokenInfoBar = selectedToken && (
    <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 py-2">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Price</span>
        <span className="text-xs font-mono font-semibold text-foreground">
          {formatPriceAsSats(selectedToken.price)}
        </span>
        {tokenUsdPrice > 0 && (
          <span className="text-xs text-muted-foreground/70 font-mono">
            ({formatUsd(tokenUsdPrice)})
          </span>
        )}
      </div>
      {priceChange !== null && (
        <div
          className={`flex items-center gap-1 text-xs font-semibold ${
            priceChange > 0
              ? "text-emerald-400"
              : priceChange < 0
                ? "text-red-400"
                : "text-muted-foreground"
          }`}
        >
          {priceChange > 0 ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {priceChange > 0 ? "+" : ""}
          {priceChange.toFixed(2)}% 24h
        </div>
      )}
      {selectedToken.marketcap && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">MCap</span>
          <span className="text-xs font-mono font-semibold text-foreground">
            {formatMcapAsUsd(selectedToken.marketcap, btcUsd)}
          </span>
        </div>
      )}
      {selectedToken.volume && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Vol</span>
          <span className="text-xs font-mono font-semibold text-foreground">
            {formatMcapAsUsd(selectedToken.volume, btcUsd)}
          </span>
        </div>
      )}
      {selectedToken.holder_count && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Holders</span>
          <span className="text-xs font-mono font-semibold text-foreground">
            {selectedToken.holder_count.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );

  // -----------------------------------------------------------------------
  // Trade Form (right panel)
  // -----------------------------------------------------------------------
  const TradeForm = (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Order type tabs */}
      <div className="border-b border-border px-4 pt-4 pb-0">
        <Tabs
          value={orderType}
          onValueChange={(v) => setOrderType(v as OrderType)}
        >
          <TabsList className="w-full h-8 p-0.5 bg-muted/40 gap-0.5">
            <TabsTrigger
              value="market"
              data-ocid="trading.order_type.market.tab"
              className="flex-1 h-full text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              Market
            </TabsTrigger>
            <TabsTrigger
              value="limit"
              data-ocid="trading.order_type.limit.tab"
              className="flex-1 h-full text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              Limit
            </TabsTrigger>
            <TabsTrigger
              value="recurring"
              data-ocid="trading.order_type.recurring.tab"
              className="flex-1 h-full text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              Recurring
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="p-4 space-y-4">
        {/* Buy/Sell tabs */}
        <Tabs
          value={tradeType}
          onValueChange={(v) => {
            setTradeType(v as "buy" | "sell");
            setBtcAmount("");
            setTokenAmount("");
          }}
        >
          <TabsList className="w-full h-10 p-1 bg-muted/40">
            <TabsTrigger
              value="buy"
              data-ocid="trading.buy.toggle"
              className="flex-1 h-full text-sm font-bold data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-sm"
            >
              Buy
            </TabsTrigger>
            <TabsTrigger
              value="sell"
              data-ocid="trading.sell.toggle"
              className="flex-1 h-full text-sm font-bold data-[state=active]:bg-red-500 data-[state=active]:text-white data-[state=active]:shadow-sm"
            >
              Sell
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Limit price input */}
        {orderType === "limit" && (
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
              Target Price (sats)
            </Label>
            <Input
              data-ocid="trading.limit_price.input"
              type="number"
              min="0"
              placeholder={
                selectedToken
                  ? String(Math.round(selectedToken.price / ODIN_PRICE_DIVISOR))
                  : "0"
              }
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              className="bg-muted/40 border-border font-mono"
            />
          </div>
        )}

        {/* DCA fields */}
        {orderType === "recurring" && (
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Interval
              </Label>
              <div className="flex gap-2">
                {(["hourly", "daily", "weekly"] as DcaInterval[]).map((iv) => (
                  <button
                    type="button"
                    key={iv}
                    data-ocid={`trading.dca_interval.${iv}.toggle`}
                    onClick={() => setDcaInterval(iv)}
                    className={`flex-1 rounded-md border py-1.5 text-xs font-semibold capitalize transition-all ${
                      dcaInterval === iv
                        ? isBuy
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                          : "border-red-500 bg-red-500/10 text-red-400"
                        : "border-border bg-muted/30 text-muted-foreground hover:border-border/80"
                    }`}
                  >
                    {iv}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Number of Orders
              </Label>
              <Input
                data-ocid="trading.dca_orders.input"
                type="number"
                min="1"
                max="100"
                value={dcaOrders}
                onChange={(e) => setDcaOrders(e.target.value)}
                className="bg-muted/40 border-border"
              />
            </div>
          </div>
        )}

        {/* Two-way synced inputs */}
        <div className="space-y-1">
          {/* Top input: BTC (buy) or token (sell) */}
          <div
            className={`rounded-lg border bg-muted/30 px-3 py-2.5 ${
              isBuy ? "border-emerald-500/30" : "border-red-500/30"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {isBuy ? "You Pay" : "You Sell"}
              </span>
              <span className="text-[10px] font-semibold text-muted-foreground">
                {isBuy ? "BTC" : (selectedToken?.ticker ?? "TOKEN")}
              </span>
            </div>
            <input
              data-ocid="trading.btc_amount.input"
              type="number"
              min="0"
              step={isBuy ? "0.001" : "100"}
              placeholder={isBuy ? "0.001" : "1000"}
              value={isBuy ? btcAmount : tokenAmount}
              onChange={(e) =>
                isBuy
                  ? handleBtcAmountChange(e.target.value)
                  : handleTokenAmountChange(e.target.value)
              }
              className="w-full bg-transparent text-xl font-mono font-bold text-foreground outline-none placeholder:text-muted-foreground/40"
            />
            {payUsd !== null && btcUsdSafe > 0 && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {formatUsd(payUsd)}
              </p>
            )}
          </div>

          {/* Swap arrow */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => {
                setTradeType((t) => (t === "buy" ? "sell" : "buy"));
                setBtcAmount("");
                setTokenAmount("");
              }}
              className="rounded-full border border-border bg-card p-1.5 hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Swap buy/sell"
            >
              <ArrowDownUp className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Bottom input: tokens (buy) or BTC (sell) */}
          <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                You Receive
              </span>
              <span className="text-[10px] font-semibold text-muted-foreground">
                {isBuy ? (selectedToken?.ticker ?? "TOKEN") : "BTC"}
              </span>
            </div>
            <input
              data-ocid="trading.token_amount.input"
              type="number"
              min="0"
              placeholder="0"
              value={isBuy ? tokenAmount : btcAmount}
              onChange={(e) =>
                isBuy
                  ? handleTokenAmountChange(e.target.value)
                  : handleBtcAmountChange(e.target.value)
              }
              className="flex-1 w-full bg-transparent text-xl font-mono font-bold text-foreground outline-none placeholder:text-muted-foreground/40"
            />
            {receiveUsd !== null && btcUsdSafe > 0 && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {formatUsd(receiveUsd)}
              </p>
            )}
          </div>
        </div>

        {/* Quick preset buttons */}
        <div className="flex gap-1.5">
          {isBuy
            ? BUY_PRESETS.map((p) => (
                <button
                  type="button"
                  key={p.label}
                  data-ocid="trading.buy_preset.button"
                  onClick={() => handleBuyPreset(p.value)}
                  className={`flex-1 rounded-md border py-1.5 text-xs font-semibold transition-all ${
                    btcAmount === String(p.value)
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                      : "border-border bg-muted/30 text-muted-foreground hover:border-emerald-500/40 hover:text-emerald-400"
                  }`}
                >
                  {p.label}
                </button>
              ))
            : SELL_PRESETS.map((p) => (
                <button
                  type="button"
                  key={p.label}
                  data-ocid="trading.sell_preset.button"
                  onClick={() => handleSellPreset(p.value)}
                  className={`flex-1 rounded-md border py-1.5 text-xs font-semibold transition-all ${"border-border bg-muted/30 text-muted-foreground hover:border-red-500/40 hover:text-red-400"}`}
                >
                  {p.label}
                </button>
              ))}
        </div>

        {/* Swap fee row */}
        {swapFeeUsd !== null && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Swap Fee</span>
              <span className="text-xs font-semibold text-muted-foreground">
                1%
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {formatUsd(swapFeeUsd)}
            </span>
          </div>
        )}

        {/* Price impact + slippage settings row */}
        <div className="flex items-center justify-between">
          {priceImpact !== null ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">
                Price Impact
              </span>
              <span
                className={`text-xs font-semibold ${
                  priceImpact < 1
                    ? "text-emerald-400"
                    : priceImpact < 3
                      ? "text-yellow-400"
                      : "text-red-400"
                }`}
              >
                {priceImpact.toFixed(2)}%
              </span>
            </div>
          ) : (
            <div />
          )}

          {/* Slippage popover */}
          <Popover open={slippageOpen} onOpenChange={setSlippageOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                data-ocid="trading.slippage.button"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Settings2 className="h-3.5 w-3.5" />
                <span>{slippage}% slippage</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-56 p-3"
              data-ocid="trading.slippage.popover"
              align="end"
            >
              <p className="text-xs font-semibold text-foreground mb-2">
                Slippage Tolerance
              </p>
              <div className="flex items-center gap-2 mb-2">
                {["0.5", "1.0", "2.0"].map((v) => (
                  <button
                    type="button"
                    key={v}
                    onClick={() => setSlippage(v)}
                    className={`flex-1 rounded border py-1 text-xs font-semibold transition-all ${
                      slippage === v
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    {v}%
                  </button>
                ))}
              </div>
              <div className="relative">
                <Input
                  data-ocid="trading.slippage.input"
                  type="number"
                  min="0"
                  max="50"
                  step="0.1"
                  value={slippage}
                  onChange={(e) => setSlippage(e.target.value)}
                  className="pr-7 h-8 text-sm bg-muted/40"
                  placeholder="Custom"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  %
                </span>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <Separator className="opacity-50" />

        {/* CTA */}
        {!principal ? (
          <div
            className="flex flex-col items-center justify-center py-6 gap-2"
            data-ocid="trading.wallet_connect.section"
          >
            <Wallet className="h-7 w-7 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground font-medium">
              Wallet connect coming soon
            </p>
          </div>
        ) : (
          <Button
            type="button"
            data-ocid="trading.place_order.primary_button"
            className={`w-full h-14 text-base font-bold tracking-wide transition-all ${
              isBuy
                ? "bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-500/20 shadow-lg"
                : "bg-red-500 hover:bg-red-400 text-white shadow-red-500/20 shadow-lg"
            }`}
            disabled={
              !selectedToken ||
              (!btcAmount && !tokenAmount) ||
              addTradeLog.isPending
            }
            onClick={handlePlaceOrder}
          >
            {addTradeLog.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Placing order...
              </>
            ) : (
              `${isBuy ? "Buy" : "Sell"} ${selectedToken?.ticker ?? "Token"}`
            )}
          </Button>
        )}

        <p className="text-[10px] text-muted-foreground text-center">
          Simulated trading — orders are logged but not executed on-chain
        </p>
      </div>
    </div>
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="w-full">
      {/* Page header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">Trading</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Simulated DEX-style trading on Odin.fun tokens
        </p>
      </div>

      {/* ================================================================
          MOBILE LAYOUT (< lg)
          ================================================================ */}
      <div className="lg:hidden space-y-3">
        {/* Token header bar */}
        {TokenHeaderBar}

        {/* Token info bar */}
        {TokenInfoBar}

        {/* Chart toggle + chart */}
        {selectedToken && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <button
              type="button"
              onClick={() => setShowChart((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted/30 transition-colors"
              data-ocid="trading.chart.toggle"
            >
              <span>Price Chart</span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${
                  showChart ? "rotate-180" : ""
                }`}
              />
            </button>
            {showChart && (
              <div className="px-3 pb-3">
                <TokenPriceChart
                  key={selectedToken.id}
                  tokenId={selectedToken.id}
                  currentPrice={selectedToken.price}
                />
              </div>
            )}
          </div>
        )}

        {/* Trade form */}
        {TradeForm}

        {/* Recent trades */}
        {selectedToken && (
          <div className="rounded-xl border border-border bg-card p-4">
            <RecentTrades
              key={selectedToken.id}
              tokenId={selectedToken.id}
              ticker={selectedToken.ticker}
              btcUsd={btcUsdSafe}
            />
          </div>
        )}
      </div>

      {/* ================================================================
          DESKTOP LAYOUT (lg+)
          ================================================================ */}
      <div className="hidden lg:grid lg:grid-cols-[1fr_380px] gap-4">
        {/* LEFT COLUMN */}
        <div className="space-y-3 min-w-0">
          {/* Token header bar */}
          {TokenHeaderBar}

          {/* Token info bar */}
          {TokenInfoBar}

          {/* Chart */}
          <div className="rounded-xl border border-border bg-card p-4">
            {selectedToken ? (
              <TokenPriceChart
                key={selectedToken.id}
                tokenId={selectedToken.id}
                currentPrice={selectedToken.price}
              />
            ) : (
              <div className="h-[300px] flex flex-col items-center justify-center gap-3 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            )}
          </div>

          {/* Recent trades */}
          <div className="rounded-xl border border-border bg-card p-4">
            {selectedToken ? (
              <RecentTrades
                key={selectedToken.id}
                tokenId={selectedToken.id}
                ticker={selectedToken.ticker}
                btcUsd={btcUsdSafe}
              />
            ) : (
              <div className="py-8 text-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40 mx-auto" />
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-3">{TradeForm}</div>
      </div>
    </div>
  );
}
