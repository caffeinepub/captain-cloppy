import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { TradeType } from "../backend";
import {
  type Strategy,
  useCreateOrUpdateStrategy,
  useDeleteStrategy,
  useListStrategies,
  useToggleStrategyActive,
} from "../hooks/useQueries";

const defaultForm = (): Omit<Strategy, "active"> => ({
  name: "",
  tokenId: "",
  tradeType: TradeType.buy,
  priceTarget: 5,
  stopLoss: -10,
  maxTradeSize: 0.001,
  autoRepeat: false,
});

export function BotPage() {
  const { data: strategies, isLoading } = useListStrategies();
  const createOrUpdate = useCreateOrUpdateStrategy();
  const deleteStrategy = useDeleteStrategy();
  const toggleActive = useToggleStrategyActive();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Omit<Strategy, "active">>(defaultForm());
  const [editingName, setEditingName] = useState<string | null>(null);

  const handleOpen = (strategy?: Strategy) => {
    if (strategy) {
      const { active: _active, ...rest } = strategy;
      setForm(rest);
      setEditingName(strategy.name);
    } else {
      setForm(defaultForm());
      setEditingName(null);
    }
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.tokenId.trim()) {
      toast.error("Name and Token ID are required");
      return;
    }
    try {
      await createOrUpdate.mutateAsync({ ...form, active: false });
      toast.success(editingName ? "Strategy updated" : "Strategy created");
      setOpen(false);
    } catch {
      toast.error("Failed to save strategy");
    }
  };

  const handleDelete = async (name: string) => {
    try {
      await deleteStrategy.mutateAsync(name);
      toast.success("Strategy deleted");
    } catch {
      toast.error("Failed to delete strategy");
    }
  };

  const handleToggle = async (name: string) => {
    try {
      await toggleActive.mutateAsync(name);
    } catch {
      toast.error("Failed to toggle strategy");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Bot Automation
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage automated trading strategies
          </p>
        </div>
        <Button
          type="button"
          data-ocid="bot.create.primary_button"
          onClick={() => handleOpen()}
          className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          New Strategy
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2
            data-ocid="bot.loading_state"
            className="h-6 w-6 animate-spin text-primary"
          />
        </div>
      ) : !strategies || strategies.length === 0 ? (
        <div
          data-ocid="bot.empty_state"
          className="rounded-xl border border-border bg-card p-10 text-center"
        >
          <p className="text-sm text-muted-foreground">No strategies yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Click &quot;New Strategy&quot; to create your first automated
            trading bot.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {strategies.map((s, i) => (
            <div
              key={s.name}
              data-ocid={`bot.strategy.item.${i + 1}`}
              className="rounded-xl border border-border bg-card p-5 flex items-center gap-4 shadow-card"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm text-foreground truncate">
                    {s.name}
                  </p>
                  <span
                    className={[
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold shrink-0",
                      s.tradeType === "buy"
                        ? "bg-success/15 text-success"
                        : "bg-destructive/15 text-destructive",
                    ].join(" ")}
                  >
                    {s.tradeType.toUpperCase()}
                  </span>
                  {s.active && (
                    <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  Token: {s.tokenId} · Target: {s.priceTarget}% · Stop-loss:{" "}
                  {s.stopLoss}% · Max: {s.maxTradeSize} BTC
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  data-ocid={`bot.strategy.toggle.${i + 1}`}
                  onClick={() => handleToggle(s.name)}
                  title={s.active ? "Pause" : "Start"}
                  className={[
                    "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                    s.active
                      ? "bg-primary/10 text-primary hover:bg-primary/20"
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                  ].join(" ")}
                >
                  {s.active ? (
                    <Pause className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  data-ocid={`bot.strategy.edit_button.${i + 1}`}
                  onClick={() => handleOpen(s)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  data-ocid={`bot.strategy.delete_button.${i + 1}`}
                  onClick={() => handleDelete(s.name)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Strategy Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          data-ocid="bot.strategy.dialog"
          className="bg-card border-border max-w-md"
        >
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingName ? "Edit Strategy" : "New Strategy"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label
                htmlFor="bot-name"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Name
              </Label>
              <Input
                id="bot-name"
                data-ocid="bot.strategy.name.input"
                placeholder="My Scalping Bot"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
                className="bg-muted/40 border-border"
                disabled={!!editingName}
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="bot-tokenid"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Token ID
              </Label>
              <Input
                id="bot-tokenid"
                data-ocid="bot.strategy.tokenid.input"
                placeholder="Token ID from Odin.fun"
                value={form.tokenId}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, tokenId: e.target.value }))
                }
                className="bg-muted/40 border-border"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Trade Type
              </span>
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  type="button"
                  data-ocid="bot.strategy.buy.toggle"
                  onClick={() =>
                    setForm((prev) => ({ ...prev, tradeType: TradeType.buy }))
                  }
                  className={[
                    "flex-1 py-2 text-sm font-semibold transition-all",
                    form.tradeType === TradeType.buy
                      ? "bg-success/20 text-success"
                      : "bg-muted/40 text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  Buy
                </button>
                <button
                  type="button"
                  data-ocid="bot.strategy.sell.toggle"
                  onClick={() =>
                    setForm((prev) => ({ ...prev, tradeType: TradeType.sell }))
                  }
                  className={[
                    "flex-1 py-2 text-sm font-semibold transition-all",
                    form.tradeType === TradeType.sell
                      ? "bg-destructive/20 text-destructive"
                      : "bg-muted/40 text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  Sell
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor="bot-price-target"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Price Target %
                </Label>
                <div className="relative">
                  <Input
                    id="bot-price-target"
                    data-ocid="bot.strategy.price_target.input"
                    type="number"
                    step="0.1"
                    value={form.priceTarget}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        priceTarget: Number.parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="pr-6 bg-muted/40 border-border"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    %
                  </span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="bot-stop-loss"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Stop-Loss %
                </Label>
                <div className="relative">
                  <Input
                    id="bot-stop-loss"
                    data-ocid="bot.strategy.stop_loss.input"
                    type="number"
                    step="0.1"
                    value={form.stopLoss}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        stopLoss: Number.parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="pr-6 bg-muted/40 border-border"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    %
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="bot-max-trade"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Max Trade Size (BTC)
              </Label>
              <Input
                id="bot-max-trade"
                data-ocid="bot.strategy.max_trade.input"
                type="number"
                step="0.0001"
                min="0"
                value={form.maxTradeSize}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    maxTradeSize: Number.parseFloat(e.target.value) || 0,
                  }))
                }
                className="bg-muted/40 border-border"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg bg-muted/30 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Auto-Repeat
                </p>
                <p className="text-xs text-muted-foreground">
                  Re-run strategy after each execution
                </p>
              </div>
              <Switch
                id="bot-autorepeat"
                data-ocid="bot.strategy.autorepeat.switch"
                checked={form.autoRepeat}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, autoRepeat: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            {editingName && (
              <Button
                type="button"
                data-ocid="bot.strategy.delete_button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  handleDelete(editingName);
                  setOpen(false);
                }}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete
              </Button>
            )}
            <Button
              type="button"
              data-ocid="bot.strategy.cancel_button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              className="border-border"
            >
              Cancel
            </Button>
            <Button
              type="button"
              data-ocid="bot.strategy.save_button"
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleSave}
              disabled={createOrUpdate.isPending}
            >
              {createOrUpdate.isPending ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save Strategy"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
