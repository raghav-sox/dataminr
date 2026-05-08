# Pyxa OS, Demo

A spatial transcriptomics product development operating system mockup. Combines a unified run database with an interactive dashboard and an LLM access layer, so you can either explore the data yourself with filters and charts, or ask questions in plain English and let Claude pick the right view.

## What this is

A single page web app with:

- **237 real runs** loaded from a CSV, spanning Feb 5 to Apr 29, 2026. Nine instruments grouped into three families (Alpha dev units, Beta pre-production, Production), four software versions (1.0.0-rc3, 1.0.0-rc5, 1.0.0 GA, 1.1.0), seven experiment types (DVT-100um, DVT-20um, 235-Sequencing, StandardExperiment, PreDVT-100um, SoftwareTest, Custom-Sequencing).
- **Interactive dashboard** with toggle-chip filters across instrument family, software version, experiment type, and tissue thickness. Six KPI cards and three live charts (TPC trend, decode efficiency boxplot, amplicon round x channel heatmap) update as you filter.
- **Natural language interface** powered by Claude Sonnet 4. Ask things like "compare v1.0.0 vs v1.1.0 on TPC" or "show me the filter pipeline drop-off for cells", and the system picks chart types and parameters that fit the question.
- **Seven chart types** the AI can call: time series trend, round x channel heatmap, channel breakdown bars, faceted boxplots, 2D interaction grid, scatter correlation, and a multi-stage filter pipeline chart that shows how a metric evolves through before_filter, after_vol_count, after_pos, and best_chunk stages.
- **Cross-functional timeline** showing software releases, instrument onboarding (PX26P00002 in March, PX26P00004 in April), the DVT campaign kickoff, and the v1.1.0 deployment limited to PYXA_ALPHA2.

The AI does not compute numbers. It picks chart types and parameters from a registry; the frontend filters and aggregates the actual run data. Every claim ties back to specific runs.

## Setup

Requirements: Node.js 18.17 or later, an Anthropic API key.

```bash
# 1. Install dependencies
npm install

# 2. Add your API key
cp .env.local.example .env.local
# then edit .env.local and paste your Anthropic API key

# 3. Run the dev server
npm run dev
```

Open http://localhost:3000 in a browser.

Get an API key from https://console.anthropic.com/

## How the API key is handled

The browser never sees the key. The component calls `/api/ask`, which is a Next.js server side route (in `pages/api/ask.js`) that reads `ANTHROPIC_API_KEY` from the environment and forwards the request to Anthropic. Standard pattern for any LLM-backed web app.

If you deploy to Vercel (one click from a GitHub repo), set `ANTHROPIC_API_KEY` in the project's environment variables and it will work the same way in production.

## Project structure

```
pyxa-os-demo/
├── pages/
│   ├── _app.js              # Next.js app wrapper
│   ├── index.js             # Home page (renders PyxaOS component)
│   └── api/
│       └── ask.js           # Server-side proxy to Anthropic API
├── components/
│   └── PyxaOS.jsx           # The full mockup (charts, filters, AI panel, story)
├── data/
│   └── runs.json            # 237 runs derived from the CSV, with full pipeline metrics
├── package.json
├── next.config.mjs
├── .env.local.example       # Copy to .env.local and add your API key
├── .gitignore
└── README.md
```

## How to use it

There are two complementary entry points:

**1. The dashboard** (always on, top of page). Click the chips in the filter bar to narrow the dataset. KPI cards and the three charts below recompute. Useful for browsing: "what does v1.0.0 look like on the production instruments only?"

**2. The AI panel** (lower section). Type a question or click one of the four suggested queries:

1. *"Mean TPC moved over the release cycle. How does it look across rc3, rc5, 1.0.0, and 1.1.0?"* covers the headline question across version progression.
2. *"Compare DVT-20um and DVT-100um. Are the thinner sections giving cleaner signal?"* tests the DVT campaign hypothesis.
3. *"Are the Alpha dev units, Beta pre-prod, and Production instruments giving consistent decode efficiency?"* checks instrument family parity.
4. *"Walk me through the filter pipeline for cells. Where are we losing the most?"* drills into the multi-stage filter (before_filter to best_chunk).

The AI gets a compacted summary of all 237 runs in its system prompt, around 17k tokens. It returns a short prose answer plus a chart spec that the frontend renders.

## The data

The CSV had 237 rows and 87 columns. Every row is one experiment run. The fields used in the app:

- **Identity**: run_id, date, instrument, instrument_family, well, experiment_type, version, region, thickness
- **Quality flags**: probe_fdr, gene_fdr (with "_pass" booleans)
- **Yield metrics**: mean_tpc, median_tpc, num_cells (at four pipeline stages: before_filter, after_vol_count, after_pos, best_chunk), z_cv (coefficient of variation, also at four stages)
- **Decode metrics**: DecodeEfficiency, num_decodes, perc_amplicon_in_cell, failed_fov_count
- **Tissue**: tissue_size_x_um, tissue_size_y_um
- **Amplicon intensities**: 6 rounds x 3 channels = 18 values per run, used for the heatmap and channel breakdown

A few interesting structural facts visible in the data:

- Software version 1.1.0 was only run on PYXA_ALPHA2 and only for 235-Sequencing experiments on April 17. This is a confound: any v1.1.0 vs 1.0.0 comparison is also a single-instrument, single-experiment-type comparison. The AI's system prompt flags this so it doesn't draw spurious conclusions.
- DVT-20um runs show systematically higher mean TPC than DVT-100um (around 138 vs 53 in the dataset), consistent with thinner sections giving cleaner signal.
- The filter pipeline drops cells progressively. before_filter to best_chunk loses roughly 60 to 80 percent of cells, depending on the experiment type.

## Deploying

Easiest path is Vercel:

1. Push this folder to a GitHub repo.
2. Go to https://vercel.com/new and import the repo.
3. Add `ANTHROPIC_API_KEY` to the project's environment variables.
4. Deploy. You'll get a URL like `pyxa-os-demo.vercel.app` to share.

## Notes

- The component uses inline styles plus a `<style>` tag rather than Tailwind, so there's no build-step CSS configuration to worry about.
- Recharts handles line and scatter charts. Box plots, heatmaps, the interaction grid, and the filter pipeline chart are custom SVG.
- Field naming for filter stages is inconsistent in the source CSV (e.g., cells uses `_in_best_chunk` while z_cv uses `_best_chunk`, and TPC has no explicit `before_filter` field so the raw `mean_tpc` is used as that stage). The component handles this with a small field map per metric family. If you swap in a different CSV with different naming, update `FIELD_MAP` in PyxaOS.jsx.
- 313 KB JSON is imported directly rather than fetched. Fine for demo scale; if the dataset grows past a couple of MB, switch to a fetch-based loader.

## Costs

Each query is one Claude Sonnet 4 call, roughly 17k input tokens (the run summary is the bulk of the system prompt) and 1 to 2k output tokens. A few cents per query at current pricing. Plenty for a demo.
