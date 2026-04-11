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

  static withModel(model: string): LLMClient {
    return new LLMClient({
      baseUrl: process.env.LLM_BASE_URL || 'http://localhost:4000',
      apiKey: process.env.LLM_API_KEY || '',
      model,
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
      max_tokens: params.maxTokens ?? 1500,       // Fix 7: was missing
      temperature: params.temperature ?? 0.7,      // Fix 7: was missing
      response_format: { type: 'json_object' },
    });

    return JSON.parse(response.choices[0]?.message?.content ?? '{}') as T;
  }

  async createEmbedding(input: string, model?: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: model || process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
      input: input.substring(0, 8000),
    });
    return response.data[0].embedding;
  }

  async generateWithQuality(params: LLMGenerateParams): Promise<LLMGenerateResult & { qualityScore: number }> {
    const qualitySystemSuffix = `\n\nIMPORTANT: Respond with a JSON object containing two fields:
- "content": the generated content text
- "qualityScore": your honest self-assessment of the content quality from 1 to 10 (10 = excellent, would definitely approve; 1 = low quality, should be rejected)

Respond ONLY with valid JSON.`;

    const response = await this.client.chat.completions.create({
      model: params.model ?? this.defaultModel,
      messages: [
        { role: 'system', content: params.systemPrompt + qualitySystemSuffix },
        { role: 'user', content: params.userPrompt },
      ],
      max_tokens: params.maxTokens ?? 2000,
      temperature: params.temperature ?? 0.7,
      response_format: { type: 'json_object' },
    });

    const raw = response.choices[0]?.message?.content ?? '{}';
    let parsed: { content?: string; qualityScore?: number };
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { content: raw, qualityScore: 5 };
    }

    return {
      content: parsed.content ?? raw,
      qualityScore: Math.min(10, Math.max(1, parsed.qualityScore ?? 5)),
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
}
