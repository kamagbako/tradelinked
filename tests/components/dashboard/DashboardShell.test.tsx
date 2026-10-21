import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, within } from "@testing-library/react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { signOut } from "@/lib/actions/auth";
import { renderWithIntl } from "@tests/helpers/utils";

const nav = vi.hoisted(() => ({ pathname: "/dashboard" }));

type Handler = (payload: { new: unknown }) => void;
const realtime = vi.hoisted(() => ({ handlers: new Map<string, Handler>() }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/lib/actions/auth", () => ({ signOut: vi.fn() }));
vi.mock("@/lib/actions/locale", () => ({ setLocale: vi.fn(async () => {}) }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: (name: string) => {
      const channel: Record<string, unknown> = {};
      channel.on = (_type: string, _config: unknown, handler: Handler) => {
        realtime.handlers.set(name, handler);
        return channel;
      };
      channel.subscribe = () => channel;
      return channel;
    },
    removeChannel: () => {},
  }),
}));
vi.mock("@/components/marketing/ChatWidget", () => ({
  ChatWidget: () => <div data-testid="chat-widget" />,
}));

function pushMessage(channel: "insert" | "update", userId: string, message: Record<string, unknown>) {
  act(() => {
    realtime.handlers.get(`dashboard-messages-${channel}-${userId}`)?.({ new: message });
  });
}

const swallowLinkNavigation = (e: MouseEvent) => {
  if ((e.target as Element).closest("a")) e.preventDefault();
};

beforeEach(() => {
  nav.pathname = "/dashboard";
  realtime.handlers.clear();
  document.addEventListener("click", swallowLinkNavigation);
});

afterEach(() => {
  document.removeEventListener("click", swallowLinkNavigation);
});

function renderShell(props: Partial<React.ComponentProps<typeof DashboardShell>> = {}, locale = "en") {
  return renderWithIntl(
    <DashboardShell userId="u1" name="Ada Lovelace" email="ada@example.com" balance={1234.5} {...props}>
      <p>Page content</p>
    </DashboardShell>,
    { locale },
  );
}

const sidebar = () => screen.getByRole("navigation", { name: "Dashboard" });

