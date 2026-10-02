import type { Metadata } from "next";
import { OrderConfirmation } from "@/components/order/order-confirmation";

export const metadata: Metadata = { title: "Order confirmed" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderConfirmation id={id} />;
}
