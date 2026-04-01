export * from './types';
export { LLMClient } from './llm/client';
export type { LLMGenerateParams, LLMGenerateResult } from './llm/client';
export { buildPrompt, type PromptTemplateInput } from './llm/prompts';
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
export { type SignalAdapter, type AdapterConfig } from './sources/types';
export { GitHubSignalAdapter } from './sources/github';
export { RSSSignalAdapter } from './sources/rss';
export { HackerNewsSignalAdapter } from './sources/hackernews';
