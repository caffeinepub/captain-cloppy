# Captain Cloppy

## Current State
Halaman Trading menggunakan kalkulasi linear sederhana `BTC ÷ price_per_token` untuk memperkirakan jumlah token yang diterima. Ini menghasilkan angka yang jauh berbeda dari Odin.fun karena Odin.fun menggunakan **AMM constant product bonding curve** (`x * y = k`).

Contoh perbedaan:
- 0.1 BTC → di Odin.fun: 8.5M token
- 0.1 BTC → di platform kita: 25,252,525 token (salah ~3x lebih besar)

## Requested Changes (Diff)

### Add
- State `tokenDetail` untuk menyimpan data detail token (btc_liquidity, token_liquidity) dari API `/v1/token/{id}`
- Fungsi AMM helper `calcAmmBuyTokens(btcIn, btcReserve, tokenReserve)` dan `calcAmmSellBtc(tokenIn, btcReserve, tokenReserve)` menggunakan formula constant product
- Fetch token detail saat token dipilih atau auto-loaded

### Modify
- `handleBtcAmountChange`: gunakan AMM formula jika btc_liquidity & token_liquidity tersedia, fallback ke linear jika tidak
- `handleTokenAmountChange`: gunakan AMM formula inverse jika data tersedia
- `priceImpact`: hitung menggunakan AMM (harga sebelum vs sesudah trade) bukan perkiraan market cap
- handleSelectToken: fetch detail token setelah select

### Remove
- Tidak ada yang dihapus

## Implementation Plan
1. Tambah state `tokenDetail` dengan `btc_liquidity` dan `token_liquidity`
2. Buat helper AMM:
   - BUY: `tokens_out = (token_liquidity_raw * btc_in_raw) / (btc_liquidity_raw + btc_in_raw)` — lalu bagi dengan TOKEN_DIVISOR
   - SELL: `btc_out = (btc_liquidity_raw * token_in_raw) / (token_liquidity_raw + token_in_raw)` — lalu bagi dengan SATS_PER_BTC
3. Fetch token detail (GET /v1/token/{id}) setelah auto-select dan handleSelectToken
4. Gunakan AMM helper di handleBtcAmountChange dan handleTokenAmountChange
5. Update price impact calculation berdasarkan harga sebelum dan sesudah AMM trade

## Notes
- `btc_liquidity` dari API adalah integer dalam milli-satoshi (bagi 1000 untuk sats, bagi lagi 100,000,000 untuk BTC)
- `token_liquidity` dari API adalah decimal dalam unit token raw (bagi 100,000,000,000 untuk display)
- TOKEN_DIVISOR = 100_000_000_000 (sesuai konvensi Odin.fun)
