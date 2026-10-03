import { Logo } from "@/components/brand/logo";
import { LoginForm } from "./login-form";

export const metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="grid min-h-dvh place-items-center bg-black px-5">
      <div className="w-full max-w-sm">
        <Logo className="mx-auto h-6" />
        <h1 className="text-statement mt-8 text-center text-[44px]">Staff only</h1>
        <p className="mt-2 text-center text-sm text-text-secondary">Sign in with the Superfit account.</p>
        <LoginForm next={next ?? "/admin"} />
      </div>
    </main>
  );
}
