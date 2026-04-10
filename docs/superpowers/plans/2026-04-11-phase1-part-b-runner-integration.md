# Phase 1 Part B: Runner Integration, GitHub Scraper Fix, Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the `scoreRelevance()` function from Part A into the pipeline runner between dedup and filter, fix GitHub scraper path validation, and delete the outdated `docs/TODO-manual-steps.md` file.

**Architecture:** The runner gains a new "relevance" step between dedup (step 2) and filter (step 3). It uses the pipeline definition's `relevanceThreshold` (defaulting to 3) to drop non-AI signals early. Dropped signals are logged at warn level. The GitHub scraper gains stricter path validation to reject non-repo URLs.

**Tech Stack:** TypeScript, vitest

**Depends on:** Part A must be completed first (`relevance.ts`, `relevance.test.ts`, and the `relevanceThreshold` type addition).

---

### Task 1: Integrate `scoreRelevance()` into the Pipeline Runner

**Files:**
- Modify: `packages/pipelines/src/engine/runner.ts:19,70-88`
- Modify: `packages/pipelines/src/engine/runner.test.ts`

- [ ] **Step 1: Add a runner test for the relevance step**

Edit `packages/pipelines/src/engine/runner.test.ts` — add the following test inside the existing `describe('runPipeline', ...)` block, after the last `it(...)` block (after the "marks run as failed when ingest throws" test around line 123):

```ts
  it('filters out non-AI-relevant signals before passing to filter step', async () => {
    const mixedSignals: Signal[] = [
      {
        sourceType: 'github',
        sourceId: 'org/ai-tool',
        title: 'New GPT-based LLM framework by OpenAI',
        summary: 'A transformer-based generative AI tool',
        url: 'https://github.com/org/ai-tool',
        metadata: { stars: 2000 },
        fetchedAt: new Date(),
      },
      {
        sourceType: 'github',
        sourceId: 'org/gardening-app',
        title: 'Best gardening tips for your backyard',
        summary: 'A mobile app for plant care',
        url: 'https://github.com/org/gardening-app',
        metadata: { stars: 50 },
        fetchedAt: new Date(),
      },
    ];

    const filterFn = vi.fn().mockResolvedValue([
      { ...mixedSignals[0], score: 95, scoreReason: 'High relevance' },
    ]);

    const defWithMixed: PipelineDefinition = {
      ...mockDefinition,
      ingest: vi.fn().mockResolvedValue(mixedSignals),
      filter: filterFn,
      relevanceThreshold: 3,
    };

    await runPipeline(defWithMixed);

    // filter should only receive the AI-relevant signal, not the gardening one
    expect(filterFn).toHaveBeenCalledTimes(1);
    const passedSignals = filterFn.mock.calls[0][0] as Signal[];
    expect(passedSignals.length).toBe(1);
    expect(passedSignals[0].sourceId).toBe('org/ai-tool');
  });

  it('uses default threshold of 3 when relevanceThreshold is not set', async () => {
    const mixedSignals: Signal[] = [
      {
        sourceType: 'github',
        sourceId: 'org/llm-project',
        title: 'Advanced LLM fine-tuning with Claude',
        summary: 'Deep learning framework for generative AI',
        url: 'https://github.com/org/llm-project',
        metadata: {},
        fetchedAt: new Date(),
      },
      {
        sourceType: 'github',
        sourceId: 'org/cooking-blog',
        title: 'Easy pasta recipes',
        summary: 'Italian cooking tips',
        url: 'https://github.com/org/cooking-blog',
        metadata: {},
        fetchedAt: new Date(),
      },
    ];

    const filterFn = vi.fn().mockResolvedValue([
      { ...mixedSignals[0], score: 90 },
    ]);

    const defNoThreshold: PipelineDefinition = {
      ...mockDefinition,
      relevanceThreshold: undefined,
      ingest: vi.fn().mockResolvedValue(mixedSignals),
      filter: filterFn,
    };

    await runPipeline(defNoThreshold);

    // Should still filter — default threshold 3 drops cooking blog
    const passedSignals = filterFn.mock.calls[0][0] as Signal[];
    expect(passedSignals.length).toBe(1);
    expect(passedSignals[0].sourceId).toBe('org/llm-project');
  });

  it('skips generation when all signals are dropped by relevance', async () => {
    const irrelevantSignals: Signal[] = [
      {
        sourceType: 'github',
        sourceId: 'org/weather-app',
        title: 'Simple weather dashboard',
        summary: 'Shows local weather data',
        url: 'https://github.com/org/weather-app',
        metadata: {},
        fetchedAt: new Date(),
      },
    ];

    const defIrrelevant: PipelineDefinition = {
      ...mockDefinition,
      ingest: vi.fn().mockResolvedValue(irrelevantSignals),
      filter: vi.fn(),
      relevanceThreshold: 3,
    };

    const result = await runPipeline(defIrrelevant);

    // filter should not even be called since all signals were dropped
    expect(defIrrelevant.filter).not.toHaveBeenCalled();
    expect(result.status).toBe('completed');
    expect(result.itemsGenerated).toBe(0);
  });
```

