import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { ChangePasswordForm } from "@/components/dashboard/ChangePasswordForm";
import { changePassword } from "@/lib/actions/account";
import { renderWithIntl } from "@tests/helpers/utils";

vi.mock("@/lib/actions/account", () => ({ changePassword: vi.fn() }));

const change = vi.mocked(changePassword);

const current = () => screen.getByLabelText("Current password");
const next = () => screen.getByLabelText("New password");
const confirm = () => screen.getByLabelText("Confirm new password");
const submitButton = () => screen.getByRole("button", { name: "Update password" });

type User = ReturnType<typeof renderWithIntl>["user"];

async function fillValid(user: User, { cur = "oldpass1", pw = "newpass12" } = {}) {
  await user.type(current(), cur);
  await user.type(next(), pw);
  await user.type(confirm(), pw);
}

const rule = (text: string) => screen.getByText(text).closest("li") as HTMLElement;

describe("ChangePasswordForm", () => {
  describe("initial state", () => {
    it("renders three empty password fields and a disabled submit button", () => {
      renderWithIntl(<ChangePasswordForm />);
      expect(current()).toHaveValue("");
      expect(next()).toHaveValue("");
      expect(confirm()).toHaveValue("");
      expect(submitButton()).toBeDisabled();
    });

    it("uses password inputs with suitable autocomplete values", () => {
      renderWithIntl(<ChangePasswordForm />);
      expect(current()).toHaveAttribute("type", "password");
      expect(current()).toHaveAttribute("autocomplete", "current-password");
      expect(next()).toHaveAttribute("autocomplete", "new-password");
      expect(confirm()).toHaveAttribute("autocomplete", "new-password");
    });

    it("lets each field's visibility be toggled independently", async () => {
      const { user } = renderWithIntl(<ChangePasswordForm />);
      const toggles = screen.getAllByRole("button", { name: "Show password" });
      expect(toggles).toHaveLength(3);
      await user.click(toggles[1]);
      expect(next()).toHaveAttribute("type", "text");
      expect(current()).toHaveAttribute("type", "password");
      expect(confirm()).toHaveAttribute("type", "password");
    });
  });

  describe("password rules checklist", () => {
    it("lists the three rules, all unmet initially", () => {
      renderWithIntl(<ChangePasswordForm />);
      for (const text of ["At least 8 characters", "Contains a letter", "Contains a number"]) {
        expect(rule(text)).toHaveClass("text-text-muted");
        expect(rule(text)).not.toHaveClass("text-emerald-400");
        expect(rule(text).querySelector("svg.lucide-circle")).toBeInTheDocument();
      }
    });

    it("ticks the letter rule for letters only", async () => {
      const { user } = renderWithIntl(<ChangePasswordForm />);
      await user.type(next(), "abc");
      expect(rule("Contains a letter")).toHaveClass("text-emerald-400");
      expect(rule("Contains a letter").querySelector("svg.lucide-check")).toBeInTheDocument();
      expect(rule("Contains a number")).not.toHaveClass("text-emerald-400");
      expect(rule("At least 8 characters")).not.toHaveClass("text-emerald-400");
    });

    it("ticks the number rule for digits only", async () => {
      const { user } = renderWithIntl(<ChangePasswordForm />);
      await user.type(next(), "123");
      expect(rule("Contains a number")).toHaveClass("text-emerald-400");
      expect(rule("Contains a letter")).not.toHaveClass("text-emerald-400");
    });

    it("ticks the length rule at exactly eight characters", async () => {
      const { user } = renderWithIntl(<ChangePasswordForm />);
      await user.type(next(), "1234567");
      expect(rule("At least 8 characters")).not.toHaveClass("text-emerald-400");
      await user.type(next(), "8");
      expect(rule("At least 8 characters")).toHaveClass("text-emerald-400");
    });

    it("ticks every rule for a strong password", async () => {
      const { user } = renderWithIntl(<ChangePasswordForm />);
      await user.type(next(), "abcdefg1");
      for (const text of ["At least 8 characters", "Contains a letter", "Contains a number"]) {
        expect(rule(text)).toHaveClass("text-emerald-400");
      }
    });
  });

  describe("confirmation feedback", () => {
    it("shows no message until something is typed in the confirm field", async () => {
      const { user } = renderWithIntl(<ChangePasswordForm />);
      await user.type(next(), "abcdefg1");
      expect(screen.queryByText("Passwords match.")).not.toBeInTheDocument();
      expect(screen.queryByText("Passwords do not match.")).not.toBeInTheDocument();
    });

    it("shows a mismatch message in red", async () => {
      const { user } = renderWithIntl(<ChangePasswordForm />);
      await user.type(next(), "abcdefg1");
      await user.type(confirm(), "abcdefg2");
      expect(screen.getByText("Passwords do not match.")).toHaveClass("text-red-400");
    });

    it("shows a match message in green", async () => {
      const { user } = renderWithIntl(<ChangePasswordForm />);
      await user.type(next(), "abcdefg1");
      await user.type(confirm(), "abcdefg1");
      expect(screen.getByText("Passwords match.")).toHaveClass("text-emerald-400");
    });

    it("re-evaluates when the new password changes after confirming", async () => {
      const { user } = renderWithIntl(<ChangePasswordForm />);
      await user.type(next(), "abcdefg1");
      await user.type(confirm(), "abcdefg1");
      await user.type(next(), "x");
      expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    });
  });

  describe("submit button gating", () => {
    it("stays disabled without a current password", async () => {
      const { user } = renderWithIntl(<ChangePasswordForm />);
      await user.type(next(), "newpass12");
      await user.type(confirm(), "newpass12");
      expect(submitButton()).toBeDisabled();
    });

    it("stays disabled when the new password breaks a rule", async () => {
      const { user } = renderWithIntl(<ChangePasswordForm />);
      await user.type(current(), "oldpass1");
      await user.type(next(), "short1");
      await user.type(confirm(), "short1");
      expect(submitButton()).toBeDisabled();
    });

    it("stays disabled when the password has no digit", async () => {
      const { user } = renderWithIntl(<ChangePasswordForm />);
      await user.type(current(), "oldpass1");
      await user.type(next(), "onlyletters");
      await user.type(confirm(), "onlyletters");
      expect(submitButton()).toBeDisabled();
    });

    it("stays disabled when the confirmation does not match", async () => {
      const { user } = renderWithIntl(<ChangePasswordForm />);
      await user.type(current(), "oldpass1");
      await user.type(next(), "newpass12");
      await user.type(confirm(), "newpass13");
      expect(submitButton()).toBeDisabled();
    });

    it("stays disabled when the confirmation is empty", async () => {
      const { user } = renderWithIntl(<ChangePasswordForm />);
      await user.type(current(), "oldpass1");
      await user.type(next(), "newpass12");
      expect(submitButton()).toBeDisabled();
    });

    it("becomes enabled once the current password, rules and confirmation are all satisfied", async () => {
      const { user } = renderWithIntl(<ChangePasswordForm />);
      await fillValid(user);
      expect(submitButton()).toBeEnabled();
    });
  });

  describe("submitting", () => {
    it("sends the three passwords as FormData", async () => {
      change.mockResolvedValue({ success: true });
      const { user } = renderWithIntl(<ChangePasswordForm />);
      await fillValid(user, { cur: "oldpass1", pw: "brandnew9" });
      await user.click(submitButton());

      await waitFor(() => expect(change).toHaveBeenCalledTimes(1));
      const data = change.mock.calls[0][0];
      expect(data.get("currentPassword")).toBe("oldpass1");
      expect(data.get("newPassword")).toBe("brandnew9");
      expect(data.get("confirmPassword")).toBe("brandnew9");
    });

    it("shows success and clears all fields, re-disabling the button", async () => {
      change.mockResolvedValue({ success: true });
      const { user } = renderWithIntl(<ChangePasswordForm />);
      await fillValid(user);
      await user.click(submitButton());

      expect(await screen.findByText("Password updated.")).toBeInTheDocument();
      expect(current()).toHaveValue("");
      expect(next()).toHaveValue("");
      expect(confirm()).toHaveValue("");
      expect(submitButton()).toBeDisabled();
      expect(screen.queryByText("Passwords match.")).not.toBeInTheDocument();
      expect(screen.queryByText("Passwords do not match.")).not.toBeInTheDocument();
    });

    it("resets the rule checklist after success", async () => {
      change.mockResolvedValue({ success: true });
      const { user } = renderWithIntl(<ChangePasswordForm />);
      await fillValid(user);
      await user.click(submitButton());
      await screen.findByText("Password updated.");
      expect(rule("Contains a letter")).not.toHaveClass("text-emerald-400");
    });

    it("shows the server error as an alert and no success message", async () => {
      change.mockResolvedValue({ error: "Your current password is incorrect." });
      const { user } = renderWithIntl(<ChangePasswordForm />);
      await fillValid(user);
      await user.click(submitButton());

      expect(await screen.findByRole("alert")).toHaveTextContent("Your current password is incorrect.");
      expect(screen.queryByText("Password updated.")).not.toBeInTheDocument();
    });

    it("shows a loading state and disables the button while the request is in flight", async () => {
      let resolve!: (v: { success: boolean }) => void;
      change.mockReturnValue(new Promise((r) => (resolve = r)));
      const { user, container } = renderWithIntl(<ChangePasswordForm />);
      await fillValid(user);
      await user.click(submitButton());

      await waitFor(() => expect(submitButton()).toBeDisabled());
      expect(container.querySelector(".animate-spin")).toBeInTheDocument();

      resolve({ success: true });
      await screen.findByText("Password updated.");
      expect(container.querySelector(".animate-spin")).not.toBeInTheDocument();
    });
  });

  describe("localisation", () => {
    it("renders French labels, rules and feedback", async () => {
      const { user } = renderWithIntl(<ChangePasswordForm />, { locale: "fr" });
      expect(screen.getByLabelText("Mot de passe actuel")).toBeInTheDocument();
      expect(screen.getByText("Au moins 8 caractères")).toBeInTheDocument();
      expect(screen.getByText("Contient une lettre")).toBeInTheDocument();
      await user.type(screen.getByLabelText("Nouveau mot de passe"), "abcdefg1");
      await user.type(screen.getByLabelText("Confirmer le nouveau mot de passe"), "abcdefg2");
      expect(screen.getByText("Les mots de passe ne correspondent pas.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Mettre à jour le mot de passe" })).toBeDisabled();
    });

    it("renders Chinese labels and the interpolated minimum length", () => {
      renderWithIntl(<ChangePasswordForm />, { locale: "zh" });
      expect(screen.getByLabelText("当前密码")).toBeInTheDocument();
      expect(screen.getByText("至少 8 个字符")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "更新密码" })).toBeDisabled();
    });
  });
});
