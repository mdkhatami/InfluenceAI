import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, type, githubRepo, npmPackage, pypiPackage } = body as {
      name: string;
      type: string;
      githubRepo?: string;
      npmPackage?: string;
      pypiPackage?: string;
    };

    if (!name || !type) {
      return NextResponse.json(
        { error: 'name and type are required' },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('trend_entities')
      .insert({
        name,
        type,
        github_repo: githubRepo ?? null,
        npm_package: npmPackage ?? null,
        pypi_package: pypiPackage ?? null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ entity: data }, { status: 201 });
  } catch (error) {
    console.error('[trends/entities] failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create entity' },
      { status: 500 },
    );
  }
}
