"use client";

import * as React from "react";
import * as D from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

const Dialog = D.Root;
const DialogTitle = D.Title;
const DialogDescription = D.Description;
const DialogClose = D.Close;

function DialogContent({ className, children, ...props }: React.ComponentProps<typeof D.Content>) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm data-[state=open]:animate-[fade-in_200ms_var(--ease-out)] data-[state=closed]:animate-[fade-out_150ms_var(--ease-in)]" />
      <D.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[28px] border border-hairline-strong bg-surface-1 shadow-[0_40px_120px_-20px_rgb(0_0_0/0.9)] outline-none",
          "data-[state=open]:animate-[dialog-in_260ms_var(--ease-out)] data-[state=closed]:animate-[dialog-out_160ms_var(--ease-in)]",
          className,
        )}
        {...props}
      >
        {children}
      </D.Content>
    </D.Portal>
  );
}

export { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose };
