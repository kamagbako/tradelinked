import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Drift, Marquee, Orb, Parallax, ScrollFade, ScrollProgress } from "@/components/motion/Ambient";

describe("Drift", () => {
  it("renders its children", () => {
    render(
      <Drift>
        <p>floating</p>
      </Drift>,
    );
    expect(screen.getByText("floating")).toBeInTheDocument();
  });

  it("forwards className", () => {
    const { container } = render(<Drift className="absolute">x</Drift>);
    expect(container.firstChild).toHaveClass("absolute");
  });

  it("renders with sway, distance, duration and delay options", () => {
    render(
      <Drift sway={10} distance={20} duration={3} delay={1}>
        swaying
      </Drift>,
    );
    expect(screen.getByText("swaying")).toBeInTheDocument();
  });

  it("renders without children", () => {
    const { container } = render(<Drift className="empty" />);
    expect(container.firstChild).toBeEmptyDOMElement();
  });
});

describe("Orb", () => {
  it("renders a decorative element hidden from assistive tech", () => {
    const { container } = render(<Orb className="glow" />);
    const orb = container.firstChild as HTMLElement;
    expect(orb).toHaveAttribute("aria-hidden", "true");
    expect(orb).toHaveClass("glow");
    expect(orb).toBeEmptyDOMElement();
  });

  it("accepts duration and delay", () => {
    const { container } = render(<Orb duration={5} delay={2} />);
    expect(container.firstChild).toBeInTheDocument();
  });
});

describe("Parallax", () => {
  it("renders its children and className", () => {
    const { container } = render(
      <Parallax className="layer" offset={40}>
        <span>deep</span>
      </Parallax>,
    );
    expect(screen.getByText("deep")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("layer");
  });

  it("renders with the default offset", () => {
    render(
      <Parallax>
        <span>default</span>
      </Parallax>,
    );
    expect(screen.getByText("default")).toBeInTheDocument();
  });
});

describe("ScrollFade", () => {
  it("renders its children and className", () => {
    const { container } = render(
      <ScrollFade className="hero">
        <h1>Title</h1>
      </ScrollFade>,
    );
    expect(screen.getByRole("heading", { name: "Title" })).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("hero");
  });
});

describe("ScrollProgress", () => {
  it("renders a fixed, decorative progress bar", () => {
    const { container } = render(<ScrollProgress />);
    const bar = container.firstChild as HTMLElement;
    expect(bar).toHaveAttribute("aria-hidden", "true");
    expect(bar).toHaveClass("fixed", "top-0");
  });

  it("has no text and no interactive content", () => {
    const { container } = render(<ScrollProgress />);
    expect(container).toHaveTextContent("");
    expect(container.querySelector("button, a")).toBeNull();
  });
});

describe("Marquee", () => {
  it("renders its children twice for a seamless loop", () => {
    render(
      <Marquee>
        <span>EURUSD</span>
      </Marquee>,
    );
    expect(screen.getAllByText("EURUSD", { ignore: "[aria-hidden] *" })).toHaveLength(1);
    expect(document.body.querySelectorAll("span")).toHaveLength(2);
  });

  it("hides the second copy from assistive tech", () => {
    const { container } = render(
      <Marquee>
        <span>EURUSD</span>
      </Marquee>,
    );
    const copies = container.querySelectorAll(".flex-shrink-0");
    expect(copies).toHaveLength(2);
    expect(copies[0]).not.toHaveAttribute("aria-hidden");
    expect(copies[1]).toHaveAttribute("aria-hidden", "true");
    expect(copies[1]).toHaveTextContent("EURUSD");
  });

  it("exposes the content to the accessibility tree only once", () => {
    render(
      <Marquee>
        <a href="/x">Quote</a>
      </Marquee>,
    );
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getAllByRole("link", { hidden: true })).toHaveLength(2);
  });

  it("renders multiple children in each copy", () => {
    const { container } = render(
      <Marquee>
        <span>A</span>
        <span>B</span>
      </Marquee>,
    );
    const copies = container.querySelectorAll(".flex-shrink-0");
    expect(copies[0]).toHaveTextContent("AB");
    expect(copies[1]).toHaveTextContent("AB");
  });

  it("applies className to the outer wrapper and a fade mask", () => {
    const { container } = render(<Marquee className="ticker">x</Marquee>);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("ticker");
    expect(wrapper.style.maskImage || wrapper.style.webkitMaskImage || wrapper.getAttribute("style")).toMatch(
      /linear-gradient/,
    );
  });

  it("supports reverse and custom duration", () => {
    render(
      <Marquee reverse duration={10}>
        <span>Rev</span>
      </Marquee>,
    );
    expect(screen.getAllByText("Rev", { ignore: "[aria-hidden] *" })).toHaveLength(1);
  });
});
