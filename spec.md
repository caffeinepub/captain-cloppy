# Captain Cloppy - Profile Page

## Current State
- App has: Dashboard, Trading, Explorer, Bot, History pages
- NavPage type = "dashboard" | "trading" | "explorer" | "bot" | "history"
- No Profile/Wallet detail page exists
- odinApi.ts has: getUserTrades, getUserBalances, getTokens, formatBtcWithUsd, formatMcapAsUsd, formatTokenAmount, etc.
- BTC price fetched via fetchBtcUsd() and useBtcPrice hook
- Auth: useSiwbAuth returns principal (string | null)

## Requested Changes (Diff)

### Add
- New page: `ProfilePage` component (`src/frontend/src/components/ProfilePage.tsx`)
- New nav item: "Profile" (User icon) in Sidebar and bottom nav
- NavPage type extended to include "profile"
- Sections in ProfilePage:
  1. **Identity Header** — avatar (initials), username, principal ID (truncated, copyable), Member Since (first trade date)
  2. **Financial Overview** — Total Balance (BTC + USD), Total Portfolio Value of all token holdings
  3. **PnL Stats** — Realized PnL (from sells), Unrealized PnL (current holdings vs avg buy price), ROI %, Win Rate %
  4. **Trading Stats Cards** — Total Trades, Buys vs Sells count, Average Trade Size, Most Traded Token, Biggest Win, Biggest Loss
  5. **Portfolio Breakdown** — Donut/pie chart of token holdings (using recharts/chart.tsx), + table with rank, token logo, ticker, balance, % of portfolio
  6. **Top Holdings** — Top 5 tokens by value (BTC + USD)
  7. **Activity Heatmap** — GitHub-style contribution heatmap (last 52 weeks of trading activity by day)
  8. **Trade History** — Paginated list of personal trades (reuse card layout from HistoryPage), with filter by buy/sell and token search
  9. **Volume Stats** — Total volume traded (BTC + USD), all time
  10. **Leaderboard Rank** — Estimated rank by total volume among all Odin traders (fetched from global trades)
- Profile page is accessible from sidebar and bottom nav
- If no wallet connected: show "Wallet connect coming soon" placeholder
- All data fetched from Odin.fun REST API using existing principal from useSiwbAuth

### Modify
- `App.tsx` — add `profile` to NavPage type, add ProfilePage component, add to page routing and PAGE_TITLES
- `Sidebar.tsx` — add Profile nav item (User icon)
- Bottom nav in `App.tsx` — add Profile nav item

### Remove
- Nothing removed

## Implementation Plan
1. Create `ProfilePage.tsx` with all sections listed above
2. Add API helper in odinApi.ts: `getUserProfile(principal)` to fetch user detail (username, created_time) from `/user/{principal}` endpoint
3. Update NavPage type in Sidebar.tsx
4. Update App.tsx routing, PAGE_TITLES, BOTTOM_NAV_ITEMS, and render ProfilePage
5. Wire up: principal from useSiwbAuth, btcUsd from useBtcPrice, trades/balances from odinApi
6. PnL calculation: group trades by token, match buys to sells FIFO, compute realized PnL; unrealized = (current price - avg buy price) * held amount
7. Activity heatmap: build from trade timestamps over last 52 weeks
8. Portfolio donut chart: use existing recharts via chart.tsx
