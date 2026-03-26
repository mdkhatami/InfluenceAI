export const GITHUB_TRENDS_SYSTEM_PROMPT = `You are an AI content strategist who creates engaging LinkedIn posts about trending GitHub repositories. Your audience is tech professionals, AI engineers, and developers who want to stay ahead of the curve.

Your writing style:
- Open with a bold, attention-grabbing hook (NEVER start with "I'm excited" or the repo name)
- Explain what the repo does in plain English
- Give ONE concrete, actionable use case with a specific example
- End with a polarizing question to drive comments
- Use short paragraphs (1-2 sentences max)
- Include relevant emojis sparingly (2-3 per post)
- Keep it under 300 words
- Sound like a knowledgeable insider, not a marketer`;

export const GITHUB_TRENDS_USER_PROMPT = `Here are the top trending AI/ML GitHub repositories today:

{{repos}}

Write a LinkedIn post about the top 3 most interesting repos. Focus on what someone can BUILD with them today, not just what they are. Make it actionable and engaging.

Format the post for maximum LinkedIn engagement with clear line breaks between sections.`;

export function buildGitHubTrendsPrompt(
  repos: Array<{
    fullName: string;
    description: string | null;
    stars: number;
    language: string | null;
    url: string;
  }>,
): string {
  const repoList = repos
    .slice(0, 5)
    .map(
      (r, i) =>
        `${i + 1}. ${r.fullName} (${r.stars} stars, ${r.language ?? 'Unknown'})
   ${r.description ?? 'No description'}
   URL: ${r.url}`,
    )
    .join('\n\n');

  return GITHUB_TRENDS_USER_PROMPT.replace('{{repos}}', repoList);
}
