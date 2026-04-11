// packages/intelligence/src/config.ts
export interface SwarmConfig {
  enabledAgents: string[];
  globalTimeout: number;
  maxConcurrent: number;
  triggerType?: 'batch' | 'manual'; // Fix 22
}

export const defaultSwarmConfig: SwarmConfig = {
  enabledAgents: ['tech', 'finance', 'geopolitics', 'industry', 'deveco', 'history'],
  globalTimeout: 90_000,
  maxConcurrent: 6,
};
