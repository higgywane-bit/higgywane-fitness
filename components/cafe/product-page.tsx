"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getMenuItem } from "@/content/menu";
import { ProductConfigurator } from "@/components/cafe/product-configurator";
import { useCart, useCartUI } from "@/lib/cart-store";
import { useHydrated } from "@/hooks/use-hydrated";

/** Direct visit to /cafe/[product]: same configurator as the sheet, as a full page. */
export function ProductPage({ slug }: { slug: string }) {
  const router = useRouter();
  const editId = useSearchParams().get("edit");
  const hydrated = useHydrated();
  const line = useCart((s) => (editId ? s.lines.find((l) => l.id === editId) : undefined));
  const setCartOpen = useCartUI((s) => s.setCartOpen);
  const item = getMenuItem(slug)!;
  const edit = hydrated && line ? { lineId: line.id, selections: line.selections, qty: line.qty, note: line.note } : undefined;

  return (
    <>
      <div className="mx-auto max-w-6xl px-4 pt-3 md:px-8 md:pt-6">
        <Link
          href="/cafe"
          className="tap -ml-2 inline-flex h-11 items-center gap-1 rounded-full pr-4 pl-2 text-[15px] font-medium text-text-secondary hover:text-white"
        >
          <ChevronLeft className="size-5" aria-hidden />
          Menu
        </Link>
      </div>
      <ProductConfigurator
        key={edit ? edit.lineId : "new"}
        item={item}
        layout="page"
        edit={edit}
        titleAs="h1"
        onDone={() => {
          router.push("/cafe");
          if (edit) setCartOpen(true);
        }}
      />
    </>
  );
}
