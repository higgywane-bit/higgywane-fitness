import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getMenuItem, menu } from "@/content/menu";
import { ProductPage } from "@/components/cafe/product-page";

export function generateStaticParams() {
  return menu.map((m) => ({ product: m.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ product: string }> }): Promise<Metadata> {
  const item = getMenuItem((await params).product);
  if (!item) return {};
  return { title: item.name, description: item.description };
}

export default async function ProductRoute({ params }: { params: Promise<{ product: string }> }) {
  const { product } = await params;
  if (!getMenuItem(product)) notFound();
  return (
    <Suspense>
      <ProductPage slug={product} />
    </Suspense>
  );
}
