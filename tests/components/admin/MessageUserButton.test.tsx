import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { MessageUserButton } from "@/components/admin/MessageUserButton";
import { getMessageThread, markMessagesRead, sendAdminMessage } from "@/lib/actions/messages";
import { renderWithIntl } from "@tests/helpers/utils";
import type { Message } from "@/lib/types";

const captured = vi.hoisted(() => ({ props: null as null | Record<string, unknown> }));

vi.mock("@/lib/actions/messages", () => ({
  getMessageThread: vi.fn(async () => ({ messages: [] })),
  markMessagesRead: vi.fn(async () => ({ success: true })),
  sendAdminMessage: vi.fn(async () => ({ success: true, message: { id: "sent" } })),
}));
vi.mock("@/components/ui/MessageThread", () => ({
  MessageThread: (props: Record<string, unknown>) => {
    captured.props = props;
    return <div data-testid="message-thread" />;
  },
}));

beforeEach(() => {
  captured.props = null;
  vi.mocked(getMessageThread).mockClear();
  vi.mocked(getMessageThread).mockResolvedValue({ messages: [] });
  vi.mocked(markMessagesRead).mockClear();
  vi.mocked(sendAdminMessage).mockClear();
});

const button = () => screen.getByRole("button", { name: /message/i });

describe("MessageUserButton", () => {
  it("shows no badge when there are no unread messages", () => {
    renderWithIntl(<MessageUserButton userId="u1" label="Ada Lovelace" />);
    expect(button()).toHaveTextContent("Message");
    expect(within(button()).queryByText(/^\d+\+?$/)).not.toBeInTheDocument();
  });

  it("shows the unread count as a badge", () => {
    renderWithIntl(<MessageUserButton userId="u1" label="Ada Lovelace" initialUnread={3} />);
    expect(within(button()).getByText("3")).toBeInTheDocument();
  });

  it("caps the badge at 9+", () => {
    renderWithIntl(<MessageUserButton userId="u1" label="Ada Lovelace" initialUnread={42} />);
    expect(within(button()).getByText("9+")).toBeInTheDocument();
  });

  it("opens a drawer titled with the given label", async () => {
    const { user } = renderWithIntl(<MessageUserButton userId="u1" label="Ada Lovelace" />);
    await user.click(button());
    expect(await screen.findByRole("heading", { name: "Ada Lovelace" })).toBeInTheDocument();
  });

  it("loads the thread for this user on open", async () => {
    const { user } = renderWithIntl(<MessageUserButton userId="u1" label="Ada Lovelace" />);
    await user.click(button());
    await waitFor(() => expect(getMessageThread).toHaveBeenCalledWith("u1"));
  });

  it("shows a loading message while the thread is being fetched", async () => {
    let resolve!: (v: { messages: Message[] }) => void;
    vi.mocked(getMessageThread).mockReturnValue(new Promise((r) => (resolve = r)));
    const { user } = renderWithIntl(<MessageUserButton userId="u1" label="Ada Lovelace" />);
    await user.click(button());

    expect(screen.getByText(/loading messages/i)).toBeInTheDocument();
    resolve({ messages: [] });
    await waitFor(() => expect(screen.queryByText(/loading messages/i)).not.toBeInTheDocument());
  });

  it("passes the loaded messages, the user id and ADMIN as the self sender to MessageThread", async () => {
    const rows: Message[] = [
      { id: "m1", user_id: "u1", sender: "USER", sender_id: "u1", body: "Hi", read_at: null, created_at: "2025-01-01T00:00:00Z" },
    ];
    vi.mocked(getMessageThread).mockResolvedValue({ messages: rows });
    const { user } = renderWithIntl(<MessageUserButton userId="u1" label="Ada Lovelace" />);
    await user.click(button());

    await screen.findByTestId("message-thread");
    expect(captured.props?.initialMessages).toEqual(rows);
    expect(captured.props?.userId).toBe("u1");
    expect(captured.props?.selfSender).toBe("ADMIN");
  });

  it("shows an error instead of the thread when loading fails", async () => {
    vi.mocked(getMessageThread).mockResolvedValue({ error: "Could not load messages." });
    const { user } = renderWithIntl(<MessageUserButton userId="u1" label="Ada Lovelace" />);
    await user.click(button());

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load messages.");
    expect(screen.queryByTestId("message-thread")).not.toBeInTheDocument();
  });

  it("marks the user's messages read and clears the badge once the thread loads, when there were unread messages", async () => {
    const { user } = renderWithIntl(<MessageUserButton userId="u1" label="Ada Lovelace" initialUnread={2} />);
    await user.click(button());

    await screen.findByTestId("message-thread");
    expect(markMessagesRead).toHaveBeenCalledWith("u1", "USER");
    expect(within(button()).queryByText("2")).not.toBeInTheDocument();
  });

  it("does not call markMessagesRead when there was nothing unread", async () => {
    const { user } = renderWithIntl(<MessageUserButton userId="u1" label="Ada Lovelace" initialUnread={0} />);
    await user.click(button());

    await screen.findByTestId("message-thread");
    expect(markMessagesRead).not.toHaveBeenCalled();
  });

  it("only fetches the thread once across repeated opens", async () => {
    const { user } = renderWithIntl(<MessageUserButton userId="u1" label="Ada Lovelace" />);
    await user.click(button());
    await screen.findByTestId("message-thread");

    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(button());

    expect(getMessageThread).toHaveBeenCalledTimes(1);
  });

  it("wires onSend to sendAdminMessage for this user", async () => {
    const { user } = renderWithIntl(<MessageUserButton userId="target-1" label="Ada Lovelace" />);
    await user.click(button());
    await screen.findByTestId("message-thread");

    const onSend = captured.props?.onSend as (body: string) => Promise<unknown>;
    await onSend("Hello there");
    expect(sendAdminMessage).toHaveBeenCalledWith("target-1", "Hello there");
  });
});
