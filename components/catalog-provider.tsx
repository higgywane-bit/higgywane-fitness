"use client";

import { setCatalog, type Catalog } from "@/lib/catalog";

/** Hands the live catalog to client components (cart pricing, macros, plan pickers). */
export function CatalogProvider({ value, children }: { value: Catalog; children: React.ReactNode }) {
  setCatalog(value);
  return children;
}
