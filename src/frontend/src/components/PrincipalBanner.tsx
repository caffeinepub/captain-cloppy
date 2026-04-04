import { Wallet } from "lucide-react";

interface PrincipalBannerProps {
  onSet: (principal: string) => void;
}

export function PrincipalBanner({ onSet: _onSet }: PrincipalBannerProps) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 px-5 py-4 flex items-center gap-3 opacity-60">
      <Wallet className="h-5 w-5 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium text-muted-foreground">
          Wallet connect coming soon
        </p>
        <p className="text-xs text-muted-foreground/70 mt-0.5">
          Connect your Bitcoin wallet to view balances and execute trades
        </p>
      </div>
    </div>
  );
}
