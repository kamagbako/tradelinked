import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { motion, useReducedMotion } from "framer-motion";
import { MotionProvider } from "@/components/motion/MotionProvider";

function ReducedProbe() {
  const reduce = useReducedMotion();
  return <p>{reduce ? "reduced" : "full"}</p>;
}

describe("MotionProvider", () => {
  it("renders its children", () => {
    render(
      <MotionProvider>
        <p>content</p>
      </MotionProvider>,
    );
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("renders several children unchanged", () => {
    render(
      <MotionProvider>
        <p>one</p>
        <p>two</p>
      </MotionProvider>,
    );
    expect(screen.getAllByText(/one|two/)).toHaveLength(2);
  });

  it("does not add wrapper DOM of its own", () => {
    const { container } = render(
      <MotionProvider>
        <p>content</p>
      </MotionProvider>,
    );
    expect(container.firstChild?.nodeName).toBe("P");
  });

  it("allows motion components inside", () => {
    render(
      <MotionProvider>
        <motion.div data-testid="m" animate={{ opacity: 1 }} />
      </MotionProvider>,
    );
    expect(screen.getByTestId("m")).toBeInTheDocument();
  });

  it("follows the OS setting: full motion when the user has no reduced-motion preference", () => {
    render(
      <MotionProvider>
        <ReducedProbe />
      </MotionProvider>,
    );
    expect(screen.getByText("full")).toBeInTheDocument();
  });
});
