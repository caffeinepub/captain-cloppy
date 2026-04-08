import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActor } from "./useActor";

// ---------------------------------------------------------------------------
// Local type definitions (backend interface is currently empty, so these
// are defined here to keep the rest of the app compiling cleanly)
// ---------------------------------------------------------------------------

export enum TradeStatus {
  pending = "pending",
  completed = "completed",
  failed = "failed",
}

export enum TradeType {
  buy = "buy",
  sell = "sell",
}

export interface TradeLog {
  status: TradeStatus;
  tokenId: string;
  tradeType: TradeType;
  amountToken: number;
  timestamp: bigint;
  amountBtc: number;
  price: number;
}

export interface Strategy {
  name: string;
  tokenId: string;
  tradeType: TradeType;
  priceTarget: number;
  stopLoss: number;
  maxTradeSize: number;
  autoRepeat: boolean;
  active?: boolean;
}

// ---------------------------------------------------------------------------
// In-memory store for simulated trade logs (no backend persistence yet)
// ---------------------------------------------------------------------------
let _tradeLogs: TradeLog[] = [];

export function useListStrategies() {
  const { actor, isFetching } = useActor();
  return useQuery<Strategy[]>({
    queryKey: ["strategies"],
    queryFn: async () => {
      if (!actor) return [];
      // @ts-expect-error — actor method may not exist yet
      return actor.listStrategies();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetTradeLogs() {
  return useQuery<TradeLog[]>({
    queryKey: ["tradeLogs"],
    queryFn: async () => {
      return [..._tradeLogs];
    },
  });
}

export function useCreateOrUpdateStrategy() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (strategy: Strategy) => {
      if (!actor) throw new Error("No actor");
      // @ts-expect-error — actor method may not exist yet
      return actor.createOrUpdateStrategy(strategy);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
    },
  });
}

export function useDeleteStrategy() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      if (!actor) throw new Error("No actor");
      // @ts-expect-error — actor method may not exist yet
      return actor.deleteStrategy(name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
    },
  });
}

export function useToggleStrategyActive() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      if (!actor) throw new Error("No actor");
      // @ts-expect-error — actor method may not exist yet
      return actor.toggleStrategyActive(name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
    },
  });
}

export function useAddTradeLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (log: TradeLog) => {
      // Store locally (simulated — no backend persistence yet)
      _tradeLogs = [log, ..._tradeLogs].slice(0, 500);
      return log;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tradeLogs"] });
    },
  });
}