- [ ] **Step 2: Verify new tests fail (relevance not yet wired)**

Run:
```bash
pnpm vitest run packages/pipelines/src/engine/runner.test.ts
```

Expected: The new tests fail because the runner does not yet call `scoreRelevance()`. The gardening/cooking signals still reach the filter function. This confirms TDD red phase.

- [ ] **Step 3: Wire `scoreRelevance()` into `runner.ts`**

Edit `packages/pipelines/src/engine/runner.ts`:

First, add the import. After the existing import of `deduplicateSignals` on line 19:

```ts
import { deduplicateSignals } from './dedup';
import { scoreRelevance } from './relevance';
```

Then, insert the relevance step between the dedup early-return (line 88) and the filter step (line 90). Replace the block from `// STEP 3: FILTER` through the existing filter call:

Find this section (lines 90-95):

```ts
    // STEP 3: FILTER
    await logPipelineStep(db, runId, 'filter', 'info', 'Starting signal filtering');
    const scoredSignals = await definition.filter(newSignals, {});
    const topSignals = scoredSignals.slice(0, definition.generate.topK);
    signalsFiltered = topSignals.length;
    await logPipelineStep(db, runId, 'filter', 'info', `Filtered to top ${topSignals.length} signals`);
```

Replace with:

```ts
    // STEP 2.5: RELEVANCE SCORING
    const relevanceThreshold = definition.relevanceThreshold ?? 3;
    const relevantSignals = scoreRelevance(newSignals, relevanceThreshold);
    const droppedCount = newSignals.length - relevantSignals.length;

    if (droppedCount > 0) {
      await logPipelineStep(
        db,
        runId,
        'relevance',
        'warn',
        `Dropped ${droppedCount} signal(s) below relevance threshold ${relevanceThreshold}`,
      );
    }

    await logPipelineStep(
      db,
      runId,
      'relevance',
      'info',
      `${relevantSignals.length} signal(s) passed relevance scoring (threshold: ${relevanceThreshold})`,
    );

    if (relevantSignals.length === 0) {
      await logPipelineStep(
        db,
        runId,
        'relevance',
        'info',
        'No relevant signals — skipping generation',
      );
      await completePipelineRun(db, runId, {
        status: 'completed',
        signalsIngested,
        signalsFiltered: 0,
        itemsGenerated: 0,
      });
      return {
        runId,
        pipelineId: definition.id,
        status: 'completed',
        signalsIngested,
        signalsFiltered: 0,
        itemsGenerated: 0,
        errors: [],
        durationMs: Date.now() - startTime,
      };
    }

    // STEP 3: FILTER
    await logPipelineStep(db, runId, 'filter', 'info', 'Starting signal filtering');
    const scoredSignals = await definition.filter(relevantSignals, {});
    const topSignals = scoredSignals.slice(0, definition.generate.topK);
    signalsFiltered = topSignals.length;
    await logPipelineStep(db, runId, 'filter', 'info', `Filtered to top ${topSignals.length} signals`);
```

Key changes:
- New import of `scoreRelevance` from `./relevance`
- Relevance step between dedup and filter, using `definition.relevanceThreshold ?? 3`
- Filter now receives `relevantSignals` instead of `newSignals`
- Dropped signals logged at `warn` level
- Early return when all signals dropped by relevance

- [ ] **Step 4: Run tests — expect all to pass**

