import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithIntl } from "@tests/helpers/utils";
import { PasswordInput } from "@/components/ui/PasswordInput";

describe("PasswordInput", () => {
  it("renders a masked input by default", () => {
    renderWithIntl(<PasswordInput aria-label="Secret" />);
    expect(screen.getByLabelText("Secret")).toHaveAttribute("type", "password");
  });

  it("offers a 'Show password' toggle that is not pressed initially", () => {
    renderWithIntl(<PasswordInput aria-label="Secret" />);
    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveAttribute("type", "button");
  });

  it("reveals the password when the toggle is clicked", async () => {
    const { user } = renderWithIntl(<PasswordInput aria-label="Secret" />);
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Secret")).toHaveAttribute("type", "text");
  });

  it("flips the label to 'Hide password' and aria-pressed to true when visible", async () => {
    const { user } = renderWithIntl(<PasswordInput aria-label="Secret" />);
    await user.click(screen.getByRole("button", { name: "Show password" }));
    const toggle = screen.getByRole("button", { name: "Hide password" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "Show password" })).not.toBeInTheDocument();
  });

  it("hides the password again on a second click", async () => {
    const { user } = renderWithIntl(<PasswordInput aria-label="Secret" />);
    await user.click(screen.getByRole("button", { name: "Show password" }));
    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(screen.getByLabelText("Secret")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Show password" })).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps the typed value when toggling visibility", async () => {
    const { user } = renderWithIntl(<PasswordInput aria-label="Secret" />);
    await user.type(screen.getByLabelText("Secret"), "hunter22");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Secret")).toHaveValue("hunter22");
  });

  it("toggling does not submit the surrounding form", async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    const { user } = renderWithIntl(
      <form onSubmit={onSubmit}>
        <PasswordInput aria-label="Secret" />
      </form>,
    );
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("forwards props to the input", () => {
    renderWithIntl(
      <PasswordInput aria-label="Secret" name="password" autoComplete="new-password" placeholder="••••" required />,
    );
    const input = screen.getByLabelText("Secret");
    expect(input).toHaveAttribute("name", "password");
    expect(input).toHaveAttribute("autocomplete", "new-password");
    expect(input).toHaveAttribute("placeholder", "••••");
    expect(input).toBeRequired();
  });

  it("forwards the ref to the input element", () => {
    const ref = createRef<HTMLInputElement>();
    renderWithIntl(<PasswordInput aria-label="Secret" ref={ref} />);
    expect(ref.current).toBe(screen.getByLabelText("Secret"));
  });

  it("works as a controlled input", async () => {
    const onChange = vi.fn();
    const { user } = renderWithIntl(<PasswordInput aria-label="Secret" value="abc" onChange={onChange} />);
    await user.type(screen.getByLabelText("Secret"), "d");
    expect(onChange).toHaveBeenCalled();
    expect(screen.getByLabelText("Secret")).toHaveValue("abc");
  });

  it("adds right padding for the toggle and merges custom classes", () => {
    renderWithIntl(<PasswordInput aria-label="Secret" className="custom" />);
    expect(screen.getByLabelText("Secret")).toHaveClass("pr-11", "custom");
  });

  it("translates the toggle label", () => {
    renderWithIntl(<PasswordInput aria-label="Secret" />, { locale: "fr" });
    expect(screen.queryByRole("button", { name: "Show password" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Afficher le mot de passe" })).toBeInTheDocument();
  });
});
