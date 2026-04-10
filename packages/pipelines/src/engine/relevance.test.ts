import { describe, it, expect } from 'vitest';
import type { Signal } from '@influenceai/core';
import { scoreSignalRelevance, scoreRelevance } from './relevance';

function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    sourceType: 'rss',
    sourceId: 'test-source',
    title: '',
    summary: '',
    url: 'https://example.com',
    metadata: {},
    fetchedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

describe('scoreSignalRelevance', () => {
  it('scores a clear AI signal high — "OpenAI releases GPT-5"', () => {
    const signal = makeSignal({ title: 'OpenAI releases GPT-5', summary: 'Major new LLM launch.' });
    expect(scoreSignalRelevance(signal)).toBeGreaterThanOrEqual(5);
  });

  it('scores unrelated content as 0 — "Chimpanzees in Uganda"', () => {
    const signal = makeSignal({
      title: 'Chimpanzees in Uganda',
      summary: 'A study on primate behavior in the wild forests of Uganda.',
    });
    expect(scoreSignalRelevance(signal)).toBe(0);
  });

  it('scores marginally relevant tech content low — "WireGuard makes new Windows release"', () => {
    const signal = makeSignal({
      title: 'WireGuard makes new Windows release',
      summary: 'The VPN protocol ships an updated client for Windows 11.',
    });
    expect(scoreSignalRelevance(signal)).toBeLessThanOrEqual(2);
  });

  it('scores AI-relevant summary even when title is generic', () => {
    const signal = makeSignal({
      title: 'New RAG framework for LLM applications',
      summary: 'Retrieval augmented generation combined with large language model inference.',
    });
    expect(scoreSignalRelevance(signal)).toBeGreaterThanOrEqual(5);
  });

  it('scores from summary alone when title is empty', () => {
    const signal = makeSignal({
      title: '',
      summary: 'Anthropic releases a new Claude model with improved reasoning capabilities.',
    });
    expect(scoreSignalRelevance(signal)).toBeGreaterThanOrEqual(2);
  });

  it('returns 0 for completely empty title and summary', () => {
    const signal = makeSignal({ title: '', summary: '' });
    expect(scoreSignalRelevance(signal)).toBe(0);
  });

  it('caps score at 10 even when many keywords match', () => {
    const signal = makeSignal({
      title: 'OpenAI Anthropic GPT Claude LLM machine learning deep learning generative ai',
      summary: 'Large language model transformer neural network fine-tuning RAG vector database agent agentic',
    });
    expect(scoreSignalRelevance(signal)).toBe(10);
  });

  it('is case insensitive', () => {
    const lower = makeSignal({ title: 'openai releases gpt model', summary: '' });
    const upper = makeSignal({ title: 'OPENAI RELEASES GPT MODEL', summary: '' });
    expect(scoreSignalRelevance(lower)).toBe(scoreSignalRelevance(upper));
  });

  it('matches multi-word keywords like "machine learning"', () => {
    const signal = makeSignal({
      title: 'Machine learning breakthrough announced',
      summary: '',
    });
    expect(scoreSignalRelevance(signal)).toBeGreaterThanOrEqual(2);
  });

  it('does not double-count overlapping keywords (llm should use high weight, not standard+high)', () => {
    // "llm" appears in both standard and high-weight lists — should only count once at weight 2
    const signalWithLLM = makeSignal({ title: 'llm', summary: '' });
    const score = scoreSignalRelevance(signalWithLLM);
    expect(score).toBe(2);
  });

  it('does not match "ai" as substring in common words', () => {
    const signal = makeSignal({
      title: 'Explaining the main details about daily training',
    });
    const score = scoreSignalRelevance(signal);
    expect(score).toBe(0);
  });
});

describe('scoreRelevance (batch filtering)', () => {
  it('filters out signals below the threshold', () => {
    const signals = [
      makeSignal({ title: 'OpenAI GPT-5 launch', summary: 'New LLM from OpenAI.' }),
      makeSignal({ title: 'Chimpanzees in Uganda', summary: 'Primate behavior study.' }),
    ];
    const filtered = scoreRelevance(signals, 3);
    expect(filtered.length).toBe(1);
    expect(filtered[0].title).toBe('OpenAI GPT-5 launch');
  });

  it('returns empty array when no signals meet the threshold', () => {
    const signals = [
      makeSignal({ title: 'Weekend gardening tips', summary: 'How to grow tomatoes.' }),
      makeSignal({ title: 'Local sports recap', summary: 'Town football results.' }),
    ];
    const filtered = scoreRelevance(signals, 1);
    expect(filtered).toHaveLength(0);
  });

  it('returns all signals when threshold is 0', () => {
    const signals = [
      makeSignal({ title: 'Anything goes', summary: '' }),
      makeSignal({ title: 'Another item', summary: '' }),
    ];
    const filtered = scoreRelevance(signals, 0);
    expect(filtered).toHaveLength(2);
  });

  it('preserves original signal properties on returned signals', () => {
    const original = makeSignal({
      title: 'Claude 3 Opus released by Anthropic',
      summary: 'New LLM frontier model.',
      sourceId: 'my-source-123',
      url: 'https://anthropic.com/news',
    });
    const filtered = scoreRelevance([original], 1);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].sourceId).toBe('my-source-123');
    expect(filtered[0].url).toBe('https://anthropic.com/news');
    expect(filtered[0].fetchedAt).toEqual(original.fetchedAt);
  });
});
