import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { renderWithIntl } from "@tests/helpers/utils";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }) }));
vi.mock("@/lib/actions/locale", () => ({ setLocale: vi.fn(async () => {}) }));

const signUp = vi.fn<(fd: FormData) => Promise<{ error?: string }>>(async () => ({}));
vi.mock("@/lib/actions/auth", () => ({ signUp: (fd: FormData) => signUp(fd) }));

import RegisterPage from "@/app/register/page";

const VALID = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  password: "abcdefg1",
  confirm: "abcdefg1",
};

type User = ReturnType<typeof renderWithIntl>["user"];

async function fillAll(
  user: User,
  values: { name?: string; email?: string; password?: string; confirm?: string; terms?: boolean } = {},
) {
  const v = { ...VALID, terms: true, ...values };
  if (v.name) await user.type(screen.getByLabelText("Full name"), v.name);
  if (v.email) await user.type(screen.getByLabelText("Email"), v.email);
  if (v.password) await user.type(screen.getByLabelText("Password"), v.password);
  if (v.confirm) await user.type(screen.getByLabelText("Confirm password"), v.confirm);
  if (v.terms) await user.click(screen.getByRole("checkbox"));
}

const submit = () => screen.getByRole("button", { name: "Create account" });

beforeEach(() => {
  signUp.mockReset();
  signUp.mockResolvedValue({});
});

