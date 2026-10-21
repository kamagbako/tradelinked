import { beforeEach, describe, expect, it, vi } from "vitest";
import { logError, logWarn } from "@/lib/logger";

let errorSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("logError", () => {
  it("logs scope, message, and stack for Error instances", () => {
    const err = new Error("boom");
    logError("scope", err);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith("[tradelinked] scope: boom", { stack: err.stack });
  });

  it("merges extra context alongside the stack", () => {
    logError("scope", new Error("boom"), { path: "/x" });
    const [, ctx] = errorSpy.mock.calls[0];
    expect(ctx).toMatchObject({ path: "/x" });
    expect(ctx).toHaveProperty("stack");
  });

  it("wraps string errors", () => {
    logError("scope", "plain string");
    expect(errorSpy.mock.calls[0][0]).toBe("[tradelinked] scope: plain string");
  });

  it("uses a generic message for unknown values", () => {
    logError("scope", { weird: true });
    expect(errorSpy.mock.calls[0][0]).toBe("[tradelinked] scope: Unknown error");
    logError("scope", null);
    expect(errorSpy.mock.calls[1][0]).toBe("[tradelinked] scope: Unknown error");
  });

  it("does not use console.warn", () => {
    logError("scope", new Error("x"));
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe("logWarn", () => {
  it("logs scope and message with default empty context", () => {
    logWarn("email", "skipping");
    expect(warnSpy).toHaveBeenCalledWith("[tradelinked] email: skipping", {});
  });

  it("passes through context", () => {
    logWarn("email", "skipping", { subject: "Hi" });
    expect(warnSpy).toHaveBeenCalledWith("[tradelinked] email: skipping", { subject: "Hi" });
  });

  it("does not use console.error", () => {
    logWarn("a", "b");
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
