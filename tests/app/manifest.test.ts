import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

describe("manifest.ts", () => {
  const m = manifest();

  it("is an installable standalone app that starts on the dashboard", () => {
    expect(m.name).toBe("TradeLinked");
    expect(m.short_name).toBe("TradeLinked");
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/dashboard");
  });

  it("has matching background and theme colours", () => {
    expect(m.background_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(m.theme_color).toBe(m.background_color);
  });

  it("provides 192px and 512px png icons", () => {
    expect(m.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: "192x192", type: "image/png", src: "/icons/icon-192.png" }),
        expect.objectContaining({ sizes: "512x512", type: "image/png", src: "/icons/icon-512.png" }),
      ]),
    );
  });

  it("has a description", () => {
    expect(m.description).toBeTruthy();
  });
});
