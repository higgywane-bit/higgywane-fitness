import type { Metadata } from "next";
import { ComingSoonPage } from "@/components/layout/coming-soon-page";

export const metadata: Metadata = { title: "Coaches" };

// Built in session 2: rotator, shared-element transition, profile pages.
export default function CoachesPage() {
  return (
    <ComingSoonPage
      title="Coaches"
      body="Profiles for Bella, Nicha, Aun and Poom are coming soon. Ask at the front desk to book a session today."
    />
  );
}
