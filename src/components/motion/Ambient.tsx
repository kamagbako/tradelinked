"use client";

import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { useRef, type ReactNode } from "react";

interface DriftProps {
  children?: ReactNode;
  className?: string;
  /** Vertical travel in px. */
  distance?: number;
  /** Horizontal sway in px. */
  sway?: number;
  duration?: number;
  delay?: number;
}

/** Endless, slow idle float so elements never sit completely still. Desync neighbours with `delay`. */
export function Drift({ children, className, distance = 8, sway = 0, duration = 7, delay = 0 }: DriftProps) {
  return (
    <motion.div
      className={className}
      animate={{ y: [0, -distance, 0, distance * 0.4, 0], x: sway ? [0, sway, 0, -sway, 0] : 0 }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut", delay }}
    >
      {children}
    </motion.div>
  );
}

/** Decorative glow that drifts and breathes forever. */
export function Orb({ className, duration = 12, delay = 0 }: { className?: string; duration?: number; delay?: number }) {
  return (
    <motion.div
      aria-hidden="true"
      className={className}
      animate={{ y: [0, -30, 10, 0], x: [0, 20, -15, 0], scale: [1, 1.12, 0.96, 1], opacity: [0.7, 1, 0.75, 0.7] }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut", delay }}
    />
  );
}

/** Moves its children at a different rate than the page scroll, for depth. */
export function Parallax({ children, className, offset = 60 }: { children: ReactNode; className?: string; offset?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useSpring(useTransform(scrollYProgress, [0, 1], [offset, -offset]), { stiffness: 40, damping: 20 });

  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      {children}
    </motion.div>
  );
}

/** Content that eases upward and fades slightly as it scrolls away (used on the hero). */
export function ScrollFade({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useSpring(useTransform(scrollYProgress, [0, 1], [0, 80]), { stiffness: 40, damping: 20 });
  const opacity = useTransform(scrollYProgress, [0, 0.9], [1, 0.2]);

  return (
    <motion.div ref={ref} style={{ y, opacity }} className={className}>
      {children}
    </motion.div>
  );
}

/** Thin bar across the top of the page that fills as you scroll. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 60, damping: 25, restDelta: 0.001 });

  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-gradient-to-r from-emerald-500 via-blue-500 to-emerald-500"
    />
  );
}

/** Endless horizontal ticker. Children are rendered twice for a seamless loop. */
export function Marquee({
  children,
  duration = 45,
  reverse = false,
  className,
}: {
  children: ReactNode;
  duration?: number;
  reverse?: boolean;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        maskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
        WebkitMaskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
      }}
    >
      <motion.div
        className="flex w-max"
        animate={{ x: reverse ? ["-50%", "0%"] : ["0%", "-50%"] }}
        transition={{ duration, repeat: Infinity, ease: "linear" }}
      >
        <div className="flex flex-shrink-0 items-center">{children}</div>
        <div className="flex flex-shrink-0 items-center" aria-hidden="true">{children}</div>
      </motion.div>
    </div>
  );
}
