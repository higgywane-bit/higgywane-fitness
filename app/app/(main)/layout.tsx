import { requireClient } from "@/lib/pt/session";
import { RefreshOnFocus } from "@/components/pt/refresh-on-focus";

/* Everything here needs a signed-in client. */
export default async function SignedInLayout({ children }: { children: React.ReactNode }) {
  await requireClient();
  return (
    <>
      <RefreshOnFocus />
      {children}
    </>
  );
}