describe("DashboardShell", () => {
  it("renders its children inside the main landmark", () => {
    renderShell();
    expect(within(screen.getByRole("main")).getByText("Page content")).toBeInTheDocument();
  });

  it("renders all nine nav destinations with the correct hrefs, in order", () => {
    renderShell();
    const links = within(sidebar()).getAllByRole("link").filter((l) => l.getAttribute("href") !== "/admin");
    expect(links.map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
      ["Dashboard", "/dashboard"],
      ["Plans", "/dashboard/plans"],
      ["Deposit", "/dashboard/deposit"],
      ["Withdraw", "/dashboard/withdraw"],
      ["Transactions", "/dashboard/transactions"],
      ["Messages", "/dashboard/messages"],
      ["2FA Setting", "/dashboard/2fa"],
      ["Profile", "/dashboard/profile"],
      ["Change Password", "/dashboard/change-password"],
    ]);
  });

  it("makes ten destinations reachable for an admin (nine pages plus the admin panel)", () => {
    renderShell({ isAdmin: true });
    const hrefs = within(sidebar()).getAllByRole("link").map((l) => l.getAttribute("href"));
    expect(new Set(hrefs).size).toBe(10);
    expect(hrefs).toContain("/admin");
  });

  it("links the brand to the dashboard home", () => {
    renderShell();
    const brandLinks = screen.getAllByRole("link", { name: /TradeLinked/ });
    expect(brandLinks.length).toBeGreaterThan(0);
    for (const link of brandLinks) expect(link).toHaveAttribute("href", "/dashboard");
  });

  describe("active item", () => {
    it.each([
      ["/dashboard", "Dashboard"],
      ["/dashboard/plans", "Plans"],
      ["/dashboard/deposit", "Deposit"],
      ["/dashboard/withdraw", "Withdraw"],
      ["/dashboard/transactions", "Transactions"],
      ["/dashboard/2fa", "2FA Setting"],
      ["/dashboard/profile", "Profile"],
      ["/dashboard/change-password", "Change Password"],
    ])("marks only %s as the current page", (pathname, label) => {
      nav.pathname = pathname;
      renderShell();
      const current = within(sidebar()).getAllByRole("link").filter((l) => l.getAttribute("aria-current") === "page");
      expect(current).toHaveLength(1);
      expect(current[0]).toHaveTextContent(label);
    });

    it("keeps the parent item current on nested paths", () => {
      nav.pathname = "/dashboard/profile/edit";
      renderShell();
      expect(within(sidebar()).getByRole("link", { name: "Profile" })).toHaveAttribute("aria-current", "page");
      expect(within(sidebar()).getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
    });

    it("marks nothing current on an unrelated path", () => {
      nav.pathname = "/somewhere-else";
      renderShell();
      expect(within(sidebar()).getAllByRole("link").some((l) => l.hasAttribute("aria-current"))).toBe(false);
    });
  });

  describe("admin panel link", () => {
    it("is absent for regular users everywhere in the shell", () => {
      renderShell();
      expect(screen.queryByRole("link", { name: "Admin panel" })).not.toBeInTheDocument();
      expect(document.querySelector('a[href="/admin"]')).toBeNull();
    });

    it("is shown in the sidebar for admins", () => {
      renderShell({ isAdmin: true });
      expect(within(sidebar()).getByRole("link", { name: "Admin panel" })).toHaveAttribute("href", "/admin");
    });
  });

  describe("balance", () => {
    it("shows the balance in the sidebar with its label", () => {
      renderShell();
      const aside = within(screen.getByRole("complementary"));
      expect(aside.getByText("Account balance")).toBeInTheDocument();
      expect(aside.getByText(/1,234\.50/)).toBeInTheDocument();
    });

    it("shows the compact balance pill in the top bar", () => {
      renderShell();
      expect(within(screen.getByRole("banner")).getByText("$1,234.50")).toBeInTheDocument();
    });

    it("shows a zero balance", () => {
      renderShell({ balance: 0 });
      expect(within(screen.getByRole("banner")).getByText("$0.00")).toBeInTheDocument();
    });
  });

  describe("quick actions", () => {
    it("has Deposit and Withdraw buttons in the sidebar", () => {
      renderShell();
      const sidebarLinks = within(screen.getByRole("complementary")).getAllByRole("link");
      const deposit = sidebarLinks.find((l) => l.getAttribute("href") === "/dashboard/deposit" && l.className.includes("bg-emerald-500"));
      const withdraw = sidebarLinks.find((l) => l.getAttribute("href") === "/dashboard/withdraw" && l.className.includes("bg-text"));
      expect(deposit).toHaveTextContent("Deposit");
      expect(withdraw).toHaveTextContent("Withdraw");
    });
  });

  describe("logout", () => {
    it("renders a Logout button in the sidebar", () => {
      renderShell();
      expect(within(sidebar()).getByRole("button", { name: "Logout" })).toHaveAttribute("type", "submit");
    });

    it("submits the sign-out action", async () => {
      const { user } = renderShell();
      await user.click(within(sidebar()).getByRole("button", { name: "Logout" }));
      expect(signOut).toHaveBeenCalledTimes(1);
    });
  });

  describe("top bar", () => {
    it("shows the avatar menu with the user's initials", () => {
      renderShell();
      expect(screen.getByRole("button", { name: "Account menu" })).toHaveTextContent("AL");
    });

    it("passes the admin flag to the avatar menu", async () => {
      const { user } = renderShell({ isAdmin: true });
      await user.click(screen.getByRole("button", { name: "Account menu" }));
      expect(screen.getByRole("menuitem", { name: "Admin panel" })).toBeInTheDocument();
    });

    it("includes the language switcher and theme toggle", () => {
      renderShell();
      const header = screen.getByRole("banner");
      expect(within(header).getByRole("button", { name: "Language: English" })).toBeInTheDocument();
      expect(within(header).getByRole("button", { name: "Toggle light and dark mode" })).toBeInTheDocument();
    });
  });

  describe("mobile navigation and chat", () => {
    it("renders the mobile bar with its primary tabs", () => {
      renderShell();
      const bar = screen.getByRole("navigation", { name: "Main" });
      expect(within(bar).getAllByRole("link")).toHaveLength(4);
    });

    it("passes isAdmin to the mobile menu", async () => {
      const { user } = renderShell({ isAdmin: true });
      await user.click(screen.getByRole("button", { name: "More" }));
      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByRole("link", { name: "Admin" })).toHaveAttribute("href", "/admin");
    });

    it("renders the chat widget", () => {
      renderShell();
      expect(screen.getByTestId("chat-widget")).toBeInTheDocument();
    });
  });

  describe("unread messages badge", () => {
    it("shows no badge next to Messages when there are no unread messages", () => {
      renderShell();
      const messagesLink = within(sidebar()).getByRole("link", { name: /Messages/ });
      expect(messagesLink).toHaveTextContent("Messages");
      expect(within(messagesLink).queryByText(/^\d+\+?$/)).not.toBeInTheDocument();
    });

    it("shows the initial unread count next to Messages", () => {
      renderShell({ unreadMessages: 3 });
      const messagesLink = within(sidebar()).getByRole("link", { name: /Messages/ });
      expect(within(messagesLink).getByText("3")).toBeInTheDocument();
    });

    it("caps the displayed count at 9+", () => {
      renderShell({ unreadMessages: 42 });
      expect(within(sidebar()).getByText("9+")).toBeInTheDocument();
    });

    it("bumps the count live when a new admin message arrives by realtime", () => {
      renderShell({ userId: "u1" });
      pushMessage("insert", "u1", { sender: "ADMIN", read_at: null });
      expect(within(sidebar()).getByText("1")).toBeInTheDocument();
    });

    it("ignores the user's own messages echoed back by realtime", () => {
      renderShell({ userId: "u1" });
      pushMessage("insert", "u1", { sender: "USER", read_at: null });
      const messagesLink = within(sidebar()).getByRole("link", { name: /Messages/ });
      expect(within(messagesLink).queryByText("1")).not.toBeInTheDocument();
    });

    it("brings the count back down when messages are marked read elsewhere", () => {
      renderShell({ userId: "u1", unreadMessages: 2 });
      pushMessage("update", "u1", { sender: "ADMIN", read_at: "2025-01-01T00:00:00Z" });
      expect(within(sidebar()).getByText("1")).toBeInTheDocument();
    });

    it("never goes below zero", () => {
      renderShell({ userId: "u1", unreadMessages: 0 });
      pushMessage("update", "u1", { sender: "ADMIN", read_at: "2025-01-01T00:00:00Z" });
      const messagesLink = within(sidebar()).getByRole("link", { name: /Messages/ });
      expect(within(messagesLink).queryByText(/^\d+\+?$/)).not.toBeInTheDocument();
    });

    it("also shows the count on the Messages tile inside the mobile More sheet", async () => {
      const { user } = renderShell({ unreadMessages: 3 });
      await user.click(screen.getByRole("button", { name: "More" }));
      const dialog = await screen.findByRole("dialog");
      const messagesTile = within(dialog).getByRole("link", { name: /Messages/ });
      expect(within(messagesTile).getByText("3")).toBeInTheDocument();
    });

    it("also shows a dot on the mobile More button", () => {
      renderShell({ unreadMessages: 1 });
      const moreButton = screen.getByRole("button", { name: "More" });
      expect(moreButton.querySelector(".rfd-badge--dot")).not.toBeNull();
    });
  });

  describe("localisation", () => {
    it("renders French navigation labels", () => {
      renderShell({ isAdmin: true }, "fr");
      const nav = screen.getByRole("navigation", { name: "Tableau de bord" });
      expect(within(nav).getByRole("link", { name: "Tableau de bord" })).toHaveAttribute("href", "/dashboard");
      expect(within(nav).getByRole("link", { name: "Changer le mot de passe" })).toBeInTheDocument();
      expect(within(nav).getByRole("link", { name: "Panneau d’administration" })).toBeInTheDocument();
      expect(within(nav).getByRole("button", { name: "Déconnexion" })).toBeInTheDocument();
    });

    it("renders Chinese navigation labels and balance label", () => {
      renderShell({}, "zh");
      const nav = screen.getByRole("navigation", { name: "控制台" });
      expect(within(nav).getByRole("link", { name: "交易记录" })).toHaveAttribute("href", "/dashboard/transactions");
      expect(screen.getByText("账户余额")).toBeInTheDocument();
    });
  });
});
