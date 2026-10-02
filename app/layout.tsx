import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import "./globals.css";

/*
 * Display: Avenir Next LT Pro Heavy Condensed via the owner's Adobe Fonts kit.
 * Until NEXT_PUBLIC_ADOBE_FONTS_KIT is set we fall back to Barlow Condensed 800/900.
 * TODO: confirm with owner (Adobe Fonts kit ID)
 */
const adobeKit = process.env.NEXT_PUBLIC_ADOBE_FONTS_KIT;

const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--font-barlow",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Superfit",
    template: "%s | Superfit",
  },
  description:
    "Superfit bodybuilding gym and cafe in Thailand. Order protein smoothies, fresh juice and coffee with live macros.",
  applicationName: "Superfit",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Superfit" },
  icons: { icon: "/brand/superfit-star-white.svg" },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const displayFace = adobeKit
    ? `"avenir-next-lt-pro-condensed", var(--font-barlow)`
    : "var(--font-barlow)";
  const bodyFace = adobeKit ? `"avenir-next-lt-pro", var(--font-inter)` : "var(--font-inter)";

  return (
    <html
      lang="en"
      className={`dark ${display.variable} ${body.variable}`}
      style={
        {
          "--font-display-face": displayFace,
          "--font-body": bodyFace,
        } as React.CSSProperties
      }
    >
      <head>
        {adobeKit ? (
          // eslint-disable-next-line @next/next/no-css-tags
          <link rel="stylesheet" href={`https://use.typekit.net/${adobeKit}.css`} />
        ) : null}
      </head>
      <body>{children}</body>
    </html>
  );
}
