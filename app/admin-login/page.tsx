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
        <LoginForm next={next ?? "/admin"} />
      </div>
    </main>
  );
}
