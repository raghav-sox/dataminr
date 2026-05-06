import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ScatterChart, Scatter, ResponsiveContainer, ReferenceLine, Legend,
  ComposedChart
} from 'recharts';

// ============================================================
// CROSS-FUNCTIONAL EVENTS
// ============================================================

const EVENTS = [
  { date: "2024-08-28", type: "chemistry",     title: "Chemistry v3.2 finalized", source: "Chemistry" },
  { date: "2024-10-08", type: "pipeline",      title: "Pipeline v2.4.0 deployed", details: "New cell segmentation model, revised channel-specific normalization", source: "Bioinformatics" },
  { date: "2024-11-15", type: "manufacturing", title: "Gene panel kit lot GP-A52 introduced", details: "Replaces GP-A48. Released after standard QC.", source: "Manufacturing" },
  { date: "2024-11-25", type: "manufacturing", title: "Sample prep kit lot SP-C09 introduced", details: "Replaces SP-B09. Released after standard QC.", source: "Manufacturing" },
  { date: "2024-12-01", type: "ticket",        title: "ENG-453 opened — investigate signal degradation", details: "Bioinformatics flagged downward trend in mean_tpc across late-Nov runs.", source: "Jira" },
  { date: "2024-12-09", type: "milestone",     title: "DVT runs begin", source: "DVT team" },
  { date: "2024-12-13", type: "milestone",     title: "DVT runs missed signal/APA specs", details: "All four DVT runs failed mean_tpc and APA thresholds. Investigation initiated.", source: "DVT" },
  { date: "2024-12-16", type: "investigation", title: "Reprocessing initiated on alternate pipeline", details: "Selected recent samples being re-run through pipeline v2.3.0 to isolate factors.", source: "Bioinformatics" },
];

// ============================================================
// METRICS GENERATOR
// ============================================================

const STANDARD_BASELINE = {
  version: "1.0.5", processed_fov_count: 433, failed_fov_count: 0,
  num_decodes: 57000000, perc_trans_in_cell: 0.76,
  probe_fdr: 0.0054, gene_fdr: 0.0091, num_blank_barcodes: 1,
  neg_detection_rate: 0.0002, blank_detection_rate: 0.0,
  bio_count_fov: 133570, bio_percentage: 0.9997,
  z_cv_before_filter: 0.53, mean_tpc_before_filter: 127.74, median_tpc_before_filter: 101.0,
  num_cells_before_filter: 345514, num_cells_after_vol_count: 323736, num_cells_after_filter: 323736,
  tissue_size_um_after_vol_count: 91.39, z_cv_after_vol_count: 0.48, tpc_z_cv_after_vol_count: 0.29,
  mean_tpc_after_vol_count: 134.74, median_tpc_after_vol_count: 107.0,
  mean_tpc: 134.74, median_tpc: 107.0,
  num_cells_after_pos: 291362, tissue_size_um_after_pos: 69.74,
  z_cv_after_pos: 0.22, tpc_z_cv_after_pos: 0.14,
  mean_tpc_after_pos: 139.72, median_tpc_after_pos: 112.0,
  amplicon_mean_intensity_r0c0: 15.69, amplicon_mean_intensity_r0c1: 42.6, amplicon_mean_intensity_r0c2: 27.47,
  amplicon_mean_intensity_r1c0: 8.53,  amplicon_mean_intensity_r1c1: 29.6, amplicon_mean_intensity_r1c2: 20.75,
  amplicon_mean_intensity_r2c0: 14.91, amplicon_mean_intensity_r2c1: 33.98, amplicon_mean_intensity_r2c2: 10.0,
  amplicon_mean_intensity_r3c0: 6.08,  amplicon_mean_intensity_r3c1: 32.15, amplicon_mean_intensity_r3c2: 15.41,
  amplicon_mean_intensity_r4c0: 10.45, amplicon_mean_intensity_r4c1: 17.63, amplicon_mean_intensity_r4c2: 6.32,
  amplicon_mean_intensity_r5c0: 6.96,  amplicon_mean_intensity_r5c1: 25.6, amplicon_mean_intensity_r5c2: 8.52,
  perc_amplicon_in_cell: 0.77,
  amplicon_per_cell_before_filter: 186.25, amplicon_per_cell_after_filter: 194.56,
};

// Deterministic pseudorandom in [0,1)
const seedRand = (seed) => {
  const x = Math.sin(seed * 12345.678 + 1.234) * 10000;
  return x - Math.floor(x);
};

const round2 = (n) => Math.round(n * 100) / 100;
const round4 = (n) => Math.round(n * 10000) / 10000;

