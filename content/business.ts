/*
 * Superfit business facts: opening hours, location, contact.
 * Leah (the chat assistant) and the site read from here.
 * TODO: confirm with owner (every value below is a placeholder written for layout)
 */

export type DayHours = { open: string; close: string } | null;

/** ISO weekday 1 = Monday … 7 = Sunday, times "HH:MM" Bangkok time. null = closed. */
export type WeeklyHours = Record<1 | 2 | 3 | 4 | 5 | 6 | 7, DayHours>;

export const TIMEZONE = "Asia/Bangkok";

export const business = {
  name: "Superfit",
  tagline: "Bodybuilding gym and cafe",
  // TODO: confirm with owner
  address: "Superfit, Thailand (full address to be confirmed)",
  // TODO: confirm with owner
  mapsUrl: "https://maps.google.com/?q=Superfit+Thailand",
  contact: {
    // TODO: confirm with owner
    line: { handle: "@superfit", url: "https://line.me/R/ti/p/@superfit" },
    // TODO: confirm with owner
    instagram: { handle: "@superfit", url: "https://instagram.com/superfit" },
    // TODO: confirm with owner
    phone: "",
  },
  hours: {
    // TODO: confirm with owner
    gym: {
      1: { open: "06:00", close: "22:00" },
      2: { open: "06:00", close: "22:00" },
      3: { open: "06:00", close: "22:00" },
      4: { open: "06:00", close: "22:00" },
      5: { open: "06:00", close: "22:00" },
      6: { open: "07:00", close: "20:00" },
      7: { open: "07:00", close: "20:00" },
    } satisfies WeeklyHours,
    // TODO: confirm with cafe
    cafe: {
      1: { open: "07:00", close: "20:00" },
      2: { open: "07:00", close: "20:00" },
      3: { open: "07:00", close: "20:00" },
      4: { open: "07:00", close: "20:00" },
      5: { open: "07:00", close: "20:00" },
      6: { open: "08:00", close: "18:00" },
      7: { open: "08:00", close: "18:00" },
    } satisfies WeeklyHours,
  },
} as const;
