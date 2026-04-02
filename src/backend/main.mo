import Map "mo:core/Map";
import Array "mo:core/Array";
import Time "mo:core/Time";
import Order "mo:core/Order";
import Int "mo:core/Int";
import List "mo:core/List";
import Runtime "mo:core/Runtime";
import Principal "mo:core/Principal";

actor {
  type TradeType = {
    #buy;
    #sell;
  };

  type TradeStatus = {
    #pending;
    #completed;
    #failed;
  };

  type Strategy = {
    name : Text;
    priceTarget : Float;
    stopLoss : Float;
    maxTradeSize : Float;
    autoRepeat : Bool;
    active : Bool;
    tokenId : Text;
    tradeType : TradeType;
  };

  type TradeLog = {
    tokenId : Text;
    tradeType : TradeType;
    amountBtc : Float;
    amountToken : Float;
    price : Float;
    timestamp : Int;
    status : TradeStatus;
  };

  module Strategy {
    public func compare(s1 : Strategy, s2 : Strategy) : Order.Order {
      s1.name.compare(s2.name);
    };
  };

  module TradeLog {
    public func compare(t1 : TradeLog, t2 : TradeLog) : Order.Order {
      Int.compare(t2.timestamp, t1.timestamp);
    };
  };

  let strategies = Map.empty<Principal, Map.Map<Text, Strategy>>();
  let tradeLogs = Map.empty<Principal, List.List<TradeLog>>();

  func getUserStrategies(user : Principal) : Map.Map<Text, Strategy> {
    switch (strategies.get(user)) {
      case (null) { Runtime.trap("No strategies found for user") };
      case (?strats) { strats };
    };
  };

  public shared ({ caller }) func createOrUpdateStrategy(strategy : Strategy) : async () {
    let user = caller;
    var userStrategies = strategies.get(user);
    switch (userStrategies) {
      case (null) {
        let newStrategies = Map.empty<Text, Strategy>();
        newStrategies.add(strategy.name, strategy);
        strategies.add(user, newStrategies);
      };
      case (?userStrategies) {
        userStrategies.add(strategy.name, strategy);
      };
    };
  };

  public shared ({ caller }) func deleteStrategy(name : Text) : async () {
    let user = caller;
    switch (strategies.get(user)) {
      case (null) { return };
      case (?userStrategies) {
        userStrategies.remove(name);
      };
    };
  };

  public query ({ caller }) func listStrategies() : async [Strategy] {
    let user = caller;
    let userStrategies = strategies.get(user);
    switch (userStrategies) {
      case (null) { [] };
      case (?userStrategies) { userStrategies.values().toArray().sort() };
    };
  };

  public shared ({ caller }) func toggleStrategyActive(name : Text) : async Strategy {
    let user = caller;
    let userStrategies = getUserStrategies(user);
    let strategy = switch (userStrategies.get(name)) {
      case (null) { Runtime.trap("Strategy not found") };
      case (?strat) { strat };
    };
    let updatedStrategy = {
      strategy with active = not strategy.active;
    };
    userStrategies.add(name, updatedStrategy);
    updatedStrategy;
  };

  public shared ({ caller }) func addTradeLog(log : TradeLog) : async () {
    let user = caller;
    let newLog = {
      log with timestamp = Time.now();
    };
    var userLogs = tradeLogs.get(user);
    switch (userLogs) {
      case (null) {
        let newLogs = List.empty<TradeLog>();
        newLogs.add(newLog);
        tradeLogs.add(user, newLogs);
      };
      case (?userLogs) {
        userLogs.add(newLog);
      };
    };
  };

  public query ({ caller }) func getTradeLogs() : async [TradeLog] {
    let user = caller;
    switch (tradeLogs.get(user)) {
      case (null) { [] };
      case (?userLogs) { userLogs.toArray().sort() };
    };
  };
};