const generateMetrics = ({ scenario, idx, tissue, pipeline }) => {
  const isProblem = scenario === 'problem';
  const isMidbrain = tissue === 'midbrain';

  // Channel c0 multiplier: drops to ~0.50-0.60 of baseline in problem cells
  const c0_mult = isProblem
    ? 0.50 + seedRand(idx + 1) * 0.10
    : 1.0 + (seedRand(idx + 1) - 0.5) * 0.06;

  const tpc_mult = isProblem
    ? 0.78 + seedRand(idx + 2) * 0.06
    : 1.0 + (seedRand(idx + 2) - 0.5) * 0.04;

  const tissue_noise = isMidbrain
    ? 1.0 + (seedRand(idx + 3) - 0.5) * 0.10
    : 1.0 + (seedRand(idx + 3) - 0.5) * 0.04;

  const decodes_mult = isProblem
    ? 0.74 + seedRand(idx + 4) * 0.06
    : 1.0 + (seedRand(idx + 4) - 0.5) * 0.04;

  const m = { ...STANDARD_BASELINE };
  m.version = pipeline === '2.4.0' ? '1.1.0' : '1.0.5';

  // c0 channel degradation across all rounds when problem
  for (let r = 0; r <= 5; r++) {
    const key = `amplicon_mean_intensity_r${r}c0`;
    m[key] = round2(STANDARD_BASELINE[key] * c0_mult * (0.97 + seedRand(idx * 10 + r) * 0.06));
  }
  // c1, c2 stable with small per-run noise
  for (let r = 0; r <= 5; r++) {
    for (let c = 1; c <= 2; c++) {
      const key = `amplicon_mean_intensity_r${r}c${c}`;
      m[key] = round2(STANDARD_BASELINE[key] * (0.96 + seedRand(idx * 10 + r * 3 + c) * 0.08));
    }
  }

  // TPC chain
  m.mean_tpc = round2(STANDARD_BASELINE.mean_tpc * tpc_mult * tissue_noise);
  m.median_tpc = round2(STANDARD_BASELINE.median_tpc * tpc_mult * tissue_noise);
  m.mean_tpc_before_filter = round2(STANDARD_BASELINE.mean_tpc_before_filter * tpc_mult * tissue_noise);
  m.median_tpc_before_filter = round2(STANDARD_BASELINE.median_tpc_before_filter * tpc_mult * tissue_noise);
  m.mean_tpc_after_vol_count = round2(STANDARD_BASELINE.mean_tpc_after_vol_count * tpc_mult * tissue_noise);
  m.median_tpc_after_vol_count = round2(STANDARD_BASELINE.median_tpc_after_vol_count * tpc_mult * tissue_noise);
  m.mean_tpc_after_pos = round2(STANDARD_BASELINE.mean_tpc_after_pos * tpc_mult * tissue_noise);
  m.median_tpc_after_pos = round2(STANDARD_BASELINE.median_tpc_after_pos * tpc_mult * tissue_noise);

  m.num_decodes = Math.round(STANDARD_BASELINE.num_decodes * decodes_mult);
  m.bio_percentage = round4(isProblem
    ? 0.9989 + seedRand(idx + 5) * 0.0008
    : STANDARD_BASELINE.bio_percentage - seedRand(idx + 5) * 0.0003);

  m.perc_trans_in_cell = round2(STANDARD_BASELINE.perc_trans_in_cell + (seedRand(idx + 6) - 0.5) * 0.02);

  // z_cv slightly higher for midbrain (the operator confound source)
  m.z_cv_after_pos = round2(STANDARD_BASELINE.z_cv_after_pos + (isMidbrain ? 0.03 : 0) + (seedRand(idx + 7) - 0.5) * 0.04);
  m.tpc_z_cv_after_pos = round2(STANDARD_BASELINE.tpc_z_cv_after_pos + (isMidbrain ? 0.02 : 0) + (seedRand(idx + 7) - 0.5) * 0.03);

  // Cell counts: midbrain has lower density
  const cell_mult = (isMidbrain ? 0.85 : 1.0) * (0.95 + seedRand(idx + 8) * 0.10);
  m.num_cells_before_filter = Math.round(STANDARD_BASELINE.num_cells_before_filter * cell_mult);
  m.num_cells_after_vol_count = Math.round(STANDARD_BASELINE.num_cells_after_vol_count * cell_mult);
  m.num_cells_after_filter = Math.round(STANDARD_BASELINE.num_cells_after_filter * cell_mult);
  m.num_cells_after_pos = Math.round(STANDARD_BASELINE.num_cells_after_pos * cell_mult);

  // perc_amplicon_in_cell roughly stable
  m.perc_amplicon_in_cell = round2(STANDARD_BASELINE.perc_amplicon_in_cell + (seedRand(idx + 9) - 0.5) * 0.03);
  m.amplicon_per_cell_before_filter = round2(STANDARD_BASELINE.amplicon_per_cell_before_filter * (isProblem ? 0.78 : 1) * tissue_noise);
  m.amplicon_per_cell_after_filter = round2(STANDARD_BASELINE.amplicon_per_cell_after_filter * (isProblem ? 0.80 : 1) * tissue_noise);

  return m;
};

// ============================================================
// RUN DEFINITIONS
// ============================================================

const RUNS_RAW = [
  // === Baseline: pipeline 2.3.0 + GP-A48 ===
  { id: "RUN-1041", date: "2024-08-12", operator: "K. Liu",   tissue: "coronal",  pipeline: "2.3.0", gene_lot: "GP-A48", prep_lot: "SP-B08", scenario: "baseline" },
  { id: "RUN-1042", date: "2024-08-19", operator: "M. Patel", tissue: "coronal",  pipeline: "2.3.0", gene_lot: "GP-A48", prep_lot: "SP-B08", scenario: "baseline" },
  { id: "RUN-1051", date: "2024-09-04", operator: "T. Nguyen",tissue: "midbrain", pipeline: "2.3.0", gene_lot: "GP-A48", prep_lot: "SP-B08", scenario: "baseline" },
  { id: "RUN-1054", date: "2024-09-11", operator: "K. Liu",   tissue: "coronal",  pipeline: "2.3.0", gene_lot: "GP-A48", prep_lot: "SP-B08", scenario: "baseline" },
  { id: "RUN-1058", date: "2024-09-18", operator: "T. Nguyen",tissue: "midbrain", pipeline: "2.3.0", gene_lot: "GP-A48", prep_lot: "SP-B08", scenario: "baseline" },
  { id: "RUN-1063", date: "2024-09-30", operator: "M. Patel", tissue: "coronal",  pipeline: "2.3.0", gene_lot: "GP-A48", prep_lot: "SP-B08", scenario: "baseline" },
  { id: "RUN-1067", date: "2024-10-04", operator: "K. Liu",   tissue: "coronal",  pipeline: "2.3.0", gene_lot: "GP-A48", prep_lot: "SP-B08", scenario: "baseline" },

  // === Pipeline 2.4.0 deployed Oct 8, still GP-A48 ===
  { id: "RUN-1071", date: "2024-10-14", operator: "M. Patel", tissue: "coronal",  pipeline: "2.4.0", gene_lot: "GP-A48", prep_lot: "SP-B09", scenario: "baseline" },
  { id: "RUN-1075", date: "2024-10-21", operator: "T. Nguyen",tissue: "midbrain", pipeline: "2.4.0", gene_lot: "GP-A48", prep_lot: "SP-B09", scenario: "baseline" },
  { id: "RUN-1079", date: "2024-10-28", operator: "K. Liu",   tissue: "coronal",  pipeline: "2.4.0", gene_lot: "GP-A48", prep_lot: "SP-B09", scenario: "baseline" },
  { id: "RUN-1085", date: "2024-11-04", operator: "T. Nguyen",tissue: "midbrain", pipeline: "2.4.0", gene_lot: "GP-A48", prep_lot: "SP-B09", scenario: "baseline" },
  { id: "RUN-1093", date: "2024-11-13", operator: "M. Patel", tissue: "coronal",  pipeline: "2.4.0", gene_lot: "GP-A48", prep_lot: "SP-B09", scenario: "baseline" },

  // === GP-A52 introduced Nov 15 ===
  { id: "RUN-1098", date: "2024-11-19", operator: "K. Liu",   tissue: "coronal",  pipeline: "2.4.0", gene_lot: "GP-A52", prep_lot: "SP-B09", scenario: "problem" },
  { id: "RUN-1102", date: "2024-11-22", operator: "T. Nguyen",tissue: "midbrain", pipeline: "2.4.0", gene_lot: "GP-A52", prep_lot: "SP-B09", scenario: "problem" },
  { id: "RUN-1105", date: "2024-11-25", operator: "M. Patel", tissue: "coronal",  pipeline: "2.4.0", gene_lot: "GP-A52", prep_lot: "SP-C09", scenario: "problem" },
  { id: "RUN-1108", date: "2024-11-27", operator: "K. Liu",   tissue: "coronal",  pipeline: "2.4.0", gene_lot: "GP-A52", prep_lot: "SP-C09", scenario: "problem" },
  { id: "RUN-1111", date: "2024-12-01", operator: "T. Nguyen",tissue: "midbrain", pipeline: "2.4.0", gene_lot: "GP-A52", prep_lot: "SP-C09", scenario: "problem" },
  { id: "RUN-1112", date: "2024-12-02", operator: "M. Patel", tissue: "coronal",  pipeline: "2.4.0", gene_lot: "GP-A52", prep_lot: "SP-C09", scenario: "problem" },
  { id: "RUN-1115", date: "2024-12-05", operator: "T. Nguyen",tissue: "midbrain", pipeline: "2.4.0", gene_lot: "GP-A52", prep_lot: "SP-C09", scenario: "problem" },
  { id: "RUN-1118", date: "2024-12-09", operator: "K. Liu",   tissue: "coronal",  pipeline: "2.4.0", gene_lot: "GP-A52", prep_lot: "SP-C09", scenario: "problem" },
  { id: "RUN-1119", date: "2024-12-10", operator: "T. Nguyen",tissue: "midbrain", pipeline: "2.4.0", gene_lot: "GP-A52", prep_lot: "SP-C09", scenario: "problem" },
  { id: "RUN-1120", date: "2024-12-11", operator: "M. Patel", tissue: "coronal",  pipeline: "2.4.0", gene_lot: "GP-A52", prep_lot: "SP-C09", scenario: "problem" },
  { id: "RUN-1121", date: "2024-12-12", operator: "K. Liu",   tissue: "coronal",  pipeline: "2.4.0", gene_lot: "GP-A52", prep_lot: "SP-C09", scenario: "problem" },

  // === Reprocessing on pipeline 2.3.0 (Dec 16-17) ===
  { id: "RUN-1125", date: "2024-12-16", operator: "K. Liu",   tissue: "coronal",  pipeline: "2.3.0", gene_lot: "GP-A52", prep_lot: "SP-C09", scenario: "baseline" },
  { id: "RUN-1126", date: "2024-12-17", operator: "T. Nguyen",tissue: "midbrain", pipeline: "2.3.0", gene_lot: "GP-A52", prep_lot: "SP-C09", scenario: "baseline" },
];

