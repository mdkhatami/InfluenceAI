import { NextResponse } from 'next/server';
import {
  LLMClient,
  fetchTrendingRepos,
  scoreRepos,
  GITHUB_TRENDS_SYSTEM_PROMPT,
  buildGitHubTrendsPrompt,
} from '@influenceai/integrations';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const language = body.language as string | undefined;

    // Step 1: Fetch trending repos
    const repos = await fetchTrendingRepos({ language, since: 'daily' });

    if (repos.length === 0) {
      return NextResponse.json(
        { error: 'No trending repos found' },
        { status: 404 }
      );
    }

    // Step 2: Score and rank
    const scored = scoreRepos(repos);
    const topRepos = scored.slice(0, 5);

    // Step 3: Generate content via LiteLLM
    const llm = LLMClient.fromEnv();
    const prompt = buildGitHubTrendsPrompt(topRepos);

    const result = await llm.generate({
      systemPrompt: GITHUB_TRENDS_SYSTEM_PROMPT,
      userPrompt: prompt,
      maxTokens: 1500,
      temperature: 0.8,
    });

    return NextResponse.json({
      success: true,
      repos: topRepos,
      generated: {
        content: result.content,
        model: result.model,
        usage: result.usage,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('GitHub Trends pipeline error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Pipeline execution failed' },
      { status: 500 }
    );
  }
}

// GET endpoint for fetching trending repos without generation
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const language = searchParams.get('language') || undefined;

    const repos = await fetchTrendingRepos({ language, since: 'daily' });
    const scored = scoreRepos(repos);

    return NextResponse.json({
      repos: scored.slice(0, 10),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('GitHub Trends fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch trends' },
      { status: 500 }
    );
  }
}
