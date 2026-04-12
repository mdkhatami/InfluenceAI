import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { LLMClient } from '@influenceai/integrations';
import { generateAngles, parseBriefFromRow } from '@influenceai/creation';

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

    const parsedBrief = parseBriefFromRow(brief);
    const angleCards = await generateAngles(parsedBrief, platform, llm);

    return NextResponse.json({ angleCards });
  } catch {
    return NextResponse.json({ error: 'Failed to generate angles' }, { status: 500 });
  }
}
