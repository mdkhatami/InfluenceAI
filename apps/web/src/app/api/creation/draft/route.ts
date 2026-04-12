import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { LLMClient } from '@influenceai/integrations';
import { createDraftFromAngle, parseBriefFromRow } from '@influenceai/creation';
import type { AngleCard, Finding } from '@influenceai/creation';

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

    // Fetch the previously stored angle card (no regeneration needed)
    const { data: angleRow, error: angleError } = await supabase
      .from('angle_cards')
      .select('*')
      .eq('id', angleCardId)
      .single();

    if (angleError || !angleRow) {
      return NextResponse.json({ error: 'Angle card not found' }, { status: 404 });
    }

    const parsedBrief = parseBriefFromRow(brief);

    const angle: AngleCard = {
      id: angleRow.id,
      researchBriefId: angleRow.research_brief_id,
      angleType: angleRow.angle_type,
      hook: angleRow.hook,
      thesis: angleRow.thesis,
      supportingFindings: (angleRow.supporting_findings || []) as Finding[],
      domainSource: angleRow.domain_source,
      estimatedEngagement: angleRow.estimated_engagement,
      reasoning: angleRow.reasoning,
      status: angleRow.status,
      createdAt: new Date(angleRow.created_at),
    };

    const { draft, storyArc } = await createDraftFromAngle(parsedBrief, angle, platform, supabase, llm);

    // Store as content item
    const { data: contentItem, error: insertError } = await supabase
      .from('content_items')
      .insert({
        title: draft.title,
        body: draft.body,
        platform,
        status: 'pending_review',
        quality_score: draft.qualityScore,
        metadata: {
          angleType: angle.angleType,
          storyArc: storyArc.id,
          researchBriefId: brief.id,
          angleCardId: angle.id,
        },
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      draft,
      storyArc: { id: storyArc.id, name: storyArc.name },
      contentItemId: contentItem.id,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to generate draft' }, { status: 500 });
  }
}
