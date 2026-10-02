import pricing from "@/content/pricing.json";

export type PTPackage = {
  id: string;
  name: string;
  sessions: number;
  price: number;
  perSession: number;
  /** saving vs buying the same number of single sessions */
  saving: number;
};

type RawPT = { name: string; sessions: number; price: number; price_per_session?: number };

export function ptPackages(products: RawPT[] = pricing.sections.personal_training.products): PTPackage[] {
  const single = products.find((p) => p.sessions === 1)?.price ?? 0;
  return products.map((p) => ({
    id: `pt-${p.sessions}`,
    name: p.name,
    sessions: p.sessions,
    price: p.price,
    perSession: p.price_per_session ?? Math.floor(p.price / p.sessions),
    saving: Math.max(0, single * p.sessions - p.price),
  }));
}

export function getPTPackage(id: string): PTPackage | undefined {
  return ptPackages().find((p) => p.id === id);
}

export function lowestPerSession(): number {
  return Math.min(...ptPackages().map((p) => p.perSession));
}
