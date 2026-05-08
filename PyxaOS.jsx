import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ScatterChart, Scatter, ResponsiveContainer, ReferenceLine, Legend,
  ComposedChart
} from 'recharts';
import RUNS_RAW from '../data/runs.json';

// ============================================================
// DATA
// ============================================================

const RUNS = RUNS_RAW; // already sorted by date

// Cross-functional events. Dates pulled from the actual run timeline plus
// reasonable surrounding milestones for software, instruments, and experiments.
const EVENTS = [
  { date: "2026-02-05", type: "software",     title: "Pipeline v1.0.0-rc3 deployed",      details: "First release candidate. Limited to PYXA_ALPHA5 with StandardExperiment.", source: "Bioinformatics" },
  { date: "2026-02-13", type: "software",     title: "Pipeline v1.0.0-rc5 deployed",      details: "Second release candidate. Rolled out to ALPHA2, ALPHA4, ALPHA6, BETA5.",  source: "Bioinformatics" },
  { date: "2026-02-26", type: "milestone",    title: "Cross-instrument validation begins", details: "Standard experiments run side-by-side on five instruments to establish baselines.", source: "Hardware" },
  { date: "2026-03-09", type: "software",     title: "Pipeline v1.0.0 GA release",        details: "General availability. All instruments migrate over the following week.",   source: "Bioinformatics" },
  { date: "2026-03-13", type: "milestone",    title: "Pre-DVT campaign begins",            details: "PreDVT-100um runs across alpha and beta units.",                          source: "DVT" },
  { date: "2026-03-19", type: "manufacturing",title: "PX26P00002 enters service",          details: "First production unit online. Begins 235-Sequencing campaign.",            source: "Manufacturing" },
  { date: "2026-03-22", type: "milestone",    title: "DVT campaign begins (100um, 20um)",  details: "Design verification testing at both target tissue thicknesses.",          source: "DVT" },
  { date: "2026-04-09", type: "manufacturing",title: "PX26P00004 enters service",          details: "Second production unit online.",                                          source: "Manufacturing" },
  { date: "2026-04-17", type: "software",     title: "Pipeline v1.1.0 deployed",           details: "Cell segmentation upgrade. Restricted to PYXA_ALPHA2 for validation.",     source: "Bioinformatics" },
  { date: "2026-04-20", type: "milestone",    title: "235-Sequencing campaign scaling",    details: "v1.1.0 validation runs on 235-gene panel.",                               source: "DVT" },
  { date: "2026-04-29", type: "ticket",       title: "BIO-218 opened. Decode efficiency variance",  details: "Some runs show DecodeEfficiency below 25%. Investigation pending.", source: "Jira" },
];

// ============================================================
// HELPERS
// ============================================================

const round2 = (n) => Math.round(n * 100) / 100;

const channelAvg = (run, c) => {
  if (!run.amplicon) return null;
  let sum = 0, n = 0;
  for (let r = 0; r <= 5; r++) {
    const v = run.amplicon[`r${r}c${c}`];
    if (v != null) { sum += v; n++; }
  }
  return n ? sum / n : null;
};

const roundAvg = (run, r) => {
  if (!run.amplicon) return null;
  let sum = 0, n = 0;
  for (let c = 0; c <= 2; c++) {
    const v = run.amplicon[`r${r}c${c}`];
    if (v != null) { sum += v; n++; }
  }
  return n ? sum / n : null;
};

const stats = (vals) => {
  const clean = vals.filter(v => v != null && !Number.isNaN(v));
  if (!clean.length) return null;
  const sorted = [...clean].sort((a, b) => a - b);
  const q = (p) => {
    const idx = (sorted.length - 1) * p;
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };
  const mean = clean.reduce((s, v) => s + v, 0) / clean.length;
  const variance = clean.reduce((s, v) => s + (v - mean) ** 2, 0) / clean.length;
  return {
    min: sorted[0], max: sorted[sorted.length - 1],
    q1: q(0.25), median: q(0.5), q3: q(0.75),
    mean, sd: Math.sqrt(variance), n: clean.length
  };
};

// Apply a filter object to a runs array. Filter keys are run fields.
// Special key: date_after, date_before. Array values mean OR within key.
const filterRuns = (runs, filter = {}) => runs.filter(r => {
  if (filter.date_after && r.date < filter.date_after) return false;
  if (filter.date_before && r.date > filter.date_before) return false;
  for (const [key, val] of Object.entries(filter)) {
    if (key === 'date_after' || key === 'date_before') continue;
    if (val == null || (Array.isArray(val) && val.length === 0)) continue;
    if (Array.isArray(val)) {
      if (!val.includes(r[key])) return false;
    } else {
      if (r[key] !== val) return false;
    }
  }
  return true;
});

// Get a metric off a run. Supports virtual metrics like c0_avg, c1_avg, c2_avg.
const getMetric = (run, metric) => {
  if (metric === 'c0_avg') return channelAvg(run, 0);
  if (metric === 'c1_avg') return channelAvg(run, 1);
  if (metric === 'c2_avg') return channelAvg(run, 2);
  return run[metric];
};

const FAMILY_ORDER   = ['Alpha', 'Beta', 'Production'];
const VERSION_ORDER  = ['1.0.0-rc3', '1.0.0-rc5', '1.0.0', '1.1.0'];
const EXPERIMENT_ORDER = ['StandardExperiment', 'PreDVT-100um', 'DVT-100um', 'DVT-20um', '235-Sequencing', 'Custom-Sequencing', 'SoftwareTest'];

const COLORS_FAMILY = {
  Alpha:      '#8B4513',
  Beta:       '#2D5A4F',
  Production: '#C7522A',
};

const COLORS_VERSION = {
  '1.0.0-rc3': '#A8A4A0',
  '1.0.0-rc5': '#B8860B',
  '1.0.0':     '#2D5A4F',
  '1.1.0':     '#C7522A',
};

const COLORS_EXPERIMENT = {
  'StandardExperiment': '#6E6E78',
  'PreDVT-100um':       '#B8860B',
  'DVT-100um':          '#8B4513',
  'DVT-20um':           '#A8612D',
  '235-Sequencing':     '#2D5A4F',
  'Custom-Sequencing':  '#5A6E78',
  'SoftwareTest':       '#A8A4A0',
};

const paletteFor = (groupKey) => {
  if (groupKey === 'instrument_family') return COLORS_FAMILY;
  if (groupKey === 'version') return COLORS_VERSION;
  if (groupKey === 'experiment_type') return COLORS_EXPERIMENT;
  return null;
};

const ALL_INSTRUMENT_FAMILIES = FAMILY_ORDER;
const ALL_VERSIONS = VERSION_ORDER;
const ALL_EXPERIMENTS = EXPERIMENT_ORDER;

// ============================================================
// STYLES
// ============================================================

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Geist:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

* { box-sizing: border-box; margin: 0; padding: 0; }

.app {
  --bg: #F7F4ED;
  --surface: #FFFFFF;
  --surface-alt: #FBF8F1;
  --ink: #1B1D2A;
  --ink-soft: #3A3D4D;
  --muted: #6E6E78;
  --faint: #A8A4A0;
  --border: #E4DFD3;
  --border-soft: #EFEAE0;
  --accent: #C7522A;
  --accent-soft: #FBEDE5;
  --success: #2D5A4F;
  --warning: #B8860B;
  --warm: #8B4513;

  font-family: 'Geist', system-ui, sans-serif;
  background: var(--bg);
  color: var(--ink);
  min-height: 100vh;
  font-size: 15px;
  line-height: 1.5;
  letter-spacing: -0.005em;
}

.serif { font-family: 'Fraunces', Georgia, serif; font-optical-sizing: auto; }
.mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }

.shell { max-width: 1240px; margin: 0 auto; padding: 48px 32px 80px; }

