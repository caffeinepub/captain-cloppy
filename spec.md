# Captain Cloppy

## Current State
Halaman Trading sudah memiliki Jupiter-style layout dengan chart, form buy/sell, dan recent trades. Token selector bisa search by ticker dengan dropdown.

## Requested Changes (Diff)

### Add
- (none)

### Modify
- **Bug fix: Token selector search** -- Saat user mengetik ticker lalu memilih token dari dropdown, `handleSelectToken` men-set `query` ke `token.ticker` yang memicu `useEffect` untuk jalankan `doSearch` lagi. Ini menyebabkan dropdown muncul kembali dan data yang ditampilkan tidak konsisten. Fix: setelah token dipilih, skip doSearch dengan flag atau dengan cara tidak trigger search saat query-nya sama persis dengan selectedToken.ticker.
- **Remove USD display di trade form** -- `tokenAmountUsd` ditampilkan di bawah input "You Receive" sebagai `~$X.XX`. User meminta ini dihapus dari area Trading.

### Remove
- USD display di bagian "You Receive" di trade form

## Implementation Plan
1. Tambahkan `skipNextSearch` ref boolean -- di `handleSelectToken`, set ref ini ke `true`. Di `useEffect` yang watch query, cek ref ini dan skip `doSearch` jika true, lalu reset ke false.
2. Hapus rendering `{tokenAmountUsd && isBuy && ...}` dari bagian bottom input di TradeForm.
