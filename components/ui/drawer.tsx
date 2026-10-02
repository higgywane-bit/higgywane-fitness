"use client";

import * as React from "react";
import { Drawer as Vaul } from "vaul";
import { cn } from "@/lib/utils";

const Drawer = Vaul.Root;
const DrawerTrigger = Vaul.Trigger;
const DrawerClose = Vaul.Close;
const DrawerTitle = Vaul.Title;
const DrawerDescription = Vaul.Description;

function DrawerOverlay({ className, ...props }: React.ComponentProps<typeof Vaul.Overlay>) {
  return <Vaul.Overlay className={cn("fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px]", className)} {...props} />;
}

function DrawerContent({
  className,
  children,
  side = "bottom",
  ...props
}: React.ComponentProps<typeof Vaul.Content> & { side?: "bottom" | "right" }) {
  return (
    <Vaul.Portal>
      <DrawerOverlay />
      <Vaul.Content
        className={cn(
          "fixed z-50 flex flex-col bg-surface-1 outline-none",
          side === "bottom" &&
            "inset-x-0 bottom-0 max-h-[94dvh] rounded-t-[28px] border-t border-hairline-strong",
          side === "right" && "inset-y-0 right-0 w-full max-w-[440px] border-l border-hairline-strong",
          className,
        )}
        {...props}
      >
        {side === "bottom" ? (
          <div aria-hidden className="mx-auto mt-2.5 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-white/20" />
        ) : null}
        {children}
      </Vaul.Content>
    </Vaul.Portal>
  );
}

export { Drawer, DrawerTrigger, DrawerClose, DrawerContent, DrawerTitle, DrawerDescription };