/* Header */
.header {
  display: flex; align-items: flex-end; justify-content: space-between;
  border-bottom: 1px solid var(--border); padding-bottom: 28px; margin-bottom: 32px;
}
.brand h1 {
  font-family: 'Fraunces', Georgia, serif; font-weight: 500;
  font-size: 44px; font-variation-settings: 'opsz' 96;
  letter-spacing: -0.02em; line-height: 1; color: var(--ink);
}
.brand h1 em { font-style: italic; color: var(--accent); font-weight: 400; }
.brand p { margin-top: 8px; color: var(--muted); font-size: 14px; }
.status { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; font-size: 12px; color: var(--muted); }
.status-row { display: flex; align-items: center; gap: 8px; font-family: 'JetBrains Mono', monospace; }
.dot { width: 6px; height: 6px; border-radius: 50%; background: var(--success); box-shadow: 0 0 0 3px rgba(45,90,79,0.12); }

/* Source connector cards */
.sources {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px;
  background: var(--border); border: 1px solid var(--border); border-radius: 4px;
  margin-bottom: 24px; overflow: hidden;
}
.source-cell { background: var(--surface); padding: 14px 16px; }
.source-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); margin-bottom: 4px; font-weight: 500; }
.source-value { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--ink); font-weight: 500; }

/* Filter bar */
.filter-bar {
  background: var(--surface); border: 1px solid var(--border); border-radius: 4px;
  padding: 18px 20px 16px; margin-bottom: 20px;
}
.filter-header {
  display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 14px;
}
.filter-eyebrow {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em;
  color: var(--muted); font-weight: 500;
}
.filter-count {
  font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--ink);
}
.filter-count em { color: var(--accent); font-style: normal; font-weight: 500; }
.filter-clear {
  background: transparent; border: none; color: var(--muted); font-size: 11px;
  cursor: pointer; padding: 0 0 0 16px; font-family: 'Geist', sans-serif;
  text-transform: uppercase; letter-spacing: 0.08em; font-weight: 500;
}
.filter-clear:hover { color: var(--accent); }
.filter-row {
  display: grid; grid-template-columns: 110px 1fr; gap: 16px;
  padding: 8px 0; border-top: 1px dashed var(--border-soft);
}
.filter-row:first-of-type { border-top: none; }
.filter-row-label {
  font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em;
  font-weight: 500; padding-top: 4px;
}
.filter-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip {
  background: transparent; border: 1px solid var(--border);
  font-family: 'JetBrains Mono', monospace; font-size: 11px;
  padding: 4px 10px; border-radius: 3px;
  cursor: pointer; color: var(--ink-soft);
  transition: all 0.12s ease;
  display: inline-flex; align-items: center; gap: 5px;
}
.chip:hover { border-color: var(--ink); color: var(--ink); }
.chip.active {
  background: var(--ink); color: var(--bg); border-color: var(--ink);
}
.chip .swatch {
  width: 7px; height: 7px; border-radius: 50%; display: inline-block;
}
.chip .count {
  font-size: 10px; opacity: 0.7;
}

/* KPI cards */
.kpis {
  display: grid; grid-template-columns: repeat(6, 1fr); gap: 1px;
  background: var(--border); border: 1px solid var(--border); border-radius: 4px;
  margin-bottom: 24px; overflow: hidden;
}
.kpi {
  background: var(--surface); padding: 14px 14px 16px;
  display: flex; flex-direction: column; gap: 4px;
}
.kpi-label {
  font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--muted); font-weight: 500;
}
.kpi-value {
  font-family: 'Fraunces', Georgia, serif; font-weight: 400;
  font-size: 26px; font-variation-settings: 'opsz' 48;
  letter-spacing: -0.02em; color: var(--ink); line-height: 1;
}
.kpi-sub {
  font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--muted);
  margin-top: 2px;
}

/* Dashboard */
.dashboard-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
  margin-bottom: 36px;
}
.dashboard-tile {
  background: var(--surface); border: 1px solid var(--border); border-radius: 4px;
  padding: 18px 18px 12px;
}
.dashboard-tile.full { grid-column: 1 / -1; }
.tile-head {
  display: flex; align-items: baseline; justify-content: space-between;
  margin-bottom: 10px;
}
.tile-title {
  font-size: 13px; font-weight: 500; color: var(--ink); letter-spacing: -0.01em;
}
.tile-sub {
  font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--muted);
}

/* Query section */
.query-section { margin-bottom: 32px; padding-top: 32px; border-top: 1px solid var(--border); }
.query-eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: var(--muted); margin-bottom: 14px; font-weight: 500; }
.query-input-wrap {
  display: flex; align-items: stretch; background: var(--surface);
  border: 1px solid var(--border); border-radius: 4px; overflow: hidden;
  transition: border-color 0.15s ease;
}
.query-input-wrap:focus-within { border-color: var(--ink); }
.query-input {
  flex: 1; border: none; outline: none; background: transparent;
  padding: 18px 20px; font-family: 'Geist', sans-serif; font-size: 16px; color: var(--ink);
}
.query-input::placeholder { color: var(--faint); font-style: italic; }
.query-button {
  background: var(--ink); color: var(--bg); border: none; padding: 0 26px;
  font-family: 'Geist', sans-serif; font-weight: 500; font-size: 14px;
  letter-spacing: 0.02em; cursor: pointer; transition: background 0.15s ease;
}
.query-button:hover { background: var(--accent); }
.query-button:disabled { opacity: 0.5; cursor: wait; }

.suggested { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 14px; }
.suggested-card {
  background: transparent; border: 1px solid var(--border); border-radius: 3px;
  padding: 14px 16px; text-align: left; cursor: pointer;
  font-family: 'Geist', sans-serif; font-size: 13px; color: var(--ink-soft);
  transition: all 0.15s ease; line-height: 1.4;
}
.suggested-card:hover { border-color: var(--ink); background: var(--surface); color: var(--ink); }
.suggested-card:before { content: '→ '; color: var(--accent); font-weight: 500; }

.answer { margin-top: 36px; animation: fadeIn 0.4s ease; }
.answer-eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: var(--muted); margin-bottom: 12px; font-weight: 500; }
.answer-summary {
  font-family: 'Fraunces', Georgia, serif; font-weight: 400;
  font-size: 28px; font-variation-settings: 'opsz' 96;
  letter-spacing: -0.015em; line-height: 1.25; color: var(--ink); margin-bottom: 8px;
}
.answer-summary em { font-style: italic; color: var(--accent); font-weight: 400; }

.key-finding {
  background: var(--accent-soft); border-left: 2px solid var(--accent);
  padding: 14px 18px; margin: 24px 0 32px; border-radius: 0 3px 3px 0;
}
.key-finding-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.14em; color: var(--accent); font-weight: 600; margin-bottom: 6px; }
.key-finding-text { color: var(--ink); font-size: 14px; line-height: 1.5; }

.panel-section-header {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em;
  color: var(--muted); font-weight: 500; margin: 28px 0 14px;
  padding-bottom: 10px; border-bottom: 1px solid var(--border-soft);
}

.panel {
  background: var(--surface); border: 1px solid var(--border); border-radius: 4px;
  padding: 22px 22px 18px; margin-bottom: 16px;
}
.panel-head {
  display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 4px;
}
.panel-title {
  font-family: 'Fraunces', Georgia, serif; font-weight: 500;
  font-size: 17px; font-variation-settings: 'opsz' 48;
  letter-spacing: -0.01em; color: var(--ink);
}
.panel-type {
  font-family: 'JetBrains Mono', monospace; font-size: 10px;
  color: var(--faint); text-transform: lowercase;
}
.panel-caption { font-size: 12px; color: var(--muted); margin-bottom: 16px; line-height: 1.5; }
.panel-body { width: 100%; }

