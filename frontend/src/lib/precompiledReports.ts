import type { MissionReportData, RankedAsteroid } from "@/types/orebit";
import { formatValue } from "@/lib/utils";

/** True when the row is rank #1 (first in THE TARGETS table). */
export function isFirstRankingRow(rank: RankedAsteroid): boolean {
  return rank.rank === 1;
}

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function asteroidRenderSvg(name: string, specType: string, diameterKm: number): string {
  const color = specType === "M" ? "#C0C0C0" : specType === "S" ? "#8B6914" : "#505868";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
  <rect width="800" height="600" fill="#0a0a0f"/>
  ${Array.from({ length: 80 }, (_, i) => {
    const x = (i * 137) % 800;
    const y = (i * 89) % 600;
    const r = 0.4 + (i % 3) * 0.3;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${0.15 + (i % 5) * 0.1}"/>`;
  }).join("")}
  <defs>
    <radialGradient id="glow" cx="35%" cy="35%">
      <stop offset="0%" stop-color="${color}" stop-opacity="1"/>
      <stop offset="70%" stop-color="${color}" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#1a1a24" stop-opacity="0.9"/>
    </radialGradient>
    <filter id="crater"><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3"/></filter>
  </defs>
  <ellipse cx="400" cy="300" rx="180" ry="175" fill="url(#glow)"/>
  <ellipse cx="340" cy="250" rx="28" ry="22" fill="#000" opacity="0.25"/>
  <ellipse cx="460" cy="340" rx="18" ry="14" fill="#000" opacity="0.2"/>
  <ellipse cx="420" cy="220" rx="12" ry="10" fill="#000" opacity="0.15"/>
  <text x="24" y="560" fill="#94a3b8" font-family="monospace" font-size="14">${name}  |  ${diameterKm.toFixed(1)} km  |  ${specType}-type</text>
  <text x="24" y="580" fill="#64748b" font-family="monospace" font-size="11">OREBIT MISSION RENDER · LIVE</text>
</svg>`;
}

function compositionMapSvg(name: string, minerals: [string, number][]): string {
  const colors: Record<string, string> = {
    iron: "#8B8B8B",
    nickel: "#B8860B",
    cobalt: "#4169E1",
    platinum: "#E5E4E2",
    platinumGroup: "#E5E4E2",
    water_ice: "#87CEEB",
    neodymium: "#9370DB",
    carbon: "#2F2F2F",
  };
  let angle = -90;
  const cx = 350;
  const cy = 280;
  const r = 140;
  const slices = minerals.slice(0, 5).map(([mineral, pct]) => {
    const sweep = (pct / 100) * 360;
    const start = angle;
    angle += sweep;
    const rad1 = (start * Math.PI) / 180;
    const rad2 = ((start + sweep) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(rad1);
    const y1 = cy + r * Math.sin(rad1);
    const x2 = cx + r * Math.cos(rad2);
    const y2 = cy + r * Math.sin(rad2);
    const large = sweep > 180 ? 1 : 0;
    const fill = colors[mineral] ?? "#666";
    const mid = ((start + sweep / 2) * Math.PI) / 180;
    const lx = cx + (r + 40) * Math.cos(mid);
    const ly = cy + (r + 40) * Math.sin(mid);
    return `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z" fill="${fill}" stroke="#0a0a0f" stroke-width="2"/>
      <text x="${lx}" y="${ly}" fill="#e2e8f0" font-size="11" text-anchor="middle">${mineral.replace(/_/g, " ")} ${pct.toFixed(0)}%</text>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 700">
  <rect width="700" height="700" fill="#0a0a0f"/>
  <text x="350" y="40" fill="#fff" font-family="monospace" font-size="16" text-anchor="middle">${name} — Mineral Composition</text>
  ${slices.join("")}
</svg>`;
}

function routeMapSvg(name: string, deltaV: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 900">
  <rect width="900" height="900" fill="#0a0a0f"/>
  <text x="450" y="40" fill="#fff" font-family="monospace" font-size="16" text-anchor="middle">Mission Route — ${name}</text>
  <circle cx="450" cy="450" r="80" fill="none" stroke="#4169E1" stroke-dasharray="6 4" opacity="0.4"/>
  <circle cx="450" cy="450" r="130" fill="none" stroke="#CD853F" stroke-dasharray="6 4" opacity="0.35"/>
  <circle cx="450" cy="450" r="185" fill="none" stroke="#64748b" stroke-dasharray="4 6" opacity="0.25"/>
  <circle cx="450" cy="450" r="12" fill="#FFD700"/>
  <text x="468" y="454" fill="#FFD700" font-size="12">☀</text>
  <circle cx="530" cy="450" r="8" fill="#4169E1"/>
  <text x="542" y="454" fill="#4169E1" font-size="11">Earth</text>
  <circle cx="610" cy="380" r="14" fill="#FF4500"/>
  <text x="630" y="384" fill="#FF4500" font-size="12">${name.split(" ").slice(-1)[0]}</text>
  <path d="M 538 450 Q 580 400 596 388" fill="none" stroke="#00FF88" stroke-width="2" stroke-dasharray="8 4" marker-end="url(#arrow)"/>
  <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="#00FF88"/></marker></defs>
  <text x="450" y="860" fill="#64748b" font-family="monospace" font-size="13" text-anchor="middle">Total Δv ${deltaV.toFixed(2)} km/s · Hohmann + plane-change optimized</text>
</svg>`;
}

