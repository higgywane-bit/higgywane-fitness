import {
  CalendarClock,
  ChartNoAxesColumn,
  Coffee,
  Dumbbell,
  FileChartColumn,
  History,
  LayoutDashboard,
  Mail,
  ReceiptText,
  ScanLine,
  Settings2,
  IdCard,
  TrendingUp,
  UserRoundPlus,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export type AdminNavItem = { href: string; label: string; short?: string; icon: LucideIcon };
export type AdminNavGroup = { label: string; items: AdminNavItem[] };

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: "Today",
    items: [
      { href: "/admin", label: "Dashboard", short: "Home", icon: LayoutDashboard },
      { href: "/admin/check-in", label: "Check-in", icon: ScanLine },
      { href: "/admin/cafe", label: "Cafe orders", short: "Cafe", icon: Coffee },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/admin/members", label: "Members", icon: UsersRound },
      { href: "/admin/leads", label: "Leads", icon: UserRoundPlus },
      { href: "/admin/coaching", label: "Coaching", icon: Dumbbell },
      { href: "/admin/messages", label: "Messages", icon: Mail },
    ],
  },
  {
    label: "Business",
    items: [
      { href: "/admin/performance", label: "Performance", icon: TrendingUp },
      { href: "/admin/sales", label: "Sales", icon: ChartNoAxesColumn },
      { href: "/admin/expenses", label: "Expenses", icon: ReceiptText },
      { href: "/admin/insights", label: "Insights", icon: FileChartColumn },
    ],
  },
  {
    label: "Team",
    items: [
      { href: "/admin/staff", label: "Staff", icon: IdCard },
      { href: "/admin/staff/rota", label: "Rota & hours", icon: CalendarClock },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/activity", label: "Activity log", icon: History },
      { href: "/admin/settings", label: "Settings", icon: Settings2 },
    ],
  },
];

/** Bottom tabs on phones; everything else sits behind "More". */
export const MOBILE_TABS = ["/admin", "/admin/check-in", "/admin/members", "/admin/cafe"];

export const ADMIN_NAV: AdminNavItem[] = ADMIN_NAV_GROUPS.flatMap((g) => g.items);

export function isAdminActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  if (href === "/admin/staff") return pathname === "/admin/staff" || (pathname.startsWith("/admin/staff/") && !pathname.startsWith("/admin/staff/rota"));
  return pathname === href || pathname.startsWith(`${href}/`);
}