.evidence-list { display: flex; flex-direction: column; gap: 8px; }
.evidence-item {
  background: var(--surface); border: 1px solid var(--border-soft); border-radius: 3px;
  padding: 10px 14px; font-size: 12px;
  display: grid; grid-template-columns: 90px 90px 1fr; gap: 14px; align-items: baseline;
}
.evidence-id { color: var(--accent); font-weight: 500; }
.evidence-date { color: var(--muted); }
.evidence-obs { color: var(--ink-soft); line-height: 1.5; }

.followups { display: flex; flex-wrap: wrap; gap: 8px; }
.followup-chip {
  background: transparent; border: 1px solid var(--border); border-radius: 100px;
  padding: 7px 14px; font-size: 12px; color: var(--ink-soft); cursor: pointer;
  font-family: 'Geist', sans-serif; transition: all 0.15s ease;
}
.followup-chip:hover { border-color: var(--ink); background: var(--surface); color: var(--ink); }

.loading { display: flex; align-items: center; gap: 12px; padding: 28px 0; color: var(--muted); font-size: 13px; }
.spinner {
  width: 14px; height: 14px; border: 2px solid var(--border);
  border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

/* Timeline */
.timeline-section { margin-top: 56px; padding-top: 36px; border-top: 1px solid var(--border); }
.timeline-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 22px; }
.timeline-title { font-size: 22px; font-family: 'Fraunces', serif; font-weight: 500; }
.timeline-subtitle { color: var(--muted); font-size: 12px; font-family: 'JetBrains Mono', monospace; }
.timeline { display: flex; flex-direction: column; gap: 8px; }
.timeline-row {
  display: grid; grid-template-columns: 100px 14px 1fr; align-items: baseline; gap: 14px;
  padding: 8px 0; border-bottom: 1px solid var(--border-soft);
}
.timeline-date { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--muted); }
.timeline-marker { width: 8px; height: 8px; border-radius: 50%; background: var(--ink); margin-top: 6px; }
.timeline-marker[data-type="software"] { background: var(--accent); }
.timeline-marker[data-type="manufacturing"] { background: var(--success); }
.timeline-marker[data-type="ticket"] { background: var(--warning); }
.timeline-marker[data-type="milestone"] { background: var(--warm); }
.timeline-event-title { font-size: 13px; font-weight: 500; color: var(--ink); }
.timeline-event-details { font-size: 12px; color: var(--ink-soft); margin-top: 2px; line-height: 1.4; }
.timeline-event-source { font-size: 10px; color: var(--faint); margin-top: 4px; font-family: 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: 0.06em; }

.foot { margin-top: 60px; padding-top: 24px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; font-size: 11px; color: var(--faint); font-family: 'JetBrains Mono', monospace; }

/* Empty state for charts when no runs match */
.empty-state {
  display: flex; align-items: center; justify-content: center;
  height: 240px; color: var(--faint); font-size: 13px; font-style: italic;
}

