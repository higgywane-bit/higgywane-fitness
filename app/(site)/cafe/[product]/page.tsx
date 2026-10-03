import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getMenuItem } from "@/lib/catalog";
import { getCatalog } from "@/lib/catalog/server";
import { ProductPage } from "@/components/cafe/product-page";

export async function generateMetadata({ params }: { params: Promise<{ product: string }> }): Promise<Metadata> {
  await getCatalog();
  const item = getMenuItem((await params).product);
  if (!item) return {};
  return { title: item.name, description: item.description };
}

export default async function ProductRoute({ params }: { params: Promise<{ product: string }> }) {
  const { product } = await params;
  await getCatalog();
  if (!getMenuItem(product)) notFound();
  return (
    <Suspense>
      <ProductPage slug={product} />
    </Suspense>
  );
}
