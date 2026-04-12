import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { LLMClient } from '@influenceai/integrations';
import { analyzeVoice } from '@influenceai/creation';

export const maxDuration = 300;

export async function POST() {
  try {
    const supabase = await createClient();
    const llm = LLMClient.fromEnv();

    const profile = await analyzeVoice(supabase, llm);

    return NextResponse.json({
      version: profile.version,
      confidence: profile.confidence,
      rulesExtracted: profile.styleRules.length,
      editsAnalyzed: profile.editsAnalyzed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to analyze voice';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
