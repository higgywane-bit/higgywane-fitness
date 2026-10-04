import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("customer link rules on the server", () => {
  it("edge functions run the exact same rules as the app", () => {
    // Deno copy: cp lib/customer/link.ts supabase/functions/_shared/link.ts
    expect(readFileSync("supabase/functions/_shared/link.ts", "utf8")).toBe(readFileSync("lib/customer/link.ts", "utf8"));
  });
});
