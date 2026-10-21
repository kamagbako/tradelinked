import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { PlansGrid } from "@/components/marketing/PlansGrid";
import { renderWithIntl } from "@tests/helpers/utils";
import { flatten, loadMessages } from "@tests/helpers/messages";

const en = flatten(loadMessages("en"));

const PLANS = [
  { name: "Starter", roi: "4.5%", range: "$500 – $4,999", features: ["ticker", "email", "ledger"] },
  { name: "Growth", roi: "6.8%", range: "$5,000 – $24,999", features: ["withdrawal", "whatsapp", "note"] },
  { name: "Elite", roi: "9.2%", range: "$25,000 – $250,000", features: ["manager", "payout", "priority"] },
] as const;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("PlansGrid", () => {
  it("is the #plans anchor target with a heading and subtitle", () => {
    const { container } = renderWithIntl(<PlansGrid />);
    expect(container.querySelector("section#plans")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Investment Plans" })).toBeInTheDocument();
    expect(screen.getByText("Choose a plan that fits your investment goals.")).toBeInTheDocument();
  });

  it("renders exactly three plans in order", () => {
    renderWithIntl(<PlansGrid />);
    const names = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(names).toEqual(["Starter", "Growth", "Elite"]);
  });

  it.each(PLANS)("shows ROI, duration and deposit range for $name", ({ name, roi, range }) => {
    renderWithIntl(<PlansGrid />);
    const card = screen.getByRole("heading", { level: 3, name }).parentElement!;
    expect(within(card).getByText(roi)).toBeInTheDocument();
    expect(within(card).getByText("/ 30 days")).toBeInTheDocument();
    expect(within(card).getByText(range)).toBeInTheDocument();
  });

  it.each(PLANS)("lists the three features of $name", ({ name, features }) => {
    renderWithIntl(<PlansGrid />);
    const card = screen.getByRole("heading", { level: 3, name }).parentElement!;
    const items = within(card).getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toEqual(features.map((f) => en[`landing.plans.items.${name.toLowerCase()}.features.${f}`]));
  });

  it("badges only the Growth plan as most popular", () => {
    renderWithIntl(<PlansGrid />);
    const badges = screen.getAllByText("Most popular");
    expect(badges).toHaveLength(1);
    expect(badges[0].parentElement).toContainElement(screen.getByRole("heading", { name: "Growth" }));
  });

  it("gives every plan a contact-support button", () => {
    renderWithIntl(<PlansGrid />);
    expect(screen.getAllByRole("button", { name: "Contact Support to Invest" })).toHaveLength(3);
  });

  it("does not render the drawer until a plan is chosen", () => {
    renderWithIntl(<PlansGrid />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each(["Starter", "Growth", "Elite"])("opens the drawer titled for the %s plan", async (name) => {
    const { user } = renderWithIntl(<PlansGrid />);
    const card = screen.getByRole("heading", { level: 3, name }).parentElement!;
    await user.click(within(card).getByRole("button", { name: "Contact Support to Invest" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: `Invest in ${name}` })).toBeInTheDocument();
    const emphasised = within(dialog).getByText(name, { selector: "span" });
    expect(emphasised).toHaveClass("text-text");
    expect(dialog).toHaveTextContent(`To get started with the ${name} plan`);
  });

  it("shows a WhatsApp link from NEXT_PUBLIC_WHATSAPP_SUPPORT_URL inside the drawer", async () => {
    vi.stubEnv("NEXT_PUBLIC_WHATSAPP_SUPPORT_URL", "https://wa.me/15550001111");
    const { user } = renderWithIntl(<PlansGrid />);
    await user.click(screen.getAllByRole("button", { name: "Contact Support to Invest" })[1]);

    const link = within(await screen.findByRole("dialog")).getByRole("link", { name: /Chat on WhatsApp/ });
    expect(link).toHaveAttribute("href", "https://wa.me/15550001111");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("falls back to a # link when no WhatsApp URL is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_WHATSAPP_SUPPORT_URL", undefined);
    const { user } = renderWithIntl(<PlansGrid />);
    await user.click(screen.getAllByRole("button", { name: "Contact Support to Invest" })[0]);

    const link = within(await screen.findByRole("dialog")).getByRole("link", { name: /Chat on WhatsApp/ });
    expect(link).toHaveAttribute("href", "#");
  });

  it("closes the drawer with the close button", async () => {
    const { user } = renderWithIntl(<PlansGrid />);
    await user.click(screen.getAllByRole("button", { name: "Contact Support to Invest" })[0]);
    const dialog = await screen.findByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("switches the drawer to a different plan when reopened", async () => {
    const { user } = renderWithIntl(<PlansGrid />);
    const buttons = screen.getAllByRole("button", { name: "Contact Support to Invest" });
    await user.click(buttons[0]);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(buttons[2]);
    expect(await screen.findByRole("heading", { name: "Invest in Elite" })).toBeInTheDocument();
  });

  it("renders French plan copy and drawer title", async () => {
    const fr = flatten(loadMessages("fr"));
    const { user } = renderWithIntl(<PlansGrid />, { locale: "fr" });
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(fr["landing.plans.heading"]);
    expect(screen.getByText(fr["landing.plans.mostPopular"])).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: fr["landing.plans.contactSupport"] })[1]);
    const growth = fr["landing.plans.items.growth.name"];
    expect(
      await screen.findByRole("heading", { name: fr["landing.plans.drawerTitle"].replace("{plan}", growth) }),
    ).toBeInTheDocument();
  });

  it("renders Chinese plan names and the per-days label", () => {
    const zh = flatten(loadMessages("zh"));
    renderWithIntl(<PlansGrid />, { locale: "zh" });
    const names = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(names).toEqual(["starter", "growth", "elite"].map((id) => zh[`landing.plans.items.${id}.name`]));
    expect(screen.getAllByText(zh["landing.plans.perDays"].replace("{days}", "30"))).toHaveLength(3);
  });
});
