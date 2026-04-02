import { useEffect, useRef, useState } from "react";

const SATS_PER_BTC = 100_000_000;

interface BtcPriceState {
  btcUsd: number | null;
  satsUsd: number | null; // how many USD per 1 sat
  lastUpdated: Date | null;
  loading: boolean;
}

// Global singleton state so all components share one fetch cycle
let globalListeners: Array<(state: BtcPriceState) => void> = [];
let globalState: BtcPriceState = {
  btcUsd: null,
  satsUsd: null,
  lastUpdated: null,
  loading: false,
};
let fetchInterval: ReturnType<typeof setInterval> | null = null;

async function doFetch() {
  globalState = { ...globalState, loading: true };
  notifyAll();
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
      { headers: { Accept: "application/json" } },
    );
    if (res.ok) {
      const json = await res.json();
      const btcUsd: number = json?.bitcoin?.usd;
      if (btcUsd && btcUsd > 0) {
        globalState = {
          btcUsd,
          satsUsd: btcUsd / SATS_PER_BTC,
          lastUpdated: new Date(),
          loading: false,
        };
        notifyAll();
        return;
      }
    }
  } catch {
    // ignore
  }
  globalState = { ...globalState, loading: false };
  notifyAll();
}

function notifyAll() {
  for (const listener of globalListeners) listener(globalState);
}

function subscribe(listener: (state: BtcPriceState) => void) {
  globalListeners.push(listener);
  if (globalListeners.length === 1) {
    // First subscriber: start polling
    doFetch();
    fetchInterval = setInterval(doFetch, 60_000);
  }
  return () => {
    globalListeners = globalListeners.filter((l) => l !== listener);
    if (globalListeners.length === 0 && fetchInterval) {
      clearInterval(fetchInterval);
      fetchInterval = null;
    }
  };
}

/** Hook that provides realtime BTC/USD price, refreshed every 60s from CoinGecko */
export function useBtcPrice() {
  const [state, setState] = useState<BtcPriceState>(globalState);
  const stateRef = useRef(state);

  useEffect(() => {
    const unsub = subscribe((s) => {
      if (s !== stateRef.current) {
        stateRef.current = s;
        setState(s);
      }
    });
    return unsub;
  }, []);

  return state;
}
