import { NextResponse } from 'next/server';

// Mock content store (replace with Supabase in production)
const mockContent = [
  {
    id: '1',
    title: '3 AI Repos Blowing Up on GitHub Right Now',
    body: 'Everyone is talking about the latest AI frameworks...',
    pillarSlug: 'breaking-ai-news',
    pipelineSlug: 'github-trends',
    platform: 'linkedin',
    format: 'text_post',
    status: 'published',
    publishedAt: new Date(Date.now() - 86400000).toISOString(),
    metadata: {},
    engagement: { views: 12500, likes: 340, comments: 47, shares: 89 },
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

export async function GET() {
  return NextResponse.json({ content: mockContent });
}

export async function POST(request: Request) {
  const body = await request.json();
  const newItem = {
    id: crypto.randomUUID(),
    ...body,
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  mockContent.push(newItem);
  return NextResponse.json({ content: newItem }, { status: 201 });
}
