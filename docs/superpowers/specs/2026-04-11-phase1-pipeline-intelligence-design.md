# Phase 1: Pipeline Intelligence — Fix Content Quality

**Date**: 2026-04-11
**Status**: Approved
**Depends on**: Nothing (first phase)
**Goal**: Pipelines only produce AI-relevant content. Non-AI signals are dropped before content generation.

---

## Problem

All 3 active pipelines hardcode `pillar: 'breaking-ai-news'` but perform no AI-relevance filtering on ingested signals:

- **Signal Amplifier** uses `RSSSignalAdapter` (6 feeds) + `HackerNewsSignalAdapter`. The HN adapter fetches top stories — many are general tech or non-tech entirely. Current filter scores by HN points and comment count, not by topic relevance. Result: content about chimpanzee research, WireGuard releases.

- **Release Radar** uses the same adapters with release-oriented RSS feeds. Its filter looks for release-related terms (changelog, version, launch) but doesn't check if the release is AI-related. Result: any software release triggers content.

- **GitHub Trends** is the least affected — repos tend to be tech-related — but still picks up non-AI repos (e.g., `sponsors/obra` which is a sponsorship page, not a repo).

The filter functions in each pipeline definition (`packages/pipelines/src/tasks/*.ts`) score signals by engagement metrics (stars, HN score, comments) and source-specific signals (official feeds get a boost), but never check whether the content is actually about AI.

## Solution

Add an AI-relevance keyword scoring step to the pipeline runner, between dedup and the existing filter step. This runs for every pipeline and drops signals that aren't about AI before any content is generated.

### Architecture

```
ingest → dedup → [NEW: relevance score] → filter → generate → finalize
```

The new step:
1. Takes deduped signals as input
2. Scores each signal 0-10 based on keyword matches in `title` + `summary`
3. Drops signals below a configurable threshold (default: 3)
4. Logs dropped signals: `"Dropped signal: '{title}' (relevance: {score})"`
5. Passes remaining signals to the existing filter step

### Keyword Scoring Algorithm

```
keywords (weight 1 each):
  ai, artificial intelligence, machine learning, ml, deep learning,
  llm, large language model, gpt, claude, gemini, copilot,
  transformer, neural network, diffusion, stable diffusion,
  embedding, rag, retrieval augmented, vector database,
  agent, agentic, multi-agent, autonomous,
  fine-tuning, fine tuning, training data, inference,
  gpu, cuda, tensor, pytorch, tensorflow, jax,
  openai, anthropic, google deepmind, meta ai, mistral,
  hugging face, huggingface, replicate, together ai,
  computer vision, nlp, natural language processing,
  text-to-image, text-to-speech, speech-to-text,
  chatbot, conversational ai, generative ai, gen ai,
  foundation model, frontier model, open source model,
  prompt engineering, prompt template, chain of thought,
  model context protocol, mcp, function calling, tool use

high-weight keywords (weight 2 each):
  llm, gpt, claude, openai, anthropic, machine learning,
  deep learning, generative ai, large language model

Score = sum of matched keyword weights (capped at 10)
Match is case-insensitive, whole-word or substring in title + summary
```

A signal about "Chimpanzees in Uganda" scores 0 → dropped.
A signal about "OpenAI releases GPT-5" scores 6+ → kept.

### Configuration

Add an optional `relevanceThreshold` field to `PipelineDefinition` in `packages/core/src/types/engine.ts`:

```typescript
export interface PipelineDefinition {
  // ... existing fields ...
  relevanceThreshold?: number;  // 0-10, default 3. Signals below this are dropped.
}
```

Each pipeline definition can override this. Default is 3 (permissive — catches obvious non-AI but lets borderline content through).

### Pipeline Runner Changes

In `packages/pipelines/src/engine/runner.ts`, after the dedup step and before the filter step, add:

```typescript
// Score relevance (insert after dedup, before filter — around line 89 of runner.ts)
await logPipelineStep(db, runId, 'relevance', 'info', `Scoring ${newSignals.length} signals for AI relevance`);
const relevantSignals = scoreRelevance(newSignals, definition.relevanceThreshold ?? 3);
await logPipelineStep(db, runId, 'relevance', 'info', `${relevantSignals.length} signals passed relevance check (${newSignals.length - relevantSignals.length} dropped)`);

// IMPORTANT: The existing filter step (line 92) currently calls `definition.filter(newSignals, {})`.
// After inserting this step, change it to `definition.filter(relevantSignals, {})` so that
// the filter operates on relevance-checked signals, not the raw deduped set.
```

### GitHub Trends URL Fix

The `scrapeGitHubTrending()` function in `packages/integrations/src/github/client.ts` (private/non-exported, line 60) still captures non-repo paths like `sponsors/obra`. The existing guard (line 102: `if (fullName.startsWith('login') || !fullName.includes('/')) continue;`) catches login redirects but not `sponsors/*`. Strengthen the validation: the `fullName` must have exactly 2 segments when split by `/`, both non-empty, and not match known non-repo prefixes (`sponsors`, `orgs`, `settings`, `login`). Skip entries that look like profile pages, sponsor pages, or other non-repo paths.

## Cleanup

- Delete `docs/TODO-manual-steps.md` — references Trigger.dev which is removed
- Delete `docs/specs/` directory — old rough drafts replaced by these specs
- Delete old failed pipeline run data from Supabase: `DELETE FROM pipeline_runs WHERE status = 'failed'` and their associated logs and content signals with login redirect URLs

## Files

| Action | File | What changes |
|--------|------|-------------|
| Create | `packages/pipelines/src/engine/relevance.ts` | `scoreRelevance()` function with keyword list |
| Modify | `packages/pipelines/src/engine/runner.ts` | Add relevance step between dedup and filter |
| Modify | `packages/core/src/types/engine.ts` | Add optional `relevanceThreshold` to PipelineDefinition |
| Modify | `packages/integrations/src/github/client.ts` | Validate repo paths in scraper |
| Delete | `docs/TODO-manual-steps.md` | Outdated Trigger.dev references |
| Delete | `docs/specs/` | Old rough draft specs |

## Testing

1. Create `scoreRelevance()` with unit tests:
   - Signal "OpenAI releases GPT-5" → score >= 5, kept
   - Signal "Chimpanzees in Uganda locked in civil war" → score 0, dropped
   - Signal "WireGuard makes new Windows release" → score 0-2, dropped
   - Signal "New RAG framework for LLM applications" → score >= 5, kept
   - Edge: signal with AI keyword only in summary, not title → still scores
   - Edge: empty title and summary → score 0, dropped

2. Run each pipeline after the change and verify:
   - `pipeline_logs` shows the new "relevance" step
   - Dropped signals appear in logs
   - Generated content is AI-relevant

3. Verify GitHub scraper filters out `sponsors/*` and other non-repo paths
