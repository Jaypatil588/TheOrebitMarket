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

  // Only allow process.env.GEMINI_API_KEY fallback in local dev.
  // On Vercel (production), enforce the user-provided key from the UI.
  const isLocalDev = process.env.NODE_ENV === 'development';
  const apiKey = req.headers.get('x-gemini-api-key') || (isLocalDev ? process.env.GEMINI_API_KEY : null);
  
  if (!apiKey) {
    console.log('[API] GEMINI_API_KEY not provided — using precompiled/mock report');
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
    const jsonString = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const reportData = JSON.parse(jsonString);

    // Cache the report to Neon DB if connected
    if (pool) {
      try {
        await pool.query(
          `INSERT INTO mission_reports (asteroid_id, route_id, report, asteroid_render, composition_map, route_map, physical_profile)
           VALUES ($1, $2, $3, '', '', '', '')
           ON CONFLICT (asteroid_id, route_id) DO UPDATE
           SET report = EXCLUDED.report`,
          [
            asteroidId,
            routeId,
            JSON.stringify(reportData),
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
