import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ChangePasswordPage, { generateMetadata } from "@/app/dashboard/change-password/page";
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
vi.mock("@/components/dashboard/ChangePasswordForm", () => ({
  ChangePasswordForm: () => <div data-testid="change-password-form" />,
}));

beforeEach(() => {
  locale.current = "en";
  vi.mocked(requireUser).mockResolvedValue({
    supabase: createSupabaseMock().client,
    user: { id: "user-1", email: "user@example.com" },
  } as unknown as Awaited<ReturnType<typeof requireUser>>);
});

describe("change password page", () => {
  it("sets the page title", async () => {
    expect(await generateMetadata()).toEqual({ title: "Change Password" });
  });

  it("requires a signed-in user", async () => {
    await ChangePasswordPage();
    expect(requireUser).toHaveBeenCalledTimes(1);
  });

  it("propagates the redirect for signed-out users", async () => {
    vi.mocked(requireUser).mockRejectedValue(new RedirectSignal("/login"));
    await expect(ChangePasswordPage()).rejects.toMatchObject({ digest: expect.stringContaining("/login") });
  });

  it("renders the heading and the form", async () => {
    render(await ChangePasswordPage());
    expect(screen.getByRole("heading", { level: 1, name: "Change Password" })).toBeInTheDocument();
    expect(screen.getByTestId("change-password-form")).toBeInTheDocument();
  });

  it("renders localised headings", async () => {
    locale.current = "fr";
    render(await ChangePasswordPage());
    expect(screen.getByRole("heading", { level: 1, name: "Changer le mot de passe" })).toBeInTheDocument();
    expect(await generateMetadata()).toEqual({ title: "Changer le mot de passe" });
  });

  it("renders the Chinese heading", async () => {
    locale.current = "zh";
    render(await ChangePasswordPage());
    expect(screen.getByRole("heading", { level: 1, name: "修改密码" })).toBeInTheDocument();
  });
});
