import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCard } from "@/components/dashboard/StatCard";

const columns = [
  { label: "Submitted", value: "$10.00 USD" },
  { label: "Pending", value: "$5.00 USD" },
  { label: "Rejected", value: "$0.00 USD" },
];

describe("StatCard", () => {
  it("renders the title as a heading and the headline value", () => {
    render(<StatCard title="Successful Deposits" value="$100.00 USD" columns={columns} footer="footer" />);
    expect(screen.getByRole("heading", { level: 2, name: "Successful Deposits" })).toBeInTheDocument();
    expect(screen.getByText("$100.00 USD")).toBeInTheDocument();
  });

  it("renders every sub-figure column with its label and value", () => {
    render(<StatCard title="T" value="V" columns={columns} footer="f" />);
    for (const col of columns) {
      expect(screen.getByText(col.label)).toBeInTheDocument();
      expect(screen.getByText(col.value)).toBeInTheDocument();
    }
  });

  it("renders the footer summary line", () => {
    render(<StatCard title="T" value="V" columns={columns} footer="You've submitted 3 deposits." />);
    expect(screen.getByText("You've submitted 3 deposits.")).toBeInTheDocument();
  });

  it("renders no columns when none are given", () => {
    render(<StatCard title="T" value="V" columns={[]} footer="f" />);
    expect(screen.queryByText("Submitted")).not.toBeInTheDocument();
  });

  it("uses the blue accent by default and honours a custom accent", () => {
    const { container, rerender } = render(<StatCard title="T" value="V" columns={[]} footer="f" />);
    expect(container.firstElementChild).toHaveClass("border-l-blue-500");
    rerender(<StatCard title="T" value="V" columns={[]} footer="f" accent="border-l-emerald-500" />);
    expect(container.firstElementChild).toHaveClass("border-l-emerald-500");
    expect(container.firstElementChild).not.toHaveClass("border-l-blue-500");
  });
});
