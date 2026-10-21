import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import AdminSettingsPage, { metadata } from "@/app/admin/settings/page";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseMock, type SupabaseMockOptions } from "@tests/helpers/supabase";
import { renderWithIntl } from "@tests/helpers/utils";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/actions/settings", () => ({ updateCompanySettings: vi.fn(), toggleUserFreeze: vi.fn() }));

function mockDb(tables: SupabaseMockOptions["tables"]) {
  const mock = createSupabaseMock({ tables });
  vi.mocked(createClient).mockResolvedValue(mock.client as never);
  return mock;
}

async function renderPage() {
  return renderWithIntl(await AdminSettingsPage());
}

describe("AdminSettingsPage", () => {
  it("has the Settings title", () => {
    expect(metadata.title).toBe("Settings");
  });

  it("renders the heading and form", async () => {
    mockDb({ company_settings: { data: null } });
    await renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Company Settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Settings" })).toBeInTheDocument();
  });

  it("reads the single settings row (id = 1)", async () => {
    const { builders, client } = mockDb({ company_settings: { data: null } });
    await renderPage();
    expect(client.from).toHaveBeenCalledExactlyOnceWith("company_settings");
    expect(builders.company_settings.calls).toEqual([
      { method: "select", args: ["*"] },
      { method: "eq", args: ["id", 1] },
    ]);
    expect(builders.company_settings.single).toHaveBeenCalledTimes(1);
  });

  it("prefills the form from the stored settings", async () => {
    mockDb({
      company_settings: {
        data: { id: 1, bank_name: "First Bank", btc_address: "bc1qexample", whatsapp_support_url: "https://wa.me/1" },
      },
    });
    await renderPage();
    expect(screen.getByLabelText("Bank name")).toHaveValue("First Bank");
    expect(screen.getByLabelText("BTC receiving address")).toHaveValue("bc1qexample");
    expect(screen.getByLabelText("WhatsApp support link")).toHaveValue("https://wa.me/1");
    expect(screen.getByLabelText("USDT (TRC20) address")).toHaveValue("");
  });

  it("renders an empty form when no row exists", async () => {
    mockDb({ company_settings: { data: null } });
    await renderPage();
    expect(screen.getByLabelText("Bank name")).toHaveValue("");
  });
});
