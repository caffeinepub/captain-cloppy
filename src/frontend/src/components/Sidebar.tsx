import {
  Bot,
  Compass,
  History,
  LayoutDashboard,
  LifeBuoy,
  TrendingUp,
  User,
  X,
} from "lucide-react";

export type NavPage =
  | "dashboard"
  | "trading"
  | "explorer"
  | "bot"
  | "history"
  | "profile";

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
  { page: "profile", label: "Profile", icon: User },
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
      <div className="flex items-center gap-3 px-4 py-4 border-b border-sidebar-border bg-black">
        <img
          src="/assets/2062-019d5d43-9b5b-74da-87b1-d706e80113b7.jpeg"
          alt="Captain Cloppy Logo"
          className="h-14 w-14 rounded-xl object-contain flex-shrink-0 shadow-sm bg-black"
        />
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold text-white tracking-tight leading-tight whitespace-nowrap">
            Captain Cloppy
          </span>
          <p className="text-[11px] text-zinc-400 leading-none mt-0.5 whitespace-nowrap">
            ODIN•FUN
          </p>
        </div>
        {/* Close button — mobile only */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sidebar"
          className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white transition-colors ml-auto flex-shrink-0"
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
