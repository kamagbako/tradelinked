import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type SupabaseMockOptions } from "@tests/helpers/supabase";

const { createClientMock, revalidatePathMock, logErrorMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  logErrorMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next-intl/server", async () => (await import("@tests/helpers/utils")).nextIntlServerMock());
vi.mock("@/lib/logger", () => ({ logError: logErrorMock, logWarn: vi.fn() }));

import { getMessageThread, markMessagesRead, sendAdminMessage, sendUserMessage } from "@/lib/actions/messages";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

function setup(options: SupabaseMockOptions = {}) {
  const mock = createSupabaseMock(options);
  createClientMock.mockResolvedValue(mock.client);
  return mock;
}

const UNEXPECTED = { error: "Something went wrong. Please try again." };
const SENT_MESSAGE = { id: "m1", user_id: "user-1", sender: "USER", sender_id: "user-1", body: "Hi", read_at: null, created_at: "2025-01-01T00:00:00Z" };

describe("sendUserMessage", () => {
  beforeEach(() => {
    setup({ user: { id: "user-1" }, tables: { messages: { data: SENT_MESSAGE } } });
  });

  it("rejects an empty or whitespace-only body", async () => {
    const message = { error: "Enter a message to send." };
    await expect(sendUserMessage(form({}))).resolves.toEqual(message);
    await expect(sendUserMessage(form({ body: "   " }))).resolves.toEqual(message);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("rejects a body longer than 4000 characters", async () => {
    await expect(sendUserMessage(form({ body: "a".repeat(4001) }))).resolves.toEqual({
      error: "Message is too long. Keep it under 4000 characters.",
    });
  });

  it("accepts a body exactly at the 4000 character limit", async () => {
    await expect(sendUserMessage(form({ body: "a".repeat(4000) }))).resolves.toEqual({
      success: true,
      message: SENT_MESSAGE,
    });
  });

  it("returns 'signed in' error when there is no user", async () => {
    setup({ user: null, tables: { messages: { data: SENT_MESSAGE } } });
    await expect(sendUserMessage(form({ body: "Hi" }))).resolves.toEqual({ error: "You must be signed in." });
  });

  it("inserts as sender USER, with the sender id matching the signed-in user", async () => {
    const { builders } = setup({ user: { id: "u-9" }, tables: { messages: { data: SENT_MESSAGE } } });
    await sendUserMessage(form({ body: "  Hello there  " }));
    expect(builders.messages.insert).toHaveBeenCalledWith({
      user_id: "u-9",
      sender: "USER",
      sender_id: "u-9",
      body: "Hello there",
    });
  });

  it("returns the inserted message on success", async () => {
    await expect(sendUserMessage(form({ body: "Hi" }))).resolves.toEqual({ success: true, message: SENT_MESSAGE });
  });

  it("revalidates the messages page on success", async () => {
    await sendUserMessage(form({ body: "Hi" }));
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/messages");
  });

  it("returns the database error and does not revalidate", async () => {
    setup({ user: { id: "user-1" }, tables: { messages: { error: { message: "insert failed" } } } });
    await expect(sendUserMessage(form({ body: "Hi" }))).resolves.toEqual({ error: "insert failed" });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("converts thrown exceptions into the friendly message and logs them", async () => {
    const boom = new Error("connection reset");
    createClientMock.mockRejectedValue(boom);
    await expect(sendUserMessage(form({ body: "Hi" }))).resolves.toEqual(UNEXPECTED);
    expect(logErrorMock).toHaveBeenCalledWith("action:messages.sendUser", boom);
  });
});

const ADMIN_SENT = { id: "m2", user_id: "target-1", sender: "ADMIN", sender_id: "admin-1", body: "Hello", read_at: null, created_at: "2025-01-01T00:00:00Z" };

describe("sendAdminMessage", () => {
  beforeEach(() => {
    setup({ user: { id: "admin-1" }, tables: { messages: { data: ADMIN_SENT } } });
  });

  it("rejects an empty or whitespace-only body without touching the database", async () => {
    const { client } = setup({ user: { id: "admin-1" } });
    await expect(sendAdminMessage("target-1", "")).resolves.toEqual({ error: "Message can't be empty." });
    await expect(sendAdminMessage("target-1", "   ")).resolves.toEqual({ error: "Message can't be empty." });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("rejects a body longer than 4000 characters", async () => {
    await expect(sendAdminMessage("target-1", "a".repeat(4001))).resolves.toEqual({
      error: "Message can't be longer than 4000 characters.",
    });
  });

  it("returns a signed-in error when there is no user", async () => {
    setup({ user: null, tables: { messages: { data: ADMIN_SENT } } });
    await expect(sendAdminMessage("target-1", "Hello")).resolves.toEqual({ error: "You must be signed in." });
  });

  it("inserts as sender ADMIN for the target user, with the admin's own id as sender_id", async () => {
    const { builders } = setup({ user: { id: "admin-1" }, tables: { messages: { data: ADMIN_SENT } } });
    await sendAdminMessage("target-1", "  Hello  ");
    expect(builders.messages.insert).toHaveBeenCalledWith({
      user_id: "target-1",
      sender: "ADMIN",
      sender_id: "admin-1",
      body: "Hello",
    });
  });

  it("returns the inserted message on success", async () => {
    await expect(sendAdminMessage("target-1", "Hello")).resolves.toEqual({ success: true, message: ADMIN_SENT });
  });

  it("revalidates the admin users page on success", async () => {
    await sendAdminMessage("target-1", "Hello");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/users");
  });

  it("returns the database error, e.g. when RLS rejects a non-admin sender", async () => {
    setup({ user: { id: "not-admin" }, tables: { messages: { error: { message: "new row violates row-level security policy" } } } });
    await expect(sendAdminMessage("target-1", "Hello")).resolves.toEqual({
      error: "new row violates row-level security policy",
    });
  });

  it("converts thrown exceptions into the friendly message and logs them", async () => {
    const boom = new Error("connection reset");
    createClientMock.mockRejectedValue(boom);
    await expect(sendAdminMessage("target-1", "Hello")).resolves.toEqual(UNEXPECTED);
    expect(logErrorMock).toHaveBeenCalledWith("action:messages.sendAdmin", boom);
  });
});

describe("markMessagesRead", () => {
  it("marks unread messages from the given sender in the user's thread as read", async () => {
    const { builders } = setup();
    await markMessagesRead("user-1", "ADMIN");
    expect(builders.messages.update).toHaveBeenCalledWith({ read_at: expect.any(String) });
    expect(builders.messages.calls).toContainEqual({ method: "eq", args: ["user_id", "user-1"] });
    expect(builders.messages.calls).toContainEqual({ method: "eq", args: ["sender", "ADMIN"] });
    expect(builders.messages.calls).toContainEqual({ method: "is", args: ["read_at", null] });
  });

  it("revalidates the dashboard layout and the admin users page", async () => {
    setup();
    await markMessagesRead("user-1", "ADMIN");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard", "layout");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/users");
  });

  it("returns the database error and does not revalidate", async () => {
    setup({ tables: { messages: { error: { message: "update failed" } } } });
    await expect(markMessagesRead("user-1", "USER")).resolves.toEqual({ error: "update failed" });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("converts thrown exceptions into the friendly message and logs them", async () => {
    const boom = new Error("connection reset");
    createClientMock.mockRejectedValue(boom);
    await expect(markMessagesRead("user-1", "ADMIN")).resolves.toEqual(UNEXPECTED);
    expect(logErrorMock).toHaveBeenCalledWith("action:messages.markRead", boom);
  });
});

describe("getMessageThread", () => {
  it("returns the ordered messages for the given user's thread", async () => {
    const rows = [SENT_MESSAGE, ADMIN_SENT];
    const { builders } = setup({ tables: { messages: { data: rows } } });
    await expect(getMessageThread("user-1")).resolves.toEqual({ messages: rows });
    expect(builders.messages.calls).toContainEqual({ method: "eq", args: ["user_id", "user-1"] });
    expect(builders.messages.calls).toContainEqual({ method: "order", args: ["created_at", { ascending: true }] });
  });

  it("treats a null result as an empty thread", async () => {
    setup({ tables: { messages: { data: null } } });
    await expect(getMessageThread("user-1")).resolves.toEqual({ messages: [] });
  });

  it("returns the database error", async () => {
    setup({ tables: { messages: { error: { message: "select failed" } } } });
    await expect(getMessageThread("user-1")).resolves.toEqual({ error: "select failed" });
  });

  it("converts thrown exceptions into the friendly message and logs them", async () => {
    const boom = new Error("connection reset");
    createClientMock.mockRejectedValue(boom);
    await expect(getMessageThread("user-1")).resolves.toEqual(UNEXPECTED);
    expect(logErrorMock).toHaveBeenCalledWith("action:messages.getThread", boom);
  });
});
