import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { RequestHistory, type RequestRow } from "@/components/dashboard/RequestHistory";
import { renderWithIntl } from "@tests/helpers/utils";

const row = (over: Partial<RequestRow> = {}): RequestRow => ({
  id: "r1",
  amount: 1500,
  method: "BANK_TRANSFER",
  status: "PENDING",
  detail: "Ref 12345",
  created_at: "2025-01-15T12:00:00Z",
  ...over,
});

const table = () => within(screen.getByRole("table"));
const bodyRows = () => table().getAllByRole("row").slice(1);

describe("RequestHistory", () => {
  it("renders the column headers", () => {
    renderWithIntl(<RequestHistory rows={[row()]} empty="nothing" />);
    expect(table().getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Amount",
      "Method",
      "Status",
      "Details",
      "Date",
    ]);
  });

  it("renders a row with formatted amount, method, status, detail and date", () => {
    renderWithIntl(<RequestHistory rows={[row()]} empty="nothing" />);
    const cells = within(bodyRows()[0]).getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("$1,500.00");
    expect(cells[1]).toHaveTextContent("Bank Transfer");
    expect(cells[2]).toHaveTextContent("PENDING");
    expect(cells[3]).toHaveTextContent("Ref 12345");
    expect(cells[4]).toHaveTextContent(/Jan 15, 2025/);
  });

  it("renders one table row per request, in the given order", () => {
    renderWithIntl(
      <RequestHistory
        rows={[row({ id: "a", amount: 10 }), row({ id: "b", amount: 20 }), row({ id: "c", amount: 30 })]}
        empty="nothing"
      />,
    );
    expect(bodyRows().map((r) => within(r).getAllByRole("cell")[0].textContent)).toEqual(["$10.00", "$20.00", "$30.00"]);
  });

  it("shows the empty state and no table when there are no rows", () => {
    renderWithIntl(<RequestHistory rows={[]} empty="You haven't submitted any deposits yet." />);
    expect(screen.getByText("You haven't submitted any deposits yet.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows a dash when there is no detail", () => {
    renderWithIntl(<RequestHistory rows={[row({ detail: null })]} empty="x" />);
    expect(within(bodyRows()[0]).getAllByRole("cell")[3]).toHaveTextContent("—");
  });

  it("shows the rejection reason passed as detail for rejected requests", () => {
    renderWithIntl(<RequestHistory rows={[row({ status: "REJECTED", detail: "Payment not received" })]} empty="x" />);
    const cells = within(bodyRows()[0]).getAllByRole("cell");
    expect(cells[2]).toHaveTextContent("REJECTED");
    expect(cells[3]).toHaveTextContent("Payment not received");
  });

  describe("status badge tones", () => {
    it.each([
      ["APPROVED", "APPROVED", "text-emerald-400"],
      ["COMPLETED", "COMPLETED", "text-emerald-400"],
      ["PENDING", "PENDING", "text-amber-400"],
      ["REJECTED", "REJECTED", "text-red-400"],
      ["SOMETHING_NEW", "SOMETHING_NEW", "text-text-muted"],
    ])("%s renders as %s with %s", (status, label, toneClass) => {
      renderWithIntl(<RequestHistory rows={[row({ status })]} empty="x" />);
      const badge = within(bodyRows()[0]).getByText(label);
      expect(badge).toHaveClass(toneClass);
    });
  });

  describe("method labels", () => {
    it.each([
      ["BANK_TRANSFER", "Bank Transfer"],
      ["BTC", "Bitcoin (BTC)"],
      ["USDT", "USDT"],
    ])("translates %s to %s", (method, label) => {
      renderWithIntl(<RequestHistory rows={[row({ method })]} empty="x" />);
      expect(within(bodyRows()[0]).getAllByRole("cell")[1]).toHaveTextContent(label);
    });

    it("falls back to a humanised raw value for unknown methods", () => {
      renderWithIntl(<RequestHistory rows={[row({ method: "WIRE_X" })]} empty="x" />);
      expect(within(bodyRows()[0]).getAllByRole("cell")[1]).toHaveTextContent("WIRE X");
    });
  });

  it("also renders the stacked mobile cards with the same data", () => {
    renderWithIntl(<RequestHistory rows={[row()]} empty="x" />);
    expect(screen.getAllByText("$1,500.00")).toHaveLength(2);
    expect(screen.getAllByText("Ref 12345")).toHaveLength(2);
  });

  it("is translated to French", () => {
    renderWithIntl(<RequestHistory rows={[row({ status: "APPROVED", method: "BANK_TRANSFER" })]} empty="x" />, { locale: "fr" });
    expect(table().getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Montant",
      "Moyen",
      "Statut",
      "Détails",
      "Date",
    ]);
    const cells = within(bodyRows()[0]).getAllByRole("cell");
    expect(cells[1]).toHaveTextContent("Virement bancaire");
    expect(cells[2]).toHaveTextContent("APPROUVÉ");
  });

  it("is translated to Chinese", () => {
    renderWithIntl(<RequestHistory rows={[row({ status: "COMPLETED" })]} empty="x" />, { locale: "zh" });
    expect(within(bodyRows()[0]).getAllByRole("cell")[2]).toHaveTextContent("已完成");
  });
});
