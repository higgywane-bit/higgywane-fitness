import Link from "next/link";
import { StarMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export function ComingSoonPage({ title, body }: { title: string; body: string }) {
  return (
    <div className="relative mx-auto flex min-h-[70dvh] max-w-7xl flex-col justify-end overflow-hidden px-4 pt-10 pb-12 md:px-8 md:pb-20">
      <StarMark aria-hidden className="pointer-events-none absolute -top-10 -right-24 size-[420px] text-white/[0.04] md:size-[640px]" />
      <h1 className="text-statement relative text-[72px] md:text-[140px]">{title}</h1>
      <p className="relative mt-4 max-w-md text-base text-text-secondary">{body}</p>
      <div className="relative mt-6">
        <Button asChild size="lg" variant="inverse">
          <Link href="/cafe">Order from the cafe</Link>
        </Button>
      </div>
    </div>
  );
}
