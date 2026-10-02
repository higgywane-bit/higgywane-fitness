/** Front-desk rules. Change here, not in components. TODO: confirm with owner */
export const GYM = {
  name: "Superfit",
  /** Thailand is UTC+7 all year (no daylight saving). */
  utcOffsetHours: 7,
  /** A member shows as "expiring" when this many days (or fewer) are left. */
  expiringSoonDays: 7,
  /** Check-in screen nudges a renewal at this many days left. */
  renewNudgeDays: 3,
  /** A second scan within this window is treated as the same visit. */
  duplicateScanSeconds: 120,
  /** Reminder emails: days before the end date, and days after expiry for the win-back. */
  reminders: { before: [7, 1], after: [3] },
  /** Opening hours, used for the peak-hours chart. TODO: confirm with owner */
  hours: { open: 6, close: 22 },
} as const;
