import type { LeadStage } from "@/lib/db/schema";

export const STAGES: { id: LeadStage; label: string }[] = [
  { id: "new", label: "New" },
  { id: "contacted", label: "Contacted" },
  { id: "trial", label: "Trial / visited" },
  { id: "won", label: "Joined" },
  { id: "lost", label: "Lost" },
];

export const SOURCES = {
  "walk-in": "Walk-in",
  instagram: "Instagram",
  facebook: "Facebook",
  website: "Website",
  line: "LINE",
  referral: "Referral",
  google: "Google",
  other: "Other",
} as const;

export const INTERESTS = {
  membership: "Membership",
  pt: "Personal training",
  "day-pass": "Day pass",
  cafe: "Cafe",
  other: "Other",
} as const;
