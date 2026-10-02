import { ChartNoAxesColumn, FileChartColumn, LayoutDashboard, ScanLine, Settings2, UsersRound, type LucideIcon } from "lucide-react";

export type AdminNavItem = { href: string; label: string; short?: string; icon: LucideIcon };

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", short: "Home", icon: LayoutDashboard },
  { href: "/admin/check-in", label: "Check-in", icon: ScanLine },
  { href: "/admin/members", label: "Members", icon: UsersRound },
  { href: "/admin/sales", label: "Sales", icon: ChartNoAxesColumn },
  { href: "/admin/insights", label: "Insights", icon: FileChartColumn },
  { href: "/admin/settings", label: "Settings", icon: Settings2 },
];

export function isAdminActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}
