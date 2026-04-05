# Captain Cloppy

## Current State
Dashboard shows: Large Transactions, Hot Tokens grid, Mini Global Feed. No platform-wide stats section exists.

## Requested Changes (Diff)

### Add
- `PlatformStatsSection` component in `DashboardPage.tsx` that fetches `GET https://api.odin.fun/v1/statistics/dashboard` and displays:
  - 4 stat cards: Total Tokens, Bonded Tokens, Total Users, Total Liquidity (USD)
  - All-time Volume (USD) and 24h Volume (USD) as additional stats
  - A 30-day trading volume bar chart using `trades_30d` data (dates + volume in milli-sats converted to USD)
- This section is placed **between the Header and Large Transactions** (i.e., at the very top of the dashboard content)
- Auto-refresh every 60 seconds
- Skeleton loading states while data is being fetched

### Modify
- `DashboardPage.tsx`: add `PlatformStatsSection` at the top of the dashboard layout (above `LargeTransactionsFeed`)
- `odinApi.ts`: add `getStatsDashboard()` function that fetches and returns the statistics/dashboard data

### Remove
- Nothing removed

## Implementation Plan
1. Add `getStatsDashboard()` to `odinApi.ts` returning the full stats object (bonded, tokens, total_users, total_value_tokens, total_volume_24h, total_volume_all, value_liquidity, trades_30d, activities_30d)
2. Create `PlatformStatsSection` component inside `DashboardPage.tsx`:
   - Fetches stats on mount, refreshes every 60s
   - Shows 4 stat cards in a 2x2 grid (mobile) / 4-col row (desktop): Total Tokens, Bonded, Total Users, Total Liquidity USD
   - Shows All-time Volume and 24h Volume
   - Renders a simple 30-day bar chart using inline SVG or div bars (no extra chart library needed) showing daily volume in USD
   - All milli-sat values converted to USD using BTC price from `useBtcPrice`
3. Insert `<PlatformStatsSection />` at the top of the `DashboardPage` return JSX, above `LargeTransactionsFeed`