const RUNS = RUNS_RAW.map((r, i) => ({
  ...r,
  chemistry_version: "v3.2",
  metrics: generateMetrics({ scenario: r.scenario, idx: i, tissue: r.tissue, pipeline: r.pipeline })
}));

// ============================================================
// HELPERS
// ============================================================

const channelAvg = (m, c) => {
  let sum = 0;
  for (let r = 0; r <= 5; r++) sum += m[`amplicon_mean_intensity_r${r}c${c}`];
  return sum / 6;
};

const stats = (vals) => {
  if (!vals.length) return null;
  const sorted = [...vals].sort((a, b) => a - b);
  const q = (p) => {
    const idx = (sorted.length - 1) * p;
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };
  return {
    min: sorted[0], max: sorted[sorted.length - 1],
    q1: q(0.25), median: q(0.5), q3: q(0.75),
    mean: vals.reduce((s, v) => s + v, 0) / vals.length, n: vals.length
  };
};

const filterRuns = (filter = {}) => RUNS.filter(r => {
  if (filter.date_after && r.date < filter.date_after) return false;
  if (filter.date_before && r.date > filter.date_before) return false;
  if (filter.gene_lot && r.gene_lot !== filter.gene_lot) return false;
  if (filter.pipeline && r.pipeline !== filter.pipeline) return false;
  if (filter.tissue && r.tissue !== filter.tissue) return false;
  if (filter.operator && r.operator !== filter.operator) return false;
  return true;
});

// Compact summary passed to AI (not full metrics, just key fields)
const RUN_SUMMARIES = RUNS.map(r => ({
  id: r.id, date: r.date, operator: r.operator, tissue: r.tissue,
  pipeline: r.pipeline, gene_lot: r.gene_lot, prep_lot: r.prep_lot,
  mean_tpc: r.metrics.mean_tpc,
  num_decodes: r.metrics.num_decodes,
  bio_percentage: r.metrics.bio_percentage,
  perc_trans_in_cell: r.metrics.perc_trans_in_cell,
  z_cv_after_pos: r.metrics.z_cv_after_pos,
  num_cells_after_pos: r.metrics.num_cells_after_pos,
  c0_avg: round2(channelAvg(r.metrics, 0)),
  c1_avg: round2(channelAvg(r.metrics, 1)),
  c2_avg: round2(channelAvg(r.metrics, 2)),
}));

// ============================================================
// STYLES
// ============================================================

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Geist:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

* { box-sizing: border-box; margin: 0; padding: 0; }

.app {
  --bg: #F7F4ED;
  --surface: #FFFFFF;
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

.shell { max-width: 1180px; margin: 0 auto; padding: 48px 32px 80px; }

.header {
  display: flex; align-items: flex-end; justify-content: space-between;
  border-bottom: 1px solid var(--border); padding-bottom: 28px; margin-bottom: 36px;
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

.sources {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px;
  background: var(--border); border: 1px solid var(--border); border-radius: 4px;
  margin-bottom: 36px; overflow: hidden;
}
.source-cell { background: var(--surface); padding: 14px 16px; }
.source-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); margin-bottom: 4px; font-weight: 500; }
.source-value { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--ink); font-weight: 500; }

.query-section { margin-bottom: 32px; }
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

.answer { margin-top: 48px; animation: fadeIn 0.4s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
.answer-eyebrow {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em;
  color: var(--muted); margin-bottom: 14px; display: flex;
  align-items: center; gap: 10px; font-weight: 500;
}
.answer-eyebrow:after { content: ''; flex: 1; height: 1px; background: var(--border); }
.answer-summary {
  font-family: 'Fraunces', Georgia, serif; font-variation-settings: 'opsz' 60;
  font-weight: 400; font-size: 28px; line-height: 1.3;
  letter-spacing: -0.015em; color: var(--ink); margin-bottom: 24px;
}
.answer-summary em { font-style: italic; color: var(--accent); }

.key-finding {
  background: var(--accent-soft); border-left: 2px solid var(--accent);
  padding: 18px 22px; margin-bottom: 32px; border-radius: 0 3px 3px 0;
}
.key-finding-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.14em; color: var(--accent); font-weight: 600; margin-bottom: 6px; }
.key-finding-text { font-size: 15px; color: var(--ink); line-height: 1.55; }

