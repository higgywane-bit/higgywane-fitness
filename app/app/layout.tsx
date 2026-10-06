import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/pt/controls";
import { thai } from "@/components/pt/fonts";
import { PT_APP } from "@/content/pt-app";

/* The client app: phone-first, one column, works the same on any screen. */

export const metadata: Metadata = {
  title: { default: PT_APP.name, template: `%s | ${PT_APP.name}` },
  applicationName: PT_APP.name,
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: PT_APP.name },
  robots: { index: false },
};

export const viewport: Viewport = { themeColor: "#000000", colorScheme: "dark" };

export default function ClientAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`s1 ${thai.variable} min-h-dvh`}>
      <div className="mx-auto min-h-dvh w-full max-w-md">{children}</div>
      <Toaster />
    </div>
  );
}
