import { Noto_Sans_Thai } from "next/font/google";

/** Thai text (cues, exercise groups) for the super1 apps. Inter comes from the root layout. */
export const thai = Noto_Sans_Thai({
  subsets: ["thai"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-thai",
  display: "swap",
});
