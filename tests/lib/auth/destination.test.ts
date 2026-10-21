import { describe, expect, it } from "vitest";
import { postLoginDestination } from "@/lib/auth/destination";

describe("postLoginDestination", () => {
  it("sends an admin to /admin", () => {
    expect(postLoginDestination("ADMIN")).toBe("/admin");
  });

  it("sends a regular user to /dashboard", () => {
    expect(postLoginDestination("USER")).toBe("/dashboard");
  });

  it("defaults to /dashboard when the role is null, undefined, or any other value", () => {
    expect(postLoginDestination(null)).toBe("/dashboard");
    expect(postLoginDestination(undefined)).toBe("/dashboard");
    expect(postLoginDestination("")).toBe("/dashboard");
    expect(postLoginDestination("SUPERADMIN")).toBe("/dashboard");
  });

  it("is case-sensitive: only the exact string ADMIN counts", () => {
    expect(postLoginDestination("admin")).toBe("/dashboard");
    expect(postLoginDestination("Admin")).toBe("/dashboard");
  });
});
