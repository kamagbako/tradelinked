import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import { SidebarBalance } from "@/components/dashboard/SidebarBalance";
import { renderWithIntl } from "@tests/helpers/utils";

type Handler = (payload: { new: unknown }) => void;

const realtime = vi.hoisted(() => ({
  handler: null as null | ((payload: { new: unknown }) => void),
  config: null as unknown,
  channelName: "",
  removeChannel: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => {
    const channel: Record<string, unknown> = {};
    channel.on = (_type: string, config: unknown, handler: Handler) => {
      realtime.config = config;
      realtime.handler = handler;
      return channel;
    };
    channel.subscribe = () => channel;
    return {
      channel: (name: string) => {
        realtime.channelName = name;
        return channel;
      },
      removeChannel: realtime.removeChannel,
    };
  },
}));

const notificationSpy = vi.fn();

function stubNotification(permission: NotificationPermission) {
  class FakeNotification {
    static permission = permission;
    constructor(title: string, options?: NotificationOptions) {
      notificationSpy(title, options);
    }
  }
  Object.defineProperty(globalThis, "Notification", { value: FakeNotification, configurable: true, writable: true });
}

function pushBalance(value: number | string) {
  act(() => {
    realtime.handler?.({ new: { available_balance: value } });
  });
}

beforeEach(() => {
  realtime.handler = null;
  realtime.removeChannel = vi.fn();
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, "Notification");
});

describe("SidebarBalance", () => {
  it("shows the initial balance with two decimals and a USD suffix", () => {
    renderWithIntl(<SidebarBalance userId="u1" initialBalance={1234.5} />);
    expect(screen.getByText("Account balance")).toBeInTheDocument();
    expect(screen.getByText(/1,234\.50/)).toBeInTheDocument();
    expect(screen.getByText("USD")).toBeInTheDocument();
  });

  it("shows zero as 0.00", () => {
    renderWithIntl(<SidebarBalance userId="u1" initialBalance={0} />);
    expect(screen.getByText(/0\.00/)).toBeInTheDocument();
  });

  it("subscribes to UPDATEs on the user's balance row", () => {
    renderWithIntl(<SidebarBalance userId="u1" initialBalance={1} />);
    expect(realtime.config).toEqual({
      event: "UPDATE",
      schema: "public",
      table: "balances",
      filter: "user_id=eq.u1",
    });
  });

  it("uses distinct channel names for the desktop and compact variants", () => {
    const first = renderWithIntl(<SidebarBalance userId="u1" initialBalance={1} />);
    expect(realtime.channelName).toBe("sidebar-balance-u1-d");
    first.unmount();
    renderWithIntl(<SidebarBalance userId="u1" initialBalance={1} compact />);
    expect(realtime.channelName).toBe("sidebar-balance-u1-m");
  });

  it("updates the displayed number when a realtime update arrives", () => {
    renderWithIntl(<SidebarBalance userId="u1" initialBalance={100} />);
    pushBalance(250.75);
    expect(screen.getByText(/250\.75/)).toBeInTheDocument();
    expect(screen.queryByText(/^100\.00/)).not.toBeInTheDocument();
  });

  it("coerces numeric strings from the database", () => {
    renderWithIntl(<SidebarBalance userId="u1" initialBalance={100} />);
    pushBalance("42.5");
    expect(screen.getByText(/42\.50/)).toBeInTheDocument();
  });

  it("removes the channel on unmount", () => {
    const { unmount } = renderWithIntl(<SidebarBalance userId="u1" initialBalance={1} />);
    expect(realtime.removeChannel).not.toHaveBeenCalled();
    unmount();
    expect(realtime.removeChannel).toHaveBeenCalledTimes(1);
  });

  describe("compact variant", () => {
    it("renders a currency pill instead of the labelled block", () => {
      renderWithIntl(<SidebarBalance userId="u1" initialBalance={1234.5} compact />);
      expect(screen.getByText("$1,234.50")).toBeInTheDocument();
      expect(screen.queryByText("Account balance")).not.toBeInTheDocument();
    });

    it("applies a custom className", () => {
      renderWithIntl(<SidebarBalance userId="u1" initialBalance={5} compact className="lg:hidden" />);
      expect(screen.getByText("$5.00")).toHaveClass("lg:hidden");
    });

    it("updates on realtime changes but never raises a browser notification", () => {
      stubNotification("granted");
      renderWithIntl(<SidebarBalance userId="u1" initialBalance={5} compact />);
      pushBalance(9);
      expect(screen.getByText("$9.00")).toBeInTheDocument();
      expect(notificationSpy).not.toHaveBeenCalled();
    });
  });

  describe("browser notifications", () => {
    it("raises a notification when permission is granted and the balance changed", () => {
      stubNotification("granted");
      renderWithIntl(<SidebarBalance userId="u1" initialBalance={100} />);
      pushBalance(150);
      expect(notificationSpy).toHaveBeenCalledTimes(1);
      expect(notificationSpy).toHaveBeenCalledWith("TradeLinked balance updated", {
        body: "Your available balance is now $150.00.",
        icon: "/icons/icon-192.png",
      });
    });

    it("does not notify when the value is unchanged", () => {
      stubNotification("granted");
      renderWithIntl(<SidebarBalance userId="u1" initialBalance={100} />);
      pushBalance(100);
      expect(notificationSpy).not.toHaveBeenCalled();
    });

    it("notifies once per distinct change, not for a repeated value", () => {
      stubNotification("granted");
      renderWithIntl(<SidebarBalance userId="u1" initialBalance={100} />);
      pushBalance(150);
      pushBalance(150);
      pushBalance(160);
      expect(notificationSpy).toHaveBeenCalledTimes(2);
    });

    it("does not notify when permission is default", () => {
      stubNotification("default");
      renderWithIntl(<SidebarBalance userId="u1" initialBalance={100} />);
      pushBalance(150);
      expect(notificationSpy).not.toHaveBeenCalled();
    });

    it("does not notify when permission is denied", () => {
      stubNotification("denied");
      renderWithIntl(<SidebarBalance userId="u1" initialBalance={100} />);
      pushBalance(150);
      expect(notificationSpy).not.toHaveBeenCalled();
    });

    it("does not crash when the Notification API is unsupported", () => {
      renderWithIntl(<SidebarBalance userId="u1" initialBalance={100} />);
      pushBalance(150);
      expect(screen.getByText(/150\.00/)).toBeInTheDocument();
    });

    it("localises the notification text", () => {
      stubNotification("granted");
      renderWithIntl(<SidebarBalance userId="u1" initialBalance={100} />, { locale: "fr" });
      pushBalance(150);
      expect(notificationSpy).toHaveBeenCalledWith(
        "Solde TradeLinked mis à jour",
        expect.objectContaining({ body: expect.stringContaining("$150.00") }),
      );
    });
  });

  it("translates the label in Chinese", () => {
    renderWithIntl(<SidebarBalance userId="u1" initialBalance={1} />, { locale: "zh" });
    expect(screen.getByText("账户余额")).toBeInTheDocument();
  });
});
