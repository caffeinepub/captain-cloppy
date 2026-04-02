import {
  Bot,
  Compass,
  History,
  LayoutDashboard,
  LifeBuoy,
  TrendingUp,
  X,
} from "lucide-react";

export type NavPage = "dashboard" | "trading" | "explorer" | "bot" | "history";

interface SidebarProps {
  activePage: NavPage;
  onNavigate: (page: NavPage) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const navItems: {
  page: NavPage;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { page: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { page: "trading", label: "Trading", icon: TrendingUp },
  { page: "explorer", label: "Explorer", icon: Compass },
  { page: "bot", label: "Bot", icon: Bot },
  { page: "history", label: "History", icon: History },
];

export function Sidebar({
  activePage,
  onNavigate,
  isOpen = false,
  onClose,
}: SidebarProps) {
  return (
    <aside
      className={[
        "fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col bg-sidebar border-r border-sidebar-border transition-transform duration-300",
        // Mobile: slide in/out; Desktop: always visible
        isOpen ? "translate-x-0" : "-translate-x-full",
        "md:translate-x-0",
      ].join(" ")}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-sidebar-border">
        <img
          src="/assets/20601_11zon-019d5072-212a-741a-a639-a67bddd46f3d.png"
          alt="Captain Cloppy Logo"
          className="h-10 w-10 rounded-lg object-contain bg-primary/10"
        />
        <div className="flex-1 min-w-0">
          <span className="text-base font-bold text-foreground tracking-tight leading-tight">
            Captain Cloppy
          </span>
          <p className="text-[11px] text-muted-foreground leading-none mt-0.5">
            Trading Automation
          </p>
        </div>
        {/* Close button — mobile only */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sidebar"
          className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ page, label, icon: Icon }) => {
          const isActive = activePage === page;
          return (
            <button
              type="button"
              key={page}
              data-ocid={`nav.${page}.link`}
              onClick={() => {
                onNavigate(page);
                onClose?.();
              }}
              className={[
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              ].join(" ")}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
              {isActive && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
        >
          <LifeBuoy className="h-4 w-4 shrink-0" />
          Support
        </button>
      </div>
    </aside>
  );
}
