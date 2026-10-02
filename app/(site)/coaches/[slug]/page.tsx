import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { coaches, getCoach } from "@/content/coaches";
import { CoachProfile } from "@/components/coaches/coach-profile";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return coaches.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const coach = getCoach((await params).slug);
  if (!coach) return {};
  return { title: `${coach.name} · ${coach.title}`, description: `${coach.tagline} Book PT with ${coach.name} at Superfit.` };
}

export default async function CoachPage({ params }: { params: Promise<Params> }) {
  const coach = getCoach((await params).slug);
  if (!coach) notFound();
  return <CoachProfile coach={coach} />;
}