@media (max-width: 880px) {
  .sources, .kpis { grid-template-columns: repeat(2, 1fr); }
  .dashboard-grid { grid-template-columns: 1fr; }
  .filter-row { grid-template-columns: 1fr; gap: 8px; }
  .suggested { grid-template-columns: 1fr; }
}
`;

// ============================================================
// CHART COMPONENTS
// ============================================================

const EmptyState = ({ msg = 'No runs match the current filter.' }) => (
  <div className="empty-state">{msg}</div>
);

// ----- Trend chart -----
const TrendChart = ({ runs, params }) => {
  const filtered = filterRuns(runs, params.filter || {});
  const metric = params.metric;
  const colorBy = params.color_by;

  if (filtered.length === 0) return <EmptyState />;

  // For trend, group by date AND optionally color_by, then average per day per group
  const groups = colorBy
    ? [...new Set(filtered.map(r => r[colorBy]))].filter(g => g != null).sort()
    : ['all'];

  const palette = paletteFor(colorBy) || { all: '#1B1D2A' };

  // Build data: rows by date, with one column per group for the metric
  const dates = [...new Set(filtered.map(r => r.date))].sort();
  const data = dates.map(date => {
    const row = { date };
    for (const g of groups) {
      const subset = filtered.filter(r => r.date === date && (!colorBy || r[colorBy] === g));
      const vals = subset.map(r => getMetric(r, metric)).filter(v => v != null);
      if (vals.length) row[g] = round2(vals.reduce((s, v) => s + v, 0) / vals.length);
    }
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 24, bottom: 24, left: 8 }}>
        <CartesianGrid stroke="#EFEAE0" strokeDasharray="2 2" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6E6E78' }} stroke="#A8A4A0"
               angle={-30} textAnchor="end" height={50} />
        <YAxis tick={{ fontSize: 11, fill: '#6E6E78' }} stroke="#A8A4A0"
               label={{ value: metric, angle: -90, position: 'insideLeft', fontSize: 11, fill: '#6E6E78' }} />
        <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E4DFD3', borderRadius: 3, fontSize: 12 }} />
        {groups.map(g => (
          <Line key={g} type="monotone" dataKey={g} name={g}
                stroke={palette[g] || '#1B1D2A'} strokeWidth={2}
                dot={{ r: 3, fill: palette[g] || '#1B1D2A' }} connectNulls />
        ))}
        {colorBy && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 16 }} />}
      </LineChart>
    </ResponsiveContainer>
  );
};

// ----- Heatmap (round x channel intensity matrix) -----
const HeatmapPanel = ({ runs, params }) => {
  // groups: array of { label, filter }
  // Each cell = mean of amplicon[r{r}c{c}] across runs in the group
  const groups = (params.groups && params.groups.length > 0)
    ? params.groups
    : [{ label: 'All runs', filter: params.filter || {} }];

  const matrices = groups.map(g => {
    const subset = filterRuns(runs, g.filter || {});
    const M = Array.from({ length: 6 }, () => Array(3).fill(null));
    for (let r = 0; r <= 5; r++) {
      for (let c = 0; c <= 2; c++) {
        const vals = subset.map(run => run.amplicon?.[`r${r}c${c}`]).filter(v => v != null);
        if (vals.length) M[r][c] = vals.reduce((s, v) => s + v, 0) / vals.length;
      }
    }
    return { label: g.label, n: subset.length, M };
  });

  // Global color scale across all matrices
  const allVals = matrices.flatMap(m => m.M.flat()).filter(v => v != null);
  if (allVals.length === 0) return <EmptyState />;
  const vMin = Math.min(...allVals), vMax = Math.max(...allVals);

  const cellSize = 38;
  const gap = 28;
  const labelL = 30;
  const labelT = 36;
  const matrixW = 3 * cellSize;
  const matrixH = 6 * cellSize;
  const W = labelL + matrices.length * (matrixW + gap);
  const H = labelT + matrixH + 28;

  const colorFor = (v) => {
    if (v == null) return '#F4F1E8';
    const t = (v - vMin) / Math.max(1e-9, vMax - vMin);
    // Cream → ink ramp via accent
    const r = Math.round(247 + (199 - 247) * t);
    const g = Math.round(244 + (82  - 244) * t);
    const b = Math.round(237 + (42  - 237) * t);
    return `rgb(${r},${g},${b})`;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: matrices.length * (matrixW + gap) + labelL }}>
      {/* Round labels (left) */}
      {[0,1,2,3,4,5].map(r => (
        <text key={r} x={labelL - 6} y={labelT + r * cellSize + cellSize/2 + 4}
              textAnchor="end" style={{ fontSize: 10, fill: '#6E6E78', fontFamily: 'JetBrains Mono, monospace' }}>
          r{r}
        </text>
      ))}

      {matrices.map((m, mi) => {
        const xOff = labelL + mi * (matrixW + gap);
        return (
          <g key={mi}>
            {/* Group label */}
            <text x={xOff + matrixW/2} y={14} textAnchor="middle"
                  style={{ fontSize: 12, fill: '#1B1D2A', fontFamily: 'Geist, sans-serif', fontWeight: 500 }}>
              {m.label}
            </text>
            <text x={xOff + matrixW/2} y={28} textAnchor="middle"
                  style={{ fontSize: 10, fill: '#6E6E78', fontFamily: 'JetBrains Mono, monospace' }}>
              n={m.n}
            </text>
            {/* Channel labels */}
            {[0,1,2].map(c => (
              <text key={c} x={xOff + c * cellSize + cellSize/2} y={labelT - 4}
                    textAnchor="middle" style={{ fontSize: 10, fill: '#6E6E78', fontFamily: 'JetBrains Mono, monospace' }}>
                c{c}
              </text>
            ))}
            {/* Cells */}
            {m.M.map((row, r) => row.map((v, c) => (
              <g key={`${r}-${c}`}>
                <rect x={xOff + c * cellSize} y={labelT + r * cellSize}
                      width={cellSize - 1} height={cellSize - 1}
                      fill={colorFor(v)} stroke="#E4DFD3" strokeWidth={0.5} />
                <text x={xOff + c * cellSize + cellSize/2}
                      y={labelT + r * cellSize + cellSize/2 + 3.5}
                      textAnchor="middle"
                      style={{
                        fontSize: 10,
                        fill: v != null && (v - vMin) / Math.max(1e-9, vMax - vMin) > 0.55 ? '#FFFFFF' : '#1B1D2A',
                        fontFamily: 'JetBrains Mono, monospace'
                      }}>
                  {v != null ? v.toFixed(1) : '—'}
                </text>
              </g>
            )))}
          </g>
        );
      })}
      {/* Scale */}
      <text x={labelL} y={H - 8} style={{ fontSize: 10, fill: '#A8A4A0', fontFamily: 'JetBrains Mono, monospace' }}>
        scale: {vMin.toFixed(1)} → {vMax.toFixed(1)}
      </text>
    </svg>
  );
};

// ----- Channel breakdown over time -----
const ChannelBreakdown = ({ runs, params }) => {
  const filtered = filterRuns(runs, params.filter || {});
  if (filtered.length === 0) return <EmptyState />;

  const dates = [...new Set(filtered.map(r => r.date))].sort();
  const data = dates.map(date => {
    const subset = filtered.filter(r => r.date === date);
    const c0 = subset.map(r => channelAvg(r, 0)).filter(v => v != null);
    const c1 = subset.map(r => channelAvg(r, 1)).filter(v => v != null);
    const c2 = subset.map(r => channelAvg(r, 2)).filter(v => v != null);
    return {
      date,
      c0: c0.length ? round2(c0.reduce((s, v) => s + v, 0) / c0.length) : null,
      c1: c1.length ? round2(c1.reduce((s, v) => s + v, 0) / c1.length) : null,
      c2: c2.length ? round2(c2.reduce((s, v) => s + v, 0) / c2.length) : null,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 24, bottom: 24, left: 8 }}>
        <CartesianGrid stroke="#EFEAE0" strokeDasharray="2 2" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6E6E78' }} stroke="#A8A4A0"
               angle={-30} textAnchor="end" height={50} />
        <YAxis tick={{ fontSize: 11, fill: '#6E6E78' }} stroke="#A8A4A0"
               label={{ value: 'mean intensity', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#6E6E78' }} />
        <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E4DFD3', borderRadius: 3, fontSize: 12 }} />
        <Line type="monotone" dataKey="c0" name="c0" stroke="#C7522A" strokeWidth={2} dot={{ r: 3 }} connectNulls />
        <Line type="monotone" dataKey="c1" name="c1" stroke="#2D5A4F" strokeWidth={2} dot={{ r: 3 }} connectNulls />
        <Line type="monotone" dataKey="c2" name="c2" stroke="#B8860B" strokeWidth={2} dot={{ r: 3 }} connectNulls />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 16 }} />
      </LineChart>
    </ResponsiveContainer>
  );
};

// ----- Box plot helpers -----
const BoxPlot = ({ stats, x, w, color, jitterValues }) => {
  if (!stats) return null;
  const half = w / 2;
  return (
    <g>
      {/* whisker */}
      <line x1={x} y1={stats.min} x2={x} y2={stats.max} stroke={color} strokeWidth={1} />
      <line x1={x - half * 0.4} y1={stats.min} x2={x + half * 0.4} y2={stats.min} stroke={color} strokeWidth={1} />
      <line x1={x - half * 0.4} y1={stats.max} x2={x + half * 0.4} y2={stats.max} stroke={color} strokeWidth={1} />
      {/* box */}
      <rect x={x - half} y={Math.min(stats.q1, stats.q3)} width={w}
            height={Math.abs(stats.q3 - stats.q1)} fill={color} fillOpacity={0.16} stroke={color} strokeWidth={1.2} />
      {/* median */}
      <line x1={x - half} y1={stats.median} x2={x + half} y2={stats.median} stroke={color} strokeWidth={2} />
      {/* points */}
      {jitterValues.map((y, i) => (
        <circle key={i} cx={x + (((i * 7919) % 31) / 31 - 0.5) * w * 0.5} cy={y}
                r={2.5} fill={color} fillOpacity={0.6} />
      ))}
    </g>
  );
};

// ----- Box compare chart -----
const BoxCompareChart = ({ runs, params }) => {
  const filtered = filterRuns(runs, params.filter || {});
  if (filtered.length === 0) return <EmptyState />;

  const groupBy = params.group_by;
  const facetBy = params.facet_by;
  const metric  = params.metric;

  const groupValues = [...new Set(filtered.map(r => r[groupBy]))].filter(v => v != null).sort();
  const facetValues = facetBy
    ? [...new Set(filtered.map(r => r[facetBy]))].filter(v => v != null).sort()
    : ['all'];

  const palette = paletteFor(groupBy) || groupValues.reduce((acc, g, i) => ({ ...acc, [g]: ['#1B1D2A','#C7522A','#2D5A4F','#B8860B','#8B4513'][i % 5] }), {});

  const allVals = filtered.map(r => getMetric(r, metric)).filter(v => v != null);
  if (allVals.length === 0) return <EmptyState />;
  const yMin = Math.min(...allVals);
  const yMax = Math.max(...allVals);
  const pad = (yMax - yMin) * 0.08 || 1;
  const yLo = yMin - pad, yHi = yMax + pad;

  const W = 700, H = 320;
  const padL = 60, padR = 16, padT = 16, padB = 70;
  const plotH = H - padT - padB;
  const plotW = W - padL - padR;
  const facetW = plotW / facetValues.length;
  const groupW = facetW / groupValues.length;

  const yScale = (v) => padT + plotH - ((v - yLo) / (yHi - yLo)) * plotH;
  const yTicks = [yLo, yLo + (yHi - yLo) * 0.25, yLo + (yHi - yLo) * 0.5, yLo + (yHi - yLo) * 0.75, yHi];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%">
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={padL} y1={yScale(t)} x2={W - padR} y2={yScale(t)} stroke="#EFEAE0" strokeDasharray="2 2" />
          <text x={padL - 8} y={yScale(t) + 4} textAnchor="end"
                style={{ fontSize: 10, fill: '#6E6E78', fontFamily: 'JetBrains Mono, monospace' }}>
            {t < 5 ? t.toFixed(2) : Math.round(t).toLocaleString()}
          </text>
        </g>
      ))}
      <text x={16} y={padT + plotH/2} transform={`rotate(-90 16 ${padT + plotH/2})`} textAnchor="middle"
            style={{ fontSize: 11, fill: '#6E6E78', fontFamily: 'Geist, sans-serif' }}>
        {metric}
      </text>

      {facetValues.map((fv, fi) => {
        const facetX = padL + facetW * fi;
        const facetRuns = facetBy ? filtered.filter(r => r[facetBy] === fv) : filtered;
        return (
          <g key={fi}>
            {fi > 0 && <line x1={facetX} y1={padT} x2={facetX} y2={padT + plotH} stroke="#E4DFD3" />}
            {facetBy && (
              <text x={facetX + facetW/2} y={H - padB + 38} textAnchor="middle"
                    style={{ fontSize: 11, fill: '#3A3D4D', fontFamily: 'Geist, sans-serif' }}>
                {facetBy}: {fv}
              </text>
            )}
            {groupValues.map((gv, gi) => {
              const groupRuns = facetRuns.filter(r => r[groupBy] === gv);
              const vals = groupRuns.map(r => getMetric(r, metric)).filter(v => v != null);
              if (vals.length === 0) return null;
              const s = stats(vals);
              const x = facetX + groupW * (gi + 0.5);
              return (
                <g key={gi}>
                  <BoxPlot
                    stats={{ ...s,
                      min: yScale(s.min), max: yScale(s.max),
                      q1: yScale(s.q1), q3: yScale(s.q3), median: yScale(s.median) }}
                    x={x}
                    w={groupW * 0.7}
                    color={palette[gv] || '#1B1D2A'}
                    jitterValues={vals.map(yScale)}
                  />
                  <text x={x} y={H - padB + 14} textAnchor="middle"
                        style={{ fontSize: 10, fill: palette[gv] || '#1B1D2A', fontFamily: 'JetBrains Mono, monospace' }}>
                    {String(gv).length > 12 ? String(gv).slice(0, 11) + '…' : gv}
                  </text>
                  <text x={x} y={H - padB + 26} textAnchor="middle"
                        style={{ fontSize: 9, fill: '#A8A4A0', fontFamily: 'JetBrains Mono, monospace' }}>
                    n={s.n}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
};

// ----- Interaction grid -----
const InteractionGrid = ({ runs, params }) => {
  const filtered = filterRuns(runs, params.filter || {});
  if (filtered.length === 0) return <EmptyState />;

  const rowFactor = params.row_factor;
  const colFactor = params.col_factor;
  const rowValues = params.row_values || [...new Set(filtered.map(r => r[rowFactor]))].filter(v => v != null).sort();
  const colValues = params.col_values || [...new Set(filtered.map(r => r[colFactor]))].filter(v => v != null).sort();
  const metric = params.metric;

  const allVals = filtered.map(r => getMetric(r, metric)).filter(v => v != null);
  if (allVals.length === 0) return <EmptyState />;
  const yMin = Math.min(...allVals) * 0.95;
  const yMax = Math.max(...allVals) * 1.05;

  const cellW = 200, cellH = 130, gap = 8, labelL = 110, labelT = 28;
  const W = labelL + colValues.length * (cellW + gap);
  const H = labelT + rowValues.length * (cellH + gap) + 36;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W }}>
      {colValues.map((cv, ci) => (
        <text key={ci} x={labelL + ci * (cellW + gap) + cellW/2} y={18}
              textAnchor="middle" style={{ fontSize: 12, fill: '#1B1D2A', fontFamily: 'Geist, sans-serif', fontWeight: 500 }}>
          {colFactor}: {cv}
        </text>
      ))}
      {rowValues.map((rv, ri) => (
        <text key={ri} x={labelL - 8} y={labelT + ri * (cellH + gap) + cellH/2}
              textAnchor="end" style={{ fontSize: 12, fill: '#1B1D2A', fontFamily: 'Geist, sans-serif', fontWeight: 500 }}>
          {rowFactor}: {rv}
        </text>
      ))}

      {rowValues.map((rv, ri) => colValues.map((cv, ci) => {
        const cellRuns = filtered.filter(r => r[rowFactor] === rv && r[colFactor] === cv);
        const cellX = labelL + ci * (cellW + gap);
        const cellY = labelT + ri * (cellH + gap);
        const yScale = (v) => cellY + cellH - 16 - ((v - yMin) / (yMax - yMin)) * (cellH - 24);
        const vals = cellRuns.map(r => getMetric(r, metric)).filter(v => v != null);
        const s = vals.length > 0 ? stats(vals) : null;
        const isLow = s && s.median < (yMin + (yMax - yMin) * 0.3);

        return (
          <g key={`${ri}-${ci}`}>
            <rect x={cellX} y={cellY} width={cellW} height={cellH}
                  fill={isLow ? '#FBEDE5' : '#FFFFFF'} stroke="#E4DFD3" strokeWidth={1} rx={2} />
            {[0.25, 0.5, 0.75].map(p => {
              const v = yMin + (yMax - yMin) * (1 - p);
              return (
                <line key={p} x1={cellX + 6} y1={yScale(v)} x2={cellX + cellW - 6} y2={yScale(v)}
                      stroke="#EFEAE0" strokeDasharray="2 2" />
              );
            })}
            {vals.map((v, i) => (
              <circle key={i}
                cx={cellX + cellW/2 + (((i * 7919) % 31) / 31 - 0.5) * cellW * 0.4}
                cy={yScale(v)}
                r={3} fill={isLow ? '#C7522A' : '#2D5A4F'} fillOpacity={0.7} />
            ))}
            {s && (
              <line x1={cellX + cellW * 0.25} y1={yScale(s.median)}
                    x2={cellX + cellW * 0.75} y2={yScale(s.median)}
                    stroke={isLow ? '#C7522A' : '#2D5A4F'} strokeWidth={2} />
            )}
            <text x={cellX + cellW - 8} y={cellY + cellH - 6} textAnchor="end"
                  style={{ fontSize: 10, fill: '#6E6E78', fontFamily: 'JetBrains Mono, monospace' }}>
              n={vals.length}{s ? ` · med ${s.median < 5 ? s.median.toFixed(2) : s.median.toFixed(0)}` : ''}
            </text>
          </g>
        );
      }))}
      <text x={labelL} y={H - 12} style={{ fontSize: 11, fill: '#6E6E78', fontFamily: 'Geist, sans-serif' }}>
        y-axis: {metric} (range {yMin < 5 ? yMin.toFixed(2) : Math.round(yMin)} to {yMax < 5 ? yMax.toFixed(2) : Math.round(yMax)})
      </text>
    </svg>
  );
};

// ----- Scatter correlation -----
const ScatterCorrelation = ({ runs, params }) => {
  const filtered = filterRuns(runs, params.filter || {});
  if (filtered.length === 0) return <EmptyState />;

  const xMetric = params.x_metric;
  const yMetric = params.y_metric;
  const colorBy = params.color_by;

  const groups = colorBy ? [...new Set(filtered.map(r => r[colorBy]))].filter(v => v != null).sort() : ['all'];
  const palette = paletteFor(colorBy) || { all: '#1B1D2A' };

  const data = groups.map(g => ({
    name: g,
    color: palette[g] || '#1B1D2A',
    points: filtered
      .filter(r => !colorBy || r[colorBy] === g)
      .map(r => ({
        x: getMetric(r, xMetric),
        y: getMetric(r, yMetric),
        id: r.id
      }))
      .filter(p => p.x != null && p.y != null)
      .map(p => ({ ...p, x: round2(p.x), y: round2(p.y) }))
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ScatterChart margin={{ top: 8, right: 24, bottom: 32, left: 8 }}>
        <CartesianGrid stroke="#EFEAE0" strokeDasharray="2 2" />
        <XAxis type="number" dataKey="x" name={xMetric} tick={{ fontSize: 11, fill: '#6E6E78' }} stroke="#A8A4A0"
               label={{ value: xMetric, position: 'bottom', offset: 0, fontSize: 11, fill: '#6E6E78' }} />
        <YAxis type="number" dataKey="y" name={yMetric} tick={{ fontSize: 11, fill: '#6E6E78' }} stroke="#A8A4A0"
               label={{ value: yMetric, angle: -90, position: 'insideLeft', fontSize: 11, fill: '#6E6E78' }} />
        <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ background: '#fff', border: '1px solid #E4DFD3', borderRadius: 3, fontSize: 12 }} />
        {data.map(g => (
          <Scatter key={g.name} name={g.name} data={g.points} fill={g.color} />
        ))}
        {colorBy && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 24 }} />}
      </ScatterChart>
    </ResponsiveContainer>
  );
};

// ----- Filter pipeline chart (NEW) -----
// Shows how a metric (cells, mean_tpc, z_cv) changes through the processing pipeline stages.
// Stages: before_filter → after_vol_count → after_pos → best_chunk
const FilterPipelineChart = ({ runs, params }) => {
  const filtered = filterRuns(runs, params.filter || {});
  if (filtered.length === 0) return <EmptyState />;

  const family = params.metric_family || 'cells'; // 'cells' | 'tpc' | 'zcv'
  const groupBy = params.group_by || 'instrument_family';
  const STAGES = ['before_filter', 'after_vol_count', 'after_pos', 'best_chunk'];

  // Explicit lookup. CSV naming is inconsistent across families, so we map per family.
  const FIELD_MAP = {
    cells: {
      before_filter:    'num_cells_before_filter',
      after_vol_count:  'num_cells_after_vol_count',
      after_pos:        'num_cells_after_pos',
      best_chunk:       'num_cells_in_best_chunk',
    },
    tpc: {
      // The CSV does not have mean_tpc_before_filter, so we use the overall mean_tpc
      // as the pre-stage value (it reflects the run before vol/pos refinement).
      before_filter:    'mean_tpc',
      after_vol_count:  'mean_tpc_after_vol_count',
      after_pos:        'mean_tpc_after_pos',
      best_chunk:       'mean_tpc_best_chunk',
    },
    zcv: {
      before_filter:    'z_cv_before_filter',
      after_vol_count:  'z_cv_after_vol_count',
      after_pos:        'z_cv_after_pos',
      best_chunk:       'z_cv_best_chunk',
    },
  };
  const fieldFor = (stage) => FIELD_MAP[family]?.[stage];

  const groupValues = [...new Set(filtered.map(r => r[groupBy]))].filter(v => v != null).sort();
  const palette = paletteFor(groupBy) || { all: '#1B1D2A' };

  const rows = STAGES.map(stage => {
    const row = { stage };
    for (const g of groupValues) {
      const subset = filtered.filter(r => r[groupBy] === g);
      const field = fieldFor(stage);
      const vals = subset.map(r => r[field]).filter(v => v != null && !Number.isNaN(v));
      if (vals.length) row[g] = round2(vals.reduce((s, v) => s + v, 0) / vals.length);
    }
    return row;
  });

  const yLabel = family === 'cells' ? 'mean cells' : family === 'tpc' ? 'mean TPC' : 'mean z_cv';

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={rows} margin={{ top: 8, right: 24, bottom: 24, left: 8 }}>
        <CartesianGrid stroke="#EFEAE0" strokeDasharray="2 2" />
        <XAxis dataKey="stage" tick={{ fontSize: 11, fill: '#6E6E78' }} stroke="#A8A4A0" />
        <YAxis tick={{ fontSize: 11, fill: '#6E6E78' }} stroke="#A8A4A0"
               label={{ value: yLabel, angle: -90, position: 'insideLeft', fontSize: 11, fill: '#6E6E78' }} />
        <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E4DFD3', borderRadius: 3, fontSize: 12 }} />
        {groupValues.map(g => (
          <Line key={g} type="monotone" dataKey={g} name={g}
                stroke={palette[g] || '#1B1D2A'} strokeWidth={2}
                dot={{ r: 4, fill: palette[g] || '#1B1D2A' }} />
        ))}
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 16 }} />
      </LineChart>
    </ResponsiveContainer>
  );
};

// ----- Panel router -----
const Panel = ({ panel, runs }) => {
  const { chart_type, title, caption, params = {} } = panel;
  let body;
  switch (chart_type) {
    case 'metric_trend':       body = <TrendChart runs={runs} params={params} />; break;
    case 'amplicon_heatmap':   body = <HeatmapPanel runs={runs} params={params} />; break;
    case 'channel_breakdown':  body = <ChannelBreakdown runs={runs} params={params} />; break;
    case 'box_compare':        body = <BoxCompareChart runs={runs} params={params} />; break;
    case 'interaction_grid':   body = <InteractionGrid runs={runs} params={params} />; break;
    case 'scatter_correlation':body = <ScatterCorrelation runs={runs} params={params} />; break;
    case 'filter_pipeline':    body = <FilterPipelineChart runs={runs} params={params} />; break;
    default:                   body = <div className="empty-state">Unknown chart type: {chart_type}</div>;
  }
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title serif">{title}</div>
        <div className="panel-type mono">{chart_type}</div>
      </div>
      {caption && <div className="panel-caption">{caption}</div>}
      <div className="panel-body">{body}</div>
    </div>
  );
};

// ============================================================
// AI INTEGRATION
// ============================================================

// We send a compact run summary (not the full 87-column data) to keep token usage
// reasonable. The full data lives client-side and is filtered/aggregated by the chart code.
const buildRunSummaries = () => RUNS.map(r => ({
  id: r.id,
  date: r.date,
  instrument: r.instrument,
  instrument_family: r.instrument_family,
  experiment_type: r.experiment_type,
  version: r.version,
  thickness: r.thickness,
  region: r.region,
  // Flagship metrics
  mean_tpc: r.mean_tpc,
  median_tpc: r.median_tpc,
  num_cells_after_pos: r.num_cells_after_pos,
  z_cv_after_pos: r.z_cv_after_pos,
  DecodeEfficiency: r.DecodeEfficiency,
  num_decodes: r.num_decodes,
  perc_amplicon_in_cell: r.perc_amplicon_in_cell,
  perc_trans_in_cell: r.perc_trans_in_cell,
  bio_percentage: r.bio_percentage,
  failed_fov_count: r.failed_fov_count,
  processed_fov_count: r.processed_fov_count,
  CellFilterRatio: r.CellFilterRatio,
  probe_fdr: r.probe_fdr,
  gene_fdr: r.gene_fdr,
  c0_avg: round2(channelAvg(r, 0)),
  c1_avg: round2(channelAvg(r, 1)),
  c2_avg: round2(channelAvg(r, 2)),
}));

const buildSystemPrompt = () => `You are Pyxa OS, an AI analyst for a spatial transcriptomics product development team.

