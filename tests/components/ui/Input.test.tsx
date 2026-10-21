import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@tests/helpers/utils";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";

describe("Input", () => {
  it("renders a textbox and accepts typing", async () => {
    render(<Input aria-label="Name" />);
    const input = screen.getByRole("textbox", { name: "Name" });
    await userEvent.setup().type(input, "Ada");
    expect(input).toHaveValue("Ada");
  });

  it("forwards props (type, placeholder, name, required)", () => {
    render(<Input aria-label="Mail" type="email" placeholder="you@x.com" name="email" required />);
    const input = screen.getByLabelText("Mail");
    expect(input).toHaveAttribute("type", "email");
    expect(input).toHaveAttribute("placeholder", "you@x.com");
    expect(input).toHaveAttribute("name", "email");
    expect(input).toBeRequired();
  });

  it("forwards refs", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} aria-label="R" />);
    expect(ref.current).toBe(screen.getByLabelText("R"));
  });

  it("merges custom classes with base styles", () => {
    render(<Input aria-label="C" className="pr-11" />);
    const input = screen.getByLabelText("C");
    expect(input).toHaveClass("pr-11");
    expect(input).toHaveClass("rounded-xl");
  });

  it("calls onChange for each keystroke", async () => {
    const onChange = vi.fn();
    render(<Input aria-label="C" onChange={onChange} />);
    await userEvent.setup().type(screen.getByLabelText("C"), "abc");
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it("does not accept typing when disabled", async () => {
    render(<Input aria-label="D" disabled />);
    const input = screen.getByLabelText("D");
    await userEvent.setup().type(input, "x");
    expect(input).toBeDisabled();
    expect(input).toHaveValue("");
  });

  it("respects maxLength", async () => {
    render(<Input aria-label="M" maxLength={3} />);
    const input = screen.getByLabelText("M");
    await userEvent.setup().type(input, "abcdef");
    expect(input).toHaveValue("abc");
  });
});

describe("Label", () => {
  it("renders children and associates with an input through htmlFor", () => {
    render(
      <>
        <Label htmlFor="x">Email address</Label>
        <Input id="x" />
      </>,
    );
    expect(screen.getByLabelText("Email address")).toHaveAttribute("id", "x");
  });

  it("focuses the associated input when clicked", async () => {
    render(
      <>
        <Label htmlFor="x">Email</Label>
        <Input id="x" />
      </>,
    );
    await userEvent.setup().click(screen.getByText("Email"));
    expect(screen.getByLabelText("Email")).toHaveFocus();
  });

  it("renders a <label> element with base styling", () => {
    render(<Label>Plain</Label>);
    const label = screen.getByText("Plain");
    expect(label.tagName).toBe("LABEL");
    expect(label).toHaveClass("block");
  });
});

describe("Select", () => {
  it("renders options and reports the chosen value", async () => {
    render(
      <Select aria-label="Currency" defaultValue="usd">
        <option value="usd">USD</option>
        <option value="eur">EUR</option>
      </Select>,
    );
    const select = screen.getByRole("combobox", { name: "Currency" });
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(select).toHaveValue("usd");
    await userEvent.setup().selectOptions(select, "eur");
    expect(select).toHaveValue("eur");
  });

  it("calls onChange and forwards refs", async () => {
    const onChange = vi.fn();
    const ref = createRef<HTMLSelectElement>();
    render(
      <Select aria-label="S" ref={ref} onChange={onChange}>
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>,
    );
    await userEvent.setup().selectOptions(screen.getByLabelText("S"), "b");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(ref.current).toBe(screen.getByLabelText("S"));
  });

  it("merges custom classes", () => {
    render(
      <Select aria-label="S" className="w-32">
        <option>x</option>
      </Select>,
    );
    expect(screen.getByLabelText("S")).toHaveClass("appearance-none", "w-32");
  });
});

describe("Textarea", () => {
  it("renders a multi-line textbox and accepts typing", async () => {
    render(<Textarea aria-label="Notes" />);
    const area = screen.getByRole("textbox", { name: "Notes" });
    expect(area.tagName).toBe("TEXTAREA");
    await userEvent.setup().type(area, "line1{Enter}line2");
    expect(area).toHaveValue("line1\nline2");
  });

  it("forwards refs, props and merges classes", () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<Textarea aria-label="T" ref={ref} rows={5} className="h-40" placeholder="Write" />);
    const area = screen.getByLabelText("T");
    expect(ref.current).toBe(area);
    expect(area).toHaveAttribute("rows", "5");
    expect(area).toHaveAttribute("placeholder", "Write");
    expect(area).toHaveClass("h-40");
  });
});
