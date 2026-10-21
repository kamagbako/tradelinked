import { beforeEach, describe, expect, it, vi } from "vitest";

const logError = vi.fn();
vi.mock("@/lib/logger", () => ({ logError: (...args: unknown[]) => logError(...args), logWarn: vi.fn() }));

const state = vi.hoisted(() => ({ createClient: undefined as unknown as () => unknown }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => state.createClient() }));

import { subscribeToTable } from "@/lib/supabase/realtime";

const CONFIG = { event: "UPDATE", schema: "public", table: "balances", filter: "user_id=eq.u1" } as const;

function makeClient() {
  const channel: Record<string, unknown> = {};
  const captured: { type?: string; config?: unknown; handler?: (payload: unknown) => void } = {};
  channel.on = vi.fn((type: string, config: unknown, handler: (payload: unknown) => void) => {
    Object.assign(captured, { type, config, handler });
    return channel;
  });
  channel.subscribe = vi.fn(() => channel);
  const client = { channel: vi.fn(() => channel), removeChannel: vi.fn() };
  return { client, channel, captured };
}

beforeEach(() => {
  logError.mockClear();
});

describe("subscribeToTable", () => {
  it("subscribes to postgres_changes on the named channel with the given filter", () => {
    const { client, channel, captured } = makeClient();
    state.createClient = () => client;
    subscribeToTable("balances-u1", CONFIG, vi.fn());
    expect(client.channel).toHaveBeenCalledWith("balances-u1");
    expect(captured.type).toBe("postgres_changes");
    expect(captured.config).toEqual(CONFIG);
    expect(channel.subscribe).toHaveBeenCalledTimes(1);
  });

  it("forwards change payloads to the callback", () => {
    const { client, captured } = makeClient();
    state.createClient = () => client;
    const onChange = vi.fn();
    subscribeToTable("c", CONFIG, onChange);
    captured.handler?.({ new: { available_balance: 42 } });
    expect(onChange).toHaveBeenCalledWith({ new: { available_balance: 42 } });
  });

  it("returns an unsubscribe function that removes the channel", () => {
    const { client, channel } = makeClient();
    state.createClient = () => client;
    const unsubscribe = subscribeToTable("c", CONFIG, vi.fn());
    unsubscribe();
    expect(client.removeChannel).toHaveBeenCalledExactlyOnceWith(channel);
  });

  it("does not throw and returns a no-op when the client cannot be created (bad config)", () => {
    state.createClient = () => {
      throw new Error("Missing environment variables");
    };
    let unsubscribe!: () => void;
    expect(() => (unsubscribe = subscribeToTable("c", CONFIG, vi.fn()))).not.toThrow();
    expect(() => unsubscribe()).not.toThrow();
    expect(logError).toHaveBeenCalledWith("realtime.subscribe", expect.any(Error), { channel: "c" });
  });

  it("does not throw when subscribing itself fails", () => {
    const { client, channel } = makeClient();
    (channel.subscribe as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("socket closed");
    });
    state.createClient = () => client;
    expect(() => subscribeToTable("c", CONFIG, vi.fn())).not.toThrow();
    expect(logError).toHaveBeenCalledTimes(1);
  });

  it("swallows and logs an error while unsubscribing", () => {
    const { client } = makeClient();
    client.removeChannel.mockImplementation(() => {
      throw new Error("already closed");
    });
    state.createClient = () => client;
    const unsubscribe = subscribeToTable("c", CONFIG, vi.fn());
    expect(() => unsubscribe()).not.toThrow();
    expect(logError).toHaveBeenCalledWith("realtime.unsubscribe", expect.any(Error), { channel: "c" });
  });
});
