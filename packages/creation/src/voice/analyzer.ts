import type { LLMClient } from '@influenceai/integrations';
import type { VoiceProfile, VoiceAnalysis, Stance } from '../types';

const VOICE_ANALYZER_SYSTEM_PROMPT = `You analyze before/after content edits to extract an author's writing style. Focus on:

1. PATTERNS, not individual edits. A rule is only valid if you see it applied 3+ times.
2. What the author consistently ADDS (their signature elements)
3. What the author consistently REMOVES (their pet peeves)
4. Sentence structure preferences (short/long, simple/complex)
5. Tone shifts (formal→casual, passive→active, etc.)
6. Topic-specific opinions revealed through edits

Output JSON with: styleRules[], vocabularyPreferences: {preferred[], avoided[]}, openingPatterns[], ctaPatterns[], toneDescriptor, stances[]

Each styleRule needs: rule (the pattern), evidence (specific examples from edits), strength (0-1, how consistent).`;

export async function analyzeVoice(
  db: any, // SupabaseClient
  llm: LLMClient,
): Promise<VoiceProfile> {
  // 1. Fetch unanalyzed edits
  const { data: edits } = await db.from('content_edits')
    .select('*')
    .eq('analyzed', false)
    .order('created_at', { ascending: true })
    .limit(50);

  if (!edits || edits.length < 5) {
    throw new Error('Not enough edits to analyze (minimum 5)');
  }

  // 2. Fetch current voice profile
  const currentProfile = await getCurrentVoiceProfile(db);

  // 3. Send edits to LLM for style extraction
  const analysis = await llm.generateJSON<VoiceAnalysis>({
    systemPrompt: VOICE_ANALYZER_SYSTEM_PROMPT,
    userPrompt: `
Analyze these content edits to extract the author's writing style:

${edits.map((e: any, i: number) => `
--- Edit ${i + 1} ---
BEFORE: ${e.before_body.substring(0, 500)}
AFTER: ${e.after_body.substring(0, 500)}
`).join('\n')}

${currentProfile ? `Current voice profile (update, don't replace):\n${JSON.stringify(currentProfile.styleRules)}` : 'No existing profile — create from scratch.'}

Extract:
1. Style rules (patterns in what the author consistently changes)
2. Vocabulary preferences (words added vs removed)
3. Opening patterns (how they prefer to start posts)
4. CTA patterns (how they end posts)
5. Overall tone descriptor
6. Any topic-specific stances revealed by edits
`,
    maxTokens: 800,
    temperature: 0.3,
  });

  // 4. Select exemplar posts
  const { data: exemplars } = await db.from('content_items')
    .select('id, platform, title, body, quality_score')
    .eq('status', 'approved')
    .order('quality_score', { ascending: false })
    .limit(20);

  // 5. Calculate confidence
  const totalEditsAnalyzed = (currentProfile?.editsAnalyzed ?? 0) + edits.length;
  const confidence = Math.min(1.0, totalEditsAnalyzed / 50);

  // 6. Fix 9: Deactivate previous active profiles BEFORE inserting new one
  await db.from('voice_profiles').update({ is_active: false }).eq('is_active', true);

  // 7. Build and store new voice profile
  const profile: VoiceProfile = {
    id: crypto.randomUUID(),
    version: (currentProfile?.version ?? 0) + 1,
    confidence,
    editsAnalyzed: totalEditsAnalyzed,
    styleRules: analysis.styleRules,
    vocabularyPreferences: analysis.vocabularyPreferences,
    openingPatterns: analysis.openingPatterns,
    ctaPatterns: analysis.ctaPatterns,
    toneDescriptor: analysis.toneDescriptor,
    stances: analysis.stances.map((s): Stance => ({
      ...s,
      confidence: 0.5, // Initial confidence for newly extracted stances
      lastExpressed: new Date(),
    })),
    exemplarPosts: (exemplars || []).map((e: any) => ({
      contentItemId: e.id,
      platform: e.platform,
      title: e.title,
      body: e.body,
      qualityScore: e.quality_score,
      editDistance: 0,
    })),
    isActive: true,
    updatedAt: new Date(),
  };

  await db.from('voice_profiles').insert({
    id: profile.id,
    version: profile.version,
    confidence: profile.confidence,
    style_rules: profile.styleRules,
    vocabulary_preferences: profile.vocabularyPreferences,
    opening_patterns: profile.openingPatterns,
    cta_patterns: profile.ctaPatterns,
    tone_descriptor: profile.toneDescriptor,
    stances: profile.stances,
    exemplar_posts: profile.exemplarPosts,
    edits_analyzed: profile.editsAnalyzed,
    is_active: true,
  });

  // 8. Mark edits as analyzed
  await db.from('content_edits')
    .update({ analyzed: true })
    .in('id', edits.map((e: any) => e.id));

  return profile;
}

export async function getCurrentVoiceProfile(db: any): Promise<VoiceProfile | null> {
  const { data } = await db.from('voice_profiles')
    .select('*')
    .eq('is_active', true)
    .single();

  if (!data) return null;

  return {
    id: data.id,
    version: data.version,
    confidence: data.confidence,
    editsAnalyzed: data.edits_analyzed,
    styleRules: data.style_rules,
    vocabularyPreferences: data.vocabulary_preferences,
    openingPatterns: data.opening_patterns,
    ctaPatterns: data.cta_patterns,
    toneDescriptor: data.tone_descriptor,
    stances: (data.stances || []).map((s: any): Stance => ({
      topic: s.topic,
      position: s.position,
      confidence: s.confidence ?? 0.5,
      lastExpressed: s.lastExpressed ? new Date(s.lastExpressed) : new Date(data.updated_at),
    })),
    exemplarPosts: data.exemplar_posts || [],
    isActive: data.is_active,
    updatedAt: new Date(data.updated_at),
  };
}
