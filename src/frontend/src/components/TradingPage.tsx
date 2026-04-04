import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Search,
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
  SATS_PER_BTC,
  formatMcapAsUsd,
  formatPriceAsSats,
  getTokenImageUrl,
  searchTokens,
} from "../lib/odinApi";

interface TradingPageProps {
  principal: string;
  onSetPrincipal: (p: string) => void;
  initialToken?: OdinToken;
}

const BUY_PRESETS = [
  { label: "0.001 BTC", value: 0.001 },
  { label: "0.01 BTC", value: 0.01 },
  { label: "0.05 BTC", value: 0.05 },
  { label: "0.1 BTC", value: 0.1 },
];

const SELL_PRESETS = [
  { label: "25%", value: 0.25 },
  { label: "50%", value: 0.5 },
  { label: "75%", value: 0.75 },
  { label: "MAX", value: 1.0 },
];

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

export function TradingPage({
  principal,
  onSetPrincipal: _onSetPrincipal,
  initialToken,
}: TradingPageProps) {
  const [query, setQuery] = useState(initialToken?.ticker ?? "");
  const [tokens, setTokens] = useState<OdinToken[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedToken, setSelectedToken] = useState<OdinToken | null>(
    initialToken ?? null,
  );
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState("0.5");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addTradeLog = useAddTradeLog();
  const initialTokenRef = useRef(initialToken);
  const { btcUsd } = useBtcPrice();

  useEffect(() => {
    if (initialToken && initialToken.id !== initialTokenRef.current?.id) {
      initialTokenRef.current = initialToken;
      setSelectedToken(initialToken);
      setQuery(initialToken.ticker);
      setShowDropdown(false);
    }
  }, [initialToken]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setTokens([]);
      setShowDropdown(false);
      return;
    }
    setSearchLoading(true);
    try {
      const results = await searchTokens(q);
      setTokens(results);
      setShowDropdown(true);
    } catch {
      setTokens([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  const handleSelectToken = (token: OdinToken) => {
    setSelectedToken(token);
    setQuery(token.ticker);
    setShowDropdown(false);
    setAmount("");
  };

  const handlePlaceOrder = async () => {
    if (!principal || !selectedToken || !amount) return;
    const amountNum = Number.parseFloat(amount);
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    try {
      const price = selectedToken.price ?? 0;
      const amountBtc = tradeType === "buy" ? amountNum : amountNum * price;
      const amountToken =
        tradeType === "buy" ? (price > 0 ? amountNum / price : 0) : amountNum;
      await addTradeLog.mutateAsync({
        status: TradeStatus.pending,
        tokenId: selectedToken.id,
        tradeType: tradeType === "buy" ? TradeType.buy : TradeType.sell,
        amountToken,
        timestamp: BigInt(Date.now()) * 1_000_000n,
        amountBtc,
        price,
      });
      toast.success(
        `Simulated ${tradeType.toUpperCase()} order placed for ${selectedToken.ticker}`,
      );
      setAmount("");
    } catch {
      toast.error("Failed to place simulated order");
    }
  };

  // Estimated output calculation
  const estimatedOutput = (() => {
    if (!selectedToken || !amount) return null;
    const amountNum = Number.parseFloat(amount);
    if (Number.isNaN(amountNum) || amountNum <= 0) return null;
    // price is in milli-sats; convert to BTC per token:
    // priceInMsats / 1000 = sats; sats / 1e8 = BTC per token
    const priceInBtc = selectedToken.price / ODIN_PRICE_DIVISOR / SATS_PER_BTC;
    if (tradeType === "buy") {
      // amountNum is in BTC, output is in tokens
      const tokenCount = priceInBtc > 0 ? amountNum / priceInBtc : 0;
      if (tokenCount >= 1_000_000)
        return `~${(tokenCount / 1_000_000).toFixed(2)}M ${selectedToken.ticker}`;
      if (tokenCount >= 1_000)
        return `~${(tokenCount / 1_000).toFixed(2)}K ${selectedToken.ticker}`;
      return `~${tokenCount.toFixed(2)} ${selectedToken.ticker}`;
    }
    // Sell: amountNum is in tokens, output is in BTC
    const btcOutValue = amountNum * priceInBtc;
    if (btcOutValue >= 1) return `~${btcOutValue.toFixed(4)} BTC`;
    if (btcOutValue >= 0.0001) return `~${btcOutValue.toFixed(6)} BTC`;
    return `~${btcOutValue.toFixed(8)} BTC`;
  })();

  const priceChange = selectedToken?.price_1d
    ? ((selectedToken.price - selectedToken.price_1d) /
        Math.max(1, Math.abs(selectedToken.price_1d))) *
      100
    : null;

  const isBuy = tradeType === "buy";

  return (
    <div className="w-full max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Trading</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Simulated DEX-style trading on Odin.fun tokens
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Token search + info */}
        <div className="space-y-4">
          {/* Search */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <Label
              htmlFor="token-search"
              className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Select Token
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="token-search"
                data-ocid="trading.search_input"
                placeholder="Search tokens by ticker or name…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => tokens.length > 0 && setShowDropdown(true)}
                className="pl-9 bg-muted/40 border-border"
              />
              {searchLoading && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>

            {showDropdown && tokens.length > 0 && (
              <div
                className="mt-2 rounded-lg border border-border bg-popover shadow-lg overflow-hidden max-h-64 overflow-y-auto"
                data-ocid="trading.token.dropdown_menu"
              >
                {tokens.map((token) => (
                  <button
                    type="button"
                    key={token.id}
                    onClick={() => handleSelectToken(token)}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-sm hover:bg-muted/60 transition-colors border-b border-border/50 last:border-b-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 shrink-0 rounded-full overflow-hidden ring-1 ring-primary/20">
                        <TokenImage token={token} />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-foreground">
                          {token.ticker}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {token.name}
                        </p>
                      </div>
                    </div>
                    <span className="text-primary text-xs font-mono">
                      {formatPriceAsSats(token.price)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Token info card */}
          {selectedToken ? (
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 shrink-0 rounded-full overflow-hidden ring-2 ring-primary/30 ring-offset-2 ring-offset-card">
                  <TokenImage token={selectedToken} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-foreground">
                      {selectedToken.ticker}
                    </h3>
                    {selectedToken.bonded && (
                      <svg
                        viewBox="0 0 22 22"
                        className="h-5 w-5 shrink-0 fill-[#1d9bf0]"
                        role="img"
                        aria-label="Bonded"
                      >
                        <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
                      </svg>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {selectedToken.name}
                  </p>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Price</p>
                  <p className="font-mono text-base font-bold text-primary">
                    {formatPriceAsSats(selectedToken.price)}
                  </p>
                  {priceChange !== null && (
                    <div
                      className={`flex items-center gap-1 text-xs font-semibold mt-0.5 ${
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
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Market Cap
                  </p>
                  <p className="font-mono text-base font-semibold text-foreground">
                    {selectedToken.marketcap
                      ? formatMcapAsUsd(selectedToken.marketcap, btcUsd)
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 flex flex-col items-center justify-center text-center">
              <Search className="h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                Search and select a token to start trading
              </p>
            </div>
          )}
        </div>

        {/* RIGHT: Trade form */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-5">
          {/* Buy/Sell tabs */}
          <Tabs
            value={tradeType}
            onValueChange={(v) => {
              setTradeType(v as "buy" | "sell");
              setAmount("");
            }}
          >
            <TabsList className="w-full h-11 p-1 bg-muted/40">
              <TabsTrigger
                value="buy"
                data-ocid="trading.buy.toggle"
                className="flex-1 h-full text-base font-semibold data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-sm"
              >
                Buy
              </TabsTrigger>
              <TabsTrigger
                value="sell"
                data-ocid="trading.sell.toggle"
                className="flex-1 h-full text-base font-semibold data-[state=active]:bg-red-500 data-[state=active]:text-white data-[state=active]:shadow-sm"
              >
                Sell
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Amount input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label
                htmlFor="trade-amount"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {isBuy ? "You Pay" : "You Sell"}
              </Label>
              {selectedToken && (
                <span className="text-xs text-muted-foreground">
                  {isBuy ? "Amount in BTC" : `${selectedToken.ticker} amount`}
                </span>
              )}
            </div>
            <div className="relative">
              <Input
                id="trade-amount"
                data-ocid="trading.amount.input"
                type="number"
                min="0"
                step={isBuy ? "0.001" : "100"}
                placeholder={isBuy ? "0.001" : "1000"}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pr-20 bg-muted/40 border-border text-base font-mono h-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                {isBuy ? "BTC" : (selectedToken?.ticker ?? "TOKEN")}
              </span>
            </div>

            {/* Quick preset buttons */}
            <div className="flex gap-1.5 mt-2">
              {isBuy
                ? BUY_PRESETS.map((p) => (
                    <button
                      type="button"
                      key={p.label}
                      onClick={() => setAmount(String(p.value))}
                      className={`flex-1 rounded-md border py-1.5 text-xs font-semibold transition-all ${
                        amount === String(p.value)
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                          : "border-border bg-muted/30 text-muted-foreground hover:border-emerald-500/50 hover:text-emerald-400"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))
                : SELL_PRESETS.map((p) => (
                    <button
                      type="button"
                      key={p.label}
                      onClick={() =>
                        setAmount(String(Math.round(21_000_000 * p.value)))
                      }
                      className={`flex-1 rounded-md border py-1.5 text-xs font-semibold transition-all ${
                        amount === String(Math.round(21_000_000 * p.value))
                          ? "border-red-500 bg-red-500/10 text-red-400"
                          : "border-border bg-muted/30 text-muted-foreground hover:border-red-500/50 hover:text-red-400"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
            </div>
          </div>

          {/* Slippage */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label
                htmlFor="trade-slippage"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Slippage Tolerance
              </Label>
              <span className="text-xs text-muted-foreground">
                Max price impact
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  id="trade-slippage"
                  data-ocid="trading.slippage.input"
                  type="number"
                  min="0"
                  max="50"
                  step="0.1"
                  value={slippage}
                  onChange={(e) => setSlippage(e.target.value)}
                  className="pr-8 bg-muted/40 border-border h-9"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                  %
                </span>
              </div>
              {["0.5", "1.0", "2.0"].map((v) => (
                <button
                  type="button"
                  key={v}
                  onClick={() => setSlippage(v)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-semibold h-9 transition-all ${
                    slippage === v
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {v}%
                </button>
              ))}
            </div>
          </div>

          {/* Estimated output */}
          {estimatedOutput && (
            <div className="rounded-lg bg-muted/30 border border-border px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">You receive</span>
              <span className="text-sm font-mono font-semibold text-foreground">
                {estimatedOutput}
              </span>
            </div>
          )}

          {/* CTA */}
          {!principal ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 opacity-60">
              <Wallet className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground font-medium">
                Wallet connect coming soon
              </p>
              <p className="text-xs text-muted-foreground/70">
                Connect your wallet to execute trades
              </p>
            </div>
          ) : (
            <Button
              type="button"
              data-ocid="trading.place_order.primary_button"
              className={`w-full h-12 text-base font-bold transition-all shadow-sm ${
                isBuy
                  ? "bg-emerald-500 hover:bg-emerald-400 text-white"
                  : "bg-red-500 hover:bg-red-400 text-white"
              }`}
              disabled={!selectedToken || !amount || addTradeLog.isPending}
              onClick={handlePlaceOrder}
            >
              {addTradeLog.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Placing order…
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
    </div>
  );
}
