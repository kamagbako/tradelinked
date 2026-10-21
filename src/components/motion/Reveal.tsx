"use client";

import { motion, type HTMLMotionProps, type Variants } from "framer-motion";
import type { ReactNode } from "react";

// Deliberately unhurried: long durations with a soft ease-out so movement feels smooth, not snappy.
export const EASE = [0.16, 1, 0.3, 1] as const;

// Re-triggers every time an element re-enters the viewport, so scrolling back up replays the motion.
const VIEWPORT = { once: false, margin: "-8% 0px -8% 0px" } as const;

interface RevealProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: ReactNode;
  delay?: number;
  y?: number;
  x?: number;
}

/** Fades and slides its children in whenever they scroll into view. */
export function Reveal({ children, delay = 0, y = 48, x = 0, ...props }: RevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y, x }}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={VIEWPORT}
      transition={{ duration: 1.2, ease: EASE, delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

const containerVariants: Variants = {
  hidden: {},
  show: (stagger: number) => ({ transition: { staggerChildren: stagger, delayChildren: 0.1 } }),
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 40, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 1, ease: EASE } },
};

interface StaggerProps extends Omit<HTMLMotionProps<"div">, "children" | "variants" | "custom"> {
  children: ReactNode;
  stagger?: number;
  /** "scroll" animates when scrolled into view; "mount" animates immediately. */
  trigger?: "scroll" | "mount";
}

/** Container that animates its <StaggerItem> children one after another. */
export function Stagger({ children, stagger = 0.18, trigger = "scroll", ...props }: StaggerProps) {
  const triggerProps =
    trigger === "scroll" ? { whileInView: "show", viewport: VIEWPORT } : { animate: "show" };

  return (
    <motion.div initial="hidden" variants={containerVariants} custom={stagger} {...triggerProps} {...props}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  ...props
}: Omit<HTMLMotionProps<"div">, "children" | "variants"> & { children: ReactNode }) {
  return (
    <motion.div variants={itemVariants} {...props}>
      {children}
    </motion.div>
  );
}

/** Card wrapper with a gentle lift on hover / press. */
export function HoverLift({ children, ...props }: Omit<HTMLMotionProps<"div">, "children"> & { children: ReactNode }) {
  return (
    <motion.div
      whileHover={{ y: -8, scale: 1.015 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: "spring", stiffness: 120, damping: 16 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