.panel-section { margin-bottom: 36px; }
.panel-section-header { font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: var(--muted); font-weight: 500; margin-bottom: 14px; }
.panel {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 4px; padding: 24px; margin-bottom: 16px;
}
.panel-title { font-family: 'Fraunces', Georgia, serif; font-size: 18px; font-weight: 500; letter-spacing: -0.01em; margin-bottom: 6px; }
.panel-caption { font-size: 13px; color: var(--muted); margin-bottom: 18px; line-height: 1.5; }
.panel-body { width: 100%; }

.evidence-list {
  display: flex; flex-direction: column; gap: 1px;
  background: var(--border); border: 1px solid var(--border);
  border-radius: 3px; overflow: hidden; margin-bottom: 32px;
}
.evidence-item {
  background: var(--surface); padding: 14px 18px;
  display: grid; grid-template-columns: 110px 90px 1fr;
  gap: 18px; font-size: 13px; align-items: baseline;
}
.evidence-id { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--accent); font-weight: 500; }
.evidence-date { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--muted); }
.evidence-obs { color: var(--ink-soft); line-height: 1.5; }

.followups { display: flex; flex-wrap: wrap; gap: 8px; }
.followup-chip {
  background: transparent; border: 1px solid var(--border); border-radius: 100px;
  padding: 8px 14px; font-family: 'Geist', sans-serif; font-size: 12px;
  color: var(--ink-soft); cursor: pointer; transition: all 0.15s ease;
}
.followup-chip:hover { border-color: var(--ink); color: var(--ink); }

.loading {
  display: flex; align-items: center; gap: 12px; margin-top: 36px;
  color: var(--muted); font-size: 13px; font-family: 'JetBrains Mono', monospace;
}
.spinner {
  width: 14px; height: 14px; border: 2px solid var(--border);
  border-top-color: var(--accent); border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.timeline-section { margin-top: 80px; }
.timeline-header {
  display: flex; align-items: baseline; justify-content: space-between;
  margin-bottom: 24px; padding-bottom: 14px; border-bottom: 1px solid var(--border);
}
.timeline-title { font-family: 'Fraunces', Georgia, serif; font-weight: 400; font-size: 22px; letter-spacing: -0.01em; }
.timeline-subtitle { font-size: 12px; color: var(--muted); font-family: 'JetBrains Mono', monospace; }
.timeline-row {
  display: grid; grid-template-columns: 100px 24px 1fr;
  gap: 18px; padding: 14px 0; border-bottom: 1px solid var(--border-soft);
  align-items: flex-start;
}
.timeline-row:last-child { border-bottom: none; }
.timeline-date { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--muted); padding-top: 2px; }
.timeline-marker { position: relative; display: flex; justify-content: center; padding-top: 6px; }
.timeline-marker:before {
  content: ''; width: 8px; height: 8px; border-radius: 50%;
  background: var(--surface); border: 1.5px solid var(--ink);
}
.timeline-marker[data-type="manufacturing"]:before { border-color: var(--accent); background: var(--accent); }
.timeline-marker[data-type="ticket"]:before { border-color: var(--warning); background: var(--warning); }
.timeline-marker[data-type="milestone"]:before { border-color: var(--ink); background: var(--ink); }
.timeline-marker[data-type="investigation"]:before { border-color: var(--success); background: var(--success); }
.timeline-event-title { font-size: 14px; color: var(--ink); font-weight: 500; }
.timeline-event-details { font-size: 13px; color: var(--muted); margin-top: 4px; line-height: 1.5; }
.timeline-event-source { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--faint); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.05em; }

.foot {
  margin-top: 80px; padding-top: 24px; border-top: 1px solid var(--border);
  font-size: 11px; color: var(--muted); font-family: 'JetBrains Mono', monospace;
  display: flex; justify-content: space-between;
  text-transform: uppercase; letter-spacing: 0.1em;
}