THE PLATFORM
The team runs an imaging-based assay across multiple instruments. Each run produces a rich pipeline output with hundreds of metrics. Pyxa OS unifies run-level data with cross-functional events (software releases, instrument deployments, experiment campaigns).

DATA AT YOUR DISPOSAL
RUN_DATA: 237 runs from 2026-02-05 to 2026-04-29.

Per-run fields available to you:
  Identifiers:  id, date, instrument (e.g. PYXA_ALPHA5, PX26P00002), instrument_family (Alpha/Beta/Production), experiment_type, version, thickness, region
  Quality:      probe_fdr, gene_fdr, bio_percentage
  Yield:        mean_tpc, median_tpc, num_cells_after_pos, num_decodes, processed_fov_count, failed_fov_count, CellFilterRatio
  Decode:       DecodeEfficiency, perc_amplicon_in_cell, perc_trans_in_cell
  Spatial:      z_cv_after_pos
  Channels:     c0_avg, c1_avg, c2_avg (averages across the 6-round x 3-channel amplicon intensity matrix; full matrix accessible via the heatmap chart)

Pipeline stages (filter cascade): before_filter → after_vol_count → after_pos → best_chunk. Several metrics (num_cells, mean_tpc, z_cv) are recorded at each stage.

Instrument families:
  Alpha: PYXA_ALPHA{2,4,5,6} (development units)
  Beta: PYXA_BETA{5,6} (pre-production)
  Production: PX26P0000{2,3,4} (production units, online from Mar 2026)

