import type { AngleCard, StoryArc, Platform } from '../types';

export const STORY_ARCS: StoryArc[] = [
  {
    id: 'detective',
    name: 'The Detective',
    structure: [
      { name: 'hook', instruction: "Open with curiosity — something doesn't add up, you noticed what others missed", maxLength: '2 sentences' },
      { name: 'investigation', instruction: 'Walk through what you found, step by step, building suspense', maxLength: '3-4 paragraphs' },
      { name: 'reveal', instruction: 'The surprising conclusion — the thing nobody expected', maxLength: '1-2 sentences' },
      { name: 'implication', instruction: 'What this means for the reader. Why they should care.', maxLength: '2-3 sentences' },
    ],
    bestFor: ['contrarian', 'unraveling', 'hidden_connection'],
    platformFit: { linkedin: 0.9, twitter: 0.7, instagram: 0.5, youtube: 0.8 },
  },
  {
    id: 'experiment',
    name: 'The Experiment',
    structure: [
      { name: 'hook', instruction: 'Declare what you tested and tease the result', maxLength: '1-2 sentences' },
      { name: 'setup', instruction: 'What you tested, how, and why — be specific', maxLength: '2-3 paragraphs' },
      { name: 'results', instruction: 'Honest findings with specific numbers. Include surprises and failures.', maxLength: '3-4 paragraphs' },
      { name: 'verdict', instruction: "Clear recommendation: what works, what doesn't, who should care", maxLength: '2-3 sentences' },
    ],
    bestFor: ['practical', 'contrarian'],
    platformFit: { linkedin: 0.8, twitter: 0.8, instagram: 0.6, youtube: 0.9 },
  },
  {
    id: 'prophet',
    name: 'The Prophet',
    structure: [
      { name: 'hook', instruction: 'Bold prediction stated with conviction — no hedging', maxLength: '1-2 sentences' },
      { name: 'evidence', instruction: '3 specific data points that support the prediction', maxLength: '3 paragraphs' },
      { name: 'objection', instruction: 'The strongest counter-argument — show you considered it', maxLength: '1-2 paragraphs' },
      { name: 'rebuttal', instruction: 'Why the prediction still holds despite the objection', maxLength: '1-2 paragraphs' },
    ],
    bestFor: ['prediction', 'financial_signal'],
    platformFit: { linkedin: 0.9, twitter: 0.7, instagram: 0.4, youtube: 0.8 },
  },
  {
    id: 'historian',
    name: 'The Historian',
    structure: [
      { name: 'hook', instruction: 'Draw the parallel immediately — "This happened before"', maxLength: '1-2 sentences' },
      { name: 'parallel', instruction: 'Tell the historical story concisely. Specific names, dates, outcomes.', maxLength: '2-3 paragraphs' },
      { name: 'rhyme', instruction: "How today's event mirrors the history — point by point", maxLength: '2-3 paragraphs' },
      { name: 'divergence', instruction: "The key difference this time — and what it means for the outcome", maxLength: '1-2 paragraphs' },
    ],
    bestFor: ['historical_parallel', 'geopolitical_chess'],
    platformFit: { linkedin: 0.8, twitter: 0.6, instagram: 0.5, youtube: 0.9 },
  },
  {
    id: 'connector',
    name: 'The Connector',
    structure: [
      { name: 'hook', instruction: 'Two seemingly unrelated events. One hidden story.', maxLength: '1-2 sentences' },
      { name: 'thread_a', instruction: 'First event, told briefly but with a specific detail', maxLength: '1-2 paragraphs' },
      { name: 'thread_b', instruction: 'Second event, same treatment — specific detail', maxLength: '1-2 paragraphs' },
      { name: 'collision', instruction: 'The connection nobody sees. This is the value of the post.', maxLength: '2-3 paragraphs' },
      { name: 'implication', instruction: 'What this combined story means going forward', maxLength: '1-2 sentences' },
    ],
    bestFor: ['hidden_connection', 'geopolitical_chess', 'financial_signal'],
    platformFit: { linkedin: 0.9, twitter: 0.6, instagram: 0.4, youtube: 0.7 },
  },
  {
    id: 'underdog',
    name: 'The Underdog',
    structure: [
      { name: 'hook', instruction: 'Small team/unknown player just beat a giant. State it dramatically.', maxLength: '1-2 sentences' },
      { name: 'stakes', instruction: 'Why this matters — the giant was supposed to win', maxLength: '1-2 paragraphs' },
      { name: 'how', instruction: 'What the underdog did differently. Specific technical or strategic choices.', maxLength: '2-3 paragraphs' },
      { name: 'lesson', instruction: 'The generalizable takeaway for the reader', maxLength: '1-2 sentences' },
    ],
    bestFor: ['david_vs_goliath', 'practical'],
    platformFit: { linkedin: 0.8, twitter: 0.9, instagram: 0.7, youtube: 0.8 },
  },
];

export function selectArc(angle: AngleCard, platform: Platform): StoryArc {
  const matching = STORY_ARCS
    .filter(arc => arc.bestFor.includes(angle.angleType))
    .sort((a, b) => b.platformFit[platform] - a.platformFit[platform]);

  return matching[0] ?? STORY_ARCS[0]; // Fallback to Detective
}
