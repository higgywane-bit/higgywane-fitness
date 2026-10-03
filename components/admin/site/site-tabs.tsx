"use client";

import { usePathname } from "next/navigation";
import { LinkTabs } from "@/components/admin/link-tabs";

const TABS = [
  { id: "menu", href: "/admin/site", label: "Menu" },
  { id: "add-ons", href: "/admin/site/add-ons", label: "Add-ons" },
  { id: "ingredients", href: "/admin/site/ingredients", label: "Ingredients" },
  { id: "coaches", href: "/admin/site/coaches", label: "Coaches" },
  { id: "plans", href: "/admin/site/plans", label: "Plans & prices" },
  { id: "business", href: "/admin/site/business", label: "Business" },
];

export function SiteTabs() {
  const path = usePathname();
  const active = TABS.find((t) => t.href !== "/admin/site" && path.startsWith(t.href))?.id ?? "menu";
  return <LinkTabs tabs={TABS} active={active} label="Site sections" />;
}
