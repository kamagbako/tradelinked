import type { ReactElement } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider, createTranslator } from "next-intl";
import { loadMessages } from "@tests/helpers/messages";

/** Renders a component inside the real next-intl provider with the real message files. */
export function renderWithIntl(
  ui: ReactElement,
  { locale = "en", ...options }: { locale?: string } & Omit<RenderOptions, "wrapper"> = {},
) {
  const messages = loadMessages(locale);
  const user = userEvent.setup();
  const result = render(ui, {
    wrapper: ({ children }) => (
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
        {children}
      </NextIntlClientProvider>
    ),
    ...options,
  });
  return { user, ...result };
}

/**
 * Stand-in for `getTranslations` from "next-intl/server", backed by the real English messages.
 * Usage in a test file:
 *   vi.mock("next-intl/server", async () => (await import("@tests/helpers/utils")).nextIntlServerMock());
 */
export function nextIntlServerMock(locale = "en") {
  const messages = loadMessages(locale);
  return {
    getTranslations: async (namespace?: string) =>
      createTranslator({ locale, messages, namespace: namespace as never }),
    getLocale: async () => locale,
    getMessages: async () => messages,
  };
}

export { userEvent };
