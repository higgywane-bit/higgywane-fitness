import { SiteHeader } from "@/components/layout/site-header";
import { TabBar } from "@/components/layout/tab-bar";
import { FlyLayer } from "@/components/layout/fly-layer";
import { CartDrawer } from "@/components/cart/cart-drawer";

export default function SiteLayout({
  children,
  sheet,
}: Readonly<{ children: React.ReactNode; sheet: React.ReactNode }>) {
  return (
    <>
      <a
        href="#main"
        className="sr-only z-[60] rounded-full bg-white px-4 py-2 font-semibold text-black focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="min-h-dvh pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </main>
      <TabBar />
      <CartDrawer />
      {sheet}
      <FlyLayer />
    </>
  );
}
