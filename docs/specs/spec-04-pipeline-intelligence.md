# Phase 4: Pipeline Intelligence — Better Signals, Better Content

**Priority**: Medium
**Depends on**: Phase 1 (UI Cleanup)
**Goal**: Pipelines produce AI-relevant content, not random news. Operator can monitor and configure.

---

## Problem

Current pipelines ingest everything from their sources without AI-relevance filtering:
- **Signal Amplifier** (RSS + HackerNews): Pulls general tech news → gets chimpanzee research, WireGuard releases
- **Release Radar** (HackerNews): Same issue — general HN stories, not AI releases
- **GitHub Trends**: Better (repos are more tech-focused) but still mixed

The `pillar_slug` is hardcoded to `breaking-ai-news` for all pipelines regardless of content.

---

## Features

### 1. AI Relevance Scoring

Add a relevance check before signals become content:
- Score each signal 0-10 for AI/ML/tech relevance
- Use keyword matching first (fast, free): check title + summary for AI keywords
- Optionally use LLM scoring (slower, costs tokens): ask the model "Is this about AI? Score 0-10"
- Filter out signals below threshold (e.g., score < 5)

**Implementation**: Add a `scoreRelevance()` step to the pipeline engine between `dedup` and `filter`.

### 2. Configurable Pillar Assignment

Instead of hardcoding `breaking-ai-news`, let the pipeline definition specify which pillar its content belongs to. Or better: let the LLM pick the most appropriate pillar from the 7 available.

### 3. Pipeline Run Detail View

**Route**: `/pipelines/[slug]/runs/[runId]`

Shows:
- Run metadata (started, completed, duration, status)
- Step-by-step logs from `pipeline_logs` table
- Signals that were ingested (with titles, URLs)
- Content items generated (links to review)
- Errors if any

### 4. Pipeline Configuration (Read-Only First)

On the pipeline detail page (`/pipelines/[slug]`), show:
- Current cron schedule (from vercel.json or pipeline definition)
- Source adapters used
- Target platforms
- Filter settings

**Don't build an editor yet** — just display the current config so the operator understands what each pipeline does.

### 5. Manual Trigger with UI Feedback

The "Run Now" button from Phase 2 should:
- Show a loading spinner while running
- Display results when done (signals ingested, items generated, errors)
- Link to the new content items for immediate review

---

## Pipeline Engine Changes

### New pipeline step: `scoreRelevance`

```
ingest → dedup → scoreRelevance → filter → generate → finalize
```

- Input: deduped signals
- Process: score each signal for AI relevance (keyword + optional LLM)
- Output: signals with relevance score, filtered by threshold
- Config: `relevanceThreshold` in pipeline definition (default: 5)

### AI Keywords List

```
ai, artificial intelligence, machine learning, ml, deep learning, 
llm, large language model, gpt, claude, gemini, transformer,
neural network, diffusion, embedding, rag, retrieval augmented,
agent, agentic, fine-tuning, training, inference, gpu, cuda,
openai, anthropic, google deepmind, meta ai, mistral, hugging face
```

---

## Files

| Action | File |
|--------|------|
| Modify | `packages/pipelines/src/engine/runner.ts` (add relevance scoring step) |
| Create | `packages/pipelines/src/engine/relevance.ts` (scoring logic) |
| Modify | Pipeline definitions to include relevance config |
| Create | `apps/web/src/app/(dashboard)/pipelines/[slug]/runs/[runId]/page.tsx` |
| Modify | `apps/web/src/app/(dashboard)/pipelines/[slug]/page.tsx` (add config display) |
| Modify | `apps/web/src/lib/queries/pipelines.ts` (add getPipelineLogs, getRunDetail) |

---

## Testing

- Run github-trends → verify only AI-related repos produce content
- Run signal-amplifier → verify non-AI news is filtered out
- Check pipeline detail page shows real config
- Check run detail page shows logs and signal list
- Manual trigger shows results in UI
