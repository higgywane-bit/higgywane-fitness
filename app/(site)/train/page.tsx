import type { Metadata } from "next";
import { ComingSoonPage } from "@/components/layout/coming-soon-page";

export const metadata: Metadata = { title: "Train" };

// Built in session 3: memberships and PT pricing with computed savings.
export default function TrainPage() {
  return (
    <ComingSoonPage
      title="Train"
      body="Membership and personal training prices are coming to the app soon. Day passes are available at the front desk."
    />
  );
}