@media (max-width: 760px) {
  .sources { grid-template-columns: repeat(2, 1fr); }
  .suggested { grid-template-columns: 1fr; }
  .evidence-item { grid-template-columns: 1fr; gap: 4px; }
}
`;

// ============================================================
// CHART COMPONENTS
// ============================================================

const COLORS_LOT = { 'GP-A48': '#2D5A4F', 'GP-A52': '#C7522A' };
const COLORS_PIPELINE = { '2.3.0': '#3A3D4D', '2.4.0': '#C7522A' };
const COLORS_OPERATOR = { 'K. Liu': '#2D5A4F', 'M. Patel': '#3A3D4D', 'T. Nguyen': '#C7522A' };
const COLORS_TISSUE = { 'coronal': '#2D5A4F', 'midbrain': '#C7522A' };
const COLORS_CHANNEL = { 'c0': '#C7522A', 'c1': '#2D5A4F', 'c2': '#3A3D4D' };

const eventDateFor = (key) => {
  const map = {
    'pipeline_240': '2024-10-08', 'lot_a52_intro': '2024-11-15',
    'prep_c09_intro': '2024-11-25', 'dvt_begin': '2024-12-09'
  };
  return map[key];
};
const eventLabelFor = (key) => {
  const map = {
    'pipeline_240': 'Pipeline 2.4.0', 'lot_a52_intro': 'GP-A52 intro',
    'prep_c09_intro': 'SP-C09 intro', 'dvt_begin': 'DVT begin'
  };
  return map[key];
};

// ----- Trend chart -----
const TrendChart = ({ params }) => {
  const filter = params.filter || {};
  const runs = filterRuns(filter);
  const metric = params.metric;
  const colorBy = params.color_by;

  const getValue = (r) =>
    metric === 'c0_avg' ? channelAvg(r.metrics, 0) :
    metric === 'c1_avg' ? channelAvg(r.metrics, 1) :
    metric === 'c2_avg' ? channelAvg(r.metrics, 2) :
    r.metrics[metric];

  const sortedRuns = [...runs].sort((a, b) => a.date.localeCompare(b.date));

  if (sortedRuns.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#6E6E78', fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }}>
        No runs match the filter.
      </div>
    );
  }

  const colorPalette = colorBy === 'gene_lot' ? COLORS_LOT
                     : colorBy === 'pipeline' ? COLORS_PIPELINE
                     : colorBy === 'operator' ? COLORS_OPERATOR
                     : colorBy === 'tissue'   ? COLORS_TISSUE
                     : null;

  // Single-series case
  if (!colorBy) {
    const data = sortedRuns.map(r => ({ date: r.date, value: round2(getValue(r)) }));
    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 16, right: 24, bottom: 8, left: 8 }}>
          <CartesianGrid stroke="#EFEAE0" strokeDasharray="2 2" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6E6E78' }} stroke="#A8A4A0" />
          <YAxis tick={{ fontSize: 11, fill: '#6E6E78' }} stroke="#A8A4A0" domain={['auto', 'auto']} />
          <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E4DFD3', borderRadius: 3, fontSize: 12 }} />
          {(params.annotate_events || []).map(ev => (
            <ReferenceLine key={ev} x={eventDateFor(ev)} stroke="#C7522A" strokeDasharray="3 3"
              label={{ value: eventLabelFor(ev), fill: '#C7522A', fontSize: 10, position: 'top' }} />
          ))}
          <Line type="monotone" dataKey="value" name={metric} stroke="#1B1D2A" strokeWidth={1.6}
                dot={{ r: 3, fill: '#1B1D2A' }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // Multi-series: pivot into wide format so each group is its own column
  const groups = [...new Set(sortedRuns.map(r => r[colorBy]))];
  const dateMap = {};
  sortedRuns.forEach(r => {
    if (!dateMap[r.date]) dateMap[r.date] = { date: r.date };
    dateMap[r.date][r[colorBy]] = round2(getValue(r));
  });
  const data = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 16, right: 24, bottom: 8, left: 8 }}>
        <CartesianGrid stroke="#EFEAE0" strokeDasharray="2 2" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6E6E78' }} stroke="#A8A4A0" />
        <YAxis tick={{ fontSize: 11, fill: '#6E6E78' }} stroke="#A8A4A0" domain={['auto', 'auto']} />
        <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E4DFD3', borderRadius: 3, fontSize: 12 }} />
        {(params.annotate_events || []).map(ev => (
          <ReferenceLine key={ev} x={eventDateFor(ev)} stroke="#C7522A" strokeDasharray="3 3"
            label={{ value: eventLabelFor(ev), fill: '#C7522A', fontSize: 10, position: 'top' }} />
        ))}
        {groups.map(g => (
          <Line key={g} type="monotone" dataKey={g} name={g}
                stroke={(colorPalette && colorPalette[g]) || '#1B1D2A'}
                strokeWidth={1.6} dot={{ r: 3 }} connectNulls />
        ))}
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </LineChart>
    </ResponsiveContainer>
  );
};

// ----- Heatmap (round x channel) -----
const Heatmap = ({ runs, label }) => {
  const matrix = [];
  for (let r = 0; r <= 5; r++) {
    matrix.push([]);
    for (let c = 0; c <= 2; c++) {
      const vals = runs.map(run => run.metrics[`amplicon_mean_intensity_r${r}c${c}`]);
      matrix[r].push(vals.reduce((s, v) => s + v, 0) / Math.max(vals.length, 1));
    }
  }
  const allVals = matrix.flat();
  const vmax = Math.max(...allVals);
  const vmin = Math.min(...allVals);

  // Color: low=accent (warning), high=ink
  const colorFor = (v) => {
    const t = (v - vmin) / Math.max(vmax - vmin, 0.01);
    // interpolate from #FBEDE5 (low) to #1B1D2A (high)
    const lerp = (a, b, t) => Math.round(a + (b - a) * t);
    return `rgb(${lerp(251, 27, t)}, ${lerp(237, 29, t)}, ${lerp(229, 42, t)})`;
  };

  const cellW = 80, cellH = 38, padL = 36, padT = 28;
  const w = padL + cellW * 3 + 8;
  const h = padT + cellH * 6 + 24;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: 320 }}>
      <text x={padL + (cellW * 3) / 2} y={14} textAnchor="middle"
            style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 12, fill: '#1B1D2A' }}>
        {label}
      </text>
      <text x={padL + cellW * 0 + cellW/2} y={padT - 6} textAnchor="middle" style={{ fontSize: 10, fill: '#6E6E78', fontFamily: 'JetBrains Mono, monospace' }}>c0</text>
      <text x={padL + cellW * 1 + cellW/2} y={padT - 6} textAnchor="middle" style={{ fontSize: 10, fill: '#6E6E78', fontFamily: 'JetBrains Mono, monospace' }}>c1</text>
      <text x={padL + cellW * 2 + cellW/2} y={padT - 6} textAnchor="middle" style={{ fontSize: 10, fill: '#6E6E78', fontFamily: 'JetBrains Mono, monospace' }}>c2</text>
      {[0,1,2,3,4,5].map(r => (
        <text key={r} x={padL - 6} y={padT + r * cellH + cellH/2 + 4}
              textAnchor="end" style={{ fontSize: 10, fill: '#6E6E78', fontFamily: 'JetBrains Mono, monospace' }}>
          r{r}
        </text>
      ))}
      {matrix.map((row, r) => row.map((v, c) => {
        const bg = colorFor(v);
        const fg = (v - vmin) / Math.max(vmax - vmin, 0.01) > 0.55 ? '#F7F4ED' : '#1B1D2A';
        return (
          <g key={`${r}-${c}`}>
            <rect x={padL + c * cellW} y={padT + r * cellH} width={cellW - 2} height={cellH - 2} fill={bg} rx={1} />
            <text x={padL + c * cellW + (cellW - 2) / 2} y={padT + r * cellH + cellH / 2 + 4}
                  textAnchor="middle" style={{ fontSize: 11, fill: fg, fontFamily: 'JetBrains Mono, monospace' }}>
              {v.toFixed(1)}
            </text>
          </g>
        );
      }))}
    </svg>
  );
};

const HeatmapPanel = ({ params }) => {
  const groups = params.groups || [];
  return (
    <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
      {groups.map((g, i) => {
        const runs = filterRuns(g.filter);
        return (
          <div key={i}>
            <Heatmap runs={runs} label={`${g.label} (n=${runs.length})`} />
          </div>
        );
      })}
    </div>
  );
};

// ----- Channel breakdown -----
const ChannelBreakdown = ({ params }) => {
  const runs = filterRuns(params.filter || {}).sort((a,b) => a.date.localeCompare(b.date));
  const data = runs.map(r => ({
    date: r.date,
    c0: round2(channelAvg(r.metrics, 0)),
    c1: round2(channelAvg(r.metrics, 1)),
    c2: round2(channelAvg(r.metrics, 2)),
  }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
        <CartesianGrid stroke="#EFEAE0" strokeDasharray="2 2" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6E6E78' }} stroke="#A8A4A0" />
        <YAxis tick={{ fontSize: 11, fill: '#6E6E78' }} stroke="#A8A4A0" />
        <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E4DFD3', borderRadius: 3, fontSize: 12 }} />
        {(params.annotate_events || []).map(ev => (
          <ReferenceLine key={ev} x={eventDateFor(ev)} stroke="#C7522A" strokeDasharray="3 3"
            label={{ value: eventLabelFor(ev), fill: '#C7522A', fontSize: 10, position: 'top' }} />
        ))}
        <Line type="monotone" dataKey="c0" stroke={COLORS_CHANNEL.c0} strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="c1" stroke={COLORS_CHANNEL.c1} strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="c2" stroke={COLORS_CHANNEL.c2} strokeWidth={2} dot={{ r: 3 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </LineChart>
    </ResponsiveContainer>
  );
};

// ----- Box plot (single) -----
const BoxPlot = ({ stats: s, x, w, color, jitterValues = [] }) => {
  if (!s) return null;
  const yScale = (v) => v;
  // Caller provides scaled values; this just draws.
  return (
    <g>
      {/* whiskers */}
      <line x1={x + w/2} y1={yScale(s.min)} x2={x + w/2} y2={yScale(s.q1)} stroke={color} strokeWidth={1} />
      <line x1={x + w/2} y1={yScale(s.q3)} x2={x + w/2} y2={yScale(s.max)} stroke={color} strokeWidth={1} />
      <line x1={x + w*0.25} y1={yScale(s.min)} x2={x + w*0.75} y2={yScale(s.min)} stroke={color} strokeWidth={1} />
      <line x1={x + w*0.25} y1={yScale(s.max)} x2={x + w*0.75} y2={yScale(s.max)} stroke={color} strokeWidth={1} />
      {/* box */}
      <rect x={x + w*0.15} y={yScale(s.q3)} width={w*0.7} height={Math.abs(yScale(s.q1) - yScale(s.q3))} fill={color} fillOpacity={0.2} stroke={color} strokeWidth={1.2} />
      {/* median */}
      <line x1={x + w*0.15} y1={yScale(s.median)} x2={x + w*0.85} y2={yScale(s.median)} stroke={color} strokeWidth={2} />
      {/* points */}
      {jitterValues.map((v, i) => (
        <circle key={i} cx={x + w/2 + (seedRand(i+s.n) - 0.5) * w * 0.4} cy={yScale(v)} r={2.5} fill={color} fillOpacity={0.7} />
      ))}
    </g>
  );
};

const BoxCompareChart = ({ params }) => {
  const runs = filterRuns(params.filter || {});
  const groupBy = params.group_by;
  const facetBy = params.facet_by;
  const metric = params.metric;

  const getMetric = (r) => metric === 'c0_avg' ? channelAvg(r.metrics, 0)
                       : metric === 'c1_avg' ? channelAvg(r.metrics, 1)
                       : metric === 'c2_avg' ? channelAvg(r.metrics, 2)
                       : r.metrics[metric];

  const facetValues = facetBy ? [...new Set(runs.map(r => r[facetBy]))].sort() : [null];
  const groupValues = [...new Set(runs.map(r => r[groupBy]))].sort();

  // Compute global y range
  const allVals = runs.map(getMetric);
  const yMin = Math.min(...allVals) * 0.95;
  const yMax = Math.max(...allVals) * 1.05;

  const W = 720, H = 280, padL = 56, padR = 16, padT = 24, padB = 48;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const yScale = (v) => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const facetW = plotW / facetValues.length;
  const groupW = facetW / (groupValues.length + 1);

  const palette = groupBy === 'operator' ? COLORS_OPERATOR
                : groupBy === 'tissue'   ? COLORS_TISSUE
                : groupBy === 'gene_lot' ? COLORS_LOT
                : groupBy === 'pipeline' ? COLORS_PIPELINE
                : { default: '#1B1D2A' };

  // Y-axis ticks
  const tickCount = 5;
  const ticks = Array.from({ length: tickCount }, (_, i) => yMin + (yMax - yMin) * i / (tickCount - 1));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%">
      {/* grid */}
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} y1={yScale(t)} x2={W - padR} y2={yScale(t)} stroke="#EFEAE0" strokeDasharray="2 2" />
          <text x={padL - 8} y={yScale(t) + 4} textAnchor="end" style={{ fontSize: 10, fill: '#6E6E78', fontFamily: 'JetBrains Mono, monospace' }}>
            {t.toFixed(t < 5 ? 2 : 0)}
          </text>
        </g>
      ))}
      {/* y axis label */}
      <text x={16} y={padT + plotH/2} transform={`rotate(-90 16 ${padT + plotH/2})`} textAnchor="middle"
            style={{ fontSize: 11, fill: '#6E6E78', fontFamily: 'Geist, sans-serif' }}>
        {metric}
      </text>

      {facetValues.map((fv, fi) => {
        const facetX = padL + facetW * fi;
        const facetRuns = facetBy ? runs.filter(r => r[facetBy] === fv) : runs;
        return (
          <g key={fi}>
            {/* facet separator */}
            {fi > 0 && <line x1={facetX} y1={padT} x2={facetX} y2={padT + plotH} stroke="#E4DFD3" />}
            {/* facet label */}
            {facetBy && (
              <text x={facetX + facetW/2} y={H - padB + 28} textAnchor="middle"
                    style={{ fontSize: 11, fill: '#3A3D4D', fontFamily: 'Geist, sans-serif' }}>
                {facetBy}: {fv}
              </text>
            )}
            {/* boxes per group within facet */}
            {groupValues.map((gv, gi) => {
              const groupRuns = facetRuns.filter(r => r[groupBy] === gv);
              if (groupRuns.length === 0) return null;
              const vals = groupRuns.map(getMetric);
              const s = stats(vals);
              const x = facetX + groupW * (gi + 0.5);
              return (
                <g key={gi}>
                  <BoxPlot
                    stats={{ ...s, min: yScale(s.min), max: yScale(s.max), q1: yScale(s.q1), q3: yScale(s.q3), median: yScale(s.median) }}
                    x={x}
                    w={groupW * 0.85}
                    color={palette[gv] || '#1B1D2A'}
                    jitterValues={vals.map(yScale)}
                  />
                  <text x={x + groupW * 0.42} y={H - padB + 14} textAnchor="middle"
                        style={{ fontSize: 10, fill: palette[gv] || '#1B1D2A', fontFamily: 'JetBrains Mono, monospace' }}>
                    {gv} (n={s.n})
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

// ----- Interaction grid (2D faceted strip plot) -----
const InteractionGrid = ({ params }) => {
  const runs = filterRuns(params.filter || {});
  const rowFactor = params.row_factor;
  const colFactor = params.col_factor;
  const rowValues = params.row_values || [...new Set(runs.map(r => r[rowFactor]))].sort();
  const colValues = params.col_values || [...new Set(runs.map(r => r[colFactor]))].sort();
  const metric = params.metric;
  const getMetric = (r) => metric === 'c0_avg' ? channelAvg(r.metrics, 0) : r.metrics[metric];

  const allVals = runs.map(getMetric);
  const yMin = Math.min(...allVals) * 0.95;
  const yMax = Math.max(...allVals) * 1.05;

  const cellW = 240, cellH = 160, gap = 8, labelL = 80, labelT = 28;
  const W = labelL + colValues.length * (cellW + gap);
  const H = labelT + rowValues.length * (cellH + gap) + 40;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 760 }}>
      {/* col headers */}
      {colValues.map((cv, ci) => (
        <text key={ci} x={labelL + ci * (cellW + gap) + cellW/2} y={18}
              textAnchor="middle" style={{ fontSize: 12, fill: '#1B1D2A', fontFamily: 'Geist, sans-serif', fontWeight: 500 }}>
          {colFactor}: {cv}
        </text>
      ))}
      {/* row headers */}
      {rowValues.map((rv, ri) => (
        <text key={ri} x={labelL - 8} y={labelT + ri * (cellH + gap) + cellH/2}
              textAnchor="end" style={{ fontSize: 12, fill: '#1B1D2A', fontFamily: 'Geist, sans-serif', fontWeight: 500 }}>
          {rowFactor}: {rv}
        </text>
      ))}

      {rowValues.map((rv, ri) => colValues.map((cv, ci) => {
        const cellRuns = runs.filter(r => r[rowFactor] === rv && r[colFactor] === cv);
        const cellX = labelL + ci * (cellW + gap);
        const cellY = labelT + ri * (cellH + gap);
        const yScale = (v) => cellY + cellH - 16 - ((v - yMin) / (yMax - yMin)) * (cellH - 24);
        const vals = cellRuns.map(getMetric);
        const s = vals.length > 0 ? stats(vals) : null;

        // Cell background — flag the "bad" combo
        const isBadCell = s && s.median < (yMin + (yMax - yMin) * 0.4);
        return (
          <g key={`${ri}-${ci}`}>
            <rect x={cellX} y={cellY} width={cellW} height={cellH}
                  fill={isBadCell ? '#FBEDE5' : '#FFFFFF'} stroke="#E4DFD3" strokeWidth={1} rx={2} />
            {/* y-axis ticks */}
            {[0.25, 0.5, 0.75].map(p => {
              const v = yMin + (yMax - yMin) * (1 - p);
              return (
                <line key={p} x1={cellX + 6} y1={yScale(v)} x2={cellX + cellW - 6} y2={yScale(v)} stroke="#EFEAE0" strokeDasharray="2 2" />
              );
            })}
            {/* points */}
            {vals.map((v, i) => (
              <circle key={i}
                cx={cellX + cellW/2 + (seedRand(i + ri * 10 + ci) - 0.5) * cellW * 0.4}
                cy={yScale(v)}
                r={3.5}
                fill={isBadCell ? '#C7522A' : '#2D5A4F'}
                fillOpacity={0.75} />
            ))}
            {/* median line */}
            {s && (
              <line x1={cellX + cellW * 0.25} y1={yScale(s.median)} x2={cellX + cellW * 0.75} y2={yScale(s.median)}
                stroke={isBadCell ? '#C7522A' : '#2D5A4F'} strokeWidth={2} />
            )}
            {/* n label */}
            <text x={cellX + cellW - 8} y={cellY + cellH - 6}
                  textAnchor="end" style={{ fontSize: 10, fill: '#6E6E78', fontFamily: 'JetBrains Mono, monospace' }}>
              n={vals.length} {s && `· median ${s.median.toFixed(1)}`}
            </text>
          </g>
        );
      }))}
      {/* metric label */}
      <text x={labelL} y={H - 12} style={{ fontSize: 11, fill: '#6E6E78', fontFamily: 'Geist, sans-serif' }}>
        y-axis: {metric} (range {yMin.toFixed(0)}–{yMax.toFixed(0)})
      </text>
    </svg>
  );
};

// ----- Scatter correlation -----
const ScatterCorrelation = ({ params }) => {
  const runs = filterRuns(params.filter || {});
  const xMetric = params.x_metric;
  const yMetric = params.y_metric;
  const colorBy = params.color_by;

  const getM = (r, m) => m === 'c0_avg' ? channelAvg(r.metrics, 0)
                       : m === 'c1_avg' ? channelAvg(r.metrics, 1)
                       : m === 'c2_avg' ? channelAvg(r.metrics, 2)
                       : r.metrics[m];

  const groups = colorBy ? [...new Set(runs.map(r => r[colorBy]))].sort() : ['all'];
  const palette = colorBy === 'gene_lot' ? COLORS_LOT
                : colorBy === 'pipeline' ? COLORS_PIPELINE
                : colorBy === 'operator' ? COLORS_OPERATOR
                : colorBy === 'tissue' ? COLORS_TISSUE
                : { all: '#1B1D2A' };

  const data = groups.map(g => ({
    name: g,
    color: palette[g] || '#1B1D2A',
    points: runs.filter(r => !colorBy || r[colorBy] === g).map(r => ({
      x: round2(getM(r, xMetric)),
      y: round2(getM(r, yMetric)),
      id: r.id
    }))
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

// ----- Panel router -----
const Panel = ({ panel }) => {
  const { chart_type, title, caption, params } = panel;
  let body;
  switch (chart_type) {
    case 'metric_trend':       body = <TrendChart params={params} />; break;
    case 'amplicon_heatmap':   body = <HeatmapPanel params={params} />; break;
    case 'channel_breakdown':  body = <ChannelBreakdown params={params} />; break;
    case 'box_compare':        body = <BoxCompareChart params={params} />; break;
    case 'interaction_grid':   body = <InteractionGrid params={params} />; break;
    case 'scatter_correlation':body = <ScatterCorrelation params={params} />; break;
    default: body = <div style={{ color: '#C7522A' }}>Unknown chart type: {chart_type}</div>;
  }
  return (
    <div className="panel">
      <div className="panel-title serif">{title}</div>
      {caption && <div className="panel-caption">{caption}</div>}
      <div className="panel-body">{body}</div>
    </div>
  );
};

// ============================================================
// AI BACKEND
// ============================================================

const buildSystemPrompt = () => `You are the Pyxa Product Development Operating System. You analyze run-level data from a spatial transcriptomics platform (250-gene mouse brain product).

