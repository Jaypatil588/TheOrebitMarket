"use client";

import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

export function HeroOverlay() {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-between pointer-events-none select-none">
      {/* Top title block */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: "easeOut", delay: 0.5 }}
        className="pt-16 text-center"
      >
        <h1
          className="text-[56px] font-light tracking-[0.25em] text-white"
          style={{ fontFamily: "var(--font-inter), var(--font-display)" }}
        >
          THE OREBIT MARKET
        </h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.2 }}
          className="mt-2 text-[13px] tracking-[0.3em] uppercase"
          style={{ color: "var(--dust)" }}
        >
          Asteroid Intelligence Platform
        </motion.p>
      </motion.div>

      {/* Bottom scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 2 }}
        className="pb-12 flex flex-col items-center gap-3"
      >
        <span
          className="text-[10px] tracking-[0.25em] uppercase"
          style={{ color: "var(--dust-dim)" }}
        >
          Scroll to explore
        </span>
        <ChevronDown
          size={16}
          className="scroll-indicator"
          style={{ color: "var(--dust-dim)" }}
        />
      </motion.div>
    </div>
  );
}
