# Captain Cloppy

## Current State
Full-stack trading dashboard app for Odin.fun with:
- Dashboard (ODIN•FUN Stats, Large Transactions, Hot Tokens, Mini Global Feed)
- Trading page (Jupiter-style: Market/Limit/Recurring tabs, inline chart, AMM formula, swap fees, BTC↔Token two-way input)
- Token Explorer (sortable, paginated, 24h % change)
- History page (Global Feed card list, User Trades card list)
- Profile page (Identity Header, Financial Summary, PnL, Trading Stats, Portfolio Breakdown donut chart, Activity Heatmap, Trade History)
- Token Detail Modal (Chart, Overview, Feed, Holders tabs)
- Sidebar with Captain Cloppy branding (black area, pirate logo, ODIN•FUN subtitle)
- Connect OKX button in header (logo + text, no box)
- Bonded tokens show blue checkmark
- All usernames blue and clickable for profile view
- Ticker text white
- Mobile-first vertical card lists for feeds
- PnL via FIFO logic from trade history
- AMM constant product formula + 1% swap fee

## Requested Changes (Diff)

### Add
- Nothing new

### Modify
- Full rebuild/redeploy of all existing functionality (no code changes, just republish)

### Remove
- Nothing

## Implementation Plan
1. Deploy the existing codebase as-is
