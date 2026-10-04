import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Edge functions run in Deno and import exact copies of these pure files.
const COPIES: [server: string, app: string][] = [
  // cp lib/customer/link.ts supabase/functions/_shared/link.ts
  ["supabase/functions/_shared/link.ts", "lib/customer/link.ts"],
  // cp lib/payments/promptpay.ts supabase/functions/_shared/promptpay.ts
  ["supabase/functions/_shared/promptpay.ts", "lib/payments/promptpay.ts"],
];

describe("rules on the server", () => {
  it.each(COPIES)("%s is an exact copy of %s", (server, app) => {
    expect(readFileSync(server, "utf8")).toBe(readFileSync(app, "utf8"));
  });
});
