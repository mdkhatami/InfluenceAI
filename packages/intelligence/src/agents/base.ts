import type { ScoredSignal, AgentBrief, InvestigationContext } from '../types';

export interface InvestigationAgent {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  timeout: number;
  investigate(signal: ScoredSignal, context?: InvestigationContext): Promise<AgentBrief>;
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Agent timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// Fix 11: SSRF protection for URL fetching
export function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const h = parsed.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return false;
    if (h.startsWith('10.') || h.startsWith('192.168.') || h.startsWith('169.254.')) return false;
    if (h.endsWith('.internal') || h.endsWith('.local')) return false;
    return true;
  } catch {
    return false;
  }
}
