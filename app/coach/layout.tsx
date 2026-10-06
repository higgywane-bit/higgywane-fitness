import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/pt/controls";
import { thai } from "@/components/pt/fonts";
import { PT_APP } from "@/content/pt-app";

export const metadata: Metadata = {
  title: { default: `Coach | ${PT_APP.name}`, template: `%s | Coach | ${PT_APP.name}` },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Coach" },
  robots: { index: false },
};

export const viewport: Viewport = { themeColor: "#000000", colorScheme: "dark" };

export default function CoachRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`s1 ${thai.variable} min-h-dvh`}>
      {children}
      <Toaster />
    </div>
  );
}
