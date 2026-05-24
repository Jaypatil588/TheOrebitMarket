"use client";

/** Ephemeral demo — exact phrase only; no fetch/POST; see demoScenario.ts */
import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { DEMO_SCENARIO_PHRASE } from "@/lib/demoScenario";

interface DemoScenarioInputProps {
  onTrigger: () => void;
  triggered?: boolean;
}

export function DemoScenarioInput({ onTrigger, triggered = false }: DemoScenarioInputProps) {
  const [value, setValue] = useState("");
  const [flash, setFlash] = useState(false);

  const tryTrigger = useCallback(
    (text: string) => {
      if (text !== DEMO_SCENARIO_PHRASE || triggered) return;
      setFlash(true);
      onTrigger();
      setTimeout(() => setFlash(false), 1200);
    },
    [onTrigger, triggered]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.65 }}
      className="mt-8"
    >
      <div
        className="glass-card px-4 py-3 transition-all duration-300"
        style={
          flash || triggered
            ? { borderColor: "rgba(255,235,59,0.5)", boxShadow: "0 0 24px rgba(255,235,59,0.15)" }
            : {}
        }
      >
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const next = e.target.value;
            setValue(next);
            tryTrigger(next);
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text");
            requestAnimationFrame(() => tryTrigger(pasted));
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") tryTrigger(value);
          }}
          disabled={triggered}
          placeholder="Enter market intelligence signal…"
          className="w-full bg-transparent text-sm font-mono text-white placeholder-slate-600 outline-none disabled:opacity-60"
        />
      </div>
    </motion.div>
  );
}