function physicalProfileSvg(name: string, rank: RankedAsteroid): string {
  const metrics = [
    { label: "Net Value", val: formatValue(rank.net_value_usd), pct: 92 },
    { label: "ROI", val: `${rank.roi.toFixed(0)}%`, pct: 88 },
    { label: "Δv", val: `${rank.delta_v_km_s.toFixed(2)} km/s`, pct: rank.delta_v_km_s < 6 ? 78 : 55 },
    { label: "Confidence", val: `${Math.round(rank.confidence * 100)}%`, pct: rank.confidence * 100 },
    { label: "Urgency", val: `${Math.round(rank.mineral_urgency * 100)}%`, pct: rank.mineral_urgency * 100 },
  ];
  const bars = metrics
    .map((m, i) => {
      const y = 80 + i * 70;
      const color = m.pct >= 75 ? "#00FF88" : m.pct >= 50 ? "#FFA500" : "#FF4444";
      return `<text x="40" y="${y + 20}" fill="#94a3b8" font-family="monospace" font-size="13">${m.label}</text>
        <rect x="180" y="${y}" width="520" height="28" fill="#1e293b" rx="4"/>
        <rect x="180" y="${y}" width="${(m.pct / 100) * 520}" height="28" fill="${color}" rx="4" opacity="0.85"/>
        <text x="720" y="${y + 20}" fill="#e2e8f0" font-family="monospace" font-size="12" text-anchor="end">${m.val}</text>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500">
  <rect width="800" height="500" fill="#0a0a0f"/>
  <text x="400" y="36" fill="#fff" font-family="monospace" font-size="15" text-anchor="middle">${name} — Strategic Profile</text>
  ${bars}
</svg>`;
}

/** Client-side demo mission report for rank #1 — never persisted to DB. */
export function buildPrecompiledMissionReport(rank: RankedAsteroid): MissionReportData {
  const shortName = rank.name.replace(/^\d+\s+/, "");
  const specType = rank.spec_type || "M";
  const diameterKm = specType === "M" ? 226 : specType === "S" ? 0.5 : 1.0;

  const mineralBreakdown: [string, number][] =
    rank.top_mineral === "iron"
      ? [["iron", 85], ["nickel", 8], ["cobalt", 4], ["platinumGroup", 2], ["silicates", 1]]
      : rank.top_mineral === "platinum"
        ? [["platinumGroup", 42], ["nickel", 28], ["iron", 18], ["cobalt", 8], ["silicates", 4]]
        : [["stonyMatrix", 45], ["iron", 22], ["water_ice", 15], [rank.top_mineral, 12], ["carbon", 6]];

  const launchWindow = rank.launch_window_year ?? 2028;

  return {
    asteroid_id: rank.asteroid_id,
    cached: true,
    timestamp: new Date().toISOString(),
    report: {
      precompiled: true,
      feasibility_score: 9,
      executive_summary: `${rank.name} ranks #1 on Orebit's strategic index with a composite score of ${(rank.composite_score * 100).toFixed(0)}%. As a ${specType}-type body in the main belt, it offers ${formatValue(rank.net_value_usd)} in damped net asset value against an estimated mission cost profile yielding ${rank.roi.toFixed(0)}% ROI. Primary extraction target: ${rank.top_mineral.replace(/_/g, " ")} — currently at elevated market urgency (${Math.round(rank.mineral_urgency * 100)}%).`,
      route_rationale: `Selected for the default multi-stop corridor: Δv budget of ${rank.delta_v_km_s.toFixed(2)} km/s fits Falcon Heavy + ion-tug architecture. Launch window ${launchWindow} aligns with favorable opposition geometry and minimizes plane-change penalties. ${shortName} anchors the route's mineral diversification — high mass fraction ${rank.top_mineral} offsets downstream stops with lower metal content.`,
      asteroid_render: svgDataUrl(asteroidRenderSvg(rank.name, specType, diameterKm)),
      composition_map: svgDataUrl(compositionMapSvg(rank.name, mineralBreakdown)),
      route_map: svgDataUrl(routeMapSvg(rank.name, rank.delta_v_km_s)),
      physical_profile: svgDataUrl(physicalProfileSvg(rank.name, rank)),
      composition: {
        spec_type: specType,
        spec_confidence: 0.91,
        research_notes: `Spectroscopic surveys confirm ${specType}-type signature consistent with ${rank.top_mineral}-rich regolith. Radar-derived bulk density supports a differentiated or partially exposed metallic core model — ideal for in-situ magnetic beneficiation before return haul.`,
        density_kg_m3: specType === "M" ? 5300 : 2800,
      },
      valuation: {
        raw_value_usd: rank.net_value_usd * 1.15,
        net_value_usd: rank.net_value_usd,
        mission_cost_usd: rank.net_value_usd / (rank.roi / 100 + 1),
        roi_pct: rank.roi,
      },
      mission: {
        launch_vehicle: "Falcon Heavy + Orebit Ion Tug",
        launch_vehicle_reason: `Δv ${rank.delta_v_km_s.toFixed(2)} km/s within FH envelope with tug assist for capture and departure`,
        mining_method: specType === "M" ? "Magnetic rake + thermal fragmentation" : "Anchor drill + volatiles oven",
        mining_method_trl: 6,
        transit_days: 420,
        surface_ops_days: 240,
        total_mission_days: 900,
        next_launch_window: `${launchWindow}-Q2`,
        delta_v_km_s: rank.delta_v_km_s,
      },
      market: {
        primary_mineral: rank.top_mineral,
        urgency_score: rank.mineral_urgency,
        demand_outlook: `${rank.top_mineral.replace(/_/g, " ")} demand projected +12–18% YoY through ${launchWindow + 2} on EV supply chain and defense stockpile replenishment.`,
        price_trend: "rising",
      },
      go_no_go: {
        recommendation: "GO",
        primary_reason_go: `Top-ranked target with ${rank.roi.toFixed(0)}% ROI, favorable Δv, and ${Math.round(rank.confidence * 100)}% agent confidence — proceed to Phase-B mission design.`,
        primary_reason_no_go: "",
        conditions_to_flip: "Downgrade to NO-GO if launch slips beyond 2030 or cobalt/platinum spot collapses >25%.",
      },
      route_context: {
        route_label: "Primary Strategic Corridor",
        stop_number: 1,
        total_stops: 3,
      },
    },
  };
}
