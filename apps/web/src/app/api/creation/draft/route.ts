import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { LLMClient } from '@influenceai/integrations';
import { createContent } from '@influenceai/creation';
import type { ResearchBrief } from '@influenceai/creation';

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const { researchBriefId, angleCardId, platform } = await request.json();
    if (!researchBriefId || !angleCardId || !platform) {
      return NextResponse.json({ error: 'researchBriefId, angleCardId, and platform are required' }, { status: 400 });
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

    // Reconstruct brief
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

    const result = await createContent(
      parsedBrief, platform,
      { selectedAngleId: angleCardId },
      supabase, llm,
    );

    if (result.phase !== 'complete') {
      return NextResponse.json({ error: 'Angle not found in generated cards' }, { status: 400 });
    }

    // Store as content item
    const { data: contentItem, error: insertError } = await supabase
      .from('content_items')
      .insert({
        title: result.draft.title,
        body: result.draft.body,
        platform,
        status: 'pending_review',
        quality_score: result.draft.qualityScore,
        metadata: {
          angleType: result.selectedAngle.angleType,
          storyArc: result.storyArc.id,
          researchBriefId: brief.id,
          angleCardId: result.selectedAngle.id,
        },
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      draft: result.draft,
      storyArc: { id: result.storyArc.id, name: result.storyArc.name },
      contentItemId: contentItem.id,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to generate draft' }, { status: 500 });
  }
}
