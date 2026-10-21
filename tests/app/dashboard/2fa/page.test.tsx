import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import TwoFactorPage, { generateMetadata } from "@/app/dashboard/2fa/page";
import { requireUser } from "@/lib/auth/guard";
import { RedirectSignal, createSupabaseMock } from "@tests/helpers/supabase";

const locale = vi.hoisted(() => ({ current: "en" }));

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { loadMessages } = await import("@tests/helpers/messages");
  return {
    getTranslations: async (namespace?: string) =>
      createTranslator({ locale: locale.current, messages: loadMessages(locale.current), namespace: namespace as never }),
  };
});
vi.mock("@/lib/auth/guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/components/dashboard/TwoFactorSettings", () => ({
  TwoFactorSettings: () => <div data-testid="two-factor-settings" />,
}));

beforeEach(() => {
  locale.current = "en";
  vi.mocked(requireUser).mockResolvedValue({
    supabase: createSupabaseMock().client,
    user: { id: "user-1", email: "user@example.com" },
  } as unknown as Awaited<ReturnType<typeof requireUser>>);
});

describe("2FA page", () => {
  it("sets the page title", async () => {
    expect(await generateMetadata()).toEqual({ title: "2FA Setting" });
  });

  it("requires a signed-in user", async () => {
    await TwoFactorPage();
    expect(requireUser).toHaveBeenCalledTimes(1);
  });

  it("propagates the redirect for signed-out users", async () => {
    vi.mocked(requireUser).mockRejectedValue(new RedirectSignal("/login"));
    await expect(TwoFactorPage()).rejects.toMatchObject({ digest: expect.stringContaining("/login") });
  });

  it("renders the heading and the settings panel", async () => {
    render(await TwoFactorPage());
    expect(screen.getByRole("heading", { level: 1, name: "2FA Setting" })).toBeInTheDocument();
    expect(screen.getByTestId("two-factor-settings")).toBeInTheDocument();
  });

  it("renders localised headings", async () => {
    locale.current = "fr";
    render(await TwoFactorPage());
    expect(screen.getByRole("heading", { level: 1, name: "Paramètres 2FA" })).toBeInTheDocument();
    expect(await generateMetadata()).toEqual({ title: "Paramètres 2FA" });
  });

  it("renders the Chinese heading", async () => {
    locale.current = "zh";
    render(await TwoFactorPage());
    expect(screen.getByRole("heading", { level: 1, name: "2FA 设置" })).toBeInTheDocument();
  });
});
