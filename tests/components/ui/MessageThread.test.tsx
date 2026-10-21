import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import { MessageThread } from "@/components/ui/MessageThread";
import { renderWithIntl } from "@tests/helpers/utils";
import type { Message } from "@/lib/types";

type Handler = (payload: { new: Message }) => void;
const realtime = vi.hoisted(() => ({ handler: null as Handler | null, channelName: "" }));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => {
    const channel: Record<string, unknown> = {};
    channel.on = (_type: string, _config: unknown, handler: Handler) => {
      realtime.handler = handler;
      return channel;
    };
    channel.subscribe = () => channel;
    return {
      channel: (name: string) => {
        realtime.channelName = name;
        return channel;
      },
      removeChannel: () => {},
    };
  },
}));

function msg(over: Partial<Message> = {}): Message {
  return {
    id: "m1",
    user_id: "u1",
    sender: "USER",
    sender_id: "u1",
    body: "Hello",
    read_at: null,
    created_at: "2025-01-15T12:00:00Z",
    ...over,
  };
}

function pushIncoming(message: Message) {
  act(() => {
    realtime.handler?.({ new: message });
  });
}

beforeEach(() => {
  realtime.handler = null;
  realtime.channelName = "";
});

const defaultProps = {
  userId: "u1",
  selfSender: "USER" as const,
  placeholder: "Type a message…",
  emptyText: "No messages yet.",
  sendLabel: "Send message",
};

