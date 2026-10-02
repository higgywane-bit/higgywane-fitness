import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { menu } from "@/content/menu";
import { ProductCard } from "@/components/cafe/product-card";
import { Button } from "@/components/ui/button";

// Home is assembled properly in session 3; this is the launch-ready minimum.
const FAVOURITES = ["thick", "berry-hype", "espresso-max", "bangkok-beat"];

export default function HomePage() {
  const favourites = FAVOURITES.map((slug) => menu.find((m) => m.slug === slug)!).filter(Boolean);
  return (
    <>
      <section className="relative isolate overflow-hidden">
        <div className="relative h-[440px] md:h-[min(68dvh,640px)]">
          {/* TODO: confirm with owner (replace poster crop with a proper hero photo or video) */}
          <Image
            src="/images/coaches/team-poster-crop.jpg"
            alt="Superfit coaches Bella, Nicha, Aun and Poom in black Superfit kit"
            fill
            priority
            sizes="100vw"
            className="object-cover object-[55%_25%] md:object-contain md:object-top"
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        </div>
        <div className="relative mx-auto -mt-36 max-w-7xl px-4 pb-10 md:-mt-48 md:px-8">
          <h1 className="text-statement text-[68px] md:text-[120px]">
            Train
            <br />
            with us
          </h1>
          <p className="mt-4 max-w-md text-base text-text-secondary">
            Bodybuilding gym and cafe in Thailand. Lift with our coaches, then refuel at the bar.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/cafe">Order from the cafe</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/train">Join Superfit</Link>
            </Button>
          </div>
        </div>
      </section>

      <section aria-labelledby="fav" className="mx-auto max-w-7xl px-4 pt-6 pb-16 md:px-8">
        <div className="mb-5 flex items-end justify-between">
          <h2 id="fav" className="font-display text-[34px] uppercase md:text-[44px]">
            Cafe favourites
          </h2>
          <Link href="/cafe" className="tap flex h-11 items-center gap-1 text-[15px] font-semibold text-text-secondary hover:text-white">
            Full menu <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-7 md:grid-cols-4 md:gap-x-5">
          {favourites.map((m) => (
            <ProductCard key={m.id} item={m} />
          ))}
        </div>
      </section>
    </>
  );
}
