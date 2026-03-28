import { describe, it, expect } from 'vitest';
import { buildPrompt } from './prompts';
import type { Signal } from '@influenceai/core';

describe('buildPrompt', () => {
  const signal: Signal = {
    sourceType: 'github',
    sourceId: 'test/repo',
    title: 'test/repo: An amazing AI tool',
    summary: 'A tool that does amazing things with AI',
    url: 'https://github.com/test/repo',
    metadata: { stars: 1500, language: 'Python' },
    fetchedAt: new Date('2026-03-28'),
  };

  it('replaces template variables with signal data', () => {
    const template = {
      systemPrompt: 'You are an AI content writer for {{platform}}.',
      userPromptTemplate: 'Signal: {{signal_title}}\nSummary: {{signal_summary}}\nURL: {{signal_url}}',
    };

    const result = buildPrompt(template, signal, 'linkedin');

    expect(result.systemPrompt).toBe('You are an AI content writer for linkedin.');
    expect(result.userPrompt).toContain('test/repo: An amazing AI tool');
    expect(result.userPrompt).toContain('A tool that does amazing things with AI');
    expect(result.userPrompt).toContain('https://github.com/test/repo');
  });

  it('injects platform format instructions', () => {
    const template = {
      systemPrompt: 'Write content.',
      userPromptTemplate: 'Topic: {{signal_title}}\n\n{{platform_format}}',
    };

    const result = buildPrompt(template, signal, 'linkedin');

    expect(result.userPrompt).toContain('Hook line');
    expect(result.userPrompt).toContain('polarizing question');
  });

  it('handles twitter format instructions', () => {
    const template = {
      systemPrompt: 'Write content.',
      userPromptTemplate: '{{platform_format}}\nTopic: {{signal_title}}',
    };

    const result = buildPrompt(template, signal, 'twitter');

    expect(result.userPrompt).toContain('Thread format');
    expect(result.userPrompt).toContain('280 chars');
  });

  it('handles instagram carousel format', () => {
    const template = {
      systemPrompt: 'Write content.',
      userPromptTemplate: '{{platform_format}}\nTopic: {{signal_title}}',
    };

    const result = buildPrompt(template, signal, 'instagram');

    expect(result.userPrompt).toContain('Slide 1');
    expect(result.userPrompt).toContain('carousel');
  });

  it('includes signal metadata as JSON', () => {
    const template = {
      systemPrompt: 'Analyze.',
      userPromptTemplate: 'Data: {{signal_metadata}}',
    };

    const result = buildPrompt(template, signal, 'linkedin');

    expect(result.userPrompt).toContain('"stars":1500');
    expect(result.userPrompt).toContain('"language":"Python"');
  });
});
