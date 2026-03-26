export interface SourceAdapter {
  name: string;
  fetch(params?: Record<string, unknown>): Promise<unknown[]>;
}

export interface LLMClient {
  generate(prompt: string, options?: { model?: string; maxTokens?: number; temperature?: number }): Promise<string>;
  generateStructured<T>(prompt: string, schema: unknown, options?: { model?: string }): Promise<T>;
}