Run:
```bash
pnpm vitest run packages/pipelines/src/engine/runner.test.ts
```

Expected: All tests pass including the 3 new ones (TDD green phase).

- [ ] **Step 5: Commit**

```bash
git add packages/pipelines/src/engine/runner.ts packages/pipelines/src/engine/runner.test.ts
git commit -m "feat: integrate AI-relevance scoring into pipeline runner

Inserts scoreRelevance() between dedup and filter steps.
Uses definition.relevanceThreshold (default 3) to drop
non-AI signals early. Dropped signals logged at warn level."
```

---

### Task 2: Export `scoreRelevance` from the Pipelines Package

**Files:**
- Modify: `packages/pipelines/src/index.ts`

- [ ] **Step 1: Add the export**

Edit `packages/pipelines/src/index.ts` — add the relevance export after the dedup export:

```ts
export { runPipeline } from './engine/runner';
export { deduplicateSignals } from './engine/dedup';
export { scoreRelevance, scoreSignalRelevance } from './engine/relevance';
export { githubTrendsPipeline } from './tasks/github-trends';
export { signalAmplifierPipeline } from './tasks/signal-amplifier';
export { releaseRadarPipeline } from './tasks/release-radar';
```

- [ ] **Step 2: Verify build**

Run:
```bash
pnpm vitest run
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/pipelines/src/index.ts
git commit -m "feat: export scoreRelevance and scoreSignalRelevance from pipelines package"
```

---

### Task 3: Fix `scrapeGitHubTrending()` Path Validation

**Files:**
- Modify: `packages/integrations/src/github/client.ts:99-103`

- [ ] **Step 1: Write a test for the GitHub scraper validation**

First, check if a test file already exists for the GitHub client. If not, create `packages/integrations/src/github/client.test.ts`. Since `scrapeGitHubTrending` is private and the validation logic is inside it, we test via the exported `fetchTrendingRepos` function indirectly. However, the simpler approach is to extract the validation into a small exported helper.

Create `packages/integrations/src/github/validate-repo-path.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isValidRepoPath } from './validate-repo-path';

describe('isValidRepoPath', () => {
  it('accepts a standard owner/repo path', () => {
    expect(isValidRepoPath('facebook/react')).toBe(true);
  });

  it('accepts paths with hyphens and dots', () => {
    expect(isValidRepoPath('vercel/next.js')).toBe(true);
    expect(isValidRepoPath('hugging-face/transformers')).toBe(true);
  });

  it('rejects paths starting with "login"', () => {
    expect(isValidRepoPath('login?return_to=/trending')).toBe(false);
  });

  it('rejects paths without a slash', () => {
    expect(isValidRepoPath('singleword')).toBe(false);
  });

  it('rejects paths with more than 2 segments', () => {
    expect(isValidRepoPath('org/repo/extra')).toBe(false);
  });

  it('rejects known non-repo prefixes', () => {
    expect(isValidRepoPath('sponsors/someone')).toBe(false);
    expect(isValidRepoPath('orgs/myorg')).toBe(false);
    expect(isValidRepoPath('settings/profile')).toBe(false);
    expect(isValidRepoPath('collections/ai')).toBe(false);
    expect(isValidRepoPath('topics/machine-learning')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidRepoPath('')).toBe(false);
  });

  it('rejects paths with empty segments', () => {
    expect(isValidRepoPath('/repo')).toBe(false);
    expect(isValidRepoPath('org/')).toBe(false);
  });
});
```

- [ ] **Step 2: Verify tests fail (module not found)**

Run:
```bash
pnpm vitest run packages/integrations/src/github/validate-repo-path.test.ts
```

Expected: Fails — module does not exist yet.

- [ ] **Step 3: Create the validation helper**

Create `packages/integrations/src/github/validate-repo-path.ts`:

```ts
const INVALID_PREFIXES = [
  'login',
  'signup',
  'sponsors',
  'orgs',
  'settings',
  'collections',
  'topics',
  'features',
  'marketplace',
  'explore',
  'notifications',
  'new',
  'codespaces',
];

/**
 * Validates that a path extracted from GitHub trending HTML is a real owner/repo path.
 * Rejects login redirects, known GitHub UI paths, and malformed paths.
 */
export function isValidRepoPath(path: string): boolean {
  if (!path || !path.includes('/')) return false;

  const parts = path.split('/');
  if (parts.length !== 2) return false;

  const [owner, repo] = parts;
  if (!owner || !repo) return false;

  if (INVALID_PREFIXES.some((prefix) => owner.toLowerCase().startsWith(prefix))) {
    return false;
  }

  return true;
}
```

