import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EASE, HoverLift, Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";

describe("Reveal", () => {
  it("renders its children", () => {
    render(
      <Reveal>
        <p>Hello</p>
      </Reveal>,
    );
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("renders a div and forwards className and other props", () => {
    render(
      <Reveal className="w-full" data-testid="reveal" id="r1">
        x
      </Reveal>,
    );
    const el = screen.getByTestId("reveal");
    expect(el.tagName).toBe("DIV");
    expect(el).toHaveClass("w-full");
    expect(el).toHaveAttribute("id", "r1");
  });

  it("starts hidden (opacity 0) until scrolled into view", () => {
    render(<Reveal data-testid="reveal">x</Reveal>);
    expect(screen.getByTestId("reveal")).toHaveStyle({ opacity: "0" });
  });

  it("starts offset by the y prop", () => {
    render(
      <Reveal y={20} data-testid="reveal">
        x
      </Reveal>,
    );
    expect(screen.getByTestId("reveal").style.transform).toContain("translateY(20px)");
  });

  it("starts offset by the x prop", () => {
    render(
      <Reveal x={30} y={0} data-testid="reveal">
        x
      </Reveal>,
    );
    expect(screen.getByTestId("reveal").style.transform).toContain("translateX(30px)");
  });

  it("keeps children accessible in the DOM even while visually hidden", () => {
    render(
      <Reveal>
        <button type="button">Act</button>
      </Reveal>,
    );
    expect(screen.getByRole("button", { name: "Act" })).toBeInTheDocument();
  });

  it("exports a 4-point easing curve", () => {
    expect(EASE).toHaveLength(4);
  });
});

describe("Stagger / StaggerItem", () => {
  it("renders all items inside the container", () => {
    render(
      <Stagger data-testid="stagger">
        <StaggerItem>one</StaggerItem>
        <StaggerItem>two</StaggerItem>
        <StaggerItem>three</StaggerItem>
      </Stagger>,
    );
    const container = screen.getByTestId("stagger");
    expect(container).toHaveTextContent("onetwothree");
    expect(container.children).toHaveLength(3);
  });

  it("scroll-triggered items start hidden", () => {
    render(
      <Stagger data-testid="stagger">
        <StaggerItem data-testid="item">one</StaggerItem>
      </Stagger>,
    );
    expect(screen.getByTestId("item")).toHaveStyle({ opacity: "0" });
  });

  it("forwards className to both container and item", () => {
    render(
      <Stagger className="grid" data-testid="stagger" trigger="mount">
        <StaggerItem className="card" data-testid="item">
          one
        </StaggerItem>
      </Stagger>,
    );
    expect(screen.getByTestId("stagger")).toHaveClass("grid");
    expect(screen.getByTestId("item")).toHaveClass("card");
  });

  it("accepts a stagger delay and mount trigger without crashing", () => {
    render(
      <Stagger stagger={0.05} trigger="mount">
        <StaggerItem>one</StaggerItem>
      </Stagger>,
    );
    expect(screen.getByText("one")).toBeInTheDocument();
  });
});

describe("HoverLift", () => {
  it("renders children and forwards props", () => {
    render(
      <HoverLift className="lift" data-testid="lift">
        <span>Card</span>
      </HoverLift>,
    );
    expect(screen.getByText("Card")).toBeInTheDocument();
    expect(screen.getByTestId("lift")).toHaveClass("lift");
  });
});
