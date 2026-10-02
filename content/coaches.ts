import type { Coach, Specialty, SpecialtyId } from "./types";

/*
 * Supercoach team. Order matches the team poster: Bella, Nicha, Aun, Poom.
 * TODO: confirm with owner (titles, specialties, bios, working days and session times, LINE / Instagram handles)
 */

export const specialties: Record<SpecialtyId, Specialty> = {
  "bodybuilding-prep": {
    id: "bodybuilding-prep",
    label: "Bodybuilding prep",
    blurb: "Peak week, conditioning and a plan that gets you to the stage on time.",
  },
  "womens-recomp": {
    id: "womens-recomp",
    label: "Women's recomp",
    blurb: "Drop fat and build shape at the same time, without crash dieting.",
  },
  glutes: { id: "glutes", label: "Glutes & lower body", blurb: "Programming built around the lifts that actually grow glutes." },
  posing: { id: "posing", label: "Posing", blurb: "Stage presence, transitions and the small details judges notice." },
  "fat-loss": { id: "fat-loss", label: "Fat loss", blurb: "Sustainable deficits, high protein and training that keeps your muscle." },
  nutrition: { id: "nutrition", label: "Nutrition", blurb: "Macros set for your goal and adjusted week by week." },
  strength: { id: "strength", label: "Strength", blurb: "Get stronger on the big lifts with clean, coached technique." },
  "get-jacked": { id: "get-jacked", label: "Get jacked", blurb: "Hypertrophy-first training to add size, fast and properly." },
  mobility: { id: "mobility", label: "Mobility", blurb: "Move better, lift deeper and stay out of the physio's office." },
  beginners: { id: "beginners", label: "New to the gym", blurb: "Learn the basics with someone in your corner from day one." },
};

const WEEKDAYS = [1, 2, 3, 4, 5, 6];

// TODO: confirm with owner (every field below is a placeholder written for layout)
export const coaches: Coach[] = [
  {
    slug: "bella",
    name: "Bella",
    title: "Prep & physique coach",
    tagline: "Stage-ready, the smart way.",
    specialties: ["bodybuilding-prep", "womens-recomp", "glutes", "posing"],
    about: [
      "Bella coaches women who want a physique they are proud of, on stage or off it.",
      "Her clients get a plan built around their week, honest check-ins, and training that is hard where it counts.",
    ],
    approach: [
      { title: "Assess", body: "Starting point, training history, schedule and the goal you actually care about." },
      { title: "Build", body: "A training block and macro targets written for you, not copied from a template." },
      { title: "Check in", body: "Weekly progress review, with changes made from your data, not guesswork." },
    ],
    weekdays: WEEKDAYS,
    slots: ["07:00", "08:00", "09:00", "16:00", "17:00", "18:00", "19:00"],
  },
  {
    slug: "nicha",
    name: "Nicha",
    title: "Women's recomp coach",
    tagline: "Lose the fat. Keep the strength.",
    specialties: ["womens-recomp", "bodybuilding-prep", "fat-loss", "nutrition"],
    about: [
      "Nicha helps women recomp: leaner, stronger and more confident under the bar.",
      "Expect clear coaching cues, realistic nutrition and sessions you will look forward to.",
    ],
    approach: [
      { title: "Assess", body: "Where you are now, what has worked before and what has not." },
      { title: "Build", body: "Strength-based training plus a nutrition plan you can live with." },
      { title: "Check in", body: "Measurements, photos and lifts tracked so progress is visible." },
    ],
    weekdays: WEEKDAYS,
    slots: ["06:00", "07:00", "08:00", "12:00", "17:00", "18:00"],
  },
  {
    slug: "aun",
    name: "Aun",
    title: "Strength & conditioning coach",
    tagline: "Move well. Lift heavy.",
    specialties: ["strength", "mobility", "fat-loss", "beginners"],
    about: [
      "Aun builds strong foundations: great technique, steady progress and a body that moves well.",
      "Ideal if you are new to lifting or want to get properly strong without getting hurt.",
    ],
    approach: [
      { title: "Assess", body: "Movement screen and baseline lifts so we know exactly where to start." },
      { title: "Build", body: "Progressive strength blocks with mobility work built in." },
      { title: "Check in", body: "Numbers tracked every session so you see the progress." },
    ],
    weekdays: WEEKDAYS,
    slots: ["07:00", "08:00", "10:00", "16:00", "17:00", "18:00", "19:00"],
  },
  {
    slug: "poom",
    name: "Poom",
    title: "Hypertrophy coach",
    tagline: "Get jacked.",
    specialties: ["get-jacked", "bodybuilding-prep", "strength", "nutrition"],
    about: [
      "Poom is the coach for men who want size. Hypertrophy-first training, eating to grow and no wasted sets.",
      "From first bulk to first show, he will push you harder than you would push yourself.",
    ],
    approach: [
      { title: "Assess", body: "Body composition, lifts and what is holding your growth back." },
      { title: "Build", body: "High-effort hypertrophy blocks and a calorie plan that supports growth." },
      { title: "Check in", body: "Weekly weigh-ins and lift numbers, adjusted until you are growing." },
    ],
    weekdays: WEEKDAYS,
    slots: ["08:00", "09:00", "10:00", "17:00", "18:00", "19:00", "20:00"],
  },
];

export function getCoach(slug: string): Coach | undefined {
  return coaches.find((c) => c.slug === slug);
}
