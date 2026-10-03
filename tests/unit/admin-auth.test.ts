import { describe, expect, it } from "vitest";
import { adminAuthConfig, checkCredentials, createSession, verifySession } from "@/lib/admin-auth";

const cfg = adminAuthConfig({ ADMIN_EMAIL: " Hello@Superfit.co.th ", ADMIN_PASSWORD: "lift-heavy-99" })!;

describe("admin sign-in", () => {
  it("is off until both email and password are set", () => {
    expect(adminAuthConfig({})).toBeNull();
    expect(adminAuthConfig({ ADMIN_EMAIL: "a@b.co" })).toBeNull();
    expect(cfg.email).toBe("hello@superfit.co.th");
  });

  it("checks credentials, ignoring email case", () => {
    expect(checkCredentials(cfg, "HELLO@superfit.co.th", "lift-heavy-99")).toBe(true);
    expect(checkCredentials(cfg, "hello@superfit.co.th", "lift-heavy-98")).toBe(false);
    expect(checkCredentials(cfg, "other@superfit.co.th", "lift-heavy-99")).toBe(false);
  });

  it("issues sessions that verify, expire and can't be forged", async () => {
    const now = Date.UTC(2026, 9, 3);
    const token = await createSession(cfg, now);
    expect(await verifySession(cfg, token, now + 1000)).toBe(true);
    expect(await verifySession(cfg, token, now + 31 * 86_400_000)).toBe(false);
    expect(await verifySession(cfg, token.slice(0, -2) + "xx", now)).toBe(false);
    expect(await verifySession(cfg, undefined, now)).toBe(false);
    const other = adminAuthConfig({ ADMIN_EMAIL: "hello@superfit.co.th", ADMIN_PASSWORD: "changed" })!;
    expect(await verifySession(other, token, now)).toBe(false);
  });
});
