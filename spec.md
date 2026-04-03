# Captain Cloppy

## Current State
Fully built Captain Cloppy trading dashboard app for Odin.fun traders. All core features are implemented:
- Sidebar with Captain Cloppy logo (user-supplied `/assets/20601_11zon...png`)
- Dashboard page with trending tokens and live data
- Token Explorer with sortable/searchable/paginated table, clickable tokens opening detail modals with candlestick charts
- History page with User Trades, Bot Logs, and Global Feed tabs
- Trading page and Bot management page
- Token detail modal with price chart, stats, bonded checkmark (blue Twitter-style SVG)
- All data from Odin.fun REST API (`https://api.odin.fun/v1/`)
- Token logos from `https://api.odin.fun/v1/token/{token_id}/image`
- Token prices displayed in sats, trade amounts in BTC+USD
- Market cap and volume in USD
- Token tickers displayed everywhere (with auto-fetch and cache)
- Correct token amount divisor (100,000,000,000) for 21M total supply
- Date/time formatting using parseOdinDate
- Wallet connect modal, BTC/USD ticker, and dashboard KPI banners (BTC Balance, Token Holdings, Active Bots, 24h Trades) already removed

## Requested Changes (Diff)

### Add
- Nothing new to add

### Modify
- Rebuild/redeploy the existing app as-is (draft expired)

### Remove
- Nothing to remove

## Implementation Plan
1. Validate and fix any TypeScript/lint errors in existing code
2. Build and deploy the current working state
