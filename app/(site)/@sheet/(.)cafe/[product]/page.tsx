import { ProductSheet } from "@/components/cafe/product-sheet";

export default async function InterceptedProduct({
  params,
  searchParams,
}: {
  params: Promise<{ product: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { product } = await params;
  const { edit } = await searchParams;
  return <ProductSheet key={`${product}-${edit ?? ""}`} slug={product} editLineId={edit} />;
}
