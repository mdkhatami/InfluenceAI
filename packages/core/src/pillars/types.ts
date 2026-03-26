import type { Platform, ContentFormat } from '../content/types';

export type AutomationLevel = 'high' | 'medium' | 'low' | 'manual';

export interface PillarConfig {
  slug: string;
  name: string;
  icon: string; // Lucide icon name
  description: string;
  coreEmotion: string;
  bestPlatforms: Platform[];
  frequency: string;
  automationLevel: AutomationLevel;
  color: string; // Tailwind color class
  defaultFormats: ContentFormat[];
  promptTemplates: Record<string, string>;
}
