# Phase 1 Part A: AI-Relevance Scoring Function — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a `scoreRelevance()` function that scores signals by AI-relevance using keyword matching, and a `scoreSignalRelevance()` helper for individual signals. This function will be inserted between dedup and filter in the pipeline runner (Part B).

**Architecture:** Pure function in `packages/pipelines/src/engine/relevance.ts` that takes an array of `Signal` objects and a threshold, scores each by matching AI-related keywords against `title` and `summary`, and returns only signals meeting the threshold. The `PipelineDefinition` type gains an optional `relevanceThreshold` field.

**Tech Stack:** TypeScript, vitest

---

### Task 1: Write Failing Tests for `scoreRelevance()`

**Files:**
- Create: `packages/pipelines/src/engine/relevance.test.ts`

- [ ] **Step 1: Create the test file with all test cases**

Create `packages/pipelines/src/engine/relevance.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { scoreRelevance, scoreSignalRelevance } from './relevance';
import type { Signal } from '@influenceai/core';

function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    sourceType: 'github',
    sourceId: 'test/repo',
    title: '',
    summary: '',
    url: 'https://example.com',
    metadata: {},
    fetchedAt: new Date(),
    ...overrides,
  };
}

describe('scoreSignalRelevance', () => {
  it('scores "OpenAI releases GPT-5" at 5 or above', () => {
    const signal = makeSignal({ title: 'OpenAI releases GPT-5' });
    const score = scoreSignalRelevance(signal);
    expect(score).toBeGreaterThanOrEqual(5);
  });

  it('scores "Chimpanzees in Uganda locked in civil war" at 0', () => {
    const signal = makeSignal({
      title: 'Chimpanzees in Uganda locked in civil war',
    });
    const score = scoreSignalRelevance(signal);
    expect(score).toBe(0);
  });

  it('scores "WireGuard makes new Windows release" at 2 or below', () => {
    const signal = makeSignal({
      title: 'WireGuard makes new Windows release',
    });
    const score = scoreSignalRelevance(signal);
    expect(score).toBeLessThanOrEqual(2);
  });

  it('scores "New RAG framework for LLM applications" at 5 or above', () => {
    const signal = makeSignal({
      title: 'New RAG framework for LLM applications',
    });
    const score = scoreSignalRelevance(signal);
    expect(score).toBeGreaterThanOrEqual(5);
  });

  it('picks up AI keywords from summary even when title has none', () => {
    const signal = makeSignal({
      title: 'Interesting new project released today',
      summary:
        'A new open source model for generative AI that uses transformer architecture with RAG capabilities',
    });
    const score = scoreSignalRelevance(signal);
    expect(score).toBeGreaterThanOrEqual(3);
  });

  it('returns 0 for empty title and summary', () => {
    const signal = makeSignal({ title: '', summary: '' });
    const score = scoreSignalRelevance(signal);
    expect(score).toBe(0);
  });

  it('caps score at 10', () => {
    const signal = makeSignal({
      title:
        'OpenAI Anthropic Claude GPT LLM deep learning machine learning generative AI large language model',
      summary:
        'transformer neural network diffusion embedding RAG vector database agent agentic fine-tuning training data inference GPU pytorch tensorflow',
    });
    const score = scoreSignalRelevance(signal);
    expect(score).toBeLessThanOrEqual(10);
  });

  it('matches multi-word keywords like "machine learning"', () => {
    const signal = makeSignal({
      title: 'New advances in machine learning research',
    });
    const score = scoreSignalRelevance(signal);
    // "machine learning" is weight-2 keyword
    expect(score).toBeGreaterThanOrEqual(2);
  });

  it('is case-insensitive', () => {
    const signal = makeSignal({ title: 'OPENAI Releases NEW GPT Model' });
    const score = scoreSignalRelevance(signal);
    expect(score).toBeGreaterThanOrEqual(5);
  });

  it('does not double-count overlapping keywords', () => {
    // "llm" appears in both standard (weight 1) and high (weight 2)
    // Should use the higher weight, not sum both
    const signal = makeSignal({ title: 'An LLM tool' });
    const score = scoreSignalRelevance(signal);
    // "llm" at weight 2, that's it
    expect(score).toBe(2);
  });
});

describe('scoreRelevance', () => {
  it('filters out signals below the threshold', () => {
    const signals = [
      makeSignal({
        sourceId: 'a',
        title: 'OpenAI releases GPT-5 with new LLM capabilities',
      }),
      makeSignal({
        sourceId: 'b',
        title: 'Chimpanzees in Uganda locked in civil war',
      }),
      makeSignal({
        sourceId: 'c',
        title: 'New RAG framework for LLM applications using transformers',
      }),
    ];

    const result = scoreRelevance(signals, 3);
    const ids = result.map((s) => s.sourceId);

    expect(ids).toContain('a');
    expect(ids).not.toContain('b');
    expect(ids).toContain('c');
  });

  it('returns empty array when no signals meet threshold', () => {
    const signals = [
      makeSignal({ title: 'Gardening tips for spring' }),
      makeSignal({ title: 'Best pizza recipes' }),
    ];

    const result = scoreRelevance(signals, 3);
    expect(result).toHaveLength(0);
  });

  it('returns all signals when threshold is 0', () => {
    const signals = [
      makeSignal({ title: 'Gardening tips' }),
      makeSignal({ title: 'OpenAI GPT-5' }),
    ];

    const result = scoreRelevance(signals, 0);
    expect(result).toHaveLength(2);
  });

  it('preserves original signal properties (does not mutate)', () => {
    const signals = [
      makeSignal({
        sourceId: 'org/ai-tool',
        title: 'Amazing new LLM framework by OpenAI',
        metadata: { stars: 500 },
      }),
    ];

    const result = scoreRelevance(signals, 1);
    expect(result).toHaveLength(1);
    expect(result[0].sourceId).toBe('org/ai-tool');
    expect(result[0].metadata).toEqual({ stars: 500 });
  });
});
```

