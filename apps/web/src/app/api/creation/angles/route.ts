import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { LLMClient } from '@influenceai/integrations';
import { generateAngles } from '@influenceai/creation';
import type { ResearchBrief } from '@influenceai/creation';

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const { researchBriefId, platform } = await request.json();
    if (!researchBriefId || !platform) {
      return NextResponse.json({ error: 'researchBriefId and platform are required' }, { status: 400 });
    }

    const supabase = await createClient();
    const llm = LLMClient.fromEnv();

    // Fetch research brief
    const { data: brief, error } = await supabase
      .from('research_briefs')
      .select('*')
      .eq('id', researchBriefId)
      .single();

    if (error || !brief) {
      return NextResponse.json({ error: 'Research brief not found' }, { status: 404 });
    }

    // Reconstruct ResearchBrief from DB row
    const parsedBrief: ResearchBrief = {
      id: brief.id,
      signalId: brief.signal_id,
      signal: brief.signal_data,
      topFindings: brief.top_findings,
      connections: brief.connections || [],
      suggestedAngles: brief.suggested_angles || [],
      unusualFact: brief.unusual_fact || '',
      agentBriefs: [],
      coverage: brief.coverage || { dispatched: 0, succeeded: 0, failed: 0, agents: [] },
      createdAt: new Date(brief.created_at),
      expiresAt: brief.expires_at ? new Date(brief.expires_at) : new Date(Date.now() + 48 * 60 * 60 * 1000),
    };

    const angleCards = await generateAngles(parsedBrief, platform, llm);

    return NextResponse.json({ angleCards });
  } catch {
    return NextResponse.json({ error: 'Failed to generate angles' }, { status: 500 });
  }
}
