import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { ProfileForm, type ProfileValues } from "@/components/dashboard/ProfileForm";
import { updateProfile } from "@/lib/actions/account";
import { renderWithIntl } from "@tests/helpers/utils";

vi.mock("@/lib/actions/account", () => ({ updateProfile: vi.fn() }));

const update = vi.mocked(updateProfile);

const values = (over: Partial<ProfileValues> = {}): ProfileValues => ({
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  phone: "+44 20 7946 0000",
  country: "United Kingdom",
  state: "England",
  zipCode: "N1 9GU",
  city: "London",
  address: "12 Analytical Way",
  ...over,
});

const submitButton = () => screen.getByRole("button", { name: "Submit" });

describe("ProfileForm", () => {
  describe("form fields", () => {
    it("prefills every editable field", () => {
      renderWithIntl(<ProfileForm values={values()} />);
      expect(screen.getByLabelText(/First name/)).toHaveValue("Ada");
      expect(screen.getByLabelText(/Last name/)).toHaveValue("Lovelace");
      expect(screen.getByLabelText("Phone")).toHaveValue("+44 20 7946 0000");
      expect(screen.getByLabelText("Country")).toHaveValue("United Kingdom");
      expect(screen.getByLabelText("State")).toHaveValue("England");
      expect(screen.getByLabelText("Zip code")).toHaveValue("N1 9GU");
      expect(screen.getByLabelText("City")).toHaveValue("London");
      expect(screen.getByLabelText("Address")).toHaveValue("12 Analytical Way");
    });

    it("shows the email as a read-only, disabled field", () => {
      renderWithIntl(<ProfileForm values={values()} />);
      const email = screen.getByLabelText("Email");
      expect(email).toHaveValue("ada@example.com");
      expect(email).toBeDisabled();
      expect(email).toHaveAttribute("readonly");
    });

    it("requires first and last name only", () => {
      renderWithIntl(<ProfileForm values={values()} />);
      expect(screen.getByLabelText(/First name/)).toBeRequired();
      expect(screen.getByLabelText(/Last name/)).toBeRequired();
      expect(screen.getByLabelText("Phone")).not.toBeRequired();
      expect(screen.getByLabelText("Address")).not.toBeRequired();
    });

    it("sets autocomplete hints", () => {
      renderWithIntl(<ProfileForm values={values()} />);
      expect(screen.getByLabelText(/First name/)).toHaveAttribute("autocomplete", "given-name");
      expect(screen.getByLabelText("Zip code")).toHaveAttribute("autocomplete", "postal-code");
    });

    it("renders empty values as empty inputs", () => {
      renderWithIntl(
        <ProfileForm values={values({ phone: "", country: "", state: "", zipCode: "", city: "", address: "" })} />,
      );
      expect(screen.getByLabelText("Phone")).toHaveValue("");
      expect(screen.getByLabelText("City")).toHaveValue("");
    });
  });

  describe("summary card", () => {
    it("shows initials from the full name", () => {
      renderWithIntl(<ProfileForm values={values()} />);
      expect(screen.getByText("AL")).toBeInTheDocument();
    });

    it("falls back to email initials when names are empty", () => {
      renderWithIntl(<ProfileForm values={values({ firstName: "", lastName: "", email: "grace.hopper@navy.mil" })} />);
      expect(screen.getByText("GH")).toBeInTheDocument();
    });

    it("lists name, email, phone, country and city/state", () => {
      renderWithIntl(<ProfileForm values={values()} />);
      const list = within(screen.getByRole("list"));
      expect(list.getAllByRole("listitem").map((li) => li.textContent)).toEqual([
        "Ada Lovelace",
        "ada@example.com",
        "+44 20 7946 0000",
        "United Kingdom",
        "London, England",
      ]);
    });

    it("omits summary rows that have no value", () => {
      renderWithIntl(<ProfileForm values={values({ phone: "", country: "", city: "", state: "" })} />);
      expect(within(screen.getByRole("list")).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
        "Ada Lovelace",
        "ada@example.com",
      ]);
    });

    it("shows only the city when there is no state, and only the state when there is no city", () => {
      const { unmount } = renderWithIntl(<ProfileForm values={values({ state: "" })} />);
      expect(within(screen.getByRole("list")).getByText("London")).toBeInTheDocument();
      unmount();
      renderWithIntl(<ProfileForm values={values({ city: "" })} />);
      expect(within(screen.getByRole("list")).getByText("England")).toBeInTheDocument();
    });

    it("trims the name when the last name is missing", () => {
      renderWithIntl(<ProfileForm values={values({ lastName: "" })} />);
      expect(within(screen.getByRole("list")).getByText("Ada")).toBeInTheDocument();
    });
  });

  describe("submitting", () => {
    it("sends the current field values as FormData", async () => {
      update.mockResolvedValue({ success: true });
      const { user } = renderWithIntl(<ProfileForm values={values()} />);
      const first = screen.getByLabelText(/First name/);
      await user.clear(first);
      await user.type(first, "Augusta");
      await user.clear(screen.getByLabelText("City"));
      await user.type(screen.getByLabelText("City"), "Paris");
      await user.click(submitButton());

      await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
      const data = update.mock.calls[0][0];
      expect(data.get("firstName")).toBe("Augusta");
      expect(data.get("lastName")).toBe("Lovelace");
      expect(data.get("phone")).toBe("+44 20 7946 0000");
      expect(data.get("country")).toBe("United Kingdom");
      expect(data.get("state")).toBe("England");
      expect(data.get("zipCode")).toBe("N1 9GU");
      expect(data.get("city")).toBe("Paris");
      expect(data.get("address")).toBe("12 Analytical Way");
    });

    it("does not send the disabled email field", async () => {
      update.mockResolvedValue({ success: true });
      const { user } = renderWithIntl(<ProfileForm values={values()} />);
      await user.click(submitButton());
      await waitFor(() => expect(update).toHaveBeenCalled());
      expect(update.mock.calls[0][0].has("email")).toBe(false);
    });

    it("does not submit when the first name is cleared", async () => {
      const { user } = renderWithIntl(<ProfileForm values={values()} />);
      await user.clear(screen.getByLabelText(/First name/));
      await user.click(submitButton());
      expect(update).not.toHaveBeenCalled();
    });

    it("shows a success message", async () => {
      update.mockResolvedValue({ success: true });
      const { user } = renderWithIntl(<ProfileForm values={values()} />);
      await user.click(submitButton());
      expect(await screen.findByText("Profile updated.")).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("shows the server error as an alert", async () => {
      update.mockResolvedValue({ error: "Your first and last name are required." });
      const { user } = renderWithIntl(<ProfileForm values={values()} />);
      await user.click(submitButton());
      expect(await screen.findByRole("alert")).toHaveTextContent("Your first and last name are required.");
      expect(screen.queryByText("Profile updated.")).not.toBeInTheDocument();
    });

    it("shows a loading state and disables the button while saving", async () => {
      let resolve!: (v: { success: boolean }) => void;
      update.mockReturnValue(new Promise((r) => (resolve = r)));
      const { user, container } = renderWithIntl(<ProfileForm values={values()} />);
      await user.click(submitButton());

      await waitFor(() => expect(submitButton()).toBeDisabled());
      expect(container.querySelector(".animate-spin")).toBeInTheDocument();

      resolve({ success: true });
      await waitFor(() => expect(submitButton()).toBeEnabled());
    });
  });

  describe("localisation", () => {
    it("renders French labels and success message", async () => {
      update.mockResolvedValue({ success: true });
      const { user } = renderWithIntl(<ProfileForm values={values()} />, { locale: "fr" });
      expect(screen.getByLabelText(/Prénom/)).toHaveValue("Ada");
      expect(screen.getByLabelText("Code postal")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Enregistrer" }));
      expect(await screen.findByText("Profil mis à jour.")).toBeInTheDocument();
    });

    it("renders Chinese labels", () => {
      renderWithIntl(<ProfileForm values={values()} />, { locale: "zh" });
      expect(screen.getByLabelText("电话")).toBeInTheDocument();
      expect(screen.getByLabelText("电子邮箱")).toBeDisabled();
      expect(screen.getByRole("button", { name: "提交" })).toBeInTheDocument();
    });
  });
});
