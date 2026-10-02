import { CupSoda, Dumbbell, House, UsersRound, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV: NavItem[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/cafe", label: "Cafe", icon: CupSoda },
  { href: "/coaches", label: "Coaches", icon: UsersRound },
  { href: "/train", label: "Train", icon: Dumbbell },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
