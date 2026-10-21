import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type SupabaseMockOptions } from "@tests/helpers/supabase";

const { createClientMock, revalidatePathMock, logErrorMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  logErrorMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next-intl/server", async () => (await import("@tests/helpers/utils")).nextIntlServerMock());
vi.mock("@/lib/logger", () => ({ logError: logErrorMock, logWarn: vi.fn() }));

import { changePassword, updateProfile } from "@/lib/actions/account";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

function setup(options: SupabaseMockOptions = {}) {
  const mock = createSupabaseMock(options);
  createClientMock.mockResolvedValue(mock.client);
  return mock;
}

const UNEXPECTED = { error: "Something went wrong. Please try again." };

describe("updateProfile", () => {
  beforeEach(() => {
    setup();
  });

  it("requires first and last names", async () => {
    const message = { error: "Your first and last name are required." };
    await expect(updateProfile(form({ firstName: "Ada" }))).resolves.toEqual(message);
    await expect(updateProfile(form({ lastName: "Lovelace" }))).resolves.toEqual(message);
    await expect(updateProfile(form({ firstName: "  ", lastName: "  " }))).resolves.toEqual(message);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("requires a signed-in user", async () => {
    setup({ user: null });
    await expect(updateProfile(form({ firstName: "Ada", lastName: "Lovelace" }))).resolves.toEqual({
      error: "You must be signed in.",
    });
  });

  it("updates the profile row with trimmed values and full_name, filtered to the user's id", async () => {
    const { builders } = setup({ user: { id: "u-42" } });
    const result = await updateProfile(
      form({
        firstName: " Ada ",
        lastName: " Lovelace ",
        phone: " +1 555 ",
        country: "UK",
        state: "London",
        zipCode: "N1",
        city: "London",
        address: " 1 Main St ",
      }),
    );
    expect(result).toEqual({ success: true });
    expect(builders.profiles.update).toHaveBeenCalledWith({
      first_name: "Ada",
      last_name: "Lovelace",
      full_name: "Ada Lovelace",
      phone: "+1 555",
      country: "UK",
      state: "London",
      zip_code: "N1",
      city: "London",
      address: "1 Main St",
    });
    expect(builders.profiles.eq).toHaveBeenCalledWith("id", "u-42");
  });

  it("stores omitted or blank optional fields as null", async () => {
    const { builders } = setup();
    await updateProfile(form({ firstName: "Ada", lastName: "L", phone: "  " }));
    expect(builders.profiles.update).toHaveBeenCalledWith(
      expect.objectContaining({ phone: null, country: null, state: null, zip_code: null, city: null, address: null }),
    );
  });

  it("revalidates the dashboard layout on success", async () => {
    await updateProfile(form({ firstName: "Ada", lastName: "L" }));
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard", "layout");
  });

  it("returns the database error and does not revalidate", async () => {
    setup({ tables: { profiles: { error: { message: "update denied" } } } });
    await expect(updateProfile(form({ firstName: "Ada", lastName: "L" }))).resolves.toEqual({ error: "update denied" });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("converts thrown exceptions into the friendly message and logs them", async () => {
    const boom = new Error("boom");
    createClientMock.mockRejectedValue(boom);
    await expect(updateProfile(form({ firstName: "Ada", lastName: "L" }))).resolves.toEqual(UNEXPECTED);
    expect(logErrorMock).toHaveBeenCalledWith("action:account.updateProfile", boom);
  });
});

describe("changePassword", () => {
  const valid = { currentPassword: "oldpass123", newPassword: "newpass456", confirmPassword: "newpass456" };

  beforeEach(() => {
    setup({ user: { id: "u1", email: "me@example.com" } });
  });

  it("requires the current password", async () => {
    await expect(changePassword(form({ ...valid, currentPassword: "" }))).resolves.toEqual({
      error: "Enter your current password.",
    });
  });

  it("rejects weak new passwords", async () => {
    const message = { error: "New password must be 8+ characters and include a letter and a number." };
    await expect(changePassword(form({ ...valid, newPassword: "short1", confirmPassword: "short1" }))).resolves.toEqual(message);
    await expect(changePassword(form({ ...valid, newPassword: "nodigitshere", confirmPassword: "nodigitshere" }))).resolves.toEqual(message);
    await expect(changePassword(form({ ...valid, newPassword: "", confirmPassword: "" }))).resolves.toEqual(message);
  });

  it("rejects mismatched confirmation", async () => {
    await expect(changePassword(form({ ...valid, confirmPassword: "other1234" }))).resolves.toEqual({
      error: "New passwords do not match.",
    });
  });

  it("rejects a new password identical to the current one", async () => {
    await expect(
      changePassword(form({ currentPassword: "samepass1", newPassword: "samepass1", confirmPassword: "samepass1" })),
    ).resolves.toEqual({ error: "Choose a password different from your current one." });
  });

  it("does not create a client when validation fails", async () => {
    await changePassword(form({ ...valid, currentPassword: "" }));
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("requires a signed-in user with an email", async () => {
    setup({ user: null });
    await expect(changePassword(form(valid))).resolves.toEqual({ error: "You must be signed in." });
    setup({ user: { id: "u1" } });
    await expect(changePassword(form(valid))).resolves.toEqual({ error: "You must be signed in." });
  });

  it("re-verifies the current password, then updates to the new one", async () => {
    const { client } = setup({ user: { id: "u1", email: "me@example.com" } });
    await expect(changePassword(form(valid))).resolves.toEqual({ success: true });
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({ email: "me@example.com", password: "oldpass123" });
    expect(client.auth.updateUser).toHaveBeenCalledWith({ password: "newpass456" });
    const verifyOrder = client.auth.signInWithPassword.mock.invocationCallOrder[0];
    const updateOrder = client.auth.updateUser.mock.invocationCallOrder[0];
    expect(verifyOrder).toBeLessThan(updateOrder);
  });

  it("returns 'incorrect' and never updates when the current password is wrong", async () => {
    const { client } = setup({ user: { id: "u1", email: "me@example.com" }, authError: { message: "Invalid login credentials" } });
    client.auth.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "me@example.com" } }, error: null } as never);
    await expect(changePassword(form(valid))).resolves.toEqual({ error: "Your current password is incorrect." });
    expect(client.auth.updateUser).not.toHaveBeenCalled();
  });

  it("returns the updateUser error message", async () => {
    const { client } = setup({ user: { id: "u1", email: "me@example.com" } });
    client.auth.updateUser.mockResolvedValue({ data: {}, error: { message: "Password is too common" } } as never);
    await expect(changePassword(form(valid))).resolves.toEqual({ error: "Password is too common" });
  });

  it("converts thrown exceptions into the friendly message and logs them", async () => {
    const { client } = setup({ user: { id: "u1", email: "me@example.com" } });
    const boom = new Error("auth down");
    client.auth.signInWithPassword.mockRejectedValue(boom);
    await expect(changePassword(form(valid))).resolves.toEqual(UNEXPECTED);
    expect(logErrorMock).toHaveBeenCalledWith("action:account.changePassword", boom);
  });
});
