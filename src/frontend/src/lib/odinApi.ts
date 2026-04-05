const BASE_URL = "https://api.odin.fun/v1";
// ─── Token ticker cache ──────────────────────────────────────────────────────
// Cache maps tokenId → ticker string to avoid redundant fetches
const _tickerCache: Map<string, string> = new Map();

/**
 * Fetch ticker for a token ID, using cache.
 * Uses /tokens/{id} endpoint and extracts the ticker field.
 */
async function fetchTickerForId(tokenId: string): Promise<string | null> {
  if (!tokenId) return null;
  if (_tickerCache.has(tokenId)) return _tickerCache.get(tokenId)!;
  try {
    const res = await fetch(
      `${BASE_URL}/tokens/${encodeURIComponent(tokenId)}`,
    );
    if (res.ok) {
      const json = await res.json();
      const t = json.data ?? json;
      const ticker: string | undefined = t?.ticker;
      if (ticker) {
        _tickerCache.set(tokenId, ticker);
        return ticker;
      }
    }
    // fallback legacy endpoint
    const res2 = await fetch(
      `${BASE_URL}/token/${encodeURIComponent(tokenId)}`,
    );
    if (res2.ok) {
      const json2 = await res2.json();
      const t2 = json2.data ?? json2;
      const ticker2: string | undefined = t2?.ticker;
      if (ticker2) {
        _tickerCache.set(tokenId, ticker2);
        return ticker2;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Enrich a list of trades with token tickers.
 * For trades where token_ticker is not present, batch-fetches token detail.
 */
async function enrichTradesWithTickers(
  trades: OdinTrade[],
): Promise<OdinTrade[]> {
  // Collect unique token IDs that are missing a ticker
  const missingIds = [
    ...new Set(
      trades
        .filter((t) => !t.token_ticker && t.token_id)
        .map((t) => t.token_id as string)
        .filter(Boolean),
    ),
  ];

  if (missingIds.length > 0) {
    // Fetch all missing tickers in parallel (with concurrency limit of 5)
    const CONCURRENCY = 5;
    for (let i = 0; i < missingIds.length; i += CONCURRENCY) {
      const batch = missingIds.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map((id) => fetchTickerForId(id)));
    }
  }

  return trades.map((t) => {
    if (t.token_ticker) return t;
    const id = t.token_id;
    if (id && _tickerCache.has(id)) {
      return { ...t, token_ticker: _tickerCache.get(id) };
    }
    return t;
  });
}

export interface OdinToken {
  id: string;
  name: string;
  ticker: string;
  price: number;
  image?: string;
  marketcap?: number;
  volume?: number;
  bonded?: boolean;
  price_1d?: number;
  holder_count?: number;
  progress?: number;
  created_time?: string;
  supply?: number;
  twitter?: string;
  website?: string;
  telegram?: string;
  description?: string;
}

export interface OdinBalance {
  id: string;
  ticker: string;
  name: string;
  balance: number;
  type: string;
}

export interface OdinTrade {
  id: string;
  user: string;
  token: string;
  /** token_id is the raw token identifier used for API lookups */
  token_id?: string;
  /** token_ticker is the display ticker (e.g. "PEPE"), if returned by API */
  token_ticker?: string;
  time: string | number;
  buy: boolean;
  amount_btc: number;
  amount_token: number;
  price: number;
  bonded: boolean;
  user_username?: string;
  /** receiver principal if it's a transfer/send */
  receiver?: string;
  /** sender principal if it's a receive */
  sender?: string;
  /** trade type: buy/sell/transfer */
  trade_type?: string;
}

export interface OdinTradesResponse {
  data: OdinTrade[];
  count: number;
}

export interface OdinTokensParams {
  page?: number;
  limit?: number;
  sort?: string;
  bonded?: boolean;
  search?: string;
}

export interface OdinTokensResponse {
  data: OdinToken[];
  count: number;
}

export async function searchTokens(query: string): Promise<OdinToken[]> {
  if (!query.trim()) return [];
  const res = await fetch(
    `${BASE_URL}/tokens?search=${encodeURIComponent(query)}&limit=20&sort=market_cap:desc`,
  );
  if (!res.ok) throw new Error("Failed to fetch tokens");
  const json = await res.json();
  const data: OdinToken[] = json.data ?? [];
  // Sort by market_cap descending (highest first)
  return data.sort((a, b) => (b.marketcap ?? 0) - (a.marketcap ?? 0));
}

export async function getTokens(
  params: OdinTokensParams = {},
): Promise<OdinTokensResponse> {
  const qs = new URLSearchParams();
  if (params.page !== undefined) qs.set("page", String(params.page));
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  if (params.sort) qs.set("sort", params.sort);
  if (params.bonded !== undefined) qs.set("bonded", String(params.bonded));
  if (params.search) qs.set("search", params.search);
  const res = await fetch(`${BASE_URL}/tokens?${qs.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch tokens");
  const json = await res.json();
  return { data: json.data ?? [], count: json.count ?? 0 };
}

export async function getGlobalTrades(
  page = 1,
  limit = 20,
): Promise<OdinTradesResponse> {
  const res = await fetch(
    `${BASE_URL}/trades?limit=${limit}&page=${page}&sort=time:desc`,
  );
  if (!res.ok) throw new Error("Failed to fetch global trades");
  const json = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: OdinTrade[] = (json.data ?? []).map(
    (t: any) =>
      ({
        ...t,
        token_id: t.token_id ?? t.token,
        token_ticker: t.token_ticker ?? t.token_name ?? t.ticker ?? undefined,
        receiver: t.receiver ?? t.to ?? undefined,
        sender: t.sender ?? t.from ?? undefined,
        trade_type: t.trade_type ?? t.type ?? undefined,
      }) as OdinTrade,
  );
  const data = await enrichTradesWithTickers(raw);
  return { data, count: json.count ?? 0 };
}

export async function getTokenDetail(
  tokenId: string,
): Promise<OdinToken | null> {
  if (!tokenId.trim()) return null;
  const res = await fetch(`${BASE_URL}/token/${encodeURIComponent(tokenId)}`);
  if (!res.ok) return null;
  const json = await res.json();
  return json.data ?? null;
}

export async function getUserBalances(
  principal: string,
): Promise<OdinBalance[]> {
  if (!principal.trim()) return [];
  const res = await fetch(
    `${BASE_URL}/user/${encodeURIComponent(principal)}/balances`,
  );
  if (!res.ok) throw new Error("Failed to fetch balances");
  const json = await res.json();
  return json.data ?? [];
}

export async function getUserTrades(
  principal: string,
  page = 1,
  limit = 20,
): Promise<OdinTradesResponse> {
  if (!principal.trim()) return { data: [], count: 0 };
  const res = await fetch(
    `${BASE_URL}/trades?user=${encodeURIComponent(principal)}&limit=${limit}&page=${page}`,
  );
  if (!res.ok) throw new Error("Failed to fetch trades");
  const json = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: OdinTrade[] = (json.data ?? []).map(
    (t: any) =>
      ({
        ...t,
        token_id: t.token_id ?? t.token,
        token_ticker: t.token_ticker ?? t.token_name ?? t.ticker ?? undefined,
        receiver: t.receiver ?? t.to ?? undefined,
        sender: t.sender ?? t.from ?? undefined,
        trade_type: t.trade_type ?? t.type ?? undefined,
      }) as OdinTrade,
  );
  const data = await enrichTradesWithTickers(raw);
  return { data, count: json.count ?? 0 };
}

export async function getToken(tokenId: string): Promise<OdinToken | null> {
  if (!tokenId.trim()) return null;
  // Try canonical /tokens/{id} endpoint first
  const res = await fetch(`${BASE_URL}/tokens/${encodeURIComponent(tokenId)}`);
  if (res.ok) {
    const json = await res.json();
    const t = json.data ?? json;
    if (t?.id) return t as OdinToken;
  }
  // Fallback to legacy /token/{id}
  const res2 = await fetch(`${BASE_URL}/token/${encodeURIComponent(tokenId)}`);
  if (!res2.ok) return null;
  const json2 = await res2.json();
  return json2.data ?? json2 ?? null;
}

// ─── BTC price fetching ─────────────────────────────────────────────────────

// Fallback sats per BTC (1 BTC = 100,000,000 sats)
export const SATS_PER_BTC_FALLBACK = 100_000_000;

let _cachedBtcUsd: number | null = null;
let _lastFetchTime = 0;
const CACHE_DURATION_MS = 60_000; // refresh every 60 seconds

export async function fetchBtcUsd(): Promise<number | null> {
  const now = Date.now();
  if (_cachedBtcUsd != null && now - _lastFetchTime < CACHE_DURATION_MS) {
    return _cachedBtcUsd;
  }
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
      { headers: { Accept: "application/json" } },
    );
    if (res.ok) {
      const json = await res.json();
      const usdPrice: number = json?.bitcoin?.usd;
      if (usdPrice && usdPrice > 0) {
        _cachedBtcUsd = usdPrice;
        _lastFetchTime = now;
        return _cachedBtcUsd;
      }
    }
  } catch {
    // ignore, use cached
  }
  return _cachedBtcUsd;
}

export const SATS_PER_BTC = 100_000_000;

/**
 * Odin API stores token `price` and `marketcap` in milli-satoshi units (1/1000 sat).
 * Divide by 1000 to get the real satoshi value for display.
 */
export const ODIN_PRICE_DIVISOR = 1_000;

/**
 * Odin API stores `amount_token` as integer where raw ÷ 100,000,000,000 = display amount.
 * Total supply raw = 2,100,000,000,000,000,000 ÷ 100,000,000,000 = 21,000,000.
 * Verified: raw ~1,870,000,000,000,000 ÷ 100,000,000,000 ≈ 18,700 (matches odin.fun 18.7K)
 * Previous incorrect divisor was 1,000,000,000 (1 Billion) which gave 1.87M instead of 18.7K.
 */
export const ODIN_TOKEN_AMOUNT_DIVISOR = 100_000_000_000;

/** Format a satoshi value for display */
export function formatSats(sats: number): string {
  if (sats === 0) return "0 sats";
  if (sats < 1) {
    return `${sats.toFixed(4)} sats`;
  }
  if (sats >= 1_000_000_000) {
    return `${(sats / 1_000_000_000).toFixed(4)}B sats`;
  }
  if (sats >= 1_000_000) {
    return `${(sats / 1_000_000).toFixed(4)}M sats`;
  }
  if (sats >= 1_000) {
    return `${(sats / 1_000).toFixed(2)}K sats`;
  }
  return `${sats.toFixed(2)} sats`;
}

/** Format BTC balance (in raw satoshis from balance API) as sats. */
export function formatBtcAsSats(odinBtcValue: number): string {
  const sats = odinBtcValue;
  if (sats >= 1_000_000_000) {
    return `${(sats / 1_000_000_000).toFixed(4)}B sats`;
  }
  if (sats >= 1_000_000) {
    return `${(sats / 1_000_000).toFixed(2)}M sats`;
  }
  if (sats >= 1_000) {
    return `${(sats / 1_000).toFixed(2)}K sats`;
  }
  return `${sats.toFixed(0)} sats`;
}

/**
 * Format trade BTC amount as BTC with USD equivalent.
 * Odin API `amount_btc` is in milli-satoshi (1/1000 sat).
 * Divide by 1000 to get sats, then by 100,000,000 to get BTC.
 * Example: raw 712,758,000 msats → 712,758 sats → 0.00712758 BTC
 * btcUsd: current BTC price in USD (from useBtcPrice hook).
 */
export function formatBtcWithUsd(
  odinBtcValue: number | undefined | null,
  btcUsd: number | null,
): string {
  // Guard against null/undefined/NaN
  const rawVal = odinBtcValue ?? 0;
  if (!Number.isFinite(rawVal) || rawVal <= 0) {
    return btcUsd != null && btcUsd > 0
      ? "0.00000000 BTC ($0.00)"
      : "0.00000000 BTC";
  }

  // amount_btc from Odin trades is in milli-satoshi; divide by 1000 to get sats
  const sats = rawVal / 1_000;
  const btc = sats / SATS_PER_BTC;

  // Format BTC value
  let btcStr: string;
  if (btc >= 1) {
    btcStr = `${btc.toFixed(4)} BTC`;
  } else if (btc >= 0.001) {
    btcStr = `${btc.toFixed(6)} BTC`;
  } else if (btc >= 0.000001) {
    btcStr = `${btc.toFixed(8)} BTC`;
  } else {
    btcStr = `${btc.toFixed(10)} BTC`;
  }

  if (btcUsd != null && btcUsd > 0) {
    const usd = btc * btcUsd;
    let usdStr: string;
    if (usd >= 1_000_000) {
      usdStr = `$${(usd / 1_000_000).toFixed(2)}M`;
    } else if (usd >= 1_000) {
      usdStr = `$${(usd / 1_000).toFixed(2)}K`;
    } else if (usd >= 1) {
      usdStr = `$${usd.toFixed(2)}`;
    } else if (usd >= 0.01) {
      usdStr = `$${usd.toFixed(4)}`;
    } else {
      usdStr = `$${usd.toFixed(6)}`;
    }
    return `${btcStr} (${usdStr})`;
  }
  return btcStr;
}

/**
 * Format USD value directly from milli-satoshi BTC amount.
 * Used for showing dollar value standalone (no BTC prefix).
 */
export function formatUsdFromMsats(
  msats: number | undefined | null,
  btcUsd: number | null,
): string {
  const rawVal = msats ?? 0;
  if (!Number.isFinite(rawVal) || !btcUsd || btcUsd <= 0) return "$0.00";
  const sats = rawVal / 1_000;
  const btc = sats / SATS_PER_BTC;
  const usd = btc * btcUsd;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(2)}K`;
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(6)}`;
}

/** Format token price in sats (price per token).
 * Odin token `price` field is in milli-satoshi (1/1000 sat), so divide by 1000. */
export function formatPriceAsSats(price: number | undefined | null): string {
  const p = price ?? 0;
  if (!Number.isFinite(p) || p <= 0) return "0 sats";
  const sats = p / ODIN_PRICE_DIVISOR;
  if (sats === 0) return "0 sats";
  if (sats < 0.0001) return `${sats.toFixed(8)} sats`;
  if (sats < 0.01) return `${sats.toFixed(6)} sats`;
  if (sats < 1) return `${sats.toFixed(4)} sats`;
  if (sats < 1_000) return `${sats.toFixed(2)} sats`;
  if (sats >= 1_000_000_000)
    return `${(sats / 1_000_000_000).toFixed(4)}B sats`;
  if (sats >= 1_000_000) return `${(sats / 1_000_000).toFixed(4)}M sats`;
  return `${(sats / 1_000).toFixed(2)}K sats`;
}

/**
 * Format market cap in USD.
 * Odin `marketcap` field is in milli-satoshi units.
 * Convert: msats / 1000 = sats / 100,000,000 = BTC * btcUsd = USD
 */
export function formatMcapAsUsd(
  mcap: number | undefined | null,
  btcUsd: number | null,
): string {
  const m = mcap ?? 0;
  if (!Number.isFinite(m) || m <= 0) return "$0";
  if (!btcUsd || btcUsd <= 0) {
    // Fallback: show in sats
    return formatMcapAsSats(m);
  }
  const sats = m / ODIN_PRICE_DIVISOR;
  const btc = sats / SATS_PER_BTC;
  const usd = btc * btcUsd;
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(2)}B`;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(2)}K`;
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  return `$${usd.toFixed(4)}`;
}

/**
 * Format volume in USD.
 * Odin `volume` field is in milli-satoshi units.
 */
export function formatVolumeAsUsd(
  volume: number | undefined | null,
  btcUsd: number | null,
): string {
  const v = volume ?? 0;
  if (!Number.isFinite(v) || v <= 0) return "$0";
  if (!btcUsd || btcUsd <= 0) {
    return formatMcapAsSats(v);
  }
  const sats = v / ODIN_PRICE_DIVISOR;
  const btc = sats / SATS_PER_BTC;
  const usd = btc * btcUsd;
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(2)}B`;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(2)}K`;
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  return `$${usd.toFixed(4)}`;
}

/** Format market cap in sats (kept for fallback). */
export function formatMcapAsSats(mcap: number): string {
  const sats = mcap / ODIN_PRICE_DIVISOR;
  if (sats >= 1_000_000_000_000)
    return `${(sats / 1_000_000_000_000).toFixed(2)}T sats`;
  if (sats >= 1_000_000_000)
    return `${(sats / 1_000_000_000).toFixed(2)}B sats`;
  if (sats >= 1_000_000) return `${(sats / 1_000_000).toFixed(2)}M sats`;
  if (sats >= 1_000) return `${(sats / 1_000).toFixed(2)}K sats`;
  return `${sats.toFixed(2)} sats`;
}

/**
 * Format token amount from raw API value to human-readable.
 * Odin stores amount_token where raw ÷ 100,000,000,000 = display amount.
 * Verified: raw ~1,870,000,000,000,000 ÷ 100,000,000,000 ≈ 18,700 (matches odin.fun 18.7K display)
 * Total supply raw = 2,100,000,000,000,000,000 ÷ 100,000,000,000 = 21,000,000.
 */
export function formatTokenAmount(
  rawAmount: number | undefined | null,
): string {
  const raw = rawAmount ?? 0;
  if (!Number.isFinite(raw) || raw <= 0) return "0";
  const amount = raw / ODIN_TOKEN_AMOUNT_DIVISOR;
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(2)}K`;
  if (amount < 1 && amount > 0) return amount.toFixed(4);
  return amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

// Legacy helpers kept for backward compat
export function satsToBtc(sats: number): number {
  return sats / 100_000_000;
}

export function formatBtc(sats: number): string {
  return formatBtcAsSats(sats);
}

export function formatPrice(price: number): string {
  return formatPriceAsSats(price);
}

/**
 * Parse Odin.fun timestamps to Date.
 * The API may return:
 * - Nanosecond timestamps (int in string or number, e.g. 1710000000000000000)
 * - ISO 8601 strings (e.g. "2024-03-10T12:34:56Z")
 * - Millisecond timestamps (number > 1e12 but < 1e16)
 * - Second timestamps (number < 1e12)
 */
export function parseOdinDate(raw: string | number | bigint): Date {
  if (typeof raw === "bigint") {
    // Nanoseconds as bigint
    return new Date(Number(raw / 1_000_000n));
  }

  if (typeof raw === "string") {
    // ISO 8601 string — try direct parse first
    const direct = new Date(raw);
    if (!Number.isNaN(direct.getTime())) return direct;

    // Maybe it's a numeric string
    const num = Number(raw);
    if (!Number.isNaN(num)) {
      return parseOdinDate(num);
    }
    return new Date(Number.NaN);
  }

  // raw is a number
  const n = raw as number;
  if (n > 1e18) {
    // Nanoseconds
    return new Date(Math.round(n / 1_000_000));
  }
  if (n > 1e15) {
    // Microseconds
    return new Date(Math.round(n / 1_000));
  }
  if (n > 1e12) {
    // Milliseconds
    return new Date(n);
  }
  // Seconds
  return new Date(n * 1000);
}

export function formatDate(dateStr: string | number | bigint): string {
  const d = parseOdinDate(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Format price delta (price_1d etc) for display.
 * price_1d from Odin is a delta in milli-sats. */
export function formatPriceDelta(delta: number): string {
  if (delta === 0) return "0%";
  const satsAbs = Math.abs(delta) / ODIN_PRICE_DIVISOR;
  const formatted = formatSats(satsAbs);
  return delta > 0 ? `+${formatted}` : `-${formatted}`;
}

export function getTokenImageUrl(tokenId?: string): string | undefined {
  if (!tokenId) return undefined;
  return `https://api.odin.fun/v1/token/${tokenId}/image`;
}

/** Format price delta as percentage for display.
 * price_1d is the delta in milli-sats, currentPrice is the current price in milli-sats.
 * Calculates: (price_1d / (currentPrice - price_1d)) * 100 */
export function formatPriceDeltaPercent(
  delta: number,
  currentPrice: number,
): string {
  if (delta === 0) return "0.00%";
  const previousPrice = currentPrice - delta;
  if (previousPrice <= 0) return delta > 0 ? "+∞%" : "-100.00%";
  const pct = (delta / previousPrice) * 100;
  const abs = Math.abs(pct);
  const formatted = abs >= 100 ? abs.toFixed(1) : abs.toFixed(2);
  return delta > 0 ? `+${formatted}%` : `-${formatted}%`;
}
