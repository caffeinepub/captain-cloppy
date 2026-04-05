# Captain Cloppy - Strategy Lab

## Current State
The app has a 'Bot Automation' (BotPage.tsx) page with basic strategy CRUD (create/edit/delete/toggle). It connects to backend hooks for strategies. Navigation in Sidebar and App.tsx references the 'bot' page.

## Requested Changes (Diff)

### Add
- New `StrategyLabPage.tsx` component replacing BotPage.tsx
- Backtest Simulator: user picks a token, entry price, strategy type (BUY dip / SELL pump / DCA), date range, and runs a simulated backtest using historical candle data from Odin.fun API
- Paper Trading Tracker: list of simulated open positions (stored in localStorage), showing entry price, current price, P&L
- Strategy Builder: UI to configure conditions (price target %, stop loss %, DCA interval) and save strategies locally

### Modify
- Sidebar.tsx: rename 'Bot' label to 'Strategy Lab', change icon from Bot to FlaskConical
- App.tsx: rename page title from 'Bot Automation' to 'Strategy Lab', update subtitle to 'Backtest & simulate trading strategies'
- Replace `<BotPage />` render with `<StrategyLabPage />`

### Remove
- BotPage.tsx is effectively replaced (keep file to avoid breaking imports, but StrategyLabPage is what renders)

## Implementation Plan
1. Create `StrategyLabPage.tsx` with 3 tabs: Backtest, Paper Trading, Strategy Builder
2. Backtest tab: token selector (search by ticker from API), entry/exit conditions form, date range, fetch candles from Odin API, simulate trades, show results (total return %, trades executed, win rate, max drawdown)
3. Paper Trading tab: add simulated position (token, amount, entry price), list open positions with current price fetched live, show P&L per position and total, store in localStorage
4. Strategy Builder tab: form to configure strategy (name, token, buy condition, sell condition, stop loss, DCA settings), save list to localStorage, show saved strategies
5. Update Sidebar.tsx: icon FlaskConical, label 'Strategy Lab'
6. Update App.tsx: title 'Strategy Lab', subtitle 'Backtest & simulate strategies', import StrategyLabPage