Today's date is December 18, 2024.

You have access to these data sources (already loaded for you below).

RUN_DATA — one row per run. Each row has run metadata and key metrics derived from the full pipeline output JSON. Available fields per run: id, date, operator, tissue (coronal/midbrain), pipeline, gene_lot, prep_lot, mean_tpc, num_decodes, bio_percentage, perc_trans_in_cell, z_cv_after_pos, num_cells_after_pos, c0_avg, c1_avg, c2_avg.

The full pipeline output JSON for each run includes the round x channel amplicon intensity matrix (amplicon_mean_intensity_rXcY for r=0..5 and c=0..2). When asked about channel-level patterns, refer to the channel averages c0_avg/c1_avg/c2_avg or request the heatmap visualization.

Run data:
${JSON.stringify(RUN_SUMMARIES, null, 1)}

Cross-functional events (chemistry releases, pipeline updates, manufacturing lot transitions, tickets, milestones):
${JSON.stringify(EVENTS, null, 1)}

YOUR JOB
- Answer the user's question by analyzing run data
- Choose visualization panels that make the pattern visible
- Cite specific run IDs when relevant
- Be honest about uncertainty. Do not invent conclusions.
- Look for confounds. If a pattern looks like operator effect but operators differ in tissue assignment, surface that.

AVAILABLE CHART TYPES (return as panels in your JSON response):

