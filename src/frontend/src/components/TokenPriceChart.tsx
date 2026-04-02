import { useEffect, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ODIN_PRICE_DIVISOR } from "../lib/odinApi";

export interface OdinCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

type Interval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

const INTERVALS: { label: string; value: Interval }[] = [
  { label: "1m", value: "1m" },
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "1H", value: "1h" },
  { label: "4H", value: "4h" },
  { label: "1D", value: "1d" },
];

async function fetchCandles(
  tokenId: string,
  interval: Interval,
): Promise<OdinCandle[]> {
  try {
    const res = await fetch(
      `https://api.odin.fun/v1/tokens/${tokenId}/candles?interval=${interval}`,
    );
    if (!res.ok) return [];
    const json = await res.json();
    const data: OdinCandle[] = (json.data ?? json ?? []).map(
      (c: OdinCandle) => ({
        time: c.time,
        open: c.open / ODIN_PRICE_DIVISOR,
        high: c.high / ODIN_PRICE_DIVISOR,
        low: c.low / ODIN_PRICE_DIVISOR,
        close: c.close / ODIN_PRICE_DIVISOR,
        volume: c.volume,
      }),
    );
    return data;
  } catch {
    return [];
  }
}

function generateFallbackCandles(
  currentPrice: number,
  count = 60,
): OdinCandle[] {
  const now = Math.floor(Date.now() / 1000);
  const interval = 3600; // 1h
  const candles: OdinCandle[] = [];
  let price = currentPrice * 0.85;
  for (let i = count; i >= 0; i--) {
    const volatility = price * 0.03;
    const open = price;
    const close = price + (Math.random() - 0.48) * volatility;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;
    candles.push({
      time: now - i * interval,
      open: Math.max(0.0001, open),
      high: Math.max(0.0001, high),
      low: Math.max(0.0001, low),
      close: Math.max(0.0001, close),
    });
    price = close;
  }
  return candles;
}

interface TokenPriceChartProps {
  tokenId: string;
  currentPrice: number;
}

export function TokenPriceChart({
  tokenId,
  currentPrice,
}: TokenPriceChartProps) {
  const [interval, setIntervalVal] = useState<Interval>("1h");
  const [loading, setLoading] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [candles, setCandles] = useState<OdinCandle[]>([]);

  useEffect(() => {
    setLoading(true);
    setUsingFallback(false);
    fetchCandles(tokenId, interval).then((data) => {
      if (data.length > 0) {
        setCandles([...data].sort((a, b) => a.time - b.time));
      } else {
        setUsingFallback(true);
        setCandles(generateFallbackCandles(currentPrice / ODIN_PRICE_DIVISOR));
      }
      setLoading(false);
    });
  }, [tokenId, interval, currentPrice]);

  // Build chart data for recharts
  const chartData = candles.map((c) => {
    const isUp = c.close >= c.open;
    const rangeMin = c.low;
    const rangeMax = c.high;
    const bodyLow = Math.min(c.open, c.close);
    const bodyHigh = Math.max(c.open, c.close);
    const label = new Date(c.time * 1000).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    return {
      ...c,
      isUp,
      rangeMin,
      rangeMax,
      bodyLow,
      bodyHigh,
      label,
      // for stacked bar: bottom filler, body, top filler
      wickBottom: rangeMin,
      bodyBottom: bodyLow,
      bodyHeight: bodyHigh - bodyLow,
      wickTop: bodyHigh,
      wickTopHeight: rangeMax - bodyHigh,
    };
  });

  const allPrices = candles.flatMap((c) => [c.low, c.high]);
  const minPrice = allPrices.length ? Math.min(...allPrices) : 0;
  const maxPrice = allPrices.length ? Math.max(...allPrices) : 1;
  const padding = (maxPrice - minPrice) * 0.05;

  const formatPrice = (v: number) =>
    v < 0.001 ? v.toExponential(2) : v < 1 ? v.toFixed(6) : v.toFixed(2);

  return (
    <div className="space-y-2">
      {/* Timeframe selector */}
      <div className="flex items-center gap-1">
        {INTERVALS.map((iv) => (
          <button
            type="button"
            key={iv.value}
            onClick={() => setIntervalVal(iv.value)}
            className={[
              "rounded px-2.5 py-1 text-xs font-semibold transition-all",
              interval === iv.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
            ].join(" ")}
          >
            {iv.label}
          </button>
        ))}
        {usingFallback && (
          <span className="ml-auto text-[10px] text-amber-400/70 italic">
            Simulated data
          </span>
        )}
        {loading && (
          <span className="ml-auto text-[10px] text-muted-foreground">
            Loading…
          </span>
        )}
      </div>

      {/* Chart */}
      <div className="w-full h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 4, right: 4, bottom: 4, left: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.05)"
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              domain={[minPrice - padding, maxPrice + padding]}
              tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatPrice}
              width={56}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]?.payload) return null;
                const d = payload[0].payload as OdinCandle & { label: string };
                const up = d.close >= d.open;
                return (
                  <div className="bg-card border border-border rounded p-2 text-xs space-y-0.5">
                    <p className="text-muted-foreground">{d.label}</p>
                    <p className={up ? "text-green-400" : "text-red-400"}>
                      O: {formatPrice(d.open)} H: {formatPrice(d.high)}
                    </p>
                    <p className={up ? "text-green-400" : "text-red-400"}>
                      L: {formatPrice(d.low)} C: {formatPrice(d.close)}
                    </p>
                  </div>
                );
              }}
            />
            {/* Render each candle as a custom shape via Bar */}
            <Bar
              dataKey="bodyHeight"
              shape={(props: unknown) => {
                const p = props as any;
                const payload = p.payload as OdinCandle & {
                  isUp: boolean;
                  bodyLow: number;
                  bodyHigh: number;
                };
                if (!payload) return <g />;
                const isUp = payload.close >= payload.open;
                const color = isUp ? "#22c55e" : "#ef4444";
                const { x, y, width, height } = p;

                // We need to also draw the wick using the yAxis scale
                // The Bar renders the body rect; we draw the wick relative
                const bodyTop = y;
                const bodyBot = y + Math.max(1, height);
                const midX = x + width / 2;

                return (
                  <g>
                    <line
                      x1={midX}
                      x2={midX}
                      y1={bodyTop - 2}
                      y2={bodyBot + 2}
                      stroke={color}
                      strokeWidth={1}
                    />
                    <rect
                      x={x + 1}
                      y={bodyTop}
                      width={Math.max(1, width - 2)}
                      height={Math.max(1, height)}
                      fill={color}
                    />
                  </g>
                );
              }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
