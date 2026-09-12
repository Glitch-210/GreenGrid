import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Role } from "@wattshare/shared";
import { useAuth } from "../../hooks/useAuth";
import { useApiQuery } from "../../hooks/useApi";
import { formatEC, formatINR } from "../../lib/format";
import { Logo } from "./Logo";
import { NotificationMenu } from "./NotificationMenu";
import { useSocketInvalidate } from "../../hooks/useSocket";

interface ProsumerDashboardData {
  creditBalance: { available: string; reserved: string; sold: string; retired: string };
  totalEarnings: string;
}

interface NavItem {
  key: string;
  label: string;
  icon: string;
  to: string;
}

function navItemsForRole(role: Role): NavItem[] {
  const home: NavItem = { key: "overview", label: "Home", icon: "☀", to: `/${role.toLowerCase()}` };
  const profile: NavItem = { key: "profile-node", label: "Profile", icon: "◆", to: "/profile" };

  switch (role) {
    case Role.PROSUMER:
      return [
        home,
        { key: "marketplace", label: "Market", icon: "▲", to: "/marketplace" },
        { key: "sell-credits", label: "Sell", icon: "⚡", to: "/prosumer/sell" },
        { key: "my-listings", label: "Listings", icon: "◱", to: "/prosumer/listings" },
        // "Txns" used to point at /prosumer/credits, which lists credit batches, not
        // transactions. Credits are reachable from the dashboard instead.
        { key: "transactions", label: "Sales", icon: "▤", to: "/prosumer/transactions" },
        profile,
      ];
    case Role.CONSUMER:
      return [
        home,
        { key: "marketplace", label: "Market", icon: "▲", to: "/marketplace" },
        { key: "transactions", label: "Txns", icon: "▤", to: "/consumer/transactions" },
        profile,
      ];
    case Role.UTILITY:
      return [home, { key: "transactions", label: "Settlements", icon: "▤", to: "/utility" }, profile];
    case Role.ADMIN:
    case Role.REGULATOR:
    default:
      return [home, { key: "transactions", label: "Audit", icon: "▤", to: "/admin" }, profile];
  }
}

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const role = (user?.role ?? Role.CONSUMER) as Role;

  const { data: dashboard } = useApiQuery<ProsumerDashboardData>(
    ["dashboard", "prosumer"],
    "/users/dashboard",
    role === Role.PROSUMER,
  );
  // Seller-side lifecycle events now reach this client, so the header EC/₹ pill
  // refreshes as trades land instead of only on navigation.
  useSocketInvalidate("trade:matched", ["dashboard", "prosumer"], ["transactions", "mine"]);
  useSocketInvalidate("payment:updated", ["dashboard", "prosumer"], ["transactions", "mine"]);
  useSocketInvalidate("credit:minted", ["dashboard", "prosumer"], ["credits", "sellable"], ["credits", "mine"]);

  const items = navItemsForRole(role);

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b-3 border-black bg-surface px-4 py-2">
        <Link to={items[0]?.to ?? "/"} className="flex items-center gap-2">
          <Logo size={32} />
          <span className="font-display text-lg font-extrabold tracking-tight">GREENGRID</span>
        </Link>

        <div className="flex items-center gap-3">
          {role === Role.PROSUMER && dashboard ? (
            <div className="hidden border-3 border-black bg-white px-2 py-1 font-mono text-xs font-bold shadow-hard-sm sm:block">
              {formatEC(dashboard.creditBalance.available)} · {formatINR(dashboard.totalEarnings)}
            </div>
          ) : (
            <div className="hidden border-3 border-black bg-white px-2 py-1 font-mono text-xs font-bold uppercase shadow-hard-sm sm:block">
              {role}
            </div>
          )}

          <NotificationMenu />

          <Link to="/profile" className="block h-8 w-8 overflow-hidden border-3 border-black shadow-hard-sm">
            <img src="/avatar-placeholder.png" alt="Profile" className="h-full w-full object-cover" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t-3 border-black bg-surface">
        {items.map((item) => {
          const active = location.pathname === item.to;
          return (
            <Link
              key={item.key}
              to={item.to}
              className={`flex flex-1 flex-col items-center gap-0.5 border-r-2 border-black py-2 font-mono text-[10px] font-bold uppercase tracking-wider last:border-r-0 ${
                active ? "bg-solar text-black" : "bg-white text-on-surface-variant"
              }`}
            >
              <span aria-hidden className="text-base leading-none">
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
        <button
          onClick={() => {
            logout();
            navigate("/login");
          }}
          className="flex flex-col items-center gap-0.5 border-l-2 border-black bg-fault px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-white"
        >
          <span aria-hidden className="text-base leading-none">
            ⏻
          </span>
          Exit
        </button>
      </nav>
    </div>
  );
}
