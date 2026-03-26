import type { PillarConfig } from './types';

export const PILLARS: PillarConfig[] = [
  {
    slug: 'breaking-ai-news',
    name: 'Breaking AI News \u2192 Made Useful',
    icon: 'Zap',
    description:
      'Transform breaking AI releases, papers, and announcements into practical, actionable content that helps your audience understand what matters and why.',
    coreEmotion: 'Excitement',
    bestPlatforms: ['linkedin', 'youtube'],
    frequency: 'Per release',
    automationLevel: 'high',
    color: 'blue',
    defaultFormats: ['text_post', 'video_short', 'carousel'],
    promptTemplates: {
      default:
        'You are an AI content strategist. Given the following AI news/release, create an engaging post that explains what it is, why it matters, and how professionals can use it today. Keep the tone excited but grounded. Include a clear takeaway.\n\nNews: {{input}}',
    },
  },
  {
    slug: 'reshared-posts',
    name: 'Reshared Posts \u2192 Upgraded',
    icon: 'RefreshCw',
    description:
      'Curate and amplify the best AI content from thought leaders by adding unique analysis, context, and contrarian takes that establish authority.',
    coreEmotion: 'Authority',
    bestPlatforms: ['linkedin', 'twitter'],
    frequency: '2-3x/day',
    automationLevel: 'high',
    color: 'violet',
    defaultFormats: ['text_post', 'thread'],
    promptTemplates: {
      default:
        'You are an AI thought leader. Given the following post/article from another creator, write a reshare post that adds your unique perspective, additional context, or a contrarian take. Position yourself as an authority who synthesizes and elevates the conversation.\n\nOriginal: {{input}}',
    },
  },
  {
    slug: 'strategy-career',
    name: 'Strategy & Career',
    icon: 'TrendingUp',
    description:
      'Deep strategic insights on AI adoption, career moves in the age of AI, and business transformation frameworks that inspire aspiration and action.',
    coreEmotion: 'Aspiration',
    bestPlatforms: ['linkedin'],
    frequency: '1x/week',
    automationLevel: 'medium',
    color: 'amber',
    defaultFormats: ['text_post', 'carousel', 'infographic'],
    promptTemplates: {
      default:
        'You are a strategic AI advisor. Write a thought-provoking LinkedIn post about AI strategy or career development. Focus on actionable frameworks, emerging opportunities, and bold predictions. The tone should be aspirational and empowering.\n\nTopic: {{input}}',
    },
  },
  {
    slug: 'live-demos',
    name: 'Live Demos & Walkthroughs',
    icon: 'Play',
    description:
      'Hands-on demonstrations of AI tools, workflows, and integrations that build trust by showing real results, not just talking about them.',
    coreEmotion: 'Trust',
    bestPlatforms: ['youtube', 'instagram'],
    frequency: '1x/week',
    automationLevel: 'low',
    color: 'emerald',
    defaultFormats: ['video_long', 'video_short'],
    promptTemplates: {
      default:
        'You are a technical AI educator. Create a script outline for a live demo/walkthrough video. Include: hook (15s), problem statement, step-by-step demonstration, results showcase, and call-to-action. Keep it practical and trust-building.\n\nTool/Topic: {{input}}',
    },
  },
  {
    slug: 'hype-detector',
    name: 'Hype Detector: Real vs Noise',
    icon: 'Shield',
    description:
      'Cut through AI hype with honest, evidence-based analysis of what works, what does not, and what is just marketing. Build credibility through radical honesty.',
    coreEmotion: 'Credibility',
    bestPlatforms: ['linkedin', 'instagram', 'youtube', 'twitter'],
    frequency: '1-2x/week',
    automationLevel: 'medium',
    color: 'red',
    defaultFormats: ['text_post', 'video_short', 'carousel', 'podcast_episode'],
    promptTemplates: {
      default:
        'You are an honest AI analyst known for cutting through hype. Analyze the following AI claim, product, or trend. Rate it on a hype scale, explain what is real vs overhyped, and give your honest verdict. Be fair but fearless.\n\nSubject: {{input}}',
    },
  },
  {
    slug: 'inside-the-machine',
    name: 'Inside the Machine',
    icon: 'Building',
    description:
      'Behind-the-scenes looks at how AI systems work, how companies are adopting AI internally, and insider perspectives that make the audience feel like they have exclusive access.',
    coreEmotion: 'Insider Access',
    bestPlatforms: ['linkedin'],
    frequency: '1x/week',
    automationLevel: 'medium',
    color: 'indigo',
    defaultFormats: ['text_post', 'thread', 'carousel'],
    promptTemplates: {
      default:
        'You are an AI insider sharing behind-the-scenes knowledge. Write a post that gives readers exclusive insight into how AI systems, companies, or processes work internally. Make them feel like they are getting access to information most people do not have.\n\nTopic: {{input}}',
    },
  },
  {
    slug: 'failure-lab',
    name: 'Failure Lab',
    icon: 'FlaskConical',
    description:
      'Transparent sharing of AI experiments that failed, lessons learned, and honest post-mortems that build authenticity and trust through vulnerability.',
    coreEmotion: 'Authenticity',
    bestPlatforms: ['linkedin', 'instagram', 'youtube', 'twitter'],
    frequency: '1x/week',
    automationLevel: 'low',
    color: 'orange',
    defaultFormats: ['text_post', 'video_short', 'carousel'],
    promptTemplates: {
      default:
        'You are an AI practitioner who values transparency. Write a post about an AI experiment or project that failed or had unexpected results. Share what you tried, what went wrong, what you learned, and what you would do differently. Be authentic and vulnerable.\n\nExperiment: {{input}}',
    },
  },
];

export const PILLAR_MAP = new Map(PILLARS.map((p) => [p.slug, p]));

export function getPillar(slug: string): PillarConfig | undefined {
  return PILLAR_MAP.get(slug);
}
