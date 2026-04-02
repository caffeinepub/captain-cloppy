import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle } from "lucide-react";
import { useState } from "react";

interface PrincipalBannerProps {
  onSet: (principal: string) => void;
}

export function PrincipalBanner({ onSet }: PrincipalBannerProps) {
  const [value, setValue] = useState("");

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 px-5 py-5 flex items-start gap-4">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-foreground">
          Enter Your Principal ID
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Enter your Odin.fun principal ID to view balances, trades, and run the
          bot.
        </p>

        <div className="mt-3 flex gap-2">
          <Input
            data-ocid="principal.input"
            placeholder="e.g. 2vxsx-fae or your principal ID"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-9 text-sm bg-background border-border"
            onKeyDown={(e) => {
              if (e.key === "Enter" && value.trim()) onSet(value.trim());
            }}
          />
          <Button
            data-ocid="principal.submit_button"
            size="sm"
            className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => {
              if (value.trim()) onSet(value.trim());
            }}
          >
            Connect
          </Button>
        </div>
      </div>
    </div>
  );
}
