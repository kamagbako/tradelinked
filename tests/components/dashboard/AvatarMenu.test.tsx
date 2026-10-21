import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { AvatarMenu } from "@/components/dashboard/AvatarMenu";
import { signOut } from "@/lib/actions/auth";
import { renderWithIntl } from "@tests/helpers/utils";

vi.mock("@/lib/actions/auth", () => ({ signOut: vi.fn() }));

// jsdom cannot navigate; swallow link clicks so they do not log "not implemented" errors.
const swallowLinkNavigation = (e: MouseEvent) => {
  if ((e.target as Element).closest("a")) e.preventDefault();
};

afterEach(() => {
  document.removeEventListener("click", swallowLinkNavigation);
});

beforeEach(() => {
  document.addEventListener("click", swallowLinkNavigation);
});

const trigger = () => screen.getByRole("button", { name: "Account menu" });

async function open(ui = <AvatarMenu name="Ada Lovelace" email="ada@example.com" />) {
  const utils = renderWithIntl(ui);
  await utils.user.click(trigger());
  return utils;
}

describe("AvatarMenu", () => {
  describe("trigger", () => {
    it("shows the initials of a two-word name", () => {
      renderWithIntl(<AvatarMenu name="Ada Lovelace" email="ada@example.com" />);
      expect(trigger()).toHaveTextContent("AL");
    });

    it("falls back to the email when there is no name", () => {
      renderWithIntl(<AvatarMenu name={null} email="john.doe@example.com" />);
      expect(trigger()).toHaveTextContent("JD");
    });

    it("uses a single initial for a one-word name", () => {
      renderWithIntl(<AvatarMenu name="Madonna" email="m@example.com" />);
      expect(trigger()).toHaveTextContent(/^M$/);
    });

    it("is a collapsed menu button by default", () => {
      renderWithIntl(<AvatarMenu name="Ada Lovelace" email="ada@example.com" />);
      expect(trigger()).toHaveAttribute("aria-haspopup", "menu");
      expect(trigger()).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });

  describe("opening", () => {
    it("opens the menu on click and marks the trigger expanded", async () => {
      await open();
      expect(screen.getByRole("menu")).toBeInTheDocument();
      expect(trigger()).toHaveAttribute("aria-expanded", "true");
    });

    it("shows the name and email in the header", async () => {
      await open();
      expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
      expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    });

    it("shows a generic label when the user has no name", async () => {
      await open(<AvatarMenu name={null} email="ada@example.com" />);
      expect(screen.getByText("Your account")).toBeInTheDocument();
    });

    it("links to the profile and change-password pages", async () => {
      await open();
      expect(screen.getByRole("menuitem", { name: "Profile" })).toHaveAttribute("href", "/dashboard/profile");
      expect(screen.getByRole("menuitem", { name: "Change password" })).toHaveAttribute(
        "href",
        "/dashboard/change-password",
      );
    });

    it("has a log out item", async () => {
      await open();
      expect(screen.getByRole("menuitem", { name: "Log out" })).toBeInTheDocument();
    });

    it("toggles closed when the trigger is clicked again", async () => {
      const { user } = await open();
      await user.click(trigger());
      await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
      expect(trigger()).toHaveAttribute("aria-expanded", "false");
    });
  });

  describe("admin entry", () => {
    it("is hidden for regular users", async () => {
      await open();
      expect(screen.queryByRole("menuitem", { name: "Admin panel" })).not.toBeInTheDocument();
    });

    it("links to /admin for admins", async () => {
      await open(<AvatarMenu name="Ada" email="a@b.co" isAdmin />);
      expect(screen.getByRole("menuitem", { name: "Admin panel" })).toHaveAttribute("href", "/admin");
    });
  });

  describe("dismissal", () => {
    it("closes on Escape", async () => {
      const { user } = await open();
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    });

    it("closes when clicking outside", async () => {
      const { user } = await open();
      await user.click(document.body);
      await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    });

    it("stays open when clicking inside the menu header", async () => {
      const { user } = await open();
      await user.click(screen.getByText("ada@example.com"));
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    it("closes when a link is chosen", async () => {
      const { user } = await open();
      await user.click(screen.getByRole("menuitem", { name: "Profile" }));
      await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    });

    it("ignores other keys", async () => {
      const { user } = await open();
      await user.keyboard("a");
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });
  });

  it("submits the sign-out action from the log out item", async () => {
    const { user } = await open();
    await user.click(screen.getByRole("menuitem", { name: "Log out" }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("is translated to French", async () => {
    const { user } = renderWithIntl(<AvatarMenu name="Ada" email="a@b.co" isAdmin />, { locale: "fr" });
    await user.click(screen.getByRole("button", { name: "Menu du compte" }));
    expect(screen.getByRole("menuitem", { name: "Changer le mot de passe" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Panneau d’administration" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Se déconnecter" })).toBeInTheDocument();
  });

  it("is translated to Chinese", async () => {
    const { user } = renderWithIntl(<AvatarMenu name={null} email="a@b.co" />, { locale: "zh" });
    await user.click(screen.getByRole("button", { name: "账户菜单" }));
    expect(screen.getByText("我的账户")).toBeInTheDocument();
  });
});