describe("MessageThread", () => {
  it("shows the empty text when there are no messages", () => {
    renderWithIntl(<MessageThread {...defaultProps} initialMessages={[]} onSend={vi.fn()} />);
    expect(screen.getByText("No messages yet.")).toBeInTheDocument();
  });

  it("renders every initial message's body", () => {
    renderWithIntl(
      <MessageThread
        {...defaultProps}
        initialMessages={[msg({ id: "a", body: "Hi there" }), msg({ id: "b", body: "How can we help?", sender: "ADMIN" })]}
        onSend={vi.fn()}
      />,
    );
    expect(screen.getByText("Hi there")).toBeInTheDocument();
    expect(screen.getByText("How can we help?")).toBeInTheDocument();
  });

  it("right-aligns the viewer's own messages and left-aligns the other party's", () => {
    renderWithIntl(
      <MessageThread
        {...defaultProps}
        initialMessages={[msg({ id: "a", body: "Mine", sender: "USER" }), msg({ id: "b", body: "Theirs", sender: "ADMIN" })]}
        onSend={vi.fn()}
      />,
    );
    expect(screen.getByText("Mine")).toHaveClass("bg-blue-500");
    expect(screen.getByText("Theirs")).not.toHaveClass("bg-blue-500");
  });

  it("subscribes to INSERT events scoped to this user's thread", () => {
    renderWithIntl(<MessageThread {...defaultProps} initialMessages={[]} onSend={vi.fn()} />);
    expect(realtime.channelName).toBe("message-thread-u1");
  });

  it("appends a realtime message from the other party", () => {
    renderWithIntl(<MessageThread {...defaultProps} initialMessages={[]} onSend={vi.fn()} />);
    pushIncoming(msg({ id: "new", sender: "ADMIN", body: "We got your message" }));
    expect(screen.getByText("We got your message")).toBeInTheDocument();
  });

  it("ignores a realtime echo of the viewer's own sender", () => {
    renderWithIntl(<MessageThread {...defaultProps} initialMessages={[]} onSend={vi.fn()} />);
    pushIncoming(msg({ id: "echo", sender: "USER", body: "Should not duplicate" }));
    expect(screen.queryByText("Should not duplicate")).not.toBeInTheDocument();
  });

  it("does not add a realtime message with an id already in the list", () => {
    renderWithIntl(
      <MessageThread {...defaultProps} initialMessages={[msg({ id: "dup", sender: "ADMIN", body: "Once" })]} onSend={vi.fn()} />,
    );
    pushIncoming(msg({ id: "dup", sender: "ADMIN", body: "Once" }));
    expect(screen.getAllByText("Once")).toHaveLength(1);
  });

  it("sends the typed message and appends the server's returned row", async () => {
    const onSend = vi.fn(async (body: string) => ({ message: msg({ id: "sent", body }) }));
    const { user } = renderWithIntl(<MessageThread {...defaultProps} initialMessages={[]} onSend={onSend} />);

    await user.type(screen.getByPlaceholderText("Type a message…"), "Need help with my deposit");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    expect(onSend).toHaveBeenCalledWith("Need help with my deposit");
    expect(await screen.findByText("Need help with my deposit")).toBeInTheDocument();
  });

  it("clears the textarea after a successful send", async () => {
    const onSend = vi.fn(async (body: string) => ({ message: msg({ id: "sent", body }) }));
    const { user } = renderWithIntl(<MessageThread {...defaultProps} initialMessages={[]} onSend={onSend} />);
    const textarea = screen.getByPlaceholderText("Type a message…");

    await user.type(textarea, "Hello");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    await screen.findByText("Hello");
    expect(textarea).toHaveValue("");
  });

  it("submits on Enter without Shift, and does not submit on Shift+Enter", async () => {
    const onSend = vi.fn(async (body: string) => ({ message: msg({ id: "sent", body }) }));
    const { user } = renderWithIntl(<MessageThread {...defaultProps} initialMessages={[]} onSend={onSend} />);
    const textarea = screen.getByPlaceholderText("Type a message…");

    await user.type(textarea, "Line one");
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    expect(onSend).not.toHaveBeenCalled();

    await user.keyboard("{Enter}");
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("does not submit an empty or whitespace-only message", async () => {
    const onSend = vi.fn();
    const { user } = renderWithIntl(<MessageThread {...defaultProps} initialMessages={[]} onSend={onSend} />);
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();

    await user.type(screen.getByPlaceholderText("Type a message…"), "   ");
    await user.click(screen.getByRole("button", { name: "Send message" }).closest("form")!);
    expect(onSend).not.toHaveBeenCalled();
  });

  it("shows the error and keeps the draft when sending fails", async () => {
    const onSend = vi.fn(async () => ({ error: "Could not send message." }));
    const { user } = renderWithIntl(<MessageThread {...defaultProps} initialMessages={[]} onSend={onSend} />);
    const textarea = screen.getByPlaceholderText("Type a message…");

    await user.type(textarea, "Will this fail?");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not send message.");
    expect(textarea).toHaveValue("Will this fail?");
  });

  it("clears a previous error once a retry succeeds", async () => {
    const onSend = vi
      .fn()
      .mockResolvedValueOnce({ error: "Could not send message." })
      .mockResolvedValueOnce({ message: msg({ id: "sent", body: "Retry" }) });
    const { user } = renderWithIntl(<MessageThread {...defaultProps} initialMessages={[]} onSend={onSend} />);
    const textarea = screen.getByPlaceholderText("Type a message…");

    await user.type(textarea, "Retry");
    await user.click(screen.getByRole("button", { name: "Send message" }));
    await screen.findByRole("alert");

    await user.click(screen.getByRole("button", { name: "Send message" }));
    await screen.findByText("Retry");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("applies a custom className to the root", () => {
    const { container } = renderWithIntl(
      <MessageThread {...defaultProps} initialMessages={[]} onSend={vi.fn()} className="mt-4" />,
    );
    expect(container.firstElementChild).toHaveClass("mt-4");
  });

  it("formats each message's timestamp", () => {
    renderWithIntl(
      <MessageThread {...defaultProps} initialMessages={[msg({ created_at: "2025-01-15T12:00:00Z" })]} onSend={vi.fn()} />,
    );
    expect(screen.getByText(/Jan 15, 2025/)).toBeInTheDocument();
  });

  describe("as the admin side of the conversation", () => {
    it("right-aligns ADMIN messages and left-aligns USER messages", () => {
      renderWithIntl(
        <MessageThread
          userId="target-1"
          selfSender="ADMIN"
          initialMessages={[msg({ id: "a", body: "Admin reply", sender: "ADMIN" }), msg({ id: "b", body: "User question", sender: "USER" })]}
          onSend={vi.fn()}
          placeholder="Type a message…"
          emptyText="No messages with this user yet."
          sendLabel="Send message"
        />,
      );
      expect(screen.getByText("Admin reply")).toHaveClass("bg-blue-500");
      expect(screen.getByText("User question")).not.toHaveClass("bg-blue-500");
    });

    it("ignores realtime echoes of its own ADMIN messages but keeps USER replies", () => {
      renderWithIntl(
        <MessageThread
          userId="target-1"
          selfSender="ADMIN"
          initialMessages={[]}
          onSend={vi.fn()}
          placeholder="Type a message…"
          emptyText="No messages with this user yet."
          sendLabel="Send message"
        />,
      );
      pushIncoming(msg({ id: "echo", user_id: "target-1", sender: "ADMIN", body: "Echo" }));
      pushIncoming(msg({ id: "reply", user_id: "target-1", sender: "USER", body: "A real reply" }));
      expect(screen.queryByText("Echo")).not.toBeInTheDocument();
      expect(screen.getByText("A real reply")).toBeInTheDocument();
    });
  });
});