1. metric_trend — line/scatter of a metric over time
   params: { metric: string, color_by?: "gene_lot"|"pipeline"|"operator"|"tissue", annotate_events?: ["pipeline_240"|"lot_a52_intro"|"prep_c09_intro"|"dvt_begin"], filter?: { date_after, date_before, gene_lot, pipeline, tissue, operator } }

2. amplicon_heatmap — round x channel intensity matrix, comparing groups side by side
   params: { groups: [{ label: string, filter: {...} }, ...] }

3. channel_breakdown — c0/c1/c2 average intensity over time as separate lines
   params: { filter?: {...}, annotate_events?: [...] }

4. box_compare — box plots of a metric across groups, optionally faceted to control for a confound
   params: { metric: string, group_by: "operator"|"tissue"|"gene_lot"|"pipeline", facet_by?: "tissue"|"operator"|"gene_lot"|"pipeline", filter?: {...} }

5. interaction_grid — 2D faceted strip plot showing metric distribution split by two factors. Best for revealing interactions.
   params: { metric: string, row_factor, col_factor, row_values?: [...], col_values?: [...], filter?: {...} }

6. scatter_correlation — metric A vs metric B
   params: { x_metric: string, y_metric: string, color_by?: "gene_lot"|"pipeline"|"operator"|"tissue", filter?: {...} }

