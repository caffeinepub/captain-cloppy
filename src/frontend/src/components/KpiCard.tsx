import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  badge?: string;
  badgeType?: "success" | "muted";
  loading?: boolean;
  ocid?: string;
}

export function KpiCard({
  title,
  value,
  icon: Icon,
  badge,
  badgeType = "muted",
  loading,
  ocid,
}: KpiCardProps) {
  return (
    <div
      data-ocid={ocid}
      className="rounded-xl border border-border bg-card p-5 shadow-card flex flex-col gap-4"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="flex items-end justify-between gap-2">
        {loading ? (
          <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        ) : (
          <span className="text-2xl font-bold text-foreground tabular-nums">
            {value}
          </span>
        )}
        {badge && (
          <span
            className={[
              "mb-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
              badgeType === "success"
                ? "bg-success/15 text-success"
                : "bg-muted text-muted-foreground",
            ].join(" ")}
          >
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}
