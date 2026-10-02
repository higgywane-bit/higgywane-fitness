import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  children,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-4 px-4 pt-6 pb-5 md:px-8 md:pt-10 md:pb-8", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="text-xs font-semibold tracking-[0.18em] text-text-tertiary uppercase">{eyebrow}</p> : null}
        <h1 className="text-statement mt-1 text-[44px] md:text-[64px]">{title}</h1>
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </header>
  );
}

export function Panel({ title, action, children, className }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-3xl border border-hairline bg-surface-1 p-4 md:p-5", className)}>
      {title ? (
        <div className="mb-4 flex min-h-8 items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
