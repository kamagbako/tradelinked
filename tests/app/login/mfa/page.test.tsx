import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@tests/helpers/utils";
import { createSupabaseMock, type SupabaseMockOptions } from "@tests/helpers/supabase";

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/actions/locale", () => ({ setLocale: vi.fn(async () => {}) }));

const signOut = vi.fn(async () => {});
vi.mock("@/lib/actions/auth", () => ({ signOut: () => signOut() }));

const logError = vi.fn();
vi.mock("@/lib/logger", () => ({ logError: (...a: unknown[]) => logError(...a), logWarn: vi.fn() }));

const state = vi.hoisted(() => ({ client: undefined as unknown }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => state.client }));

import MfaChallengePage from "@/app/login/mfa/page";

let mock: ReturnType<typeof createSupabaseMock>["client"];

function setup(
  factors: { id: string; status?: string }[] = [{ id: "factor-1", status: "verified" }],
  tables: SupabaseMockOptions["tables"] = {},
) {
  mock = createSupabaseMock({ factors: { totp: factors }, tables }).client;
  state.client = mock;
}

const codeInput = () => screen.getByLabelText("Authentication code");
const verify = () => screen.getByRole("button", { name: "Verify" });

async function renderReady() {
  const view = renderWithIntl(<MfaChallengePage />);
  await waitFor(() => expect(mock.auth.mfa.listFactors).toHaveBeenCalled());
  // The button stays disabled until a factor is loaded; wait for the load to settle by typing a code later.
  return view;
}

beforeEach(() => {
  router.replace.mockClear();
  router.refresh.mockClear();
  signOut.mockClear();
  logError.mockClear();
  setup();
});

