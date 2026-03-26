export * from './types';
export { LLMClient } from './llm/client';
export type { LLMGenerateParams, LLMGenerateResult } from './llm/client';
export {
  fetchTrendingRepos,
  scoreRepos,
  toSignals,
} from './github/client';
export type { TrendingRepo, GitHubTrendsOptions } from './github/client';
export {
  GITHUB_TRENDS_SYSTEM_PROMPT,
  GITHUB_TRENDS_USER_PROMPT,
  buildGitHubTrendsPrompt,
} from './github/prompts';
