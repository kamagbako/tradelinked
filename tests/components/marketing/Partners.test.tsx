import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { Partners } from "@/components/marketing/Partners";
import { PARTNER_MARKS } from "@/components/marketing/partnerMarks";
import { renderWithIntl } from "@tests/helpers/utils";
import { flatten, loadMessages } from "@tests/helpers/messages";

const NAMES = ["BINANCE", "Authereum", "Fortmatic", "AIRSWAP", "Blockchain.com", "crypto.com"];

describe("Partners", () => {
  it("is the #partners anchor with heading and subtitle", () => {
    const { container } = renderWithIntl(<Partners />);
    expect(container.querySelector("section#partners")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Our strategic partners" })).toBeInTheDocument();
    expect(screen.getByText(/enhancing our global market presence/)).toBeInTheDocument();
  });

  // Partners repeats its six logos twice, and <Marquee> renders its children twice more.
  it.each(NAMES)("renders %s twice per marquee track for the seamless loop", (name) => {
    const { container } = renderWithIntl(<Partners />);
    const [track, mirror] = Array.from(container.querySelectorAll("div.flex-shrink-0"));
    expect(within(track as HTMLElement).getAllByText(name)).toHaveLength(2);
    expect(within(mirror as HTMLElement).getAllByText(name)).toHaveLength(2);
  });

  it("renders the six partner names duplicated within a track", () => {
    const { container } = renderWithIntl(<Partners />);
    const track = container.querySelector("div.flex-shrink-0") as HTMLElement;
    const logos = track.querySelectorAll("span.whitespace-nowrap");
    expect(Array.from(logos).map((l) => l.textContent)).toEqual([...NAMES, ...NAMES]);
  });

  it("marks the duplicated second set as aria-hidden and leaves the first set exposed", () => {
    const { container } = renderWithIntl(<Partners />);
    const track = container.querySelector("div.flex-shrink-0") as HTMLElement;
    const logos = Array.from(track.querySelectorAll("span.whitespace-nowrap"));
    expect(logos.slice(0, 6).map((l) => l.getAttribute("aria-hidden"))).toEqual(Array(6).fill(null));
    expect(logos.slice(6).map((l) => l.getAttribute("aria-hidden"))).toEqual(Array(6).fill("true"));
  });

  it("marks the marquee's mirrored track as aria-hidden", () => {
    const { container } = renderWithIntl(<Partners />);
    const tracks = container.querySelectorAll("div.flex-shrink-0");
    expect(tracks).toHaveLength(2);
    expect(tracks[0]).not.toHaveAttribute("aria-hidden");
    expect(tracks[1]).toHaveAttribute("aria-hidden", "true");
  });

  it("exposes each partner name exactly once in the accessibility tree", () => {
    renderWithIntl(<Partners />);
    for (const name of NAMES) {
      expect(screen.getAllByText(name).filter((el) => !el.closest("[aria-hidden='true']"))).toHaveLength(1);
    }
  });

  it("draws an svg mark with the partner colour for each logo", () => {
    const { container } = renderWithIntl(<Partners />);
    const track = container.querySelector("div.flex-shrink-0") as HTMLElement;
    const paths = track.querySelectorAll("svg path");
    expect(paths).toHaveLength(12);
    expect(paths[0]).toHaveAttribute("fill", PARTNER_MARKS.binance.color);
    expect(paths[0]).toHaveAttribute("d", PARTNER_MARKS.binance.path);
  });

  it("renders French heading", () => {
    const fr = flatten(loadMessages("fr"));
    renderWithIntl(<Partners />, { locale: "fr" });
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(fr["landing.partners.heading"]);
    expect(screen.getByText(fr["landing.partners.subtitle"])).toBeInTheDocument();
  });

  it("every partner mark referenced exists", () => {
    for (const key of ["binance", "authereum", "fortmatic", "airswap", "blockchain", "cryptocom"]) {
      expect(PARTNER_MARKS[key].path.length).toBeGreaterThan(10);
      expect(PARTNER_MARKS[key].color).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });
});
