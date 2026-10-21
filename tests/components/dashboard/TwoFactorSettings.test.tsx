import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { TwoFactorSettings } from "@/components/dashboard/TwoFactorSettings";
import { renderWithIntl } from "@tests/helpers/utils";

interface Factor {
  id: string;
  status: string;
}

const mfa = vi.hoisted(() => {
  const state = { totp: [] as Factor[], all: [] as Factor[] };
  return {
    state,
    listFactors: vi.fn(),
    enroll: vi.fn(),
    challengeAndVerify: vi.fn(),
    unenroll: vi.fn(),
  };
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { mfa } }),
}));

const UNEXPECTED = "Something went wrong. Please try again.";

beforeEach(() => {
  mfa.state.totp = [];
  mfa.state.all = [];
  mfa.listFactors.mockImplementation(async () => ({
    data: { totp: mfa.state.totp, all: mfa.state.all },
    error: null,
  }));
  mfa.enroll.mockResolvedValue({
    data: { id: "factor-new", totp: { qr_code: "data:image/svg+xml;base64,QQ==", secret: "JBSWY3DPEHPK3PXP" } },
    error: null,
  });
  mfa.challengeAndVerify.mockResolvedValue({ data: {}, error: null });
  mfa.unenroll.mockResolvedValue({ data: {}, error: null });
  // logError reports via console.error; keep test output clean.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

async function renderOff() {
  const utils = renderWithIntl(<TwoFactorSettings />);
  await screen.findByRole("button", { name: "Set up 2FA" });
  return utils;
}

async function startEnrollment() {
  const utils = await renderOff();
  await utils.user.click(screen.getByRole("button", { name: "Set up 2FA" }));
  await screen.findByRole("img", { name: "2FA QR code" });
  return utils;
}

describe("TwoFactorSettings", () => {
  describe("initial load", () => {
    it("shows a loading message until the factors resolve", async () => {
      let resolve!: (v: unknown) => void;
      mfa.listFactors.mockReturnValue(new Promise((r) => (resolve = r)));
      renderWithIntl(<TwoFactorSettings />);
      expect(screen.getByText("Loading your security settings…")).toBeInTheDocument();

      resolve({ data: { totp: [], all: [] }, error: null });
      expect(await screen.findByRole("button", { name: "Set up 2FA" })).toBeInTheDocument();
      expect(screen.queryByText("Loading your security settings…")).not.toBeInTheDocument();
    });

    it("shows the off state when there is no verified factor", async () => {
      await renderOff();
      expect(screen.getByText("Protect your account with 2FA")).toBeInTheDocument();
      expect(screen.getByText(/Google Authenticator, Microsoft Authenticator or Authy/)).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("shows the on state when a verified TOTP factor exists", async () => {
      mfa.state.totp = [{ id: "f1", status: "verified" }];
      renderWithIntl(<TwoFactorSettings />);
      expect(await screen.findByText("2FA is on")).toBeInTheDocument();
      expect(screen.getByText(/enter a code from your authenticator app each time you log in/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Turn off 2FA" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Set up 2FA" })).not.toBeInTheDocument();
    });

    it("ignores unverified factors when deciding the state", async () => {
      mfa.state.all = [{ id: "pending", status: "unverified" }];
      await renderOff();
      expect(screen.queryByText("2FA is on")).not.toBeInTheDocument();
    });

    it("treats a missing data payload as off", async () => {
      mfa.listFactors.mockResolvedValue({ data: null, error: null });
      renderWithIntl(<TwoFactorSettings />);
      expect(await screen.findByRole("button", { name: "Set up 2FA" })).toBeInTheDocument();
    });
  });

  describe("hardening: thrown errors from the mfa API", () => {
    it("shows the friendly message and the off state when the initial load throws", async () => {
      mfa.listFactors.mockRejectedValue(new Error("network down"));
      renderWithIntl(<TwoFactorSettings />);

      expect(await screen.findByRole("alert")).toHaveTextContent(UNEXPECTED);
      expect(screen.queryByText("Loading your security settings…")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Set up 2FA" })).toBeInTheDocument();
      expect(screen.queryByText(/network down/)).not.toBeInTheDocument();
    });

    it("does not crash when the load rejects with a non-Error value", async () => {
      mfa.listFactors.mockRejectedValue("boom");
      renderWithIntl(<TwoFactorSettings />);
      expect(await screen.findByRole("alert")).toHaveTextContent(UNEXPECTED);
    });

    it("shows the friendly message and re-enables the button when enroll throws", async () => {
      mfa.enroll.mockRejectedValue(new Error("enroll exploded"));
      const { user } = await renderOff();
      await user.click(screen.getByRole("button", { name: "Set up 2FA" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(UNEXPECTED);
      expect(screen.getByRole("button", { name: "Set up 2FA" })).toBeEnabled();
      expect(screen.queryByRole("img", { name: "2FA QR code" })).not.toBeInTheDocument();
    });

    it("shows the friendly message when listing factors during enrollment throws", async () => {
      const { user } = await renderOff();
      mfa.listFactors.mockRejectedValue(new Error("boom"));
      await user.click(screen.getByRole("button", { name: "Set up 2FA" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(UNEXPECTED);
      expect(mfa.enroll).not.toHaveBeenCalled();
    });

    it("shows the friendly message, stays enrolling and re-enables Verify when verification throws", async () => {
      mfa.challengeAndVerify.mockRejectedValue(new Error("verify exploded"));
      const { user } = await startEnrollment();
      await user.type(screen.getByLabelText(/Enter the 6-digit code/), "123456");
      await user.click(screen.getByRole("button", { name: "Verify and enable" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(UNEXPECTED);
      expect(screen.getByRole("img", { name: "2FA QR code" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Verify and enable" })).toBeEnabled();
    });

    it("shows the friendly message and keeps 2FA on when turning it off throws", async () => {
      mfa.state.totp = [{ id: "f1", status: "verified" }];
      mfa.unenroll.mockRejectedValue(new Error("unenroll exploded"));
      const { user } = renderWithIntl(<TwoFactorSettings />);
      await user.click(await screen.findByRole("button", { name: "Turn off 2FA" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(UNEXPECTED);
      expect(screen.getByText("2FA is on")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Turn off 2FA" })).toBeEnabled();
    });

    it("still leaves the enrollment when cancelling throws, without showing an error", async () => {
      mfa.unenroll.mockRejectedValue(new Error("cancel exploded"));
      const { user } = await startEnrollment();
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(await screen.findByRole("button", { name: "Set up 2FA" })).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("logs thrown errors instead of swallowing them silently", async () => {
      mfa.listFactors.mockRejectedValue(new Error("network down"));
      renderWithIntl(<TwoFactorSettings />);
      await screen.findByRole("alert");
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("2fa.refresh: network down"),
        expect.anything(),
      );
    });
  });

  describe("setting up", () => {
    it("enrolls a TOTP factor and shows the QR code, manual key and code input", async () => {
      await startEnrollment();
      expect(mfa.enroll).toHaveBeenCalledTimes(1);
      expect(mfa.enroll).toHaveBeenCalledWith({
        factorType: "totp",
        friendlyName: expect.stringMatching(/^TradeLinked \d+$/),
      });
      expect(screen.getByRole("img", { name: "2FA QR code" })).toHaveAttribute("src", "data:image/svg+xml;base64,QQ==");
      expect(screen.getByText("Scan this QR code with your authenticator app.")).toBeInTheDocument();
      expect(screen.getByText("Or enter this key manually")).toBeInTheDocument();
      expect(screen.getByText("JBSWY3DPEHPK3PXP")).toBeInTheDocument();
      expect(screen.getByLabelText(/Enter the 6-digit code/)).toBeInTheDocument();
    });

    it("lets the user copy the secret key", async () => {
      const { user } = await startEnrollment();
      await user.click(screen.getByRole("button", { name: "Copy Or enter this key manually" }));
      expect(await navigator.clipboard.readText()).toBe("JBSWY3DPEHPK3PXP");
    });

    it("removes half-finished (unverified) factors before enrolling, and only those", async () => {
      mfa.state.all = [
        { id: "stale-1", status: "unverified" },
        { id: "keep", status: "verified" },
        { id: "stale-2", status: "unverified" },
      ];
      await startEnrollment();
      expect(mfa.unenroll).toHaveBeenCalledTimes(2);
      expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: "stale-1" });
      expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: "stale-2" });
      expect(mfa.unenroll).not.toHaveBeenCalledWith({ factorId: "keep" });
    });

    it("disables Verify until exactly six digits are entered", async () => {
      const { user } = await startEnrollment();
      const input = screen.getByLabelText(/Enter the 6-digit code/);
      const verify = screen.getByRole("button", { name: "Verify and enable" });
      expect(verify).toBeDisabled();

      await user.type(input, "12345");
      expect(verify).toBeDisabled();

      await user.type(input, "6");
      expect(verify).toBeEnabled();

      await user.type(input, "{Backspace}");
      expect(verify).toBeDisabled();
    });

    it("accepts digits only and at most six of them", async () => {
      const { user } = await startEnrollment();
      const input = screen.getByLabelText(/Enter the 6-digit code/);
      await user.type(input, "1a2b-3 4c5d6e789");
      expect(input).toHaveValue("123456");
      expect(input).toHaveAttribute("inputmode", "numeric");
      expect(input).toHaveAttribute("autocomplete", "one-time-code");
    });

    it("shows the server's message when enrollment is rejected", async () => {
      mfa.enroll.mockResolvedValue({ data: null, error: { message: "Too many factors" } });
      const { user } = await renderOff();
      await user.click(screen.getByRole("button", { name: "Set up 2FA" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Too many factors");
      expect(screen.getByRole("button", { name: "Set up 2FA" })).toBeEnabled();
    });

    it("shows a generic start-failed message when enroll returns nothing", async () => {
      mfa.enroll.mockResolvedValue({ data: null, error: null });
      const { user } = await renderOff();
      await user.click(screen.getByRole("button", { name: "Set up 2FA" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Could not start 2FA setup.");
    });

    it("disables the Set up button while enrollment is in flight", async () => {
      let resolve!: (v: unknown) => void;
      mfa.enroll.mockReturnValue(new Promise((r) => (resolve = r)));
      const { user } = await renderOff();
      await user.click(screen.getByRole("button", { name: "Set up 2FA" }));
      await waitFor(() => expect(screen.getByRole("button", { name: "Set up 2FA" })).toBeDisabled());

      resolve({ data: { id: "f", totp: { qr_code: "data:x", secret: "S" } }, error: null });
      expect(await screen.findByRole("img", { name: "2FA QR code" })).toBeInTheDocument();
    });
  });

  describe("verifying", () => {
    it("sends the factor id and trimmed code, then switches to the on state", async () => {
      const { user } = await startEnrollment();
      mfa.state.totp = [{ id: "factor-new", status: "verified" }];
      await user.type(screen.getByLabelText(/Enter the 6-digit code/), "123456");
      await user.click(screen.getByRole("button", { name: "Verify and enable" }));

      expect(await screen.findByText("2FA is on")).toBeInTheDocument();
      expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: "factor-new", code: "123456" });
      expect(screen.queryByRole("img", { name: "2FA QR code" })).not.toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("shows an error and stays in the enrollment when the code is wrong", async () => {
      mfa.challengeAndVerify.mockResolvedValue({ data: null, error: { message: "Invalid TOTP code" } });
      const { user } = await startEnrollment();
      await user.type(screen.getByLabelText(/Enter the 6-digit code/), "000000");
      await user.click(screen.getByRole("button", { name: "Verify and enable" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "That code didn't work. Check the code in your authenticator app and try again.",
      );
      expect(screen.getByRole("img", { name: "2FA QR code" })).toBeInTheDocument();
      expect(screen.getByLabelText(/Enter the 6-digit code/)).toHaveValue("000000");
      expect(screen.queryByText("2FA is on")).not.toBeInTheDocument();
    });

    it("clears an old error when the user retries", async () => {
      mfa.challengeAndVerify
        .mockResolvedValueOnce({ data: null, error: { message: "bad" } })
        .mockResolvedValueOnce({ data: {}, error: null });
      const { user } = await startEnrollment();
      await user.type(screen.getByLabelText(/Enter the 6-digit code/), "111111");
      await user.click(screen.getByRole("button", { name: "Verify and enable" }));
      await screen.findByRole("alert");

      mfa.state.totp = [{ id: "factor-new", status: "verified" }];
      await user.click(screen.getByRole("button", { name: "Verify and enable" }));
      expect(await screen.findByText("2FA is on")).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("disables Verify and Cancel while verifying", async () => {
      let resolve!: (v: unknown) => void;
      mfa.challengeAndVerify.mockReturnValue(new Promise((r) => (resolve = r)));
      const { user } = await startEnrollment();
      await user.type(screen.getByLabelText(/Enter the 6-digit code/), "123456");
      await user.click(screen.getByRole("button", { name: "Verify and enable" }));

      await waitFor(() => expect(screen.getByRole("button", { name: "Verify and enable" })).toBeDisabled());
      expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

      mfa.state.totp = [{ id: "factor-new", status: "verified" }];
      resolve({ data: {}, error: null });
      expect(await screen.findByText("2FA is on")).toBeInTheDocument();
    });
  });

  describe("turning off", () => {
    beforeEach(() => {
      mfa.state.totp = [{ id: "f1", status: "verified" }];
    });

    it("unenrolls the verified factor and returns to the off state", async () => {
      const { user } = renderWithIntl(<TwoFactorSettings />);
      const button = await screen.findByRole("button", { name: "Turn off 2FA" });
      mfa.unenroll.mockImplementation(async () => {
        mfa.state.totp = [];
        return { data: {}, error: null };
      });
      await user.click(button);

      expect(await screen.findByRole("button", { name: "Set up 2FA" })).toBeInTheDocument();
      expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: "f1" });
      expect(screen.queryByText("2FA is on")).not.toBeInTheDocument();
    });

    it("shows the server's message and stays on when unenrolling fails", async () => {
      mfa.unenroll.mockResolvedValue({ data: null, error: { message: "AAL2 required" } });
      const { user } = renderWithIntl(<TwoFactorSettings />);
      await user.click(await screen.findByRole("button", { name: "Turn off 2FA" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("AAL2 required");
      expect(screen.getByText("2FA is on")).toBeInTheDocument();
    });
  });

  describe("cancelling enrollment", () => {
    it("unenrolls the pending factor and returns to the off state", async () => {
      const { user } = await startEnrollment();
      mfa.unenroll.mockClear();
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(await screen.findByRole("button", { name: "Set up 2FA" })).toBeInTheDocument();
      expect(mfa.unenroll).toHaveBeenCalledTimes(1);
      expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: "factor-new" });
      expect(screen.queryByRole("img", { name: "2FA QR code" })).not.toBeInTheDocument();
    });

    it("clears the typed code and any error", async () => {
      mfa.challengeAndVerify.mockResolvedValue({ data: null, error: { message: "bad" } });
      const { user } = await startEnrollment();
      await user.type(screen.getByLabelText(/Enter the 6-digit code/), "123456");
      await user.click(screen.getByRole("button", { name: "Verify and enable" }));
      await screen.findByRole("alert");

      await user.click(screen.getByRole("button", { name: "Cancel" }));
      await screen.findByRole("button", { name: "Set up 2FA" });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Set up 2FA" }));
      expect(await screen.findByLabelText(/Enter the 6-digit code/)).toHaveValue("");
    });
  });

  describe("localisation", () => {
    it("renders the off state and enrollment steps in French", async () => {
      const { user } = renderWithIntl(<TwoFactorSettings />, { locale: "fr" });
      expect(screen.getByText("Chargement de vos paramètres de sécurité…")).toBeInTheDocument();
      expect(await screen.findByText("Protégez votre compte avec la 2FA")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Configurer la 2FA" }));
      expect(await screen.findByRole("img", { name: "Code QR 2FA" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Vérifier et activer" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Annuler" })).toBeInTheDocument();
    });

    it("renders the on state in Chinese", async () => {
      mfa.state.totp = [{ id: "f1", status: "verified" }];
      renderWithIntl(<TwoFactorSettings />, { locale: "zh" });
      expect(await screen.findByText("2FA 已开启")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "关闭 2FA" })).toBeInTheDocument();
    });

    it("localises the wrong-code error in Chinese", async () => {
      mfa.challengeAndVerify.mockResolvedValue({ data: null, error: { message: "x" } });
      const { user } = renderWithIntl(<TwoFactorSettings />, { locale: "zh" });
      await user.click(await screen.findByRole("button", { name: "设置 2FA" }));
      await user.type(await screen.findByLabelText(/输入应用中显示的 6 位验证码/), "123456");
      await user.click(screen.getByRole("button", { name: "验证并启用" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("验证码无效。请检查验证器应用中的验证码后重试。");
    });

    it("localises the thrown-error message in French", async () => {
      mfa.listFactors.mockRejectedValue(new Error("x"));
      renderWithIntl(<TwoFactorSettings />, { locale: "fr" });
      expect(await screen.findByRole("alert")).toHaveTextContent("Une erreur s’est produite. Veuillez réessayer.");
    });
  });
});
