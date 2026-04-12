import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentVoiceProfile } from '@influenceai/creation';

export async function GET() {
  try {
    const supabase = await createClient();
    const profile = await getCurrentVoiceProfile(supabase);

    if (!profile) {
      return NextResponse.json(null);
    }

    return NextResponse.json(profile);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch voice profile' }, { status: 500 });
  }
}
