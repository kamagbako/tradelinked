import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import ProfilePage, { generateMetadata } from "@/app/dashboard/profile/page";
import { requireUser } from "@/lib/auth/guard";
import { loadMessages } from "@tests/helpers/messages";
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
vi.mock("@/lib/actions/account", () => ({ updateProfile: vi.fn(), changePassword: vi.fn() }));

beforeEach(() => {
  locale.current = "en";
});

const profile = (over: Record<string, unknown> = {}) => ({
  id: "user-1",
  email: "ada@example.com",
  full_name: null,
  first_name: null,
  last_name: null,
  phone: null,
  country: null,
  state: null,
  zip_code: null,
  city: null,
  address: null,
  ...over,
});

async function renderPage(data: Record<string, unknown> | null, userEmail = "auth@example.com") {
  const mock = createSupabaseMock({ tables: { profiles: { data } } });
  vi.mocked(requireUser).mockResolvedValue({
    supabase: mock.client,
    user: { id: "user-1", email: userEmail },
  } as unknown as Awaited<ReturnType<typeof requireUser>>);

  const ui = await ProfilePage();
  render(
    <NextIntlClientProvider locale={locale.current} messages={loadMessages(locale.current)} timeZone="UTC">
      {ui}
    </NextIntlClientProvider>,
  );
  return mock;
}

const field = (label: string | RegExp) => screen.getByLabelText(label);

describe("profile page", () => {
  it("sets the page title", async () => {
    expect(await generateMetadata()).toEqual({ title: "Profile" });
  });

  it("propagates the redirect for signed-out users", async () => {
    vi.mocked(requireUser).mockRejectedValue(new RedirectSignal("/login"));
    await expect(ProfilePage()).rejects.toMatchObject({ digest: expect.stringContaining("/login") });
  });

  it("renders the heading and the profile form", async () => {
    await renderPage(profile());
    expect(screen.getByRole("heading", { level: 1, name: "Profile Setting" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
  });

  it("loads the signed-in user's profile row", async () => {
    const { builders } = await renderPage(profile());
    expect(builders.profiles.calls).toContainEqual({ method: "eq", args: ["id", "user-1"] });
  });

  it("prefills every field from the profile", async () => {
    await renderPage(
      profile({
        first_name: "Ada",
        last_name: "Lovelace",
        phone: "+44 1",
        country: "UK",
        state: "England",
        zip_code: "N1",
        city: "London",
        address: "12 Way",
      }),
    );
    expect(field(/First name/)).toHaveValue("Ada");
    expect(field(/Last name/)).toHaveValue("Lovelace");
    expect(field("Phone")).toHaveValue("+44 1");
    expect(field("Country")).toHaveValue("UK");
    expect(field("State")).toHaveValue("England");
    expect(field("Zip code")).toHaveValue("N1");
    expect(field("City")).toHaveValue("London");
    expect(field("Address")).toHaveValue("12 Way");
    expect(field("Email")).toHaveValue("ada@example.com");
  });

  describe("name fallback from full_name (accounts predating first/last name)", () => {
    it("splits a two-word full name into first and last", async () => {
      await renderPage(profile({ full_name: "Ada Lovelace" }));
      expect(field(/First name/)).toHaveValue("Ada");
      expect(field(/Last name/)).toHaveValue("Lovelace");
    });

    it("puts everything after the first word into the last name", async () => {
      await renderPage(profile({ full_name: "Ada Augusta King Lovelace" }));
      expect(field(/First name/)).toHaveValue("Ada");
      expect(field(/Last name/)).toHaveValue("Augusta King Lovelace");
    });

    it("uses a single-word full name as the first name and leaves the last name empty", async () => {
      await renderPage(profile({ full_name: "Madonna" }));
      expect(field(/First name/)).toHaveValue("Madonna");
      expect(field(/Last name/)).toHaveValue("");
    });

    it("leaves both names empty when there is no full name either", async () => {
      await renderPage(profile({ full_name: null }));
      expect(field(/First name/)).toHaveValue("");
      expect(field(/Last name/)).toHaveValue("");
    });

    it("prefers explicit first and last names over full_name", async () => {
      await renderPage(profile({ full_name: "Old Name", first_name: "New", last_name: "Person" }));
      expect(field(/First name/)).toHaveValue("New");
      expect(field(/Last name/)).toHaveValue("Person");
    });

    it("falls back per field, so a missing last name is still derived from full_name", async () => {
      await renderPage(profile({ full_name: "Ada Lovelace", first_name: "Augusta", last_name: null }));
      expect(field(/First name/)).toHaveValue("Augusta");
      expect(field(/Last name/)).toHaveValue("Lovelace");
    });
  });

  describe("email", () => {
    it("uses the profile email", async () => {
      await renderPage(profile({ email: "profile@example.com" }), "auth@example.com");
      expect(field("Email")).toHaveValue("profile@example.com");
    });

    it("falls back to the auth user's email when the profile row is missing", async () => {
      await renderPage(null, "auth@example.com");
      expect(field("Email")).toHaveValue("auth@example.com");
      expect(field(/First name/)).toHaveValue("");
    });
  });

  it("renders French copy", async () => {
    locale.current = "fr";
    await renderPage(profile({ first_name: "Ada" }));
    expect(screen.getByRole("heading", { level: 1, name: "Paramètres du profil" })).toBeInTheDocument();
    expect(field(/Prénom/)).toHaveValue("Ada");
    expect(await generateMetadata()).toEqual({ title: "Profil" });
  });

  it("renders Chinese copy", async () => {
    locale.current = "zh";
    await renderPage(profile());
    expect(screen.getByRole("heading", { level: 1, name: "个人资料设置" })).toBeInTheDocument();
  });
});
