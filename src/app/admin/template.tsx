"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

// A template re-mounts on every navigation, so each admin page eases in.
export default function AdminTemplate({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
