import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@tests/helpers/utils";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }) }));
vi.mock("@/lib/actions/locale", () => ({ setLocale: vi.fn(async () => {}) }));

const signIn = vi.fn<(fd: FormData) => Promise<{ error?: string }>>(async () => ({}));
vi.mock("@/lib/actions/auth", () => ({ signIn: (fd: FormData) => signIn(fd) }));

import LoginPage from "@/app/login/page";

beforeEach(() => {
  signIn.mockReset();
  signIn.mockResolvedValue({});
});

describe("LoginPage", () => {
  it("renders the heading, subtitle and submit button", () => {
    renderWithIntl(<LoginPage />);
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByText("Log in to access your portfolio.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
  });

  it("has labelled email and password fields with the right attributes", () => {
    renderWithIntl(<LoginPage />);
    const email = screen.getByLabelText("Email");
    expect(email).toHaveAttribute("type", "email");
    expect(email).toHaveAttribute("name", "email");
    expect(email).toHaveAttribute("autocomplete", "email");
    expect(email).toBeRequired();

    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("name", "password");
    expect(password).toHaveAttribute("autocomplete", "current-password");
    expect(password).toBeRequired();
  });

  it("links to the register page from the footer", () => {
    renderWithIntl(<LoginPage />);
    expect(screen.getByRole("link", { name: "Register" })).toHaveAttribute("href", "/register");
    expect(screen.getByText(/Don't have an account\?/)).toBeInTheDocument();
  });

  it("lets the user reveal the password", async () => {
    const { user } = renderWithIntl(<LoginPage />);
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Password")).toHaveValue("secret123");
  });

  it("does not show an error initially", () => {
    renderWithIntl(<LoginPage />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("posts the entered credentials as FormData to signIn", async () => {
    const { user } = renderWithIntl(<LoginPage />);
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "p4ssword!");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => expect(signIn).toHaveBeenCalledTimes(1));
    const fd = signIn.mock.calls[0][0];
    expect(fd).toBeInstanceOf(FormData);
    expect(fd.get("email")).toBe("ada@example.com");
    expect(fd.get("password")).toBe("p4ssword!");
  });

  it("submits with the Enter key from the password field", async () => {
    const { user } = renderWithIntl(<LoginPage />);
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "p4ssword!{Enter}");
    await waitFor(() => expect(signIn).toHaveBeenCalledTimes(1));
  });

  it("renders the error returned by the action", async () => {
    signIn.mockResolvedValue({ error: "Invalid login credentials" });
    const { user } = renderWithIntl(<LoginPage />);
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("Invalid login credentials")).toBeInTheDocument();
  });

  it("keeps what the user typed after a failed sign-in", async () => {
    signIn.mockResolvedValueOnce({ error: "Invalid login credentials" });
    const { user } = renderWithIntl(<LoginPage />);
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "hunter22");
    await user.click(screen.getByRole("button", { name: "Log in" }));
    await screen.findByText("Invalid login credentials");
    expect(screen.getByLabelText("Email")).toHaveValue("ada@example.com");
    expect(screen.getByLabelText("Password")).toHaveValue("hunter22");
  });

  it("announces sign-in errors to assistive technology", async () => {
    signIn.mockResolvedValueOnce({ error: "Invalid login credentials" });
    const { user } = renderWithIntl(<LoginPage />);
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "x");
    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid login credentials");
  });

  it("replaces the previous error when a later attempt returns a different one", async () => {
    signIn.mockResolvedValueOnce({ error: "First failure" }).mockResolvedValueOnce({ error: "Second failure" });
    const { user } = renderWithIntl(<LoginPage />);
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "x");
    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("First failure")).toBeInTheDocument();
    // The form is submitted via onSubmit, so React 19's post-action reset must not wipe the fields.
    expect(screen.getByLabelText("Email")).toHaveValue("ada@example.com");
    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("Second failure")).toBeInTheDocument();
    expect(screen.queryByText("First failure")).not.toBeInTheDocument();
  });

  it("clears the error after a subsequent successful attempt", async () => {
    signIn.mockResolvedValueOnce({ error: "Nope" }).mockResolvedValueOnce({});
    const { user } = renderWithIntl(<LoginPage />);
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "x");
    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("Nope")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("ada@example.com");
    await user.click(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() => expect(screen.queryByText("Nope")).not.toBeInTheDocument());
  });

  it("disables the submit button while the request is in flight", async () => {
    let resolve!: (v: { error?: string }) => void;
    signIn.mockImplementation(() => new Promise((r) => (resolve = r)));
    const { user } = renderWithIntl(<LoginPage />);
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "x");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Log in" })).toBeDisabled());
    resolve({});
    await waitFor(() => expect(screen.getByRole("button", { name: "Log in" })).toBeEnabled());
  });

  it("does not submit when the required fields are empty", async () => {
    const { user } = renderWithIntl(<LoginPage />);
    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(signIn).not.toHaveBeenCalled();
  });

  it("is translated to other locales", () => {
    renderWithIntl(<LoginPage />, { locale: "fr" });
    expect(screen.queryByRole("heading", { name: "Welcome back" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});