describe("RegisterPage: structure", () => {
  it("renders heading, subtitle and all fields", () => {
    renderWithIntl(<RegisterPage />);
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
    expect(screen.getByText("Start tracking your portfolio in minutes.")).toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toHaveAttribute("name", "fullName");
    expect(screen.getByLabelText("Email")).toHaveAttribute("name", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("name", "password");
    expect(screen.getByLabelText("Confirm password")).toHaveAttribute("name", "confirmPassword");
    expect(screen.getByRole("checkbox")).toHaveAttribute("name", "acceptTerms");
  });

  it("uses appropriate autocomplete hints and required flags", () => {
    renderWithIntl(<RegisterPage />);
    expect(screen.getByLabelText("Full name")).toHaveAttribute("autocomplete", "name");
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getByLabelText("Confirm password")).toHaveAttribute("autocomplete", "new-password");
    for (const el of [
      screen.getByLabelText("Full name"),
      screen.getByLabelText("Email"),
      screen.getByLabelText("Password"),
      screen.getByLabelText("Confirm password"),
      screen.getByRole("checkbox"),
    ]) {
      expect(el).toBeRequired();
    }
  });

  it("links to login from the footer", () => {
    renderWithIntl(<RegisterPage />);
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
  });

  it("has an independent show/hide toggle for each password field", async () => {
    const { user } = renderWithIntl(<RegisterPage />);
    const toggles = screen.getAllByRole("button", { name: "Show password" });
    expect(toggles).toHaveLength(2);
    await user.click(toggles[0]);
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Confirm password")).toHaveAttribute("type", "password");
  });

  it("has no error alert initially", () => {
    renderWithIntl(<RegisterPage />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("RegisterPage: terms links", () => {
  it.each([
    ["Terms of Service", "/terms"],
    ["Privacy Policy", "/privacy"],
    ["Forex Risk Disclosure", "/risk-disclosure"],
  ])("links %s to %s in a new tab", (name, href) => {
    renderWithIntl(<RegisterPage />);
    const link = screen.getByRole("link", { name });
    expect(link).toHaveAttribute("href", href);
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("keeps the links inside the terms checkbox label", () => {
    renderWithIntl(<RegisterPage />);
    const label = screen.getByRole("checkbox").closest("label")!;
    expect(within(label).getAllByRole("link")).toHaveLength(3);
  });

  it("the terms checkbox toggles on click", async () => {
    const { user } = renderWithIntl(<RegisterPage />);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("checkbox")).toBeChecked();
    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });
});

describe("RegisterPage: submit gating", () => {
  it("is disabled initially", () => {
    renderWithIntl(<RegisterPage />);
    expect(submit()).toBeDisabled();
  });

  it("is enabled once every requirement is met", async () => {
    const { user } = renderWithIntl(<RegisterPage />);
    await fillAll(user);
    expect(submit()).toBeEnabled();
  });

  it("is blocked when only the name is missing", async () => {
    const { user } = renderWithIntl(<RegisterPage />);
    await fillAll(user, { name: "" });
    expect(submit()).toBeDisabled();
  });

  it("is blocked by a whitespace-only name", async () => {
    const { user } = renderWithIntl(<RegisterPage />);
    await fillAll(user, { name: "   " });
    expect(submit()).toBeDisabled();
  });

  it("is blocked when only the email is missing", async () => {
    const { user } = renderWithIntl(<RegisterPage />);
    await fillAll(user, { email: "" });
    expect(submit()).toBeDisabled();
  });

  it.each(["ada", "ada@", "ada@example", "ada@example.c", "@example.com", "a da@example.com"])(
    "is blocked by the invalid email %j",
    async (email) => {
      const { user } = renderWithIntl(<RegisterPage />);
      await fillAll(user, { email });
      expect(submit()).toBeDisabled();
    },
  );

  it("is enabled for a valid email with a plus tag and subdomain", async () => {
    const { user } = renderWithIntl(<RegisterPage />);
    await fillAll(user, { email: "first.last+tag@sub.example.co" });
    expect(submit()).toBeEnabled();
  });

  it("is blocked when only the password is missing (confirm can then never match)", async () => {
    const { user } = renderWithIntl(<RegisterPage />);
    await fillAll(user, { password: "" });
    expect(submit()).toBeDisabled();
  });

  it.each([
    ["too short", "abc1"],
    ["no letter", "12345678"],
    ["no number", "abcdefgh"],
    ["7 chars", "abcdef1"],
  ])("is blocked when the (matching) password is %s", async (_label, pwd) => {
    const { user } = renderWithIntl(<RegisterPage />);
    await fillAll(user, { password: pwd, confirm: pwd });
    expect(submit()).toBeDisabled();
  });

  it("accepts a password of exactly 8 characters with a letter and a number", async () => {
    const { user } = renderWithIntl(<RegisterPage />);
    await fillAll(user, { password: "abcdefg1", confirm: "abcdefg1" });
    expect(submit()).toBeEnabled();
  });

  it("is blocked when the confirmation is empty", async () => {
    const { user } = renderWithIntl(<RegisterPage />);
    await fillAll(user, { confirm: "" });
    expect(submit()).toBeDisabled();
  });

  it("is blocked when the confirmation differs", async () => {
    const { user } = renderWithIntl(<RegisterPage />);
    await fillAll(user, { confirm: "abcdefg2" });
    expect(submit()).toBeDisabled();
  });

  it("is blocked when the confirmation differs only by case", async () => {
    const { user } = renderWithIntl(<RegisterPage />);
    await fillAll(user, { confirm: "ABCDEFG1" });
    expect(submit()).toBeDisabled();
  });

  it("is blocked when only the terms are unchecked", async () => {
    const { user } = renderWithIntl(<RegisterPage />);
    await fillAll(user, { terms: false });
    expect(submit()).toBeDisabled();
  });

  it("re-disables when terms are unchecked again", async () => {
    const { user } = renderWithIntl(<RegisterPage />);
    await fillAll(user);
    expect(submit()).toBeEnabled();
    await user.click(screen.getByRole("checkbox"));
    expect(submit()).toBeDisabled();
  });

  it("re-disables when the password is changed so it no longer matches", async () => {
    const { user } = renderWithIntl(<RegisterPage />);
    await fillAll(user);
    await user.type(screen.getByLabelText("Password"), "x");
    expect(submit()).toBeDisabled();
  });

  it("re-enables when the confirmation is corrected", async () => {
    const { user } = renderWithIntl(<RegisterPage />);
    await fillAll(user, { confirm: "abcdefg" });
    expect(submit()).toBeDisabled();
    await user.type(screen.getByLabelText("Confirm password"), "1");
    expect(submit()).toBeEnabled();
  });

  it("does not call signUp when the form is invalid and the button is clicked", async () => {
    const { user } = renderWithIntl(<RegisterPage />);
    await user.click(submit());
    expect(signUp).not.toHaveBeenCalled();
  });
});

describe("RegisterPage: password rules checklist", () => {
  function rules() {
    const list = document.getElementById("password-requirements")!;
    return within(list).getAllByRole("listitem");
  }
  const met = (li: HTMLElement) => li.className.includes("text-emerald-400");

  it("lists the three translated rules", () => {
    renderWithIntl(<RegisterPage />);
    expect(rules().map((li) => li.textContent)).toEqual([
      "At least 8 characters",
      "Contains a letter",
      "Contains a number",
    ]);
  });

  it("starts with no rule met", () => {
    renderWithIntl(<RegisterPage />);
    expect(rules().some(met)).toBe(false);
  });

  it("ticks only the letter rule for letters only", async () => {
    const { user } = renderWithIntl(<RegisterPage />);
    await user.type(screen.getByLabelText("Password"), "abc");
    expect(rules().map(met)).toEqual([false, true, false]);
  });

  it("ticks only the number rule for digits only", async () => {
    const { user } = renderWithIntl(<RegisterPage />);
    await user.type(screen.getByLabelText("Password"), "123");
    expect(rules().map(met)).toEqual([false, false, true]);
  });

  it("ticks length and number for 8 digits", async () => {
    const { user } = renderWithIntl(<RegisterPage />);
    await user.type(screen.getByLabelText("Password"), "12345678");
    expect(rules().map(met)).toEqual([true, false, true]);
  });

  it("ticks length and letter for 8 letters", async () => {
    const { user } = renderWithIntl(<RegisterPage />);
    await user.type(screen.getByLabelText("Password"), "abcdefgh");
    expect(rules().map(met)).toEqual([true, true, false]);
  });

  it("ticks all rules for a strong password", async () => {
    const { user } = renderWithIntl(<RegisterPage />);
    await user.type(screen.getByLabelText("Password"), "abcdefg1");
    expect(rules().map(met)).toEqual([true, true, true]);
  });

  it("un-ticks rules when characters are removed", async () => {
    const { user } = renderWithIntl(<RegisterPage />);
    const field = screen.getByLabelText("Password");
    await user.type(field, "abcdefg1");
    await user.type(field, "{Backspace}");
    expect(rules().map(met)).toEqual([false, true, false]);
  });

  it("swaps the circle icon for a check icon when met", async () => {
    const { user } = renderWithIntl(<RegisterPage />);
    const iconOf = (li: HTMLElement) => li.querySelector("svg")!.getAttribute("class") ?? "";
    const before = iconOf(rules()[1]);
    await user.type(screen.getByLabelText("Password"), "a");
    expect(iconOf(rules()[1])).not.toBe(before);
    expect(rules()[1].querySelector("svg")).toHaveClass("lucide-check");
  });

  it("associates the checklist with the password field for assistive tech", () => {
    renderWithIntl(<RegisterPage />);
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription(/At least 8 characters/);
  });
});

describe("RegisterPage: confirm-password feedback", () => {
  it("shows nothing while the confirmation is empty", () => {
    renderWithIntl(<RegisterPage />);
    expect(screen.queryByText("Passwords do not match.")).not.toBeInTheDocument();
    expect(screen.queryByText("Passwords match.")).not.toBeInTheDocument();
  });

  it("shows a mismatch message while the confirmation differs", async () => {
    const { user } = renderWithIntl(<RegisterPage />);
    await user.type(screen.getByLabelText("Password"), "abcdefg1");
    await user.type(screen.getByLabelText("Confirm password"), "abc");
    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toHaveAttribute("aria-invalid", "true");
  });

  it("shows a match message when they are identical", async () => {
    const { user } = renderWithIntl(<RegisterPage />);
    await user.type(screen.getByLabelText("Password"), "abcdefg1");
    await user.type(screen.getByLabelText("Confirm password"), "abcdefg1");
    expect(screen.getByText("Passwords match.")).toBeInTheDocument();
    expect(screen.queryByText("Passwords do not match.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toHaveAttribute("aria-invalid", "false");
  });

  it("flips live as the user types and as the primary password changes", async () => {
    const { user } = renderWithIntl(<RegisterPage />);
    await user.type(screen.getByLabelText("Password"), "abcdefg1");
    await user.type(screen.getByLabelText("Confirm password"), "abcdefg");
    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Confirm password"), "1");
    expect(screen.getByText("Passwords match.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Password"), "2");
    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
  });

  it("announces the status politely", () => {
    renderWithIntl(<RegisterPage />);
    expect(screen.getByLabelText("Confirm password")).toHaveAccessibleDescription("");
    expect(document.getElementById("confirm-status")).toHaveAttribute("aria-live", "polite");
  });

  it("clears the message when the confirmation is emptied", async () => {
    const { user } = renderWithIntl(<RegisterPage />);
    await user.type(screen.getByLabelText("Confirm password"), "abc");
    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Confirm password"));
    expect(screen.queryByText("Passwords do not match.")).not.toBeInTheDocument();
  });

  it("reports a match even for a password that is otherwise weak (rules are separate)", async () => {
    const { user } = renderWithIntl(<RegisterPage />);
    await user.type(screen.getByLabelText("Password"), "abc");
    await user.type(screen.getByLabelText("Confirm password"), "abc");
    expect(screen.getByText("Passwords match.")).toBeInTheDocument();
    expect(submit()).toBeDisabled();
  });
});

describe("RegisterPage: submission", () => {
  it("posts the right FormData to signUp", async () => {
    const { user } = renderWithIntl(<RegisterPage />);
    await fillAll(user);
    await user.click(submit());

    await waitFor(() => expect(signUp).toHaveBeenCalledTimes(1));
    const fd = signUp.mock.calls[0][0];
    expect(fd).toBeInstanceOf(FormData);
    expect(fd.get("fullName")).toBe("Ada Lovelace");
    expect(fd.get("email")).toBe("ada@example.com");
    expect(fd.get("password")).toBe("abcdefg1");
    expect(fd.get("confirmPassword")).toBe("abcdefg1");
    expect(fd.get("acceptTerms")).toBe("on");
  });

  it("submits with the Enter key once valid", async () => {
    const { user } = renderWithIntl(<RegisterPage />);
    await fillAll(user, { confirm: "" });
    await user.type(screen.getByLabelText("Confirm password"), "abcdefg1{Enter}");
    await waitFor(() => expect(signUp).toHaveBeenCalledTimes(1));
  });

  it("renders the error returned by the action as an alert", async () => {
    signUp.mockResolvedValue({ error: "User already registered" });
    const { user } = renderWithIntl(<RegisterPage />);
    await fillAll(user);
    await user.click(submit());
    expect(await screen.findByRole("alert")).toHaveTextContent("User already registered");
  });

  it("keeps the user's input after a failed attempt", async () => {
    signUp.mockResolvedValue({ error: "Nope" });
    const { user } = renderWithIntl(<RegisterPage />);
    await fillAll(user);
    await user.click(submit());
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Full name")).toHaveValue("Ada Lovelace");
    expect(screen.getByLabelText("Email")).toHaveValue("ada@example.com");
    expect(screen.getByLabelText("Confirm password")).toHaveValue("abcdefg1");
    expect(submit()).toBeEnabled();
  });

  it("keeps the terms checkbox checked after a failed attempt", async () => {
    signUp.mockResolvedValue({ error: "Nope" });
    const { user } = renderWithIntl(<RegisterPage />);
    await fillAll(user);
    await user.click(submit());
    await screen.findByRole("alert");
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(submit()).toBeEnabled();
  });

  it("disables the submit button while the request is in flight", async () => {
    let resolve!: (v: { error?: string }) => void;
    signUp.mockImplementation(() => new Promise((r) => (resolve = r)));
    const { user } = renderWithIntl(<RegisterPage />);
    await fillAll(user);
    await user.click(submit());
    await waitFor(() => expect(submit()).toBeDisabled());
    expect(signUp).toHaveBeenCalledTimes(1);
    resolve({});
    await waitFor(() => expect(submit()).toBeEnabled());
  });

  it("does not show an alert on success", async () => {
    const { user } = renderWithIntl(<RegisterPage />);
    await fillAll(user);
    await user.click(submit());
    await waitFor(() => expect(signUp).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
