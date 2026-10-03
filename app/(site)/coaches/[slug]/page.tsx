import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCoach } from "@/lib/catalog";
import { getCatalog } from "@/lib/catalog/server";
import { CoachProfile } from "@/components/coaches/coach-profile";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  await getCatalog();
  const coach = getCoach((await params).slug);
  if (!coach || coach.hidden) return {};
  return { title: `${coach.name} · ${coach.title}`, description: `${coach.tagline} Book PT with ${coach.name} at Superfit.` };
}

export default async function CoachPage({ params }: { params: Promise<Params> }) {
  await getCatalog();
  const coach = getCoach((await params).slug);
  if (!coach || coach.hidden) notFound();
  return <CoachProfile coach={coach} />;
}