- [ ] **Step 2: Verify tests fail (module not found)**

Run:
```bash
pnpm vitest run packages/pipelines/src/engine/relevance.test.ts
```

Expected: Fails with `Cannot find module './relevance'` or similar import error. This confirms TDD red phase.

- [ ] **Step 3: Commit failing tests**

```bash
git add packages/pipelines/src/engine/relevance.test.ts
git commit -m "test: add failing tests for AI-relevance scoring function

TDD red phase. Tests cover keyword matching, thresholds, edge cases
(empty input, score cap, case insensitivity, multi-word keywords)."
```

---

### Task 2: Implement `scoreRelevance()` and `scoreSignalRelevance()`

**Files:**
- Create: `packages/pipelines/src/engine/relevance.ts`

- [ ] **Step 1: Create the relevance scoring module**

Create `packages/pipelines/src/engine/relevance.ts`:

```ts
import type { Signal } from '@influenceai/core';

/**
 * AI-relevance keywords with weights.
 * High-weight keywords (2) are a subset that indicate strong AI relevance.
 * Standard keywords (1) indicate general AI/ML relevance.
 *
 * When a keyword appears in both lists, the higher weight wins (no double-counting).
 */

const HIGH_WEIGHT_KEYWORDS = [
  'llm',
  'gpt',
  'claude',
  'openai',
  'anthropic',
  'machine learning',
  'deep learning',
  'generative ai',
  'large language model',
] as const;

const STANDARD_KEYWORDS = [
  'ai',
  'artificial intelligence',
  'ml',
  'transformer',
  'neural network',
  'diffusion',
  'stable diffusion',
  'embedding',
  'rag',
  'retrieval augmented',
  'vector database',
  'agent',
  'agentic',
  'multi-agent',
  'autonomous',
  'fine-tuning',
  'fine tuning',
  'training data',
  'inference',
  'gpu',
  'cuda',
  'tensor',
  'pytorch',
  'tensorflow',
  'jax',
  'google deepmind',
  'meta ai',
  'mistral',
  'hugging face',
  'huggingface',
  'replicate',
  'together ai',
  'computer vision',
  'nlp',
  'natural language processing',
  'text-to-image',
  'text-to-speech',
  'speech-to-text',
  'chatbot',
  'conversational ai',
  'gen ai',
  'foundation model',
  'frontier model',
  'open source model',
  'prompt engineering',
  'prompt template',
  'chain of thought',
  'model context protocol',
  'mcp',
  'function calling',
  'tool use',
  'copilot',
] as const;

const MAX_SCORE = 10;

/**
 * Build a map of keyword -> weight, where high-weight keywords override standard ones.
 * Sorted by length descending so longer phrases match first (prevents partial matches
 * from consuming tokens that belong to longer keywords).
 */
interface KeywordEntry {
  keyword: string;
  weight: number;
}

function buildKeywordList(): KeywordEntry[] {
  const map = new Map<string, number>();

  // Add standard keywords at weight 1
  for (const kw of STANDARD_KEYWORDS) {
    map.set(kw, 1);
  }

  // Override with high-weight keywords at weight 2
  for (const kw of HIGH_WEIGHT_KEYWORDS) {
    map.set(kw, 2);
  }

  // Convert to array sorted by keyword length descending (match longer phrases first)
  return Array.from(map.entries())
    .map(([keyword, weight]) => ({ keyword, weight }))
    .sort((a, b) => b.keyword.length - a.keyword.length);
}

const KEYWORD_LIST = buildKeywordList();

/**
 * Score an individual signal for AI relevance.
 *
 * Combines title and summary into a single text blob, then matches each keyword.
 * Each unique keyword match adds its weight to the score.
 * The score is capped at MAX_SCORE (10).
 *
 * @returns A score from 0 to 10.
 */
export function scoreSignalRelevance(signal: Signal): number {
  const text = `${signal.title} ${signal.summary}`.toLowerCase();

  if (text.trim().length === 0) return 0;

  let score = 0;

  for (const { keyword, weight } of KEYWORD_LIST) {
    if (text.includes(keyword)) {
      score += weight;
    }
  }

  return Math.min(score, MAX_SCORE);
}

/**
 * Filter signals by AI-relevance score.
 *
 * Scores each signal and returns only those meeting or exceeding the threshold.
 * Does not mutate the input signals.
 *
 * @param signals - Array of signals to score
 * @param threshold - Minimum score to keep (inclusive)
 * @returns Signals with relevance score >= threshold
 */
export function scoreRelevance(signals: Signal[], threshold: number): Signal[] {
  return signals.filter((signal) => {
    const score = scoreSignalRelevance(signal);
    return score >= threshold;
  });
}
```

