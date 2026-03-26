import OpenAI from 'openai';

export interface LLMGenerateParams {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

export interface LLMGenerateResult {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class LLMClient {
  private client: OpenAI;
  private defaultModel: string;

  constructor(config: { baseUrl: string; apiKey: string; model: string }) {
    this.client = new OpenAI({
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
    });
    this.defaultModel = config.model;
  }

  static fromEnv(): LLMClient {
    return new LLMClient({
      baseUrl: process.env.LLM_BASE_URL || 'http://localhost:4000',
      apiKey: process.env.LLM_API_KEY || '',
      model: process.env.LLM_MODEL || 'default',
    });
  }

  async generate(params: LLMGenerateParams): Promise<LLMGenerateResult> {
    const response = await this.client.chat.completions.create({
      model: params.model ?? this.defaultModel,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userPrompt },
      ],
      max_tokens: params.maxTokens ?? 1500,
      temperature: params.temperature ?? 0.7,
    });

    const choice = response.choices[0];
    return {
      content: choice?.message?.content || '',
      model: response.model,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    };
  }

  async generateJSON<T>(params: LLMGenerateParams): Promise<T> {
    const response = await this.client.chat.completions.create({
      model: params.model ?? this.defaultModel,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userPrompt },
      ],
      response_format: { type: 'json_object' },
    });

    return JSON.parse(response.choices[0]?.message?.content ?? '{}') as T;
  }
}