- [ ] **Step 4: Run validation tests — expect pass**

Run:
```bash
pnpm vitest run packages/integrations/src/github/validate-repo-path.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Update `scrapeGitHubTrending()` to use the new validator**

Edit `packages/integrations/src/github/client.ts`:

Add the import at the top of the file (after the zod import on line 1):

```ts
import { z } from 'zod';
import { isValidRepoPath } from './validate-repo-path';
```

Then replace the existing guard on lines 100-102:

```ts
      if (fullName.startsWith('login') || !fullName.includes('/')) continue;
```

With the new validator:

```ts
      if (!isValidRepoPath(fullName)) continue;
```

- [ ] **Step 6: Run full test suite**

Run:
```bash
pnpm vitest run
```

Expected: All tests pass, including the new validation tests.

- [ ] **Step 7: Commit**

```bash
git add packages/integrations/src/github/validate-repo-path.ts packages/integrations/src/github/validate-repo-path.test.ts packages/integrations/src/github/client.ts
git commit -m "fix: strengthen GitHub trending path validation

Extract isValidRepoPath() with tests. Rejects known non-repo
prefixes (sponsors, orgs, settings, etc.) and malformed paths
(wrong segment count, empty segments)."
```

---

### Task 4: Delete Outdated `docs/TODO-manual-steps.md`

**Files:**
- Delete: `docs/TODO-manual-steps.md`

- [ ] **Step 1: Delete the file**

```bash
rm docs/TODO-manual-steps.md
```

This file references Trigger.dev which has been replaced by Vercel Cron (see the `2026-04-11-pipeline-automation-vercel-cron.md` plan).

- [ ] **Step 2: Commit**

```bash
git add docs/TODO-manual-steps.md
git commit -m "chore: delete outdated TODO-manual-steps.md

References Trigger.dev which was replaced by Vercel Cron.
Manual verification steps are now in the cron automation plan."
```

---

### Task 5: Final Verification

**Files:** None (testing only)

- [ ] **Step 1: Run the full test suite**

Run:
```bash
pnpm vitest run
```

Expected: All tests pass — the existing dedup and runner tests plus the new relevance tests (14 tests) and validation tests (8 tests).

- [ ] **Step 2: Verify the pipeline engine test output**

Check that the runner tests show:
- `runPipeline > returns a PipelineRunResult with correct structure` — pass
- `runPipeline > calls ingest and filter functions from the definition` — pass
- `runPipeline > generates content for each platform` — pass
- `runPipeline > marks run as completed on success` — pass
- `runPipeline > marks run as failed when ingest throws` — pass
- `runPipeline > filters out non-AI-relevant signals before passing to filter step` — pass
- `runPipeline > uses default threshold of 3 when relevanceThreshold is not set` — pass
- `runPipeline > skips generation when all signals are dropped by relevance` — pass

- [ ] **Step 3: Verify type-check (optional, if available)**

Run:
```bash
pnpm -F @influenceai/web type-check 2>&1 || true
```

This verifies the type changes propagate correctly through the monorepo.

---

## Summary of Changes

| Action | File | What |
|--------|------|------|
| Modify | `packages/pipelines/src/engine/runner.ts` | Insert relevance step between dedup and filter |
| Modify | `packages/pipelines/src/engine/runner.test.ts` | 3 new tests for relevance integration |
| Modify | `packages/pipelines/src/index.ts` | Export `scoreRelevance`, `scoreSignalRelevance` |
| Create | `packages/integrations/src/github/validate-repo-path.ts` | `isValidRepoPath()` helper |
| Create | `packages/integrations/src/github/validate-repo-path.test.ts` | 8 tests for path validation |
| Modify | `packages/integrations/src/github/client.ts` | Use `isValidRepoPath()` in scraper |
| Delete | `docs/TODO-manual-steps.md` | Remove outdated Trigger.dev manual steps |
