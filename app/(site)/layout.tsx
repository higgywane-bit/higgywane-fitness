import { SiteHeader } from "@/components/layout/site-header";
import { TabBar } from "@/components/layout/tab-bar";
import { FlyLayer } from "@/components/layout/fly-layer";
import { AddToCartFeedback } from "@/components/motion/add-to-cart-feedback";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { CatalogProvider } from "@/components/catalog-provider";
import { getCatalog } from "@/lib/catalog/server";

// Menu, prices and coaches are edited live in admin.
export const dynamic = "force-dynamic";

export default async function SiteLayout({
  children,
  sheet,
}: Readonly<{ children: React.ReactNode; sheet: React.ReactNode }>) {
  const catalog = await getCatalog();
  return (
    <CatalogProvider value={catalog}>
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
      <AddToCartFeedback />
    </CatalogProvider>
  );
}
