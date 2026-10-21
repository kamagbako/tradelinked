import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { PlansPicker } from "@/components/dashboard/PlansPicker";
import { renderWithIntl } from "@tests/helpers/utils";
import { flatten, loadMessages } from "@tests/helpers/messages";

vi.mock("@/lib/actions/plans", () => ({ activatePlan: vi.fn() }));
import { activatePlan } from "@/lib/actions/plans";

const activate = vi.mocked(activatePlan);

const PLAN_CARDS = [
  { id: "starter", name: "Starter", min: 500, roi: "4.5%", range: "$500.00 – $4,999.00" },
  { id: "growth", name: "Growth", min: 5000, roi: "6.8%", range: "$5,000.00 – $24,999.00" },
  { id: "elite", name: "Elite", min: 25000, roi: "9.2%", range: "$25,000.00 – $250,000.00" },
] as const;

function card(name: string) {
  return screen.getByRole("heading", { level: 3, name }).parentElement!;
}

describe("PlansPicker", () => {
  it("renders the three plans with their ROI, duration and deposit range", () => {
    renderWithIntl(<PlansPicker activePlanId={null} availableBalance={0} />);
    for (const { name, roi, range } of PLAN_CARDS) {
      const c = card(name);
      expect(within(c).getByText(roi)).toBeInTheDocument();
      expect(within(c).getByText("/ 30 days")).toBeInTheDocument();
      expect(within(c).getByText(range)).toBeInTheDocument();
    }
  });

  it("badges only Growth as most popular when no plan is active", () => {
    renderWithIntl(<PlansPicker activePlanId={null} availableBalance={0} />);
    expect(screen.getAllByText("Most popular")).toHaveLength(1);
  });

  it("shows no success or error message initially", () => {
    renderWithIntl(<PlansPicker activePlanId={null} availableBalance={0} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/activated\./)).not.toBeInTheDocument();
  });

  describe("with no active plan and a balance covering only Starter and Growth", () => {
    function renderIt() {
      return renderWithIntl(<PlansPicker activePlanId={null} availableBalance={6000} />);
    }

    it("offers Activate buttons for Starter and Growth", () => {
      renderIt();
      expect(within(card("Starter")).getByRole("button", { name: "Activate this plan" })).toBeEnabled();
      expect(within(card("Growth")).getByRole("button", { name: "Activate this plan" })).toBeEnabled();
    });

    it("locks Elite with a deposit prompt instead of an Activate button", () => {
      renderIt();
      const elite = card("Elite");
      expect(within(elite).getByText("Deposit at least $25,000.00 to unlock this plan.")).toBeInTheDocument();
      const depositLink = within(elite).getByRole("link", { name: "Make a deposit" });
      // Carries the plan's id so the Deposit page can pre-fill its minimum into the amount field.
      expect(depositLink).toHaveAttribute("href", "/dashboard/deposit?plan=elite");
      expect(within(elite).queryByRole("button", { name: "Activate this plan" })).not.toBeInTheDocument();
    });

    it("shows no 'Current plan' badge anywhere", () => {
      renderIt();
      expect(screen.queryByText("Current plan")).not.toBeInTheDocument();
    });
  });

  describe("with Growth already active", () => {
    function renderIt(balance = 1_000_000) {
      return renderWithIntl(<PlansPicker activePlanId="growth" availableBalance={balance} />);
    }

    it("marks Growth as the current plan with a disabled button", () => {
      renderIt();
      const growth = card("Growth");
      expect(within(growth).getByText("Current plan", { selector: "span" })).toBeInTheDocument();
      expect(within(growth).getByRole("button", { name: "Current plan" })).toBeDisabled();
    });

    it("offers 'Switch to this plan' (not 'Activate') for qualifying plans", () => {
      renderIt();
      expect(within(card("Starter")).getByRole("button", { name: "Switch to this plan" })).toBeInTheDocument();
      expect(within(card("Elite")).getByRole("button", { name: "Switch to this plan" })).toBeInTheDocument();
    });

    it("does not show the 'most popular' badge on the now-current Growth card", () => {
      renderIt();
      expect(screen.queryByText("Most popular")).not.toBeInTheDocument();
    });
  });

  describe("activating a plan", () => {
    it("submits the clicked plan's id", async () => {
      activate.mockResolvedValue({ success: true });
      const { user } = renderWithIntl(<PlansPicker activePlanId={null} availableBalance={1_000_000} />);
      await user.click(within(card("Elite")).getByRole("button", { name: "Activate this plan" }));
      expect(activate).toHaveBeenCalledExactlyOnceWith("elite");
    });

    it("shows a success message naming the plan and flips the card to 'Current plan'", async () => {
      activate.mockResolvedValue({ success: true });
      const { user } = renderWithIntl(<PlansPicker activePlanId={null} availableBalance={1_000_000} />);
      await user.click(within(card("Starter")).getByRole("button", { name: "Activate this plan" }));

      expect(await screen.findByText("Starter plan activated.")).toBeInTheDocument();
      expect(within(card("Starter")).getByRole("button", { name: "Current plan" })).toBeDisabled();
    });

    it("re-labels the other cards as 'Switch to this plan' once one is activated", async () => {
      activate.mockResolvedValue({ success: true });
      const { user } = renderWithIntl(<PlansPicker activePlanId={null} availableBalance={1_000_000} />);
      await user.click(within(card("Starter")).getByRole("button", { name: "Activate this plan" }));
      await screen.findByText("Starter plan activated.");
      expect(within(card("Growth")).getByRole("button", { name: "Switch to this plan" })).toBeInTheDocument();
    });

    it("shows the server's error message as an alert and keeps the plan inactive", async () => {
      activate.mockResolvedValue({ error: "Your available balance is below this plan's minimum deposit of $5,000.00." });
      const { user } = renderWithIntl(<PlansPicker activePlanId={null} availableBalance={1_000_000} />);
      await user.click(within(card("Growth")).getByRole("button", { name: "Activate this plan" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Your available balance is below this plan's minimum deposit of $5,000.00.",
      );
      expect(within(card("Growth")).getByRole("button", { name: "Activate this plan" })).toBeInTheDocument();
      expect(screen.queryByText(/plan activated\./)).not.toBeInTheDocument();
    });

    it("clears a previous error once a later activation succeeds", async () => {
      activate.mockResolvedValueOnce({ error: "Nope" }).mockResolvedValueOnce({ success: true });
      const { user } = renderWithIntl(<PlansPicker activePlanId={null} availableBalance={1_000_000} />);
      await user.click(within(card("Starter")).getByRole("button", { name: "Activate this plan" }));
      await screen.findByRole("alert");

      await user.click(within(card("Growth")).getByRole("button", { name: "Activate this plan" }));
      await screen.findByText("Growth plan activated.");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("disables the clicked button while the request is in flight, without disabling the others", async () => {
      let resolve!: (value: { success?: boolean; error?: string }) => void;
      activate.mockImplementation(() => new Promise((r) => (resolve = r)));
      const { user } = renderWithIntl(<PlansPicker activePlanId={null} availableBalance={1_000_000} />);

      await user.click(within(card("Starter")).getByRole("button", { name: "Activate this plan" }));
      await waitFor(() => expect(within(card("Starter")).getByRole("button")).toBeDisabled());
      expect(within(card("Growth")).getByRole("button", { name: "Activate this plan" })).toBeDisabled();

      resolve({ success: true });
      await screen.findByText("Starter plan activated.");
    });

    it("does nothing when the current plan's disabled button is clicked", async () => {
      const { user } = renderWithIntl(<PlansPicker activePlanId="growth" availableBalance={1_000_000} />);
      await user.click(within(card("Growth")).getByRole("button", { name: "Current plan" }));
      expect(activate).not.toHaveBeenCalled();
    });
  });

  it("renders translated copy and currency in French", () => {
    const fr = flatten(loadMessages("fr"));
    renderWithIntl(<PlansPicker activePlanId={null} availableBalance={6000} />, { locale: "fr" });
    const names = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(names).toEqual(["starter", "growth", "elite"].map((id) => fr[`landing.plans.items.${id}.name`]));
    expect(screen.getByText(fr["dashboard.plans.mostPopular"])).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: fr["dashboard.plans.activate"] }).length).toBeGreaterThan(0);
  });

  it("renders translated plan names and the locked-plan message in Chinese", () => {
    const zh = flatten(loadMessages("zh"));
    renderWithIntl(<PlansPicker activePlanId={null} availableBalance={0} />, { locale: "zh" });
    const names = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(names).toEqual(["starter", "growth", "elite"].map((id) => zh[`landing.plans.items.${id}.name`]));

    const eliteCard = screen.getByRole("heading", { level: 3, name: zh["landing.plans.items.elite.name"] }).parentElement!;
    expect(
      within(eliteCard).getByText(zh["dashboard.plans.locked"].replace("{amount}", "$25,000.00")),
    ).toBeInTheDocument();
  });
});
