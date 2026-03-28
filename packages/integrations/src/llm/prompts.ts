import type { Signal, Platform } from '@influenceai/core';

const PLATFORM_FORMATS: Record<string, string> = {
  linkedin: `Format: LinkedIn post.
- Hook line: bold claim, never start with "I'm excited to share..."
- 3-5 numbered insights, each a short paragraph
- End with a polarizing question to drive comments
- Total length: 1200-1500 characters`,

  twitter: `Thread format: Twitter/X thread.
- Tweet 1: hook statement, 280 chars max, must work standalone
- Tweets 2-5: one insight per tweet, each under 280 chars
- Last tweet: call-to-action
- Each tweet must be readable on its own`,

  instagram: `Format: Instagram carousel outline (text only — slides will be designed separately).
- Slide 1: bold visual claim with a number (e.g. "7 AI tools that...")
- Slides 2-7: one insight per slide, one sentence maximum
- Slide 8: your hot take or contrarian point
- Slide 9: CTA — "Save this. You'll need it."`,

  youtube: `Format: YouTube video script outline.
- Hook (first 15 seconds): bold claim or question
- Problem statement (30 seconds)
- 3-5 key points with demonstrations
- Results/conclusion
- Call-to-action (subscribe, comment)`,
};

export interface PromptTemplateInput {
  systemPrompt: string;
  userPromptTemplate: string;
}

export function buildPrompt(
  template: PromptTemplateInput,
  signal: Signal,
  platform: Platform,
): { systemPrompt: string; userPrompt: string } {
  const replacements: Record<string, string> = {
    '{{signal_title}}': signal.title,
    '{{signal_summary}}': signal.summary || '',
    '{{signal_url}}': signal.url,
    '{{signal_metadata}}': JSON.stringify(signal.metadata),
    '{{platform}}': platform,
    '{{platform_format}}': PLATFORM_FORMATS[platform] ?? '',
  };

  let systemPrompt = template.systemPrompt;
  let userPrompt = template.userPromptTemplate;

  for (const [key, value] of Object.entries(replacements)) {
    systemPrompt = systemPrompt.replaceAll(key, value);
    userPrompt = userPrompt.replaceAll(key, value);
  }

  return { systemPrompt, userPrompt };
}