Software versions in chronological order: 1.0.0-rc3, 1.0.0-rc5, 1.0.0, 1.1.0

Run summaries (one row per run):
${JSON.stringify(buildRunSummaries(), null, 1)}

Cross-functional events (software releases, instrument deployments, campaign milestones, tickets):
${JSON.stringify(EVENTS, null, 1)}

YOUR JOB
- Answer the user's question by analyzing the run data.
- Pick visualization panels that make the pattern visible.
- Cite specific run IDs when relevant.
- Be honest about uncertainty. Flag confounds (for example, v1.1.0 was only run on PYXA_ALPHA2, so any v1.1.0 vs v1.0.0 comparison is also a single-instrument comparison).
- Do not invent conclusions. If the data does not support a claim, say so.

AVAILABLE CHART TYPES (return as panels in your JSON response):

1. metric_trend. Line chart of a metric over time, optionally split by a grouping field.
   params: { metric, color_by?: "instrument_family"|"version"|"experiment_type", filter?: { date_after, date_before, instrument_family, version, experiment_type, instrument, thickness, region } }

2. amplicon_heatmap. 6-round x 3-channel intensity matrix, comparing groups side by side.
   params: { groups: [{ label: string, filter: {...} }, ...] }

3. channel_breakdown. c0/c1/c2 average intensities over time as separate lines.
   params: { filter?: {...} }

