import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowDownUp, Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { TradeStatus, TradeType } from "../backend";
import { useAddTradeLog } from "../hooks/useQueries";
import {
  type OdinToken,
  formatPriceAsSats,
  getTokenImageUrl,
  searchTokens,
} from "../lib/odinApi";

interface TradingPageProps {
  principal: string;
  onSetPrincipal: (p: string) => void;
  initialToken?: OdinToken;
}

export function TradingPage({
  principal,
  onSetPrincipal,
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
  const [tokenImgErrors, setTokenImgErrors] = useState<Record<string, boolean>>(
    {},
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addTradeLog = useAddTradeLog();
  const initialTokenRef = useRef(initialToken);

  // Sync if initialToken changes from parent (e.g. from explorer navigation)
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

  return (
    <div className="w-full max-w-xl space-y-0">
      <div className="rounded-xl border border-border bg-card p-4 md:p-6 shadow-card">
        <div className="flex items-center gap-2 mb-5 md:mb-6">
          <ArrowDownUp className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">
            Manual Trade
          </h2>
          <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
            Simulated
          </span>
        </div>

        {/* Token Search */}
        <div className="relative mb-4">
          <Label
            htmlFor="token-search"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Token
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="token-search"
              data-ocid="trading.search_input"
              placeholder="Search tokens…"
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
              className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg overflow-hidden"
              data-ocid="trading.token.dropdown_menu"
            >
              {tokens.map((token) => {
                const imgUrl = getTokenImageUrl(token.id);
                const hasImgError = tokenImgErrors[token.id];
                return (
                  <button
                    type="button"
                    key={token.id}
                    onClick={() => handleSelectToken(token)}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-sm hover:bg-muted/60 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 shrink-0 rounded-full overflow-hidden bg-gradient-to-br from-primary/30 to-primary/10 ring-1 ring-primary/20">
                        {imgUrl && !hasImgError ? (
                          <img
                            src={imgUrl}
                            alt={token.ticker}
                            className="h-full w-full rounded-full object-cover"
                            onError={() =>
                              setTokenImgErrors((prev) => ({
                                ...prev,
                                [token.id]: true,
                              }))
                            }
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[8px] font-bold text-primary">
                            {token.ticker.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span className="font-semibold text-foreground">
                        {token.ticker}
                      </span>
                      <span className="text-muted-foreground">
                        {token.name}
                      </span>
                    </div>
                    <span className="text-primary text-xs font-mono">
                      {formatPriceAsSats(token.price)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Token info */}
        {selectedToken && (
          <div className="mb-4 rounded-lg bg-primary/5 border border-primary/20 px-3 py-3 md:px-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {selectedToken.ticker}
              </p>
              <p className="text-xs text-muted-foreground">
                {selectedToken.name}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-mono font-semibold text-primary">
                {formatPriceAsSats(selectedToken.price)}
              </p>
              <p className="text-[11px] text-muted-foreground">sats/token</p>
            </div>
          </div>
        )}

        {/* Buy/Sell Toggle */}
        <div className="mb-4">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Side
          </span>
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              data-ocid="trading.buy.toggle"
              onClick={() => setTradeType("buy")}
              className={[
                "flex-1 py-2.5 md:py-2 text-sm font-semibold transition-all",
                tradeType === "buy"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/40 text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              Buy
            </button>
            <button
              type="button"
              data-ocid="trading.sell.toggle"
              onClick={() => setTradeType("sell")}
              className={[
                "flex-1 py-2.5 md:py-2 text-sm font-semibold transition-all",
                tradeType === "sell"
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-muted/40 text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              Sell
            </button>
          </div>
        </div>

        {/* Amount */}
        <div className="mb-4">
          <Label
            htmlFor="trade-amount"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {tradeType === "buy" ? "Amount (sats)" : "Token Amount"}
          </Label>
          <div className="relative">
            <Input
              id="trade-amount"
              data-ocid="trading.amount.input"
              type="number"
              min="0"
              step="1"
              placeholder={tradeType === "buy" ? "10000" : "1000"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pr-20 bg-muted/40 border-border"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
              {tradeType === "buy"
                ? "sats"
                : (selectedToken?.ticker ?? "TOKEN")}
            </span>
          </div>
        </div>

        {/* Slippage */}
        <div className="mb-5 md:mb-6">
          <Label
            htmlFor="trade-slippage"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Slippage Tolerance
          </Label>
          <div className="relative">
            <Input
              id="trade-slippage"
              data-ocid="trading.slippage.input"
              type="number"
              min="0"
              max="50"
              step="0.1"
              value={slippage}
              onChange={(e) => setSlippage(e.target.value)}
              className="pr-8 bg-muted/40 border-border"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
              %
            </span>
          </div>
        </div>

        {/* CTA */}
        {!principal ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground text-center">
              or enter your Principal ID
            </p>
            <div className="flex gap-2">
              <Input
                data-ocid="trading.principal.input"
                placeholder="Your principal ID"
                onKeyDown={(e) => {
                  if (e.key === "Enter")
                    onSetPrincipal((e.target as HTMLInputElement).value.trim());
                }}
                className="h-9 text-sm bg-muted/40 border-border"
              />
              <Button
                type="button"
                size="sm"
                className="shrink-0 bg-primary text-primary-foreground"
                onClick={(e) => {
                  const input = e.currentTarget
                    .previousElementSibling as HTMLInputElement;
                  if (input?.value?.trim()) onSetPrincipal(input.value.trim());
                }}
              >
                Set
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            data-ocid="trading.place_order.primary_button"
            className="w-full bg-gradient-to-r from-amber-400 to-amber-600 text-gray-900 font-semibold hover:from-amber-300 hover:to-amber-500 transition-all shadow-amber"
            disabled={!selectedToken || !amount || addTradeLog.isPending}
            onClick={handlePlaceOrder}
          >
            {addTradeLog.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Placing…
              </>
            ) : (
              `Simulate ${tradeType === "buy" ? "Buy" : "Sell"} Order`
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
