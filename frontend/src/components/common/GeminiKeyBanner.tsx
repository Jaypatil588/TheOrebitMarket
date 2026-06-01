"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Key, Check, Edit3, Save, Sparkles, RefreshCw } from "lucide-react";
import { BACKEND_URL } from "@/lib/config";

interface GeminiKeyBannerProps {
  isVisible: boolean;
}

export function GeminiKeyBanner({ isVisible }: GeminiKeyBannerProps) {
  const [apiKey, setApiKey] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isReloading, setIsReloading] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem("orebit_gemini_api_key");
    if (savedKey) {
      setApiKey(savedKey);
      setIsSaved(true);
      // Ensure backend has the key on mount in case the backend restarted
      fetch(`${BACKEND_URL}/api/settings/key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: savedKey, initialize_only: true }),
      }).catch(console.error);
    }
  }, []);

  const handleSave = async () => {
    if (apiKey.trim()) {
      const keyToSave = apiKey.trim();
      localStorage.setItem("orebit_gemini_api_key", keyToSave);
      setIsSaved(true);
      setIsEditing(false);
      setIsReloading(true);

      try {
        await fetch(`${BACKEND_URL}/api/settings/key`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ api_key: keyToSave, initialize_only: false }),
        });
      } catch (e) {
        console.error("Failed to update backend key:", e);
      }

      // Hard reload to reset state and establish live WebSocket
      window.location.reload();
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleClear = () => {
    localStorage.removeItem("orebit_gemini_api_key");
    setApiKey("");
    setIsSaved(false);
    setIsEditing(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-xl px-4 pointer-events-none"
        >
          <div className="pointer-events-auto rounded-lg border border-white/[0.08] bg-black/60 backdrop-blur-md shadow-[0_4px_30px_rgba(0,0,0,0.5)] p-3 flex items-center justify-between gap-4 transition-all duration-300 hover:border-amber-500/30">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0 animate-pulse">
                <Key size={14} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1">
                  Gemini API Integration <Sparkles size={8} className="text-amber-400 animate-spin" />
                </span>
                <span className="font-mono text-xs text-slate-300 truncate">
                  {isSaved && !isEditing 
                    ? "Live AI agents active (API Key Loaded)" 
                    : "Enter Gemini API Key to activate live agents"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isSaved && !isEditing ? (
                <>
                  <span className="p-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <Check size={14} />
                  </span>
                  <button
                    onClick={handleEdit}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[10px] font-bold text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded cursor-pointer transition-all duration-200"
                  >
                    <Edit3 size={10} />
                    <span>EDIT</span>
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    placeholder="AIzaSy..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    disabled={isReloading}
                    className="px-2 py-1.5 font-mono text-xs text-slate-200 bg-slate-900/60 border border-white/[0.08] focus:border-amber-500/50 rounded outline-none w-32 focus:w-44 transition-all duration-300 disabled:opacity-50"
                  />
                  <button
                    onClick={handleSave}
                    disabled={isReloading}
                    className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] font-bold text-black bg-amber-400 hover:bg-amber-300 disabled:bg-amber-400/50 rounded cursor-pointer transition-all duration-200 shadow-[0_0_10px_rgba(251,191,36,0.3)]"
                  >
                    {isReloading ? <RefreshCw size={10} className="animate-spin" /> : <Save size={10} />}
                    <span>{isReloading ? "RELOADING" : "SAVE"}</span>
                  </button>
                  {isSaved && !isReloading && (
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-2 py-1.5 font-mono text-[10px] text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      CANCEL
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