Available metric names: mean_tpc, num_decodes, bio_percentage, perc_trans_in_cell, z_cv_after_pos, num_cells_after_pos, c0_avg, c1_avg, c2_avg

OUTPUT FORMAT — respond ONLY with a valid JSON object, no markdown fences, no preamble:

{
  "summary": "1-2 sentence top-line answer. Use markdown emphasis (*word*) for the most critical term.",
  "key_finding": "Single most important insight, phrased actionably. 1-2 sentences. Be honest about what the data shows vs. doesn't.",
  "panels": [
    { "chart_type": "...", "title": "...", "caption": "What this shows.", "params": { ... } }
  ],
  "evidence": [
    { "id": "RUN-XXXX or event description", "date": "YYYY-MM-DD", "observation": "Concise note." }
  ],
  "followups": ["Suggested follow-up question 1", "..."]
}

Include 1-3 panels (more if the question genuinely requires it). Pick the chart type that makes the pattern most obvious. Always include captions explaining what to look for.`;

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
  "Mean TPC has been dropping for 3 weeks. What's driving it?",
  "Decompose recent failures by channel and round. Anything unusual?",
  "Is this a lot issue, a pipeline issue, or both?",
  "Operator T. Nguyen seems to have more failing runs. Is there an operator effect?"
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

const Header = () => (
  <div className="header">
    <div className="brand">
      <h1 className="serif">Pyxa<em>OS</em></h1>
      <p>Product Development Operating System · Mouse brain 250-gene</p>
    </div>
    <div className="status">
      <div className="status-row">
        <span className="dot"></span>
        <span>{RUNS.length} runs · {EVENTS.length} events · 4 source systems</span>
      </div>
      <div className="status-row" style={{ color: '#A8A4A0' }}>
        Last sync: 2024-12-18 09:14 UTC
      </div>
    </div>
  </div>
);

const Sources = () => (
  <div className="sources">
    {[
      { label: "Pipeline outputs", value: "S3 + per-run JSON" },
      { label: "Run metadata DB", value: "SQLite per run" },
      { label: "Manufacturing", value: "MFG-DB (lots)" },
      { label: "Software", value: "Git + deploy logs" }
    ].map(s => (
      <div key={s.label} className="source-cell">
        <div className="source-label">{s.label}</div>
        <div className="source-value">{s.value}</div>
      </div>
    ))}
  </div>
);

const QueryInterface = ({ query, setQuery, onSubmit, loading }) => (
  <div className="query-section">
    <div className="query-eyebrow">Ask the system</div>
    <div className="query-input-wrap">
      <input
        className="query-input" type="text"
        placeholder="Why are recent runs missing signal specs..."
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

const Loading = () => (
  <div className="loading">
    <div className="spinner"></div>
    <span>Analyzing run-level metrics across {RUNS.length} runs and {EVENTS.length} events…</span>
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
        <div className="panel-section">
          <div className="panel-section-header">Visualizations ({answer.panels.length})</div>
          {answer.panels.map((p, i) => <Panel key={i} panel={p} />)}
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
        <div className="timeline-subtitle">Aug–Dec 2024</div>
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
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);

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
      setAnswer({ error: 'Could not parse response. Try rephrasing the question.' });
    }
    setLoading(false);
  };

  return (
    <>
      <style>{STYLES}</style>
      <div className="app">
        <div className="shell">
          <Header />
          <Sources />
          <QueryInterface query={query} setQuery={setQuery} onSubmit={handleQuery} loading={loading} />
          {loading && <Loading />}
          {answer && !loading && <Answer answer={answer} onFollowup={handleQuery} />}
          <Timeline />
          <div className="foot">
            <span>Pyxa OS · v0.2 mockup</span>
            <span>Mouse brain 250-gene · Coronal & midbrain</span>
          </div>
        </div>
      </div>
    </>
  );
}
