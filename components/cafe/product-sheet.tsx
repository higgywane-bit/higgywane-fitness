"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { getMenuItem } from "@/lib/catalog";
import { ProductConfigurator } from "@/components/cafe/product-configurator";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { useCart, useCartUI } from "@/lib/cart-store";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/use-media-query";

/** Product detail over the current page: bottom sheet on phones, centred modal on desktop. */
export function ProductSheet({ slug, editLineId }: { slug: string; editLineId?: string }) {
  const router = useRouter();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const [open, setOpen] = useState(true);
  const leaving = useRef(false);
  const item = getMenuItem(slug);
  const line = useCart((s) => (editLineId ? s.lines.find((l) => l.id === editLineId) : undefined));
  const setCartOpen = useCartUI((s) => s.setCartOpen);
  const reopenCart = useRef(false);

  if (!item) return null;

  const leave = () => {
    if (leaving.current) return;
    leaving.current = true;
    router.back();
    if (reopenCart.current) setTimeout(() => setCartOpen(true), 60);
  };

  const close = () => {
    setOpen(false);
    // Route back once the exit animation has played (Radix ~160 ms, Vaul ~500 ms).
    setTimeout(leave, desktop ? 170 : 380);
  };

  const done = () => {
    reopenCart.current = Boolean(line);
    close();
  };

  const edit = line ? { lineId: line.id, selections: line.selections, qty: line.qty, note: line.note } : undefined;
  const description = item.description ?? `Customise your ${item.name}`;

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent aria-describedby={`desc-${item.id}`}>
          <DialogDescription id={`desc-${item.id}`} className="sr-only">
            {description}
          </DialogDescription>
          <ProductConfigurator item={item} layout="modal" edit={edit} onClose={close} onDone={done} titleAs={DialogTitle} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => !o && close()}
      repositionInputs={false}
    >
      <DrawerContent className="h-[94dvh]" aria-describedby={`desc-${item.id}`}>
        <DrawerDescription id={`desc-${item.id}`} className="sr-only">
          {description}
        </DrawerDescription>
        <ProductConfigurator item={item} layout="sheet" edit={edit} onClose={close} onDone={done} titleAs={DrawerTitle} />
      </DrawerContent>
    </Drawer>
  );
}
