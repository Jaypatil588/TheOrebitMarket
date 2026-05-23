"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MissionRoute, RouteStop } from "@/hooks/useWebSockets";
import { formatValue } from "@/lib/utils";
import { BACKEND_URL } from "@/lib/config";
import {
  X,
  Route,
  DollarSign,
  TrendingUp,
  Clock,
  Zap,
  Target,
  MapPin,
  Sparkles,
  AlertTriangle,
  Loader,
  ChevronRight,
  Gem,
  Rocket,
} from "lucide-react";

interface RouteDetailPopupProps {
  route: MissionRoute | null;
  onClose: () => void;
}

interface RouteImages {
  heatmap_url?: string;
  surface_url?: string;
  loading: boolean;
  error: boolean;
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pb-2 border-b border-white/[0.06]">
        <span className="text-slate-500">{icon}</span>
        <span className="text-sm font-mono font-semibold tracking-widest text-slate-400 uppercase">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function MetricCard({ label, value, accent, subtext }: { label: string; value: string; accent?: boolean; subtext?: string }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-3">
      <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-xl font-mono font-bold ${accent ? "text-amber-400" : "text-white"}`}>
        {value}
      </div>
      {subtext && <div className="text-xs text-slate-600 mt-0.5">{subtext}</div>}
    </div>
  );
}

function StopCard({ stop, index, total, routeColor }: { stop: RouteStop; index: number; total: number; routeColor: string }) {
  const isEarth = stop.body === "Earth";
  const isLast = index === total - 1;

  return (
    <div className="relative">
      {!isLast && (
        <div
          className="absolute left-[11px] top-[28px] w-0.5 h-[calc(100%+8px)]"
          style={{ background: `${routeColor}30` }}
        />
      )}
      <div className="flex gap-3">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: isEarth ? "var(--earth-blue)" : `${routeColor}20`, border: `2px solid ${isEarth ? "var(--earth-blue)" : routeColor}` }}
        >
          {isEarth ? (
            <Rocket size={12} className="text-white" />
          ) : (
            <span className="text-xs font-bold" style={{ color: routeColor }}>{index}</span>
          )}
        </div>
        <div className="flex-1 pb-4">
          <div className="flex items-center justify-between">
            <span className="text-lg font-medium text-white">{stop.body}</span>
            {stop.mineral_target && (
              <span
                className="text-xs font-mono px-2 py-0.5 rounded"
                style={{ background: `${routeColor}15`, color: routeColor }}
              >
                {stop.mineral_target}
              </span>
            )}
          </div>
          {!isEarth && (
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              {stop.extractable_value_usd != null && stop.extractable_value_usd > 0 && (
                <div>
                  <span className="text-slate-500 text-xs">Value</span>
                  <div className="text-amber-400 font-mono font-medium">
                    {formatValue(stop.extractable_value_usd)}
                  </div>
                </div>
              )}
              {stop.stay_duration_days != null && stop.stay_duration_days > 0 && (
                <div>
                  <span className="text-slate-500 text-xs">Stay</span>
                  <div className="text-slate-300 font-mono">{stop.stay_duration_days} days</div>
                </div>
              )}
            </div>
          )}
          {stop.delta_v_to_next_km_s > 0 && !isLast && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
              <ChevronRight size={12} />
              <span>Δv to next: {stop.delta_v_to_next_km_s.toFixed(2)} km/s</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function RouteDetailPopup({ route, onClose }: RouteDetailPopupProps) {
  const [images, setImages] = useState<RouteImages>({ loading: false, error: false });

  useEffect(() => {
    if (!route) {
      setImages({ loading: false, error: false });
      return;
    }

    setImages({ loading: true, error: false });

    const asteroidIds = route.stops
      .filter((s) => s.asteroid_id)
      .map((s) => s.asteroid_id);

    fetch(`${BACKEND_URL}/api/route-images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ route_id: route.id, asteroid_ids: asteroidIds }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch images");
        return r.json();
      })
      .then((data) => {
        setImages({
          heatmap_url: data.heatmap_url,
          surface_url: data.surface_url,
          loading: false,
          error: false,
        });
      })
      .catch(() => {
        setImages({ loading: false, error: true });
      });
  }, [route]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!route) return null;

  const asteroidStops = route.stops.filter((s) => s.body !== "Earth");

  return (
    <AnimatePresence>
      <motion.div
        key="route-popup-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

        <motion.div
          key={route.id}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl border border-white/[0.08] bg-black/90 backdrop-blur-xl shadow-[0_0_80px_rgba(0,0,0,0.8)]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-6 py-4 border-b"
            style={{ borderColor: `${route.color_hex}30`, background: `${route.color_hex}08` }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: `${route.color_hex}20` }}
              >
                <Route size={20} style={{ color: route.color_hex }} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold text-white">{route.label}</h2>
                  {route.is_default && (
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      ACTIVE
                    </span>
                  )}
                  {route.scenario_driven && (
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      <Zap size={10} className="inline mr-1" />
                      SCENARIO
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-400 mt-0.5">
                  {asteroidStops.length} asteroid{asteroidStops.length !== 1 ? "s" : ""} · {route.totals.duration_years.toFixed(1)} years
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-all"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div
            className="overflow-y-auto p-6 space-y-6"
            style={{ maxHeight: "calc(90vh - 80px)", scrollbarWidth: "thin", scrollbarColor: "#334155 transparent" }}
          >
            {/* Route Summary */}
            <Section icon={<Target size={16} />} title="Route Summary">
              <div className="space-y-4">
                {route.route_reasoning && (
                  <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <Sparkles size={16} className="text-amber-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Why This Route</div>
                        <p className="text-base text-slate-200 leading-relaxed">{route.route_reasoning}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <Gem size={16} className="text-blue-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Market Demand</div>
                        <p className="text-lg text-white font-medium">{route.urgency_reason}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {route.mineral_focus.map((mineral) => (
                            <span
                              key={mineral}
                              className="text-xs font-mono px-2 py-0.5 rounded"
                              style={{ background: `${route.color_hex}15`, color: route.color_hex }}
                            >
                              {mineral}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <TrendingUp size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Supply Chain Context</div>
                        <p className="text-lg text-white font-medium">
                          Urgency Score: {(route.urgency_score * 100).toFixed(0)}%
                        </p>
                        <p className="text-sm text-slate-400 mt-1">
                          {route.totals.minerals_covered.length} minerals covered across route
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Section>

            {/* Valuation Metrics */}
            <Section icon={<DollarSign size={16} />} title="Valuation">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard
                  label="Total Value"
                  value={formatValue(route.totals.total_value_usd)}
                  accent
                />
                <MetricCard
                  label="Net Return"
                  value={formatValue(route.totals.net_return_usd)}
                  accent={route.totals.net_return_usd > 0}
                />
                <MetricCard
                  label="ROI"
                  value={`${route.totals.roi_pct.toFixed(0)}%`}
                  accent={route.totals.roi_pct > 100}
                  subtext={route.totals.roi_pct > 200 ? "Excellent" : route.totals.roi_pct > 100 ? "Good" : "Moderate"}
                />
                <MetricCard
                  label="Mission Cost"
                  value={formatValue(route.totals.total_cost_usd)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-3 flex items-center gap-3">
                  <Clock size={18} className="text-slate-500" />
                  <div>
                    <div className="text-xs text-slate-500">Duration</div>
                    <div className="text-lg text-white font-mono">{route.totals.duration_years.toFixed(1)} years</div>
                  </div>
                </div>
                <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-3 flex items-center gap-3">
                  <Zap size={18} className="text-slate-500" />
                  <div>
                    <div className="text-xs text-slate-500">Delta-v Budget</div>
                    <div className="text-lg text-white font-mono">{route.totals.total_delta_v_km_s.toFixed(1)} km/s</div>
                  </div>
                </div>
              </div>
            </Section>

            {/* Asteroid Stops */}
            <Section icon={<MapPin size={16} />} title="Mission Trajectory">
              <div className="space-y-1">
                {route.stops.map((stop, i) => (
                  <StopCard
                    key={`${stop.body}-${i}`}
                    stop={stop}
                    index={i}
                    total={route.stops.length}
                    routeColor={route.color_hex}
                  />
                ))}
              </div>
            </Section>

            {/* AI-Generated Images */}
            <Section icon={<Sparkles size={16} />} title="AI Visualizations">
              {images.loading && (
                <div className="flex items-center justify-center py-12 text-slate-500">
                  <Loader size={20} className="animate-spin mr-3" />
                  <span>Generating route visualizations...</span>
                </div>
              )}

              {images.error && !images.loading && (
                <div className="flex items-center justify-center py-8 text-slate-500">
                  <AlertTriangle size={16} className="mr-2 text-amber-500" />
                  <span>Visualizations unavailable</span>
                </div>
              )}

              {!images.loading && !images.error && (images.heatmap_url || images.surface_url) && (
                <div className="grid grid-cols-2 gap-4">
                  {images.heatmap_url && (
                    <div className="space-y-2">
                      <div className="text-xs text-slate-500 uppercase tracking-wider">Composition Heatmap</div>
                      <div className="aspect-square rounded-lg overflow-hidden border border-white/[0.06] bg-slate-900/50">
                        <img
                          src={images.heatmap_url}
                          alt="Route composition heatmap"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  )}
                  {images.surface_url && (
                    <div className="space-y-2">
                      <div className="text-xs text-slate-500 uppercase tracking-wider">Asteroid Surface</div>
                      <div className="aspect-square rounded-lg overflow-hidden border border-white/[0.06] bg-slate-900/50">
                        <img
                          src={images.surface_url}
                          alt="Asteroid surface visualization"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!images.loading && !images.error && !images.heatmap_url && !images.surface_url && (
                <div className="flex items-center justify-center py-8 text-slate-500">
                  <span>No visualizations generated yet</span>
                </div>
              )}
            </Section>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