describe("MfaChallengePage: rendering", () => {
  it("renders the heading, subtitle and code field", async () => {
    await renderReady();
    expect(screen.getByRole("heading", { name: "Two-factor authentication" })).toBeInTheDocument();
    expect(screen.getByText("Enter the 6-digit code from your authenticator app.")).toBeInTheDocument();
    expect(codeInput()).toHaveAttribute("placeholder", "123456");
  });

  it("configures the code input for one-time codes", async () => {
    await renderReady();
    expect(codeInput()).toHaveAttribute("inputmode", "numeric");
    expect(codeInput()).toHaveAttribute("autocomplete", "one-time-code");
    expect(codeInput()).toHaveAttribute("maxlength", "6");
  });

  it("focuses the code input automatically", async () => {
    await renderReady();
    expect(codeInput()).toHaveFocus();
  });

  it("offers a 'use a different account' sign-out control in the footer", async () => {
    const { user } = await renderReady();
    await user.click(screen.getByRole("button", { name: "Use a different account" }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("does not show an error initially", async () => {
    await renderReady();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("MfaChallengePage: factor lookup", () => {
  it("redirects to /dashboard when the user has no TOTP factor", async () => {
    setup([]);
    renderWithIntl(<MfaChallengePage />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("does not redirect when a factor exists", async () => {
    await renderReady();
    await waitFor(() => expect(mock.auth.mfa.listFactors).toHaveBeenCalledTimes(1));
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("shows a friendly error and logs when listing factors throws", async () => {
    setup();
    const failure = new Error("network down");
    mock.auth.mfa.listFactors.mockRejectedValueOnce(failure);
    renderWithIntl(<MfaChallengePage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong. Please try again.");
    expect(logError).toHaveBeenCalledWith("mfa.listFactors", failure);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("keeps verify disabled when factors could not be loaded", async () => {
    setup();
    mock.auth.mfa.listFactors.mockRejectedValueOnce(new Error("x"));
    const { user } = renderWithIntl(<MfaChallengePage />);
    await screen.findByRole("alert");
    await user.type(codeInput(), "123456");
    expect(verify()).toBeDisabled();
  });

  it("looks up factors only once", async () => {
    const { rerender } = await renderReady();
    rerender(<MfaChallengePage />);
    expect(mock.auth.mfa.listFactors).toHaveBeenCalledTimes(1);
  });
});

describe("MfaChallengePage: code entry", () => {
  it("is disabled until 6 digits are entered", async () => {
    const { user } = await renderReady();
    expect(verify()).toBeDisabled();
    await user.type(codeInput(), "12345");
    expect(verify()).toBeDisabled();
    await user.type(codeInput(), "6");
    await waitFor(() => expect(verify()).toBeEnabled());
  });

  it("strips non-digit characters", async () => {
    const { user } = await renderReady();
    await user.type(codeInput(), "1a2-b3 4");
    expect(codeInput()).toHaveValue("1234");
  });

  it("only allows 6 characters", async () => {
    const { user } = await renderReady();
    await user.type(codeInput(), "12345678");
    expect(codeInput()).toHaveValue("123456");
  });

  it("filters pasted text down to digits", async () => {
    const { user } = await renderReady();
    await user.click(codeInput());
    await user.paste("12 34");
    expect(codeInput()).toHaveValue("1234");
  });

  it("re-disables verify when a digit is removed", async () => {
    const { user } = await renderReady();
    await user.type(codeInput(), "123456");
    await waitFor(() => expect(verify()).toBeEnabled());
    await user.type(codeInput(), "{Backspace}");
    expect(verify()).toBeDisabled();
  });

  it("keeps verify disabled for letters only", async () => {
    const { user } = await renderReady();
    await user.type(codeInput(), "abcdef");
    expect(codeInput()).toHaveValue("");
    expect(verify()).toBeDisabled();
  });
});

describe("MfaChallengePage: verification", () => {
  async function enterCode(user: Awaited<ReturnType<typeof renderReady>>["user"], code = "123456") {
    await user.type(codeInput(), code);
    await waitFor(() => expect(verify()).toBeEnabled());
  }

  it("verifies the code against the loaded factor", async () => {
    const { user } = await renderReady();
    await enterCode(user);
    await user.click(verify());
    await waitFor(() =>
      expect(mock.auth.mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: "factor-1", code: "123456" }),
    );
  });

  it("uses the first TOTP factor", async () => {
    setup([{ id: "first" }, { id: "second" }]);
    const { user } = renderWithIntl(<MfaChallengePage />);
    await user.type(codeInput(), "000000");
    await waitFor(() => expect(verify()).toBeEnabled());
    await user.click(verify());
    await waitFor(() =>
      expect(mock.auth.mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: "first", code: "000000" }),
    );
  });

  it("goes to /dashboard and refreshes on success", async () => {
    const { user } = await renderReady();
    await enterCode(user);
    await user.click(verify());
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/dashboard"));
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("goes straight to /admin on success for an admin account", async () => {
    setup(undefined, { profiles: { data: { role: "ADMIN" } } });
    mock.auth.mfa.challengeAndVerify.mockResolvedValueOnce({ data: { user: { id: "admin-1" } }, error: null } as never);
    const { user } = await renderReady();
    await enterCode(user);
    await user.click(verify());
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/admin"));
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("submits with the Enter key", async () => {
    const { user } = await renderReady();
    await enterCode(user);
    await user.type(codeInput(), "{Enter}");
    await waitFor(() => expect(mock.auth.mfa.challengeAndVerify).toHaveBeenCalledTimes(1));
  });

  it("does not submit an incomplete code with Enter", async () => {
    const { user } = await renderReady();
    await user.type(codeInput(), "123{Enter}");
    expect(mock.auth.mfa.challengeAndVerify).not.toHaveBeenCalled();
  });

  it("shows the invalid-code error and stays on the page when the code is wrong", async () => {
    mock.auth.mfa.challengeAndVerify.mockResolvedValueOnce({ data: {}, error: { message: "bad" } } as never);
    const { user } = await renderReady();
    await enterCode(user);
    await user.click(verify());
    expect(await screen.findByRole("alert")).toHaveTextContent("That code didn't work. Please try again.");
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("re-enables verify after a wrong code so the user can retry", async () => {
    mock.auth.mfa.challengeAndVerify.mockResolvedValueOnce({ data: {}, error: { message: "bad" } } as never);
    const { user } = await renderReady();
    await enterCode(user);
    await user.click(verify());
    await screen.findByRole("alert");
    expect(verify()).toBeEnabled();
    await user.click(verify());
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("clears the previous error when submitting again", async () => {
    mock.auth.mfa.challengeAndVerify.mockResolvedValueOnce({ data: {}, error: { message: "bad" } } as never);
    const { user } = await renderReady();
    await enterCode(user);
    await user.click(verify());
    await screen.findByRole("alert");
    await user.click(verify());
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("shows the friendly unexpected-error message (no crash) when verification throws", async () => {
    const failure = new Error("socket hang up");
    mock.auth.mfa.challengeAndVerify.mockRejectedValueOnce(failure);
    const { user } = await renderReady();
    await enterCode(user);
    await user.click(verify());
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong. Please try again.");
    expect(screen.queryByText(/socket hang up/)).not.toBeInTheDocument();
    expect(logError).toHaveBeenCalledWith("mfa.verify", failure);
    expect(router.replace).not.toHaveBeenCalled();
    expect(verify()).toBeEnabled();
    expect(screen.getByRole("heading", { name: "Two-factor authentication" })).toBeInTheDocument();
  });

  it("disables verify while the request is in flight", async () => {
    let resolve!: (v: unknown) => void;
    mock.auth.mfa.challengeAndVerify.mockImplementationOnce(() => new Promise((r) => (resolve = r)) as never);
    const { user } = await renderReady();
    await enterCode(user);
    await user.click(verify());
    await waitFor(() => expect(verify()).toBeDisabled());
    resolve({ data: { user: { id: "user-1" } }, error: null });
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("sends the entered code as a plain digit string", async () => {
    const { user } = await renderReady();
    await enterCode(user, "654321");
    await user.click(verify());
    await waitFor(() => expect(mock.auth.mfa.challengeAndVerify).toHaveBeenCalledTimes(1));
    expect(mock.auth.mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: "factor-1", code: "654321" });
  });

  it("does not nest the footer <form> inside a paragraph (hydration regression)", async () => {
    // React only logs a given nesting warning once per file, so assert the structure directly.
    renderWithIntl(<MfaChallengePage />);
    const button = await screen.findByRole("button", { name: "Use a different account" });
    expect(button.closest("form")).not.toBeNull();
    expect(button.closest("p")).toBeNull();
  });

  it("shows the friendly error instead of crashing when the Supabase client cannot be created", async () => {
    Object.defineProperty(state, "client", {
      configurable: true,
      get() {
        throw new Error("Missing environment variables");
      },
    });
    renderWithIntl(<MfaChallengePage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong. Please try again.");
    expect(logError).toHaveBeenCalledWith("mfa.createClient", expect.any(Error));
    Object.defineProperty(state, "client", { configurable: true, writable: true, value: undefined });
  });
});
