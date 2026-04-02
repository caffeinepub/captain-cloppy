import { Toaster } from "@/components/ui/sonner";
import {
  Bot,
  Compass,
  History,
  LayoutDashboard,
  Menu,
  Settings,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { BotPage } from "./components/BotPage";
import { DashboardPage } from "./components/DashboardPage";
import { HistoryPage } from "./components/HistoryPage";
import { type NavPage, Sidebar } from "./components/Sidebar";
import { TokenExplorerPage } from "./components/TokenExplorerPage";
import { TradingPage } from "./components/TradingPage";
import { useSiwbAuth } from "./hooks/useSiwbAuth";
import type { OdinToken } from "./lib/odinApi";

const PAGE_TITLES: Record<
  NavPage,
  { title: string; subtitle: string; short: string }
> = {
  dashboard: {
    title: "Trading Dashboard",
    subtitle: "Odin.fun Bot Manager",
    short: "Dashboard",
  },
  trading: {
    title: "Manual Trade",
    subtitle: "Simulated order placement",
    short: "Trading",
  },
  explorer: {
    title: "Token Explorer",
    subtitle: "Live tokens from Odin.fun",
    short: "Explorer",
  },
  bot: {
    title: "Bot Automation",
    subtitle: "Manage trading strategies",
    short: "Bot",
  },
  history: {
    title: "Transaction History",
    subtitle: "Full audit trail",
    short: "History",
  },
};

const BOTTOM_NAV_ITEMS: {
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

export default function App() {
  const [page, setPage] = useState<NavPage>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<OdinToken | undefined>(
    undefined,
  );

  const { principal, setManualPrincipal } = useSiwbAuth();

  const handleConnected = (p: string) => {
    setManualPrincipal(p);
  };

  const handleSelectToken = (token: OdinToken) => {
    setSelectedToken(token);
    setPage("trading");
  };

  const handleNavigate = (p: NavPage) => {
    setPage(p);
    setSidebarOpen(false);
  };

  const { title, subtitle, short } = PAGE_TITLES[page];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Backdrop overlay — mobile only (button for a11y) */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 bg-black/50 z-30 md:hidden cursor-default"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        activePage={page}
        onNavigate={handleNavigate}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content */}
      <div className="flex flex-1 flex-col md:pl-[240px]">
        {/* Top header */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 md:px-6 md:py-4 backdrop-blur-sm gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger — mobile only */}
            <button
              type="button"
              data-ocid="header.menu.button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation menu"
              className="md:hidden flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground hover:bg-muted transition-colors"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              {/* Full title on md+, short on mobile */}
              <h1 className="text-base font-bold text-foreground tracking-tight leading-tight truncate">
                <span className="hidden md:inline">{title}</span>
                <span className="md:hidden">{short}</span>
              </h1>
              <p className="hidden md:block text-xs text-muted-foreground mt-0.5">
                {subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              data-ocid="header.settings.button"
              className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground hover:bg-muted transition-colors"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          {page === "dashboard" && (
            <DashboardPage
              principal={principal}
              onSetPrincipal={handleConnected}
              onSelectToken={handleSelectToken}
            />
          )}
          {page === "trading" && (
            <TradingPage
              principal={principal}
              onSetPrincipal={handleConnected}
              initialToken={selectedToken}
            />
          )}
          {page === "explorer" && (
            <TokenExplorerPage onSelectToken={handleSelectToken} />
          )}
          {page === "bot" && <BotPage />}
          {page === "history" && (
            <HistoryPage
              principal={principal}
              onSetPrincipal={handleConnected}
              onSelectToken={handleSelectToken}
            />
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-border px-6 py-3 text-center hidden md:block">
          <p className="text-[11px] text-muted-foreground">
            &copy; {new Date().getFullYear()}. Built with ❤️ using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              caffeine.ai
            </a>
          </p>
        </footer>
      </div>

      {/* Bottom Navigation — mobile only */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-border bg-sidebar"
        aria-label="Bottom navigation"
      >
        <div className="flex items-stretch">
          {BOTTOM_NAV_ITEMS.map(({ page: navPage, label, icon: Icon }) => {
            const isActive = page === navPage;
            return (
              <button
                type="button"
                key={navPage}
                data-ocid={`bottom_nav.${navPage}.link`}
                onClick={() => handleNavigate(navPage)}
                className={[
                  "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors min-h-[56px]",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
                {label}
              </button>
            );
          })}
        </div>
      </nav>

      <Toaster richColors position="bottom-right" />
    </div>
  );
}
