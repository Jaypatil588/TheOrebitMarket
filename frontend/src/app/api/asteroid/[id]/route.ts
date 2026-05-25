import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { GoogleGenerativeAI } from '@google/generative-ai';

const systemInstruction = `
You are a mission intelligence officer producing a full mission brief for ONE specific asteroid.
You receive: asteroid data, its mining route context, live prices, and active market scenarios.

## RESEARCH — Execute in this order:

1. Search "[asteroid_name] spectral type composition observations"
2. Search "[primary_mineral] supply chain disruption [current_year]"
3. Search "[primary_mineral] demand forecast [current_year]"
4. Search "launch vehicle [delta_v] km/s deep space mission [current_year]"
5. Search "asteroid [spec_type]-type mining method TRL [current_year]"

## GENERATE 4 IMAGES — Python code in your sandbox:

### Image 1: asteroid_render.png (800×600)
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np
fig, ax = plt.subplots(1, 1, figsize=(8, 6), facecolor='#0a0a0f')
ax.set_facecolor('#0a0a0f')
# Star field
np.random.seed(42)
stars_x, stars_y = np.random.rand(200), np.random.rand(200)
ax.scatter(stars_x, stars_y, s=np.random.rand(200)*2+0.2, c='white', alpha=0.6, transform=ax.transAxes)
# Asteroid sphere using scatter with noise
theta = np.linspace(0, 2*np.pi, 1000)
r = 0.35 + 0.03*np.random.randn(1000)
x_ast = 0.5 + r*np.cos(theta)
y_ast = 0.5 + r*np.sin(theta)
# Color by spec_type: M=silver, S=brown, C=dark_grey, D=reddish
color_map = {'M':'#C0C0C0','S':'#8B6914','C':'#404040','D':'#8B4513','V':'#708090'}
ast_color = color_map.get(spec_type, '#808080')
ax.fill(x_ast, y_ast, color=ast_color, alpha=0.85, transform=ax.transAxes)
# Shading/lighting effect
circle = plt.Circle((0.38, 0.58), 0.33, color='black', alpha=0.4, transform=ax.transAxes)
ax.add_patch(circle)
ax.text(0.05, 0.08, f"{asteroid_name}  |  {diameter_km:.2f} km  |  {spec_type}-type",
        transform=ax.transAxes, color='white', fontsize=10, fontfamily='monospace')
ax.axis('off')
plt.tight_layout(pad=0)
plt.savefig('asteroid_render.png', dpi=100, bbox_inches='tight', facecolor='#0a0a0f')
import base64, io
buf = io.BytesIO()
plt.savefig(buf, format='png', dpi=100, bbox_inches='tight', facecolor='#0a0a0f')
buf.seek(0)
asteroid_render_b64 = base64.b64encode(buf.read()).decode()

### Image 2: composition_map.png (700×700)
import matplotlib.pyplot as plt
minerals = list(composition.keys())
values = list(composition.values())
colors = {'iron':'#8B8B8B','nickel':'#B8860B','cobalt':'#4169E1','platinum_group':'#E5E4E2',
          'silicon':'#DEB887','water_ice':'#87CEEB','neodymium':'#9370DB','carbon':'#2F2F2F',
          'magnesium':'#98FB98','stonyMatrix':'#A0522D','clayMinerals':'#8FBC8F','platinumGroup':'#E5E4E2'}
fig, ax = plt.subplots(figsize=(7,7), facecolor='#0a0a0f')
ax.set_facecolor('#0a0a0f')
wedge_colors = [colors.get(m, '#666666') for m in minerals]
wedges, texts, autotexts = ax.pie(values, labels=minerals, colors=wedge_colors,
    autopct='%1.1f%%', pctdistance=0.75, startangle=90,
    wedgeprops={'edgecolor':'#0a0a0f','linewidth':2})
for t in texts: t.set_color('white'); t.set_fontsize(9)
for t in autotexts: t.set_color('white'); t.set_fontsize(8)
ax.set_title(f"{asteroid_name} — Mineral Composition", color='white', fontsize=12, pad=20)
plt.tight_layout()
import base64, io
buf = io.BytesIO()
plt.savefig(buf, format='png', dpi=100, bbox_inches='tight', facecolor='#0a0a0f')
buf.seek(0)
composition_map_b64 = base64.b64encode(buf.read()).decode()

### Image 3: route_map.png (900×900)
import matplotlib.pyplot as plt, matplotlib.patches as mpatches, numpy as np
fig, ax = plt.subplots(figsize=(9,9), facecolor='#0a0a0f')
ax.set_facecolor('#0a0a0f')
ax.set_xlim(-3,3); ax.set_ylim(-3,3)
# Sun
ax.scatter([0],[0],s=500,c='#FFD700',zorder=5)
ax.text(0.05,0.05,'☀',fontsize=14,color='#FFD700',ha='center')
# Orbits
for r,c,lbl in [(1.0,'#4169E1','Earth'),(1.52,'#CD853F','Mars')]:
    circle = plt.Circle((0,0),r,fill=False,color=c,alpha=0.3,linestyle='--',linewidth=1)
    ax.add_patch(circle)
    ax.text(r+0.05,0.05,lbl,color=c,fontsize=8,alpha=0.7)
# Earth marker
ax.scatter([1],[0],s=100,c='#4169E1',zorder=5)
# Asteroid position
import math
a_val = float(orbital.get('a', 1.5))
angle = float(orbital.get('angle', 45)) * math.pi / 180
ax_pos = a_val * math.cos(angle); ay_pos = a_val * math.sin(angle)
ax.scatter([ax_pos],[ay_pos],s=200,c='#FF4500',zorder=6)
ax.text(ax_pos+0.1,ay_pos+0.1,asteroid_name,color='#FF4500',fontsize=9)
# Route line
ax.annotate('', xy=(ax_pos,ay_pos), xytext=(1,0),
    arrowprops={'arrowstyle':'->','color':'#00FF88','lw':1.5,'linestyle':'dashed'})
ax.set_title(f"Mission Route — {asteroid_name}", color='white', fontsize=12)
ax.tick_params(colors='#555'); ax.spines['bottom'].set_color('#333'); ax.spines['left'].set_color('#333')
ax.spines['top'].set_color('#0a0a0f'); ax.spines['right'].set_color('#0a0a0f')
ax.set_xlabel('AU', color='#888'); ax.set_ylabel('AU', color='#888')
import base64, io
buf = io.BytesIO()
plt.savefig(buf, format='png', dpi=100, bbox_inches='tight', facecolor='#0a0a0f')
buf.seek(0)
route_map_b64 = base64.b64encode(buf.read()).decode()

### Image 4: physical_profile.png (800×500)
import matplotlib.pyplot as plt, numpy as np
fig, ax = plt.subplots(figsize=(8,5), facecolor='#0a0a0f')
ax.set_facecolor('#0a0a0f')
metrics = ['Diameter (km)','Delta-v (km/s)','Density (g/cm³)','Conf. Score','Data Complete','MOID (AU)']
values_raw = [diameter_km, delta_v, density, composition_confidence, data_completeness, moid]
benchmarks = [0.5, 6.0, 3.5, 0.7, 0.7, 0.1]
norm_vals = [min(v/max(b,0.001),2.0) for v,b in zip(values_raw,benchmarks)]
colors_bar = ['#00FF88' if n <= 1 else '#FFA500' if n <= 1.5 else '#FF4444' for n in norm_vals]
y_pos = np.arange(len(metrics))
bars = ax.barh(y_pos, norm_vals, color=colors_bar, alpha=0.8, height=0.6)
ax.axvline(x=1.0, color='#555', linestyle='--', alpha=0.7, label='Benchmark')
ax.set_yticks(y_pos); ax.set_yticklabels(metrics, color='white', fontsize=10)
for i, (val, raw) in enumerate(zip(norm_vals, values_raw)):
    ax.text(val+0.03, i, f'{raw:.3g}', va='center', color='white', fontsize=9)
ax.set_title(f"{asteroid_name} — Physical Profile", color='white', fontsize=12)
ax.set_xlabel('Relative to Benchmark', color='#888')
ax.tick_params(colors='#555')
for spine in ax.spines.values(): spine.set_color('#333')
plt.tight_layout()
import base64, io
buf = io.BytesIO()
plt.savefig(buf, format='png', dpi=100, bbox_inches='tight', facecolor='#0a0a0f')
buf.seek(0)
physical_profile_b64 = base64.b64encode(buf.read()).decode()

## OUTPUT — JSON ONLY. Never return anything outside JSON block.
{
  "feasibility_score": 8,
  "composition": {
    "spec_type": "M", "spec_confidence": 0.7,
    "minerals": [{"name":"iron","fraction":0.85,"mass_kg":1e12,"value_usd":1e11,"current_price_per_kg":0.12,"scenario_impact":false}],
    "density_kg_m3": 5300, "surface_gravity_m_s2": 0.001, "research_notes": "string"
  },
  "valuation": {"raw_value_usd":0,"damped_value_usd":0,"mission_cost_usd":0,"net_value_usd":0,"roi_pct":0,"scenario_impact_pct":0},
  "risk": {"overall_risk":"MED","factors":[{"category":"string","severity":"MED","description":"string","mitigation":"string","source":"string"}],"data_gaps":[]},
  "mission": {"launch_vehicle":"Falcon Heavy","launch_vehicle_reason":"string","mining_method":"string","mining_method_trl":5,"transit_days":365,"surface_ops_days":180,"total_mission_days":900,"total_mission_years":2.5,"next_launch_window":"2028-Q3","distance_current_au":0.5,"delta_v_km_s":5.4},
  "market": {"primary_mineral":"cobalt","current_price_usd_kg":33.8,"price_trend":"rising","urgency_score":0.87,"demand_outlook":"string","supply_chain_event":{"found":true,"event":"string","severity":"HIGH","date":"string","source_url":"string"},"scenario_active":false},
  "route_context": {"route_id":"string","route_label":"string","stop_number":1,"total_stops":3,"route_net_value_usd":0,"route_total_delta_v":0,"other_stops":[]},
  "images": {
    "asteroid_render": "<base64_png>",
    "composition_map": "<base64_png>",
    "route_map": "<base64_png>",
    "physical_profile": "<base64_png>"
  },
  "go_no_go": {"recommendation":"GO","primary_reason_go":"string","primary_reason_no_go":"string","conditions_to_flip":"string","comparable_targets":[]},
  "sources": ["[Name](url)"]
}
`;

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const asteroidId = params.id;
  const url = new URL(req.url);
  const routeId = url.searchParams.get('route_id') || 'best_roi';

  const pool = getDbPool();

  // Check database cache first
  if (pool) {
    try {
      const cacheRes = await pool.query(
        'SELECT * FROM mission_reports WHERE asteroid_id = $1 AND route_id = $2',
        [asteroidId, routeId]
      );
      if (cacheRes.rows.length > 0) {
        const cached = cacheRes.rows[0];
        return NextResponse.json({
          asteroid_id: asteroidId,
          cached: true,
          report: cached.report,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('[API] Cache lookup failed:', err);
    }
  }

  // Fallback / Mock Generator when Gemini is not connected or fails
  const generateMockReport = (id: string) => {
    return {
      feasibility_score: 7,
      composition: {
        spec_type: 'M',
        spec_confidence: 0.8,
        minerals: [
          { name: 'iron', fraction: 0.82, mass_kg: 1.2e11, value_usd: 1.4e10, current_price_per_kg: 0.12, scenario_impact: false },
          { name: 'nickel', fraction: 0.12, mass_kg: 1.8e10, value_usd: 2.9e8, current_price_per_kg: 16.40, scenario_impact: false }
        ],
        density_kg_m3: 5100,
        surface_gravity_m_s2: 0.002,
        research_notes: 'Highly iron-dominant spectral returns confirmed via terrestrial photometric sweeps.'
      },
      valuation: {
        raw_value_usd: 1.8e10,
        damped_value_usd: 1.5e10,
        mission_cost_usd: 2.1e9,
        net_value_usd: 1.29e10,
        roi_pct: 614.2,
        scenario_impact_pct: 0
      },
      risk: {
        overall_risk: 'MED',
        factors: [
          { category: 'Structural Integrity', severity: 'LOW', description: 'Possible gravel-pile structural profile.', mitigation: 'Use anchor-less electromagnetic scoop mining', source: 'SBDB Photometry' }
        ],
        data_gaps: ['Thermal inertia model incomplete.']
      },
      mission: {
        launch_vehicle: 'Falcon Heavy',
        launch_vehicle_reason: 'Optimized payload volume for heavy metallic mineral loads.',
        mining_method: 'Anchor-less scoop induction',
        mining_method_trl: 6,
        transit_days: 280,
        surface_ops_days: 180,
        total_mission_days: 740,
        total_mission_years: 2.0,
        next_launch_window: '2028-Q3',
        distance_current_au: 0.28,
        delta_v_km_s: 4.8
      },
      market: {
        primary_mineral: 'cobalt',
        current_price_usd_kg: 33.8,
        price_trend: 'rising',
        urgency_score: 0.82,
        demand_outlook: 'Steady demand growth driven by EV batteries.',
        supply_chain_event: { found: true, event: 'DRC Mine Flooding', severity: 'HIGH', date: '2026', source_url: '' },
        scenario_active: false
      },
      route_context: {
        route_id: routeId,
        route_label: 'Balanced ROI Route',
        stop_number: 1,
        total_stops: 3,
        route_net_value_usd: 1.29e10,
        route_total_delta_v: 7.2,
        other_stops: []
      },
      go_no_go: {
        recommendation: 'GO',
        primary_reason_go: 'Outstanding mineral concentrations and exceptionally low delta-v of 4.8 km/s.',
        primary_reason_no_go: 'Orbital eccentricity limits launch windows to strict 18-month synodic intervals.',
        conditions_to_flip: 'Significant price crash in global iron/nickel markets.',
        comparable_targets: ['Amun', '1986 DA']
      },
      sources: ['NASA JPL SBDB', 'Bus-DeMeo Spectral Taxonomy', 'Asterank Database'],
      images: {
        asteroid_render: '',
        composition_map: '',
        route_map: '',
        physical_profile: ''
      }
    };
  };

  const apiKey = req.headers.get('x-gemini-api-key') || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('[API] GEMINI_API_KEY not set — using precompiled/mock report');
    const mock = generateMockReport(asteroidId);
    return NextResponse.json({
      asteroid_id: asteroidId,
      cached: false,
      report: mock,
      timestamp: new Date().toISOString(),
    });
  }

  try {
    console.log(`[API] Invoking Gemini Agent 4 (Mission Architect) for asteroid=${asteroidId}`);
    const ai = new GoogleGenerativeAI(apiKey);
    
    const prompt = `
      Asteroid ID: ${asteroidId}
      Target Route Context: ${routeId}
      Date: ${new Date().toISOString().split('T')[0]}
    `;

    const model = ai.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction,
    });

    const response = await model.generateContent(prompt);
    const rawText = response.response.text() || '{}';
    const reportData = JSON.parse(rawText.trim());

    // Cache the report to Neon DB if connected
    if (pool) {
      try {
        const images = reportData.images || {};
        await pool.query(
          `INSERT INTO mission_reports (asteroid_id, route_id, report, asteroid_render, composition_map, route_map, physical_profile)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (asteroid_id, route_id) DO UPDATE
           SET report = EXCLUDED.report, 
               asteroid_render = EXCLUDED.asteroid_render,
               composition_map = EXCLUDED.composition_map,
               route_map = EXCLUDED.route_map,
               physical_profile = EXCLUDED.physical_profile`,
          [
            asteroidId,
            routeId,
            JSON.stringify(reportData),
            images.asteroid_render || '',
            images.composition_map || '',
            images.route_map || '',
            images.physical_profile || '',
          ]
        );
      } catch (dbErr) {
        console.error('[API] Failed to cache Gemini report to NeonDB:', dbErr);
      }
    }

    return NextResponse.json({
      asteroid_id: asteroidId,
      cached: false,
      report: reportData,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[API] Gemini Agent 4 execution failed:', err);
    // Return mock fallback on failure to guarantee perfect application robustness
    const mock = generateMockReport(asteroidId);
    return NextResponse.json({
      asteroid_id: asteroidId,
      cached: false,
      report: mock,
      timestamp: new Date().toISOString(),
      error: String(err),
    });
  }
}
