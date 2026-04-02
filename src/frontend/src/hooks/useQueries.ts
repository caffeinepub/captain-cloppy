import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Strategy, TradeLog, TradeStatus, TradeType } from "../backend";
import { useActor } from "./useActor";

export function useListStrategies() {
  const { actor, isFetching } = useActor();
  return useQuery<Strategy[]>({
    queryKey: ["strategies"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listStrategies();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetTradeLogs() {
  const { actor, isFetching } = useActor();
  return useQuery<TradeLog[]>({
    queryKey: ["tradeLogs"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getTradeLogs();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCreateOrUpdateStrategy() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (strategy: Strategy) => {
      if (!actor) throw new Error("No actor");
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
      return actor.toggleStrategyActive(name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
    },
  });
}

export function useAddTradeLog() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (log: TradeLog) => {
      if (!actor) throw new Error("No actor");
      return actor.addTradeLog(log);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tradeLogs"] });
    },
  });
}

export type { Strategy, TradeLog, TradeType, TradeStatus };
