import type { ComponentType } from "react";
import { act, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl, userEvent } from "@tests/helpers/utils";
import { flatten, loadMessages } from "@tests/helpers/messages";

const en = flatten(loadMessages("en"));
const WHATSAPP = "https://wa.me/15550001111";
const TYPING_DELAY = 700;

type Widget = ComponentType<{ className?: string }>;

/** ChatWidget reads NEXT_PUBLIC_WHATSAPP_SUPPORT_URL once at module load, so load it fresh per env value. */
async function loadWidget(url?: string): Promise<Widget> {
  vi.stubEnv("NEXT_PUBLIC_WHATSAPP_SUPPORT_URL", url);
  vi.resetModules();
  return (await import("@/components/marketing/ChatWidget")).ChatWidget;
}

const toggle = () => screen.getByRole("button", { name: /support chat/i });

/**
 * Testing Library only cooperates with fake timers when it sees a `jest` global with the fake-timer
 * clock, so expose the vitest equivalent while faking timers.
 */
function useFakeTimers() {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.stubGlobal("jest", { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("ChatWidget open / close", () => {
  it("starts closed with an accessible launcher", async () => {
    const ChatWidget = await loadWidget();
    renderWithIntl(<ChatWidget />);
    expect(toggle()).toHaveAccessibleName("Open support chat");
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the dialog and flips aria-expanded when the launcher is clicked", async () => {
    const ChatWidget = await loadWidget();
    const { user } = renderWithIntl(<ChatWidget />);
    await user.click(toggle());

    expect(await screen.findByRole("dialog", { name: "Customer support chat" })).toBeInTheDocument();
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    expect(toggle()).toHaveAccessibleName("Close support chat");
  });

  it("closes again when the launcher is clicked a second time", async () => {
    const ChatWidget = await loadWidget();
    const { user } = renderWithIntl(<ChatWidget />);
    await user.click(toggle());
    await screen.findByRole("dialog");
    await user.click(toggle());

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on Escape", async () => {
    const ChatWidget = await loadWidget();
    const { user } = renderWithIntl(<ChatWidget />);
    await user.click(toggle());
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
  });

  it("ignores Escape while closed and other keys while open", async () => {
    const ChatWidget = await loadWidget();
    const { user } = renderWithIntl(<ChatWidget />);
    await user.keyboard("{Escape}");
    expect(toggle()).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle());
    await screen.findByRole("dialog");
    await user.keyboard("a");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows the header, reply-time hint and greeting when open", async () => {
    const ChatWidget = await loadWidget();
    const { user } = renderWithIntl(<ChatWidget />);
    await user.click(toggle());
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByText("Customer Support")).toBeInTheDocument();
    expect(within(dialog).getByText("Typically replies within minutes")).toBeInTheDocument();
    expect(within(dialog).getByText("Hello! How can I help you today?")).toBeInTheDocument();
  });

  it("offers the four quick-reply topics under the greeting", async () => {
    const ChatWidget = await loadWidget();
    const { user } = renderWithIntl(<ChatWidget />);
    await user.click(toggle());
    const dialog = await screen.findByRole("dialog");

    for (const label of ["How do I deposit?", "How do withdrawals work?", "Which plans are available?", "Talk to a person"]) {
      expect(within(dialog).getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("applies a custom className to the wrapper", async () => {
    const ChatWidget = await loadWidget();
    const { container } = renderWithIntl(<ChatWidget className="custom-class" />);
    expect(container.firstElementChild).toHaveClass("custom-class", "fixed");
  });
});

describe("ChatWidget quick replies", () => {
  beforeEach(() => {
    useFakeTimers();
  });

  async function openChat(url = WHATSAPP) {
    const ChatWidget = await loadWidget(url);
    const user = userEvent.setup({ delay: null });
    renderWithIntl(<ChatWidget />);
    await user.click(toggle());
    const dialog = await screen.findByRole("dialog");
    return { user, dialog };
  }

  it.each([
    ["deposit", "How do I deposit?"],
    ["withdraw", "How do withdrawals work?"],
    ["plans", "Which plans are available?"],
  ])("topic %s posts the user question, then the bot answer after the typing delay", async (id, label) => {
    const { user, dialog } = await openChat();
    await user.click(within(dialog).getByRole("button", { name: label }));

    // user bubble appears immediately, bot is "typing"
    expect(within(dialog).getByText(label)).toHaveClass("bg-blue-500");
    expect(within(dialog).getByLabelText("Support is typing")).toBeInTheDocument();
    expect(within(dialog).queryByText(en[`landing.chat.topics.${id}.answer`])).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(TYPING_DELAY - 1);
    });
    expect(within(dialog).queryByText(en[`landing.chat.topics.${id}.answer`])).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(within(dialog).getByText(en[`landing.chat.topics.${id}.answer`])).toHaveClass("bg-hover");
    expect(within(dialog).queryByLabelText("Support is typing")).not.toBeInTheDocument();
  });

  it("hides the quick replies once the conversation has started", async () => {
    const { user, dialog } = await openChat();
    await user.click(within(dialog).getByRole("button", { name: "How do I deposit?" }));
    expect(within(dialog).queryByRole("button", { name: "How do withdrawals work?" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Talk to a person" })).not.toBeInTheDocument();
  });

  it("does not attach a WhatsApp link to informational answers", async () => {
    const { user, dialog } = await openChat();
    await user.click(within(dialog).getByRole("button", { name: "How do I deposit?" }));
    act(() => {
      vi.advanceTimersByTime(TYPING_DELAY);
    });
    expect(within(dialog).queryByRole("link")).not.toBeInTheDocument();
  });

  it("'Talk to a person' hands off to WhatsApp with the encoded handoff text", async () => {
    const { user, dialog } = await openChat();
    await user.click(within(dialog).getByRole("button", { name: "Talk to a person" }));
    act(() => {
      vi.advanceTimersByTime(TYPING_DELAY);
    });

    expect(within(dialog).getByText("Happy to connect you with our support team.")).toBeInTheDocument();
    const link = within(dialog).getByRole("link", { name: /Continue on WhatsApp/ });
    expect(link).toHaveAttribute("href", `${WHATSAPP}?text=${encodeURIComponent("Hello, I'd like to speak to support.")}`);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("uses & when the WhatsApp URL already has a query string", async () => {
    const { user, dialog } = await openChat("https://api.whatsapp.com/send?phone=15550001111");
    await user.click(within(dialog).getByRole("button", { name: "Talk to a person" }));
    act(() => {
      vi.advanceTimersByTime(TYPING_DELAY);
    });
    const link = within(dialog).getByRole("link", { name: /Continue on WhatsApp/ });
    expect(link.getAttribute("href")).toBe(
      `https://api.whatsapp.com/send?phone=15550001111&text=${encodeURIComponent("Hello, I'd like to speak to support.")}`,
    );
  });

  it("'Talk to a person' shows no WhatsApp link when the env var is not set", async () => {
    const { user, dialog } = await openChat("");
    await user.click(within(dialog).getByRole("button", { name: "Talk to a person" }));
    act(() => {
      vi.advanceTimersByTime(TYPING_DELAY);
    });
    expect(within(dialog).getByText("Happy to connect you with our support team.")).toBeInTheDocument();
    expect(within(dialog).queryByRole("link")).not.toBeInTheDocument();
  });

  it("clears pending reply timers on unmount", async () => {
    const ChatWidget = await loadWidget();
    const user = userEvent.setup({ delay: null });
    const { unmount } = renderWithIntl(<ChatWidget />);
    await user.click(toggle());
    await user.click(await screen.findByRole("button", { name: "How do I deposit?" }));
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("ChatWidget free-text messages", () => {
  beforeEach(() => {
    useFakeTimers();
  });

  async function openChat(url?: string) {
    const ChatWidget = await loadWidget(url);
    const user = userEvent.setup({ delay: null });
    renderWithIntl(<ChatWidget />);
    await user.click(toggle());
    const dialog = await screen.findByRole("dialog");
    return {
      user,
      dialog,
      input: within(dialog).getByRole("textbox", { name: "Type a message" }),
      send: within(dialog).getByRole("button", { name: "Send message" }),
    };
  }

  it("cannot send an empty message", async () => {
    const { user, dialog, input, send } = await openChat(WHATSAPP);
    expect(send).toBeDisabled();
    await user.click(send);
    await user.type(input, "{Enter}");
    expect(vi.getTimerCount()).toBe(0);
    expect(within(dialog).queryByLabelText("Support is typing")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Talk to a person" })).toBeInTheDocument();
  });

  it("cannot send a whitespace-only message", async () => {
    const { user, dialog, input, send } = await openChat(WHATSAPP);
    await user.type(input, "    ");
    expect(send).toBeDisabled();
    await user.type(input, "{Enter}");
    expect(within(dialog).queryByLabelText("Support is typing")).not.toBeInTheDocument();
  });

  it("enables the send button once there is text", async () => {
    const { user, input, send } = await openChat(WHATSAPP);
    await user.type(input, "hi");
    expect(send).toBeEnabled();
  });

  it("posts the user's message, clears the input and shows typing", async () => {
    const { user, dialog, input, send } = await openChat(WHATSAPP);
    await user.type(input, "  I need help  ");
    await user.click(send);

    expect(within(dialog).getByText("I need help")).toHaveClass("bg-blue-500");
    expect(input).toHaveValue("");
    expect(within(dialog).getByLabelText("Support is typing")).toBeInTheDocument();
  });

  it("submits with the Enter key", async () => {
    const { user, dialog, input } = await openChat(WHATSAPP);
    await user.type(input, "hello{Enter}");
    expect(within(dialog).getByText("hello")).toBeInTheDocument();
  });

  it("replies with a WhatsApp handoff link containing the URL-encoded text", async () => {
    const { user, dialog, input, send } = await openChat(WHATSAPP);
    const text = "Can I pay by card & how much? 100%";
    await user.type(input, text);
    await user.click(send);
    act(() => {
      vi.advanceTimersByTime(TYPING_DELAY);
    });

    expect(within(dialog).getByText(en["landing.chat.replyWhatsApp"])).toBeInTheDocument();
    expect(within(dialog).queryByText(en["landing.chat.replyLogin"])).not.toBeInTheDocument();
    const link = within(dialog).getByRole("link", { name: /Continue on WhatsApp/ });
    expect(link).toHaveAttribute("href", `${WHATSAPP}?text=${encodeURIComponent(text)}`);
    expect(link.getAttribute("href")).toContain("%26");
    expect(link.getAttribute("href")).toContain("100%25");
  });

  it("replies with the log-in fallback and no link when the env var is not set", async () => {
    const { user, dialog, input, send } = await openChat(undefined);
    await user.type(input, "Where is my money?");
    await user.click(send);
    act(() => {
      vi.advanceTimersByTime(TYPING_DELAY);
    });

    expect(within(dialog).getByText(en["landing.chat.replyLogin"])).toBeInTheDocument();
    expect(within(dialog).queryByText(en["landing.chat.replyWhatsApp"])).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("link")).not.toBeInTheDocument();
  });

  it("keeps the whole conversation in order across several messages", async () => {
    const { user, dialog, input, send } = await openChat(WHATSAPP);
    await user.type(input, "first");
    await user.click(send);
    act(() => {
      vi.advanceTimersByTime(TYPING_DELAY);
    });
    await user.type(input, "second");
    await user.click(send);
    act(() => {
      vi.advanceTimersByTime(TYPING_DELAY);
    });

    const bubbles = Array.from(dialog.querySelectorAll("p.rounded-2xl")).map((p) => p.textContent);
    expect(bubbles).toEqual([
      en["landing.chat.greeting"],
      "first",
      en["landing.chat.replyWhatsApp"],
      "second",
      en["landing.chat.replyWhatsApp"],
    ]);
  });

  it("keeps the conversation when the chat is closed and reopened", async () => {
    const { user, dialog, input, send } = await openChat(WHATSAPP);
    await user.type(input, "remember me");
    await user.click(send);
    act(() => {
      vi.advanceTimersByTime(TYPING_DELAY);
    });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(dialog).not.toBeInTheDocument());

    await user.click(toggle());
    const reopened = await screen.findByRole("dialog");
    expect(within(reopened).getByText("remember me")).toBeInTheDocument();
  });
});

describe("ChatWidget localisation", () => {
  it("renders the French greeting, labels and topics", async () => {
    const fr = flatten(loadMessages("fr"));
    const ChatWidget = await loadWidget(WHATSAPP);
    const { user } = renderWithIntl(<ChatWidget />, { locale: "fr" });
    await user.click(screen.getByRole("button", { name: fr["landing.chat.open"] }));
    const dialog = await screen.findByRole("dialog", { name: fr["landing.chat.dialogLabel"] });

    expect(within(dialog).getByText(fr["landing.chat.greeting"])).toBeInTheDocument();
    expect(within(dialog).getByRole("textbox", { name: fr["landing.chat.inputLabel"] })).toHaveAttribute(
      "placeholder",
      fr["landing.chat.placeholder"],
    );
    for (const id of ["deposit", "withdraw", "plans", "person"]) {
      expect(within(dialog).getByRole("button", { name: fr[`landing.chat.topics.${id}.label`] })).toBeInTheDocument();
    }
  });

  it("renders Chinese copy and hands off in Chinese", async () => {
    const zh = flatten(loadMessages("zh"));
    const ChatWidget = await loadWidget(WHATSAPP);
    const { user } = renderWithIntl(<ChatWidget />, { locale: "zh" });
    await user.click(screen.getByRole("button", { name: zh["landing.chat.open"] }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(zh["landing.chat.greeting"])).toBeInTheDocument();

    useFakeTimers();
    const fakeTimerUser = userEvent.setup({ delay: null });
    await fakeTimerUser.click(within(dialog).getByRole("button", { name: zh["landing.chat.topics.person.label"] }));
    act(() => {
      vi.advanceTimersByTime(TYPING_DELAY);
    });
    const link = within(dialog).getByRole("link", { name: new RegExp(zh["landing.chat.continueWhatsApp"]) });
    expect(link).toHaveAttribute("href", `${WHATSAPP}?text=${encodeURIComponent(zh["landing.chat.topics.person.handoff"])}`);
  });
});