4. box_compare. Box plots split by group, optionally faceted by a second factor.
   params: { metric, group_by, facet_by?, filter? }

5. interaction_grid. 2D faceted strip plot showing metric distribution split by two factors. Best for revealing interactions.
   params: { metric, row_factor, col_factor, row_values?, col_values?, filter? }

6. scatter_correlation. Metric A vs metric B.
   params: { x_metric, y_metric, color_by?, filter? }

7. filter_pipeline. Shows how a metric family (cells / TPC / z_cv) changes across pipeline stages: before_filter → after_vol_count → after_pos → best_chunk.
   params: { metric_family: "cells"|"tpc"|"zcv", group_by?: "instrument_family"|"version"|"experiment_type", filter? }

Filter values can be a single value or an array (OR within the field).

Available metrics (any of these can be used for "metric", "x_metric", "y_metric"):
  mean_tpc, median_tpc, num_cells_after_pos, num_decodes, DecodeEfficiency,
  perc_amplicon_in_cell, perc_trans_in_cell, bio_percentage, z_cv_after_pos,
  failed_fov_count, processed_fov_count, CellFilterRatio,
  probe_fdr, gene_fdr, c0_avg, c1_avg, c2_avg

OUTPUT FORMAT. Respond with ONLY a valid JSON object, no markdown fences, no preamble:

{
  "summary": "1-2 sentence top-line answer. Use markdown emphasis (*word*) for the most critical term.",
  "key_finding": "Single most important insight, phrased actionably. 1-2 sentences. Be honest about what the data does and does not show.",
  "panels": [
    { "chart_type": "...", "title": "...", "caption": "What this shows.", "params": { ... } }
  ],
  "evidence": [
    { "id": "R-XXXX or event description", "date": "YYYY-MM-DD", "observation": "Concise note." }
  ],
  "followups": ["Suggested follow-up question 1", "..."]
}

