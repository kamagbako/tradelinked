import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import MessagesPage, { generateMetadata } from "@/app/dashboard/messages/page";
import { requireUser } from "@/lib/auth/guard";
import { markMessagesRead, sendUserMessage } from "@/lib/actions/messages";
import { loadMessages } from "@tests/helpers/messages";
import { RedirectSignal, createSupabaseMock } from "@tests/helpers/supabase";
import type { Message } from "@/lib/types";

const locale = vi.hoisted(() => ({ current: "en" }));
const captured = vi.hoisted(() => ({ props: null as null | Record<string, unknown> }));

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { loadMessages } = await import("@tests/helpers/messages");
  return {
    getTranslations: async (namespace?: string) =>
      createTranslator({ locale: locale.current, messages: loadMessages(locale.current), namespace: namespace as never }),
  };
});
vi.mock("@/lib/auth/guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/actions/messages", () => ({
  markMessagesRead: vi.fn(async () => ({ success: true })),
  sendUserMessage: vi.fn(async () => ({ success: true, message: { id: "new" } })),
}));
vi.mock("@/components/ui/MessageThread", () => ({
  MessageThread: (props: Record<string, unknown>) => {
    captured.props = props;
    return <div data-testid="message-thread" />;
  },
}));

beforeEach(() => {
  locale.current = "en";
  captured.props = null;
  vi.mocked(markMessagesRead).mockClear();
  vi.mocked(sendUserMessage).mockClear();
});

async function renderPage(messages: Message[] | null = []) {
  const mock = createSupabaseMock({ tables: { messages: { data: messages } } });
  vi.mocked(requireUser).mockResolvedValue({
    supabase: mock.client,
    user: { id: "user-1", email: "user@example.com" },
  } as unknown as Awaited<ReturnType<typeof requireUser>>);

  const ui = await MessagesPage();
  render(
    <NextIntlClientProvider locale={locale.current} messages={loadMessages(locale.current)} timeZone="UTC">
      {ui}
    </NextIntlClientProvider>,
  );
  return mock;
}

describe("messages page", () => {
  it("sets the page title", async () => {
    expect(await generateMetadata()).toEqual({ title: "Messages" });
  });

  it("propagates the redirect for signed-out users", async () => {
    vi.mocked(requireUser).mockRejectedValue(new RedirectSignal("/login"));
    await expect(MessagesPage()).rejects.toMatchObject({ digest: expect.stringContaining("/login") });
  });

  it("renders the heading and intro", async () => {
    await renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Messages" })).toBeInTheDocument();
    expect(screen.getByText("Chat directly with our support team about your account.")).toBeInTheDocument();
  });

  it("fetches this user's thread, ordered oldest first, and passes it through", async () => {
    const rows: Message[] = [
      { id: "a", user_id: "user-1", sender: "USER", sender_id: "user-1", body: "Hi", read_at: null, created_at: "2025-01-01T00:00:00Z" },
    ];
    const { builders } = await renderPage(rows);
    expect(captured.props?.initialMessages).toEqual(rows);
    expect(builders.messages.calls).toContainEqual({ method: "eq", args: ["user_id", "user-1"] });
    expect(builders.messages.calls).toContainEqual({ method: "order", args: ["created_at", { ascending: true }] });
  });

  it("treats a null result as an empty thread", async () => {
    await renderPage(null);
    expect(captured.props?.initialMessages).toEqual([]);
  });

  it("passes the user's id and USER as its own sender", async () => {
    await renderPage();
    expect(captured.props?.userId).toBe("user-1");
    expect(captured.props?.selfSender).toBe("USER");
  });

  it("passes the translated placeholder, empty text and send label", async () => {
    await renderPage();
    expect(captured.props?.placeholder).toBe("Type a message…");
    expect(captured.props?.emptyText).toBe("No messages yet. Send one and our team will get back to you.");
    expect(captured.props?.sendLabel).toBe("Send message");
  });

  it("marks admin messages as read on load", async () => {
    await renderPage();
    expect(markMessagesRead).toHaveBeenCalledWith("user-1", "ADMIN");
  });

  describe("onSend", () => {
    it("posts the body as form data to sendUserMessage and returns its result", async () => {
      vi.mocked(sendUserMessage).mockResolvedValue({ success: true, message: { id: "sent" } as Message });
      await renderPage();
      const onSend = captured.props?.onSend as (body: string) => Promise<unknown>;

      const result = await onSend("Need help with my withdrawal");

      expect(sendUserMessage).toHaveBeenCalledTimes(1);
      const sentForm = vi.mocked(sendUserMessage).mock.calls[0][0] as FormData;
      expect(sentForm.get("body")).toBe("Need help with my withdrawal");
      expect(result).toEqual({ error: undefined, message: { id: "sent" } });
    });

    it("surfaces an error from sendUserMessage", async () => {
      vi.mocked(sendUserMessage).mockResolvedValue({ error: "Enter a message to send." });
      await renderPage();
      const onSend = captured.props?.onSend as (body: string) => Promise<{ error?: string }>;

      await expect(onSend("")).resolves.toEqual({ error: "Enter a message to send.", message: undefined });
    });
  });

  describe("localisation", () => {
    it("renders the French heading and title", async () => {
      locale.current = "fr";
      await renderPage();
      expect(screen.getByRole("heading", { level: 1, name: "Messages" })).toBeInTheDocument();
      expect(await generateMetadata()).toEqual({ title: "Messages" });
    });

    it("renders the Chinese empty-state copy passed to the thread", async () => {
      locale.current = "zh";
      await renderPage();
      expect(captured.props?.emptyText).toBe("暂无消息。发送一条,我们的团队会尽快回复您。");
    });
  });
});
