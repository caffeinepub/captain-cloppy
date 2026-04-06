# Captain Cloppy – Trading Page Jupiter-Style Upgrade

## Current State
The Trading page (`TradingPage.tsx`) is a basic 2-column layout:
- Left column: token search dropdown + token info card (price, market cap)
- Right column: Buy/Sell tabs, amount input, slippage settings, estimated output, CTA button
- Order types exist (Market, Limit, Recurring) but are not yet implemented in the UI
- No token price chart inline on trading page
- No recent trades feed for selected token
- No order book / depth view
- No price impact display
- No two-way synced input (BTC ↔ Token amount)

## Requested Changes (Diff)

### Add
- **Inline price chart** for the selected token (candlestick/line chart using real candle data from Odin API) displayed prominently in the trading layout (left side on desktop, top on mobile)
- **Market / Limit / Recurring order type tabs** above the Buy/Sell tabs — Market (immediate), Limit (set target price), Recurring (DCA interval)
- **Limit order fields**: target price input (shown only when Limit tab is active)
- **Recurring order fields**: interval selector and number of orders (shown only when Recurring tab is active)
- **Recent Trades panel** for the selected token — last 10-15 trades showing time, side (buy/sell), amount, price; pulled from Odin.fun trades API
- **Price Impact** indicator in the trade summary area (estimated % impact based on order size vs market cap/liquidity)
- **Two-way synced inputs**: entering BTC amount auto-calculates token amount and vice versa (two input fields visible simultaneously)
- **Token selector improvement**: show token logo, name, ticker, price, 24h change in the selector trigger button (not just a search box)

### Modify
- Layout changed to Jupiter-style:
  - **Desktop**: 3-column — [chart + recent trades on left, wide] | [trade form, right]
  - **Mobile**: stacked vertically — order type tabs → buy/sell → chart (collapsible) → form → recent trades
- Token info card expanded to include: price in sats, 24h % change, market cap, volume, holders
- Slippage settings moved to a small gear icon popover (not always visible)
- Estimated output display enhanced: show both token and USD equivalent
- Buy/Sell CTA button styled more prominently (full width, larger)

### Remove
- Old static token info card replaced by richer inline version
- Slippage inline section removed in favor of popover

## Implementation Plan
1. Restructure TradingPage layout to Jupiter-style 2-panel: left (chart + recent trades), right (order form)
2. Add order type tabs (Market / Limit / Recurring) with conditional fields for each
3. Integrate TokenPriceChart component inline for selected token using the existing chart logic
4. Add Recent Trades panel fetching from `GET https://api.odin.fun/v1/tokens/{id}/trades?limit=15`
5. Implement two-way input: BTC input auto-calculates token amount and vice versa using current price
6. Add Price Impact estimate calculation: `(orderSizeInBtc / totalLiquidityBtc) * 100`
7. Move slippage settings to a settings popover (gear icon)
8. Enhance token selector trigger button to show logo/ticker/price/change
9. Ensure full mobile responsiveness: stacked layout on small screens with collapsible chart
10. All text in English, no boxed numbers, usernames blue and clickable, tickers white
