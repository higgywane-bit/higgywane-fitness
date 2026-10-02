import type { Metadata } from "next";
import { MenuView } from "@/components/cafe/menu-view";

export const metadata: Metadata = {
  title: "Cafe",
  description: "Order protein smoothies, cold-pressed juice and coffee from the Superfit cafe, with live macros.",
};

export default function CafePage() {
  return <MenuView />;
}
