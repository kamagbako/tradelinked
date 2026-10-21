import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { NotificationBanner, PlanBanner, TwoFactorBanner } from "@/components/dashboard/Banners";
import { renderWithIntl } from "@tests/helpers/utils";

function stubNotification(permission: NotificationPermission, requestPermission?: () => Promise<NotificationPermission>) {
  const ctor = { permission, requestPermission: requestPermission ?? vi.fn(async () => permission) };
  Object.defineProperty(globalThis, "Notification", { value: ctor, configurable: true, writable: true });
  return ctor;
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "Notification");
});

describe("NotificationBanner", () => {
  it("renders nothing when the Notification API is unsupported", () => {
    const { container } = renderWithIntl(<NotificationBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when permission is already granted", () => {
    stubNotification("granted");
    const { container } = renderWithIntl(<NotificationBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("asks the user to allow notifications when permission is default", () => {
    stubNotification("default");
    renderWithIntl(<NotificationBanner />);
    expect(screen.getByText("Please allow browser notifications")).toBeInTheDocument();
    expect(screen.getByText(/Get an alert whenever your balance changes/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Allow notifications" })).toBeInTheDocument();
  });

  it("requests permission when the allow button is clicked", async () => {
    const ctor = stubNotification("default", vi.fn(async () => "granted" as NotificationPermission));
    const { user } = renderWithIntl(<NotificationBanner />);
    await user.click(screen.getByRole("button", { name: "Allow notifications" }));
    expect(ctor.requestPermission).toHaveBeenCalledTimes(1);
  });

  it("hides the banner once permission is granted", async () => {
    stubNotification("default", async () => "granted");
    const { user, container } = renderWithIntl(<NotificationBanner />);
    await user.click(screen.getByRole("button", { name: "Allow notifications" }));
    expect(container).toBeEmptyDOMElement();
  });

  it("switches to the reset message, without a button, when the user denies the prompt", async () => {
    stubNotification("default", async () => "denied");
    const { user } = renderWithIntl(<NotificationBanner />);
    await user.click(screen.getByRole("button", { name: "Allow notifications" }));
    expect(screen.getByText("Reset browser notifications")).toBeInTheDocument();
    expect(screen.getByText(/Notifications are blocked/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows the reset message immediately when permission was denied earlier", () => {
    stubNotification("denied");
    renderWithIntl(<NotificationBanner />);
    expect(screen.getByText("Reset browser notifications")).toBeInTheDocument();
    expect(screen.queryByText("Please allow browser notifications")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Allow notifications" })).not.toBeInTheDocument();
  });

  it("is translated to French", () => {
    stubNotification("default");
    renderWithIntl(<NotificationBanner />, { locale: "fr" });
    expect(screen.getByText("Veuillez autoriser les notifications du navigateur")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Autoriser les notifications" })).toBeInTheDocument();
  });

  it("is translated to Chinese when denied", () => {
    stubNotification("denied");
    renderWithIntl(<NotificationBanner />, { locale: "zh" });
    expect(screen.getByText("重置浏览器通知")).toBeInTheDocument();
  });
});

describe("TwoFactorBanner", () => {
  it("shows the title and a link to the 2FA settings page", () => {
    renderWithIntl(<TwoFactorBanner />);
    expect(screen.getByText("2FA Authentication")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "enable 2FA" })).toHaveAttribute("href", "/dashboard/2fa");
  });

  it("keeps the surrounding sentence around the link", () => {
    renderWithIntl(<TwoFactorBanner />);
    expect(screen.getByText(/To keep your account safe, please/)).toBeInTheDocument();
    expect(screen.getByText(/more secure\./)).toBeInTheDocument();
  });

  it("translates the message and the link text in French", () => {
    renderWithIntl(<TwoFactorBanner />, { locale: "fr" });
    expect(screen.getByText("Authentification 2FA")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "activer la 2FA" })).toHaveAttribute("href", "/dashboard/2fa");
  });

  it("translates the message and the link text in Chinese", () => {
    renderWithIntl(<TwoFactorBanner />, { locale: "zh" });
    expect(screen.getByRole("link", { name: "启用 2FA" })).toHaveAttribute("href", "/dashboard/2fa");
  });
});

describe("PlanBanner", () => {
  it("invites the user to choose a plan when none is active", () => {
    renderWithIntl(<PlanBanner activePlanName={null} />);
    expect(screen.getByText("You haven't picked a plan yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Choose a plan" })).toHaveAttribute("href", "/dashboard/plans");
  });

  it("names the active plan and offers to change it", () => {
    renderWithIntl(<PlanBanner activePlanName="Growth" />);
    expect(screen.getByText("Your plan: Growth")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Change plan" })).toHaveAttribute("href", "/dashboard/plans");
    expect(screen.queryByText("You haven't picked a plan yet")).not.toBeInTheDocument();
  });

  it("always links to the plans page regardless of state", () => {
    const { rerender } = renderWithIntl(<PlanBanner activePlanName={null} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/dashboard/plans");
    rerender(<PlanBanner activePlanName="Elite" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/dashboard/plans");
  });

  it("translates both states into French", () => {
    const { rerender } = renderWithIntl(<PlanBanner activePlanName={null} />, { locale: "fr" });
    expect(screen.getByText("Vous n’avez pas encore choisi de plan")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Choisir un plan" })).toBeInTheDocument();
    rerender(<PlanBanner activePlanName="Growth" />);
    expect(screen.getByText("Votre plan : Growth")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Changer de plan" })).toBeInTheDocument();
  });

  it("translates both states into Chinese", () => {
    const { rerender } = renderWithIntl(<PlanBanner activePlanName={null} />, { locale: "zh" });
    expect(screen.getByRole("link", { name: "选择计划" })).toBeInTheDocument();
    rerender(<PlanBanner activePlanName="Growth" />);
    expect(screen.getByText("您的计划：Growth")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "更改计划" })).toBeInTheDocument();
  });
});