Include 1 to 3 panels. Pick the chart type that makes the pattern most obvious. Captions should explain what to look for.`;

const askPyxa = async (query) => {
  const response = await fetch('/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system: buildSystemPrompt(),
      messages: [{ role: 'user', content: query }]
    })
  });
  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || `Request failed with status ${response.status}`);
  }
  const data = await response.json();
  const text = data.content
    .map(b => b.type === 'text' ? b.text : '')
    .join('')
    .replace(/```json|```/g, '')
    .trim();
  return JSON.parse(text);
};

// ============================================================
// SUGGESTED QUERIES
// ============================================================

const SUGGESTED_QUERIES = [
  "How does Decode Efficiency change across software versions 1.0.0-rc3 to 1.1.0?",
  "Compare DVT-100um vs DVT-20um. Which thickness gives better TPC and cell yield?",
  "Are production instruments (PX26P) achieving parity with Alpha development units?",
  "Show how cell counts shrink through the filter pipeline by instrument family.",
];

// ============================================================
// UI COMPONENTS
// ============================================================

const renderEmphasis = (text) => {
  if (!text) return null;
  const parts = text.split(/(\*[^*]+\*)/g);
  return parts.map((p, i) => p.startsWith('*') && p.endsWith('*')
    ? <em key={i}>{p.slice(1, -1)}</em>
    : p);
};

const Header = ({ runCount }) => (
  <div className="header">
    <div className="brand">
      <h1 className="serif">Pyxa<em>OS</em></h1>
      <p>Product development operating system. 235-gene panel, multi-instrument fleet.</p>
    </div>
    <div className="status">
      <div className="status-row">
        <span className="dot"></span>
        <span>{runCount} runs · {EVENTS.length} events · 4 source systems</span>
      </div>
      <div className="status-row" style={{ color: '#A8A4A0' }}>
        Last sync: 2026-04-29 14:22 UTC
      </div>
    </div>
  </div>
);

const Sources = () => (
  <div className="sources">
    {[
      { label: "Pipeline outputs", value: "S3 + per-run JSON" },
      { label: "Run metadata DB", value: "Postgres (LIMS)" },
      { label: "Instruments",     value: "Fleet telemetry" },
      { label: "Software",        value: "Git + deploy logs" }
    ].map(s => (
      <div key={s.label} className="source-cell">
        <div className="source-label">{s.label}</div>
        <div className="source-value">{s.value}</div>
      </div>
    ))}
  </div>
);

// Filter bar with chips for instrument family / version / experiment type / thickness
const FilterBar = ({ filter, setFilter, totalCount, filteredCount }) => {
  const toggle = (key, val) => {
    setFilter(f => {
      const cur = f[key] || [];
      const next = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val];
      return { ...f, [key]: next };
    });
  };
  const isActive = (key, val) => (filter[key] || []).includes(val);
  const clear = () => setFilter({});
  const hasAny = Object.values(filter).some(v => Array.isArray(v) ? v.length > 0 : v != null);

  // Counts in unfiltered set, useful as informational suffix on chips
  const counts = (key, val) => RUNS.filter(r => r[key] === val).length;

  const Section = ({ label, dimKey, values }) => (
    <div className="filter-row">
      <div className="filter-row-label">{label}</div>
      <div className="filter-chips">
        {values.map(v => (
          <button key={v}
                  className={`chip ${isActive(dimKey, v) ? 'active' : ''}`}
                  onClick={() => toggle(dimKey, v)}>
            {paletteFor(dimKey) && (
              <span className="swatch" style={{ background: paletteFor(dimKey)[v] }} />
            )}
            <span>{v}</span>
            <span className="count">·{counts(dimKey, v)}</span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="filter-bar">
      <div className="filter-header">
        <div className="filter-eyebrow">Filter the run set</div>
        <div>
          <span className="filter-count">
            <em>{filteredCount}</em> of {totalCount} runs
          </span>
          {hasAny && <button className="filter-clear" onClick={clear}>Clear all</button>}
        </div>
      </div>
      <Section label="Instrument" dimKey="instrument_family" values={ALL_INSTRUMENT_FAMILIES} />
      <Section label="Version"    dimKey="version"           values={ALL_VERSIONS} />
      <Section label="Experiment" dimKey="experiment_type"   values={ALL_EXPERIMENTS} />
      <Section label="Thickness"  dimKey="thickness"         values={[100, 20]} />
    </div>
  );
};

// KPI cards summarizing the filtered run set
const KPICards = ({ runs }) => {
  const computeStats = (key) => {
    const vals = runs.map(r => r[key]).filter(v => v != null);
    return vals.length ? stats(vals) : null;
  };

  const tpc = computeStats('mean_tpc');
  const dec = computeStats('DecodeEfficiency');
  const cells = computeStats('num_cells_after_pos');
  const zcv = computeStats('z_cv_after_pos');
  const failedRuns = runs.filter(r => (r.failed_fov_count || 0) > 0).length;
  const failedPct = runs.length ? (failedRuns / runs.length * 100) : 0;

  const fmt = (s, d = 1) => s == null ? '—' : (s.mean < 5 ? s.mean.toFixed(2) : s.mean.toLocaleString(undefined, { maximumFractionDigits: d }));

  const cards = [
    { label: 'Runs',        value: runs.length.toLocaleString(), sub: runs.length ? `${[...new Set(runs.map(r => r.date))].length} run-days` : '—' },
    { label: 'Mean TPC',    value: fmt(tpc, 1),                  sub: tpc ? `± ${tpc.sd.toFixed(1)}` : '—' },
    { label: 'Decode eff.', value: dec ? fmt(dec) + '%' : '—',   sub: dec ? `n=${dec.n}` : '—' },
    { label: 'Cells / run', value: cells ? Math.round(cells.mean).toLocaleString() : '—', sub: cells ? `median ${Math.round(cells.median).toLocaleString()}` : '—' },
    { label: 'z_cv (pos)',  value: fmt(zcv, 2),                  sub: zcv ? `range ${zcv.min.toFixed(2)}–${zcv.max.toFixed(2)}` : '—' },
    { label: 'FOV-fail rate', value: failedPct.toFixed(0) + '%', sub: `${failedRuns} of ${runs.length} runs` },
  ];

  return (
    <div className="kpis">
      {cards.map(c => (
        <div key={c.label} className="kpi">
          <div className="kpi-label">{c.label}</div>
          <div className="kpi-value">{c.value}</div>
          <div className="kpi-sub">{c.sub}</div>
        </div>
      ))}
    </div>
  );
};

// Three always-on dashboard charts that respond to the filter
const DashboardCharts = ({ runs }) => {
  if (runs.length === 0) {
    return (
      <div className="dashboard-grid">
        <div className="dashboard-tile full">
          <div className="empty-state">No runs match the current filter. Clear filters to see data.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-grid">
      <div className="dashboard-tile">
        <div className="tile-head">
          <div className="tile-title serif">Mean TPC over time</div>
          <div className="tile-sub">colored by version</div>
        </div>
        <TrendChart runs={runs} params={{ metric: 'mean_tpc', color_by: 'version' }} />
      </div>

      <div className="dashboard-tile">
        <div className="tile-head">
          <div className="tile-title serif">Decode efficiency by experiment</div>
          <div className="tile-sub">box plots, n per group</div>
        </div>
        <BoxCompareChart runs={runs} params={{ metric: 'DecodeEfficiency', group_by: 'experiment_type' }} />
      </div>

      <div className="dashboard-tile full">
        <div className="tile-head">
          <div className="tile-title serif">Round x channel intensity</div>
          <div className="tile-sub">averaged across the filtered set, split by instrument family</div>
        </div>
        <HeatmapPanel
          runs={runs}
          params={{
            groups: [...new Set(runs.map(r => r.instrument_family))]
              .sort((a, b) => FAMILY_ORDER.indexOf(a) - FAMILY_ORDER.indexOf(b))
              .map(fam => ({ label: fam, filter: { instrument_family: fam } })),
          }}
        />
      </div>
    </div>
  );
};

const QueryInterface = ({ query, setQuery, onSubmit, loading }) => (
  <div className="query-section">
    <div className="query-eyebrow">Ask the system</div>
    <div className="query-input-wrap">
      <input
        className="query-input" type="text"
        placeholder="Why does v1.1.0 show different decode efficiency than v1.0.0..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !loading && query.trim()) onSubmit(query); }}
        disabled={loading}
      />
      <button className="query-button" onClick={() => onSubmit(query)} disabled={loading || !query.trim()}>
        {loading ? 'Thinking…' : 'Ask'}
      </button>
    </div>
    <div className="suggested">
      {SUGGESTED_QUERIES.map(q => (
        <button key={q} className="suggested-card" onClick={() => onSubmit(q)} disabled={loading}>
          {q}
        </button>
      ))}
    </div>
  </div>
);

const Loading = ({ runCount }) => (
  <div className="loading">
    <div className="spinner"></div>
    <span>Analyzing run-level metrics across {runCount} runs and {EVENTS.length} events…</span>
  </div>
);

const Answer = ({ answer, onFollowup }) => {
  if (!answer) return null;
  if (answer.error) {
    return (
      <div className="answer">
        <div className="answer-eyebrow">Error</div>
        <p style={{ color: '#6E6E78' }}>{answer.error}</p>
      </div>
    );
  }
  return (
    <div className="answer">
      <div className="answer-eyebrow">Answer</div>
      <div className="answer-summary serif">{renderEmphasis(answer.summary)}</div>

      {answer.key_finding && (
        <div className="key-finding">
          <div className="key-finding-label">Key finding</div>
          <div className="key-finding-text">{answer.key_finding}</div>
        </div>
      )}

      {answer.panels?.length > 0 && (
        <div>
          <div className="panel-section-header">Visualizations ({answer.panels.length})</div>
          {answer.panels.map((p, i) => <Panel key={i} panel={p} runs={RUNS} />)}
        </div>
      )}

      {answer.evidence?.length > 0 && (
        <>
          <div className="panel-section-header">Evidence</div>
          <div className="evidence-list">
            {answer.evidence.map((e, i) => (
              <div key={i} className="evidence-item">
                <span className="evidence-id mono">{e.id}</span>
                <span className="evidence-date mono">{e.date}</span>
                <span className="evidence-obs">{e.observation}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {answer.followups?.length > 0 && (
        <>
          <div className="panel-section-header">Follow up</div>
          <div className="followups">
            {answer.followups.map((f, i) => (
              <button key={i} className="followup-chip" onClick={() => onFollowup(f)}>
                {f}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const Timeline = () => {
  const sorted = [...EVENTS].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="timeline-section">
      <div className="timeline-header">
        <div className="timeline-title serif">Cross-functional pulse</div>
        <div className="timeline-subtitle">Feb. through Apr. 2026</div>
      </div>
      <div className="timeline">
        {sorted.map((e, i) => (
          <div key={i} className="timeline-row">
            <div className="timeline-date">{e.date}</div>
            <div className="timeline-marker" data-type={e.type}></div>
            <div>
              <div className="timeline-event-title">{e.title}</div>
              {e.details && <div className="timeline-event-details">{e.details}</div>}
              <div className="timeline-event-source">{e.source} · {e.type}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================
// MAIN APP
// ============================================================

export default function App() {
  const [filter, setFilter] = useState({});
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);

  const filteredRuns = useMemo(() => filterRuns(RUNS, filter), [filter]);

  const handleQuery = async (q) => {
    if (!q?.trim()) return;
    setQuery(q);
    setLoading(true);
    setAnswer(null);
    try {
      const result = await askPyxa(q);
      setAnswer(result);
    } catch (err) {
      console.error(err);
      setAnswer({ error: err.message || 'Could not parse response. Try rephrasing the question.' });
    }
    setLoading(false);
  };

  return (
    <>
      <style>{STYLES}</style>
      <div className="app">
        <div className="shell">
          <Header runCount={RUNS.length} />
          <Sources />
          <FilterBar
            filter={filter}
            setFilter={setFilter}
            totalCount={RUNS.length}
            filteredCount={filteredRuns.length}
          />
          <KPICards runs={filteredRuns} />
          <DashboardCharts runs={filteredRuns} />

          <QueryInterface
            query={query}
            setQuery={setQuery}
            onSubmit={handleQuery}
            loading={loading}
          />
          {loading && <Loading runCount={RUNS.length} />}
          {answer && !loading && <Answer answer={answer} onFollowup={handleQuery} />}

          <Timeline />
          <div className="foot">
            <span>Pyxa OS · v0.3 mockup</span>
            <span>235-gene panel · {RUNS.length} runs · {[...new Set(RUNS.map(r => r.instrument))].length} instruments</span>
          </div>
        </div>
      </div>
    </>
  );
}
