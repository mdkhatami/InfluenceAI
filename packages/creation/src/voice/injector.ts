import type { VoiceProfile } from '../types';

export function buildVoiceInjection(profile: VoiceProfile): string {
  if (profile.confidence < 0.3) return '';

  let injection = '\n\n--- AUTHOR VOICE PROFILE ---\n';
  injection += `Tone: ${profile.toneDescriptor}\n\n`;

  const strongRules = profile.styleRules.filter(r => r.strength >= 0.5);
  if (strongRules.length > 0) {
    injection += 'Writing rules:\n';
    injection += strongRules.map(r => `- ${r.rule}`).join('\n');
    injection += '\n\n';
  }

  if (profile.vocabularyPreferences.avoided.length > 0) {
    injection += `NEVER use these words/phrases: ${profile.vocabularyPreferences.avoided.join(', ')}\n`;
  }
  if (profile.vocabularyPreferences.preferred.length > 0) {
    injection += `Preferred vocabulary: ${profile.vocabularyPreferences.preferred.join(', ')}\n`;
  }

  if (profile.stances.length > 0) {
    injection += '\nAuthor positions on recurring topics:\n';
    injection += profile.stances.map(s => `- ${s.topic}: ${s.position}`).join('\n');
    injection += '\n';
  }

  const topExemplars = profile.exemplarPosts.slice(0, 3);
  if (topExemplars.length > 0) {
    injection += "\nExamples of the author's approved posts (match this style):\n";
    topExemplars.forEach((e, i) => {
      injection += `\n--- Example ${i + 1} (${e.platform}) ---\n${e.body.substring(0, 400)}\n`;
    });
  }

  return injection;
}
