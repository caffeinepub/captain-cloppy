import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Loader2, LogOut, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { type WalletType, useSiwbAuth } from "../hooks/useSiwbAuth";

interface WalletConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: (principal: string) => void;
  currentPrincipal?: string;
  onDisconnect: () => void;
}

function isWalletInstalled(type: WalletType): boolean {
  const w = window as any;
  if (type === "unisat") return !!w.unisat;
  if (type === "xverse")
    return !!(w.XverseProviders?.BitcoinProvider ?? w.BitcoinProvider);
  if (type === "okx") return !!w.okxwallet?.bitcoin;
  return false;
}

const WALLETS: { type: WalletType; label: string; icon: string }[] = [
  { type: "unisat", label: "Unisat Wallet", icon: "🦄" },
  { type: "xverse", label: "Xverse Wallet", icon: "✨" },
  { type: "okx", label: "OKX Wallet", icon: "🔷" },
];

export function WalletConnectModal({
  open,
  onOpenChange,
  onConnected,
  currentPrincipal,
  onDisconnect,
}: WalletConnectModalProps) {
  const { status, error, btcAddress, connectWallet, disconnect } =
    useSiwbAuth();
  const [manualValue, setManualValue] = useState("");

  // When connection succeeds, notify parent and close
  useEffect(() => {
    if (status === "connected" && open) {
      const stored = localStorage.getItem("odin_principal") ?? "";
      if (stored) {
        onConnected(stored);
        onOpenChange(false);
      }
    }
  }, [status, open, onConnected, onOpenChange]);

  const handleWalletConnect = async (type: WalletType) => {
    try {
      const result = await connectWallet(type);
      onConnected(result.principal);
      onOpenChange(false);
    } catch {
      // error already in state
    }
  };

  const handleDisconnect = () => {
    disconnect();
    onDisconnect();
    onOpenChange(false);
  };

  const handleManualSubmit = () => {
    const trimmed = manualValue.trim();
    if (!trimmed) return;
    localStorage.setItem("odin_principal", trimmed);
    onConnected(trimmed);
    onOpenChange(false);
    setManualValue("");
  };

  const isConnecting = status === "connecting";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-ocid="wallet.dialog"
        className="bg-card border-border sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Wallet className="h-5 w-5 text-primary" />
            Connect Bitcoin Wallet
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Connect your Bitcoin wallet to automatically load your Odin.fun
            Principal ID.
          </DialogDescription>
        </DialogHeader>

        {/* Currently connected indicator */}
        {currentPrincipal && (
          <div className="rounded-lg border border-success/30 bg-success/8 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-2 w-2 rounded-full bg-success shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-success">Connected</p>
                {btcAddress && (
                  <p className="text-[11px] text-muted-foreground truncate">
                    {btcAddress.length > 20
                      ? `${btcAddress.slice(0, 10)}…${btcAddress.slice(-8)}`
                      : btcAddress}
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground truncate">
                  {currentPrincipal.length > 20
                    ? `${currentPrincipal.slice(0, 10)}…${currentPrincipal.slice(-6)}`
                    : currentPrincipal}
                </p>
              </div>
            </div>
            <Button
              data-ocid="wallet.disconnect_button"
              size="sm"
              variant="ghost"
              className="shrink-0 h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleDisconnect}
            >
              <LogOut className="h-3.5 w-3.5 mr-1" />
              Disconnect
            </Button>
          </div>
        )}

        {/* Error */}
        {status === "error" && error && (
          <div
            data-ocid="wallet.error_state"
            className="rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-3 flex items-start gap-2"
          >
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        {/* Wallet Buttons */}
        <div className="flex flex-col gap-2">
          {WALLETS.map((wallet) => {
            const installed = isWalletInstalled(wallet.type);
            return (
              <button
                key={wallet.type}
                type="button"
                data-ocid={`wallet.${wallet.type}.button`}
                disabled={isConnecting || !installed}
                onClick={() => handleWalletConnect(wallet.type)}
                className="group relative flex w-full items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3.5 text-left transition-all hover:border-primary/50 hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="text-2xl leading-none">{wallet.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {wallet.label}
                  </p>
                  {!installed && (
                    <p className="text-[11px] text-muted-foreground">
                      Not installed
                    </p>
                  )}
                </div>
                {!installed && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] shrink-0 bg-muted text-muted-foreground"
                  >
                    Not installed
                  </Badge>
                )}
                {isConnecting && (
                  <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Loading overlay */}
        {isConnecting && (
          <div
            data-ocid="wallet.loading_state"
            className="rounded-lg bg-primary/8 border border-primary/20 px-4 py-3 flex items-center gap-3"
          >
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <p className="text-xs text-primary font-medium">
              Connecting to wallet… Please approve in your wallet extension.
            </p>
          </div>
        )}

        <Separator className="bg-border/60" />

        {/* Manual fallback */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground text-center">
            or enter manually
          </p>
          <div className="flex gap-2">
            <Input
              data-ocid="wallet.principal.input"
              placeholder="Your Odin.fun Principal ID"
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              className="h-9 text-sm bg-background border-border flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleManualSubmit();
              }}
            />
            <Button
              data-ocid="wallet.principal.submit_button"
              size="sm"
              className="h-9 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleManualSubmit}
            >
              Use
            </Button>
          </div>
        </div>

        <Button
          data-ocid="wallet.close_button"
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground hover:text-foreground"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  );
}
