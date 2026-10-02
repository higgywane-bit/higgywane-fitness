import * as React from "react";
import { cn } from "@/lib/utils";

export const fieldClass =
  "w-full rounded-2xl border border-hairline-strong bg-surface-2 px-4 text-base text-foreground placeholder:text-text-tertiary outline-none transition-colors focus-visible:border-white focus-visible:outline-none aria-[invalid=true]:border-red-text";

function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input data-slot="input" className={cn(fieldClass, "h-12", className)} {...props} />;
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(fieldClass, "min-h-20 resize-none py-3", className)} {...props} />;
}

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label data-slot="label" className={cn("mb-2 block text-sm font-medium text-text-secondary", className)} {...props} />;
}

export { Input, Textarea, Label };
