import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@tests/helpers/utils";
import { Button } from "@/components/ui/Button";

describe("Button", () => {
  it("renders its children as an accessible button", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.setup().click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Go
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Go" });
    expect(button).toBeDisabled();
    await userEvent.setup().click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("is enabled by default", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button")).toBeEnabled();
  });

  it("is disabled and shows a spinner while loading", () => {
    render(<Button isLoading>Saving</Button>);
    const button = screen.getByRole("button", { name: "Saving" });
    expect(button).toBeDisabled();
    expect(button.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("does not show a spinner when not loading", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button").querySelector(".animate-spin")).not.toBeInTheDocument();
  });

  it("does not fire onClick while loading", async () => {
    const onClick = vi.fn();
    render(
      <Button isLoading onClick={onClick}>
        Saving
      </Button>,
    );
    await userEvent.setup().click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("stays disabled when both disabled and isLoading are false/true combinations", () => {
    const { rerender } = render(<Button disabled isLoading={false}>X</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
    rerender(<Button disabled={false} isLoading={false}>X</Button>);
    expect(screen.getByRole("button")).toBeEnabled();
  });

  it.each([
    ["primary", "bg-blue-500"],
    ["secondary", "border-border"],
    ["ghost", "bg-transparent"],
    ["danger", "text-red-400"],
    ["success", "bg-emerald-500"],
  ] as const)("applies the %s variant styles", (variant, cls) => {
    render(<Button variant={variant}>V</Button>);
    expect(screen.getByRole("button")).toHaveClass(cls);
  });

  it("defaults to the primary variant and md size", () => {
    render(<Button>D</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("bg-blue-500");
    expect(button).toHaveClass("h-11");
  });

  it.each([
    ["sm", "h-9"],
    ["md", "h-11"],
    ["lg", "h-12"],
  ] as const)("applies the %s size", (size, cls) => {
    render(<Button size={size}>S</Button>);
    expect(screen.getByRole("button")).toHaveClass(cls);
  });

  it("merges a custom className and lets it override conflicting utilities", () => {
    render(<Button className="w-full h-20">C</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("w-full");
    expect(button).toHaveClass("h-20");
    expect(button).not.toHaveClass("h-11");
  });

  it("forwards refs to the button element", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>R</Button>);
    expect(ref.current).toBe(screen.getByRole("button"));
  });

  it("forwards arbitrary props such as type, aria-* and data-*", () => {
    render(
      <Button type="submit" aria-label="Send it" data-testid="send">
        Send
      </Button>,
    );
    const button = screen.getByTestId("send");
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toHaveAccessibleName("Send it");
  });

  it("submits its form when type=submit", async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit">Submit</Button>
      </form>,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("can be activated with the keyboard", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Key</Button>);
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole("button")).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});