- [ ] **Step 2: Run tests — expect all to pass**

Run:
```bash
pnpm vitest run packages/pipelines/src/engine/relevance.test.ts
```

Expected: All tests pass (TDD green phase).

- [ ] **Step 3: Run the full test suite to check for regressions**

Run:
```bash
pnpm vitest run
```

Expected: All existing tests still pass plus the new relevance tests.

- [ ] **Step 4: Commit the implementation**

```bash
git add packages/pipelines/src/engine/relevance.ts
git commit -m "feat: implement AI-relevance keyword scoring for signals

scoreSignalRelevance() scores 0-10 based on keyword matches.
scoreRelevance() filters arrays by threshold.
60+ keywords in two tiers: standard (weight 1), high (weight 2)."
```

---

### Task 3: Add `relevanceThreshold` to `PipelineDefinition` Type

**Files:**
- Modify: `packages/core/src/types/engine.ts:6-23`

- [ ] **Step 1: Add the optional `relevanceThreshold` field**

Edit `packages/core/src/types/engine.ts` — add `relevanceThreshold` to the `PipelineDefinition` interface:

```ts
export interface PipelineDefinition {
  id: string;
  name: string;
  description: string;
  schedule: string;
  enabled: boolean;
  pillar: string;
  platforms: Platform[];
  relevanceThreshold?: number;
  ingest: (config: Record<string, unknown>) => Promise<Signal[]>;
  filter: (signals: Signal[], config: Record<string, unknown>) => Promise<ScoredSignal[]>;
  generate: {
    model: string;
    filterModel?: string;
    maxTokens: number;
    temperature: number;
    topK: number;
  };
}
```

The field is optional (`?`) so all existing pipeline definitions remain valid without changes.

- [ ] **Step 2: Verify type-check passes**

Run:
```bash
pnpm vitest run
```

Expected: All tests pass. Adding an optional field is backward-compatible.

- [ ] **Step 3: Commit the type change**

```bash
git add packages/core/src/types/engine.ts
git commit -m "feat: add optional relevanceThreshold to PipelineDefinition

Defaults to undefined (no filtering). Runner integration in Part B
will use this value or fall back to a sensible default (3)."
```

---

## Summary of Changes

| Action | File | What |
|--------|------|------|
| Create | `packages/pipelines/src/engine/relevance.test.ts` | 14 tests covering scoring + filtering |
| Create | `packages/pipelines/src/engine/relevance.ts` | `scoreSignalRelevance()` and `scoreRelevance()` |
| Modify | `packages/core/src/types/engine.ts` | Add optional `relevanceThreshold` field |
