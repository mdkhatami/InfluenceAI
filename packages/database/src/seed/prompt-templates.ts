import { PILLARS } from '@influenceai/core';
import { getServiceClient } from '../client';
import { insertPromptTemplate } from '../queries/prompt-templates';
import type { Platform } from '@influenceai/core';

const PLATFORMS: Platform[] = ['linkedin', 'twitter', 'instagram'];

const PLATFORM_SYSTEM_PROMPTS: Record<Platform, string> = {
  linkedin: 'You are an AI content strategist writing for LinkedIn. Your tone is professional but bold. You write for engineers, executives, and AI practitioners.',
  twitter: 'You are an AI content strategist writing Twitter/X threads. Your tone is punchy, direct, and scroll-stopping. Every tweet must work standalone.',
  instagram: 'You are an AI content strategist designing Instagram carousel outlines. Structure content as slide-by-slide text (visuals will be designed separately).',
  youtube: 'You are an AI content strategist writing YouTube video script outlines. Focus on hooks, demonstrations, and clear takeaways.',
};

export async function seedPromptTemplates(): Promise<number> {
  const db = getServiceClient();
  let count = 0;

  for (const pillar of PILLARS) {
    for (const platform of PLATFORMS) {
      try {
        await insertPromptTemplate(db, {
          pillarId: pillar.slug,
          platform,
          templateType: 'generation',
          systemPrompt: `${PLATFORM_SYSTEM_PROMPTS[platform]}\n\nContent pillar: "${pillar.name}" — Core emotion: ${pillar.coreEmotion}.\n${pillar.description}`,
          userPromptTemplate: `${pillar.promptTemplates.default?.replace('{{input}}', '{{signal_title}}\\n{{signal_summary}}') ?? ''}\n\n{{platform_format}}\n\nSignal title: {{signal_title}}\nSignal summary: {{signal_summary}}\nSignal URL: {{signal_url}}\nSignal data: {{signal_metadata}}`,
        });
        count++;
      } catch (err) {
        console.log(`Template for ${pillar.slug}/${platform} already exists, skipping`);
      }
    }
  }

  return count;
}

// Run directly: npx tsx packages/database/src/seed/prompt-templates.ts
if (process.argv[1]?.endsWith('prompt-templates.ts')) {
  seedPromptTemplates()
    .then((count) => console.log(`Seeded ${count} prompt templates`))
    .catch(console.error);
}
