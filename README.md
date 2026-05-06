# Pyxa OS — Demo

An AI-driven product development operating system mockup for spatial transcriptomics. Demonstrates how a unified data layer plus an LLM access layer can surface multi-factor patterns across run-level metrics, manufacturing lot transitions, pipeline versions, and operator metadata.

## What this is

A single-page web app with:

- **Mock data** for 25 runs across the (pipeline × gene panel lot) matrix, with full pipeline output JSON (round × channel amplicon intensities, TPC, decode counts, etc.) generated from a model that encodes a multi-factor hypothesis.
- **Natural-language interface** powered by Claude. Asks like "decompose recent failures by channel and round" return structured answers with cited runs and dynamically generated charts.
- **Six chart types** (time series, round × channel heatmap, channel breakdown, faceted box plots, interaction grid, scatter correlation) that the AI selects from based on the question.
- **Cross-functional pulse** showing chemistry releases, pipeline updates, manufacturing lot transitions, tickets, and milestones.

The AI doesn't compute numbers. It picks chart types and parameters; the frontend does the actual filtering and aggregation. Every claim ties back to specific runs.

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

The browser never sees the key. The component calls `/api/ask`, which is a Next.js server-side route (in `pages/api/ask.js`) that reads `ANTHROPIC_API_KEY` from the environment and forwards the request to Anthropic. This is the standard pattern for any LLM-backed web app.

If you deploy this to Vercel (one-click from a GitHub repo), set `ANTHROPIC_API_KEY` in the Vercel project's environment variables and it will work the same way in production.

## Project structure

```
pyxa-os-demo/
├── pages/
│   ├── _app.js              # Next.js app wrapper
│   ├── index.js             # Home page (renders PyxaOS component)
│   └── api/
│       └── ask.js           # Server-side proxy to Anthropic API
├── components/
│   └── PyxaOS.jsx           # The full mockup (data, charts, UI)
├── package.json
├── next.config.mjs
├── .env.local.example       # Copy to .env.local and add your API key
├── .gitignore
└── README.md
```

## Try these queries

Four pre-built suggested queries walk through the investigation arc. Click them in order:

1. *"Mean TPC has been dropping for 3 weeks. What's driving it?"* — sets up the aggregate symptom and surfaces candidate causes.
2. *"Decompose recent failures by channel and round. Anything unusual?"* — produces the round × channel heatmap. The c0 column tells the story.
3. *"Is this a lot issue, a pipeline issue, or both?"* — the 2D interaction grid reveals it's neither alone; it's the (new lot × new pipeline) cell that's bad.
4. *"Operator T. Nguyen seems to have more failing runs. Is there an operator effect?"* — controls for tissue type, shows the operator effect dissolves.

Or type any freeform question. The AI will pick chart types based on what it judges most useful.

## Deploying

Easiest path for sharing the demo is Vercel:

1. Push this folder to a GitHub repo.
2. Go to https://vercel.com/new and import the repo.
3. Add `ANTHROPIC_API_KEY` to the project's environment variables in the Vercel dashboard.
4. Deploy. You'll get a URL like `pyxa-os-demo.vercel.app` to share.

## Notes

- The mock data is generated programmatically from a model that encodes the hypothesis (c0 channel intensity drops only when pipeline 2.4.0 runs on lot GP-A52, with an operator/tissue confound layered on). The system has to find the pattern, not retrieve it.
- The component uses inline styles and a `<style>` tag rather than Tailwind, so there's no build-step CSS configuration to worry about.
- Recharts is used for line/scatter/bar charts. Box plots, heatmaps, and the interaction grid are custom SVG.

## Costs

Each query is one Claude Sonnet 4 call, roughly 8-12k input tokens (the system prompt includes the full run dataset) and 1-2k output tokens. At current pricing that's a few cents per query. Plenty for a demo.
