import type { Signal } from '@influenceai/core';

// ---------------------------------------------------------------------------
// Keyword weight tiers
// ---------------------------------------------------------------------------

const HIGH_WEIGHT = 2;
const STANDARD_WEIGHT = 1;

const HIGH_WEIGHT_KEYWORDS: string[] = [
  'llm',
  'gpt',
  'claude',
  'openai',
  'anthropic',
  'machine learning',
  'deep learning',
  'generative ai',
  'large language model',
];

const STANDARD_WEIGHT_KEYWORDS: string[] = [
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
];

// ---------------------------------------------------------------------------
// Build a deduplicated keyword → weight map.
// High-weight keywords override any standard-weight entry for the same term.
// Sort by descending keyword length so longer phrases match first.
// ---------------------------------------------------------------------------

type KeywordEntry = { keyword: string; weight: number };

function buildKeywordMap(): KeywordEntry[] {
  const map = new Map<string, number>();

  for (const kw of STANDARD_WEIGHT_KEYWORDS) {
    map.set(kw.toLowerCase(), STANDARD_WEIGHT);
  }

  // High weight overrides standard
  for (const kw of HIGH_WEIGHT_KEYWORDS) {
    map.set(kw.toLowerCase(), HIGH_WEIGHT);
  }

  // Sort longest first so multi-word phrases match before their sub-words
  return Array.from(map.entries())
    .map(([keyword, weight]) => ({ keyword, weight }))
    .sort((a, b) => b.keyword.length - a.keyword.length);
}

const KEYWORD_ENTRIES: KeywordEntry[] = buildKeywordMap();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Score a single signal for AI relevance.
 *
 * Algorithm:
 * 1. Normalise `title + " " + summary` to lower-case.
 * 2. Walk keyword entries (longest first) and, for each match (using word
 *    boundaries to avoid false positives like 'ai' inside 'main'), add its
 *    weight once per keyword.
 * 3. Cap result at 10.
 */
export function scoreSignalRelevance(signal: Signal): number {
  const text = `${signal.title} ${signal.summary}`.toLowerCase();

  if (!text.trim()) return 0;

  let totalScore = 0;

  for (const { keyword, weight } of KEYWORD_ENTRIES) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(text)) {
      totalScore += weight;
    }
  }

  return Math.min(totalScore, 10);
}

/**
 * Filter an array of signals, returning only those whose relevance score
 * meets or exceeds `threshold`.
 */
export function scoreRelevance(signals: Signal[], threshold: number): Signal[] {
  return signals.filter(
    (signal) => scoreSignalRelevance(signal) >= threshold,
  );
}
