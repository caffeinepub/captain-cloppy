import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
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
    active: boolean;
    tokenId: string;
    tradeType: TradeType;
    name: string;
    autoRepeat: boolean;
    stopLoss: number;
    maxTradeSize: number;
    priceTarget: number;
}
export enum TradeStatus {
    pending = "pending",
    completed = "completed",
    failed = "failed"
}
export enum TradeType {
    buy = "buy",
    sell = "sell"
}
export interface backendInterface {
    addTradeLog(log: TradeLog): Promise<void>;
    createOrUpdateStrategy(strategy: Strategy): Promise<void>;
    deleteStrategy(name: string): Promise<void>;
    getTradeLogs(): Promise<Array<TradeLog>>;
    listStrategies(): Promise<Array<Strategy>>;
    toggleStrategyActive(name: string): Promise<Strategy>;
}
