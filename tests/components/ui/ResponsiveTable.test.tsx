import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithIntl } from "@tests/helpers/utils";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/ui/ResponsiveTable";

interface Row {
  id: string;
  symbol: string;
  qty: number;
  side: string;
}

const rows: Row[] = [
  { id: "1", symbol: "EURUSD", qty: 10, side: "buy" },
  { id: "2", symbol: "GBPJPY", qty: 25, side: "sell" },
];

const columns: ResponsiveColumn<Row>[] = [
  { key: "symbol", header: "Symbol", render: (r) => r.symbol },
  { key: "qty", header: "Quantity", render: (r) => r.qty },
  { key: "side", header: "Side", render: (r) => <em>{r.side}</em> },
];

function renderTable(props: Partial<React.ComponentProps<typeof ResponsiveTable<Row>>> = {}) {
  return renderWithIntl(<ResponsiveTable columns={columns} rows={rows} rowKey={(r) => r.id} {...props} />);
}

describe("ResponsiveTable", () => {
  describe("empty state", () => {
    it("shows the translated default message when there are no rows", () => {
      renderTable({ rows: [] });
      expect(screen.getByText("No records yet.")).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("translates the default message", () => {
      renderWithIntl(<ResponsiveTable columns={columns} rows={[]} rowKey={(r: Row) => r.id} />, { locale: "fr" });
      expect(screen.getByText("Aucun enregistrement pour le moment.")).toBeInTheDocument();
    });

    it("shows a custom emptyState instead of the default", () => {
      renderTable({ rows: [], emptyState: <span>Nothing traded</span> });
      expect(screen.getByText("Nothing traded")).toBeInTheDocument();
      expect(screen.queryByText("No records yet.")).not.toBeInTheDocument();
    });

    it("does not render the custom empty state when rows exist", () => {
      renderTable({ emptyState: <span>Nothing traded</span> });
      expect(screen.queryByText("Nothing traded")).not.toBeInTheDocument();
    });
  });

  describe("desktop table", () => {
    it("renders one column header per column", () => {
      renderTable();
      const table = screen.getByRole("table");
      expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
        "Symbol",
        "Quantity",
        "Side",
      ]);
    });

    it("renders a header row plus one row per data item", () => {
      renderTable();
      expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(1 + rows.length);
    });

    it("renders each cell using the column's render function", () => {
      renderTable();
      const table = screen.getByRole("table");
      const dataRow = within(table).getAllByRole("row")[1];
      expect(within(dataRow).getAllByRole("cell").map((c) => c.textContent)).toEqual(["EURUSD", "10", "buy"]);
      expect(within(dataRow).getByText("buy").tagName).toBe("EM");
    });

    it("renders rows in the order supplied", () => {
      renderTable({ rows: [...rows].reverse() });
      const cells = within(screen.getByRole("table")).getAllByRole("cell");
      expect(cells[0]).toHaveTextContent("GBPJPY");
    });

    it("uses a column's className for its cells when supplied", () => {
      renderTable({
        columns: [
          { key: "symbol", header: "Symbol", render: (r) => r.symbol, className: "px-2 font-mono" },
          { key: "qty", header: "Quantity", render: (r) => r.qty },
        ],
      });
      const cells = within(screen.getByRole("table")).getAllByRole("cell");
      expect(cells[0]).toHaveClass("font-mono");
      expect(cells[1]).toHaveClass("text-text");
    });

    it("is hidden below the sm breakpoint via CSS classes", () => {
      renderTable();
      expect(screen.getByRole("table").parentElement).toHaveClass("hidden", "sm:block");
    });
  });

  describe("mobile cards", () => {
    function cards(container: HTMLElement) {
      return container.querySelectorAll<HTMLElement>(".sm\\:hidden > .glass-card");
    }

    it("renders one card per row, hidden from sm and up", () => {
      const { container } = renderTable();
      expect(cards(container)).toHaveLength(rows.length);
      expect(cards(container)[0].parentElement).toHaveClass("sm:hidden");
    });

    it("uses the first column as the card title when none is marked primary", () => {
      const { container } = renderTable();
      const card = cards(container)[0];
      const head = card.firstElementChild as HTMLElement;
      expect(head).toHaveTextContent("Symbol");
      expect(head).toHaveTextContent("EURUSD");
    });

    it("uses the column marked primary as the card title", () => {
      const { container } = renderTable({
        columns: [
          { key: "symbol", header: "Symbol", render: (r) => r.symbol },
          { key: "qty", header: "Quantity", render: (r) => r.qty, primary: true },
          { key: "side", header: "Side", render: (r) => r.side },
        ],
      });
      const head = cards(container)[0].firstElementChild as HTMLElement;
      expect(head).toHaveTextContent("Quantity");
      expect(head).toHaveTextContent("10");
      expect(head).not.toHaveTextContent("Symbol");
    });

    it("lists the remaining columns as label/value pairs, excluding the primary one", () => {
      const { container } = renderTable();
      const details = cards(container)[0].lastElementChild as HTMLElement;
      expect(details.children).toHaveLength(2);
      expect(details.children[0]).toHaveTextContent("Quantity");
      expect(details.children[0]).toHaveTextContent("10");
      expect(details.children[1]).toHaveTextContent("Side");
      expect(details.children[1]).toHaveTextContent("buy");
      expect(details).not.toHaveTextContent("Symbol");
    });

    it("renders each row's own data in its card", () => {
      const { container } = renderTable();
      expect(cards(container)[1]).toHaveTextContent("GBPJPY");
      expect(cards(container)[1]).toHaveTextContent("25");
      expect(cards(container)[1]).toHaveTextContent("sell");
    });

    it("picks the first primary column if more than one is marked", () => {
      const { container } = renderTable({
        columns: [
          { key: "symbol", header: "Symbol", render: (r) => r.symbol },
          { key: "qty", header: "Quantity", render: (r) => r.qty, primary: true },
          { key: "side", header: "Side", render: (r) => r.side, primary: true },
        ],
      });
      expect(cards(container)[0].firstElementChild).toHaveTextContent("Quantity");
      expect((cards(container)[0].lastElementChild as HTMLElement).children).toHaveLength(2);
    });

    it("renders a card with no detail lines for a single-column table", () => {
      const { container } = renderTable({ columns: [columns[0]] });
      expect((cards(container)[0].lastElementChild as HTMLElement).children).toHaveLength(0);
    });
  });

  it("renders both desktop and mobile variants for the same data", () => {
    renderTable();
    // Each row's symbol appears once in the table and once in its mobile card.
    expect(screen.getAllByText("EURUSD")).toHaveLength(2);
  });

  it("uses rowKey to keep rows stable across re-renders", () => {
    const { rerender } = renderTable();
    const before = within(screen.getByRole("table")).getAllByRole("row")[1];
    rerender(<ResponsiveTable columns={columns} rows={[...rows, { id: "3", symbol: "AUDNZD", qty: 1, side: "buy" }]} rowKey={(r) => r.id} />);
    expect(within(screen.getByRole("table")).getAllByRole("row")[1]).toBe(before);
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(4);
  });
});
