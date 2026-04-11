import type { ScoredSignal } from '@influenceai/core';
import type { LLMClient, LLMGenerateParams } from '@influenceai/integrations';
import type { InvestigationAgent } from './base';
import type {
  AgentBrief,
  FinanceExtraction,
  Finding,
  SourceCitation,
  InvestigationContext,
} from '../types';
import companyTickers from './data/company-tickers.json';

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const FINANCE_AGENT_SYSTEM_PROMPT = `You are a financial research analyst specializing in technology sector stocks and market implications of AI developments.

Your task is to analyze a signal and extract key financial findings relevant to the AI and tech industry.

Analyze the financial significance of the provided signal. Your goal is to:
1. Identify specific, verifiable financial facts (stock moves, revenue impacts, market caps, valuations)
2. Assess the market implications for publicly traded companies
3. Note any analyst predictions or market consensus views
4. Rate the importance of each finding (high/medium/low)
5. Suggest 2-3 compelling narrative hooks that connect the technology to its financial implications

Return your analysis as JSON matching this exact structure:
{
  "findings": [
    {
      "type": "fact" | "comparison" | "prediction" | "contradiction" | "trend",
      "headline": "short headline summarizing the finding",
      "detail": "1-2 sentence explanation with specifics",
      "importance": "high" | "medium" | "low"
    }
  ],
  "hooks": ["narrative hook 1", "narrative hook 2"],
  "sources": [
    {
      "title": "source title",
      "url": "source url",
      "source": "yahoo_finance | alpha_vantage | web | etc",
      "accessedAt": "ISO date string"
    }
  ]
}

Focus on:
- Concrete price movements and market cap changes
- Revenue and earnings implications for relevant companies
- Analyst consensus and price targets
- Broader market and sector implications`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CompanyTickerMap = Record<string, string | null>;

const TICKER_MAP = companyTickers as CompanyTickerMap;

interface StockData {
  ticker: string;
  currentPrice: number;
  previousClose: number;
  closePrices: number[];
}

// ---------------------------------------------------------------------------
// Finance Agent
// ---------------------------------------------------------------------------

export class FinanceAgent implements InvestigationAgent {
  readonly id = 'finance';
  readonly name = 'Finance Signal';
  readonly description =
    'Analyzes financial implications of AI signals: stock movements, market impacts, and revenue forecasts';
  readonly enabled = true;
  readonly timeout = 25000;

  private llm: LLMClient;

  constructor(llm: LLMClient) {
    this.llm = llm;
  }

  /**
   * Scan signal title + summary for known company names.
   * Returns first match found, or null if no company detected.
   */
  findTicker(
    signal: ScoredSignal,
  ): { company: string; ticker: string | null } | null {
    const text = `${signal.title} ${signal.summary}`.toLowerCase();

    for (const [company, ticker] of Object.entries(TICKER_MAP)) {
      if (text.includes(company.toLowerCase())) {
        return { company, ticker };
      }
    }

    return null;
  }

  /**
   * Fetch 5-day stock price data from Yahoo Finance.
   * Falls back to Alpha Vantage if Yahoo fails and ALPHA_VANTAGE_API_KEY is set.
   * Returns null on any failure.
   */
  async fetchStockData(ticker: string): Promise<StockData | null> {
    // Try Yahoo Finance first
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=5d&interval=1d`;
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          chart?: {
            result?: Array<{
              meta?: { regularMarketPrice?: number; previousClose?: number };
              indicators?: { quote?: Array<{ close?: number[] }> };
            }>;
          };
        };

        const result = data?.chart?.result?.[0];
        if (result) {
          const currentPrice = result.meta?.regularMarketPrice ?? 0;
          const previousClose = result.meta?.previousClose ?? 0;
          const closePrices = result.indicators?.quote?.[0]?.close ?? [];

          return { ticker, currentPrice, previousClose, closePrices };
        }
      }
    } catch {
      // Yahoo failed, try Alpha Vantage fallback
    }

    // Alpha Vantage fallback (Fix 17)
    const alphaKey = process.env.ALPHA_VANTAGE_API_KEY;
    if (alphaKey) {
      try {
        const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${ticker}&apikey=${alphaKey}`;
        const res = await fetch(url, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(10000),
        });

        if (res.ok) {
          const data = (await res.json()) as {
            'Time Series (Daily)'?: Record<
              string,
              { '4. close': string }
            >;
          };

          const timeSeries = data['Time Series (Daily)'];
          if (timeSeries) {
            const dates = Object.keys(timeSeries).sort().reverse().slice(0, 5);
            const closePrices = dates.map((d) =>
              parseFloat(timeSeries[d]['4. close']),
            );
            const currentPrice = closePrices[0] ?? 0;
            const previousClose = closePrices[1] ?? currentPrice;

            return { ticker, currentPrice, previousClose, closePrices };
          }
        }
      } catch {
        // Alpha Vantage also failed
      }
    }

    return null;
  }

  async investigate(
    signal: ScoredSignal,
    _context?: InvestigationContext,
  ): Promise<AgentBrief> {
    try {
      // 1. Find company/ticker from signal text
      const tickerResult = this.findTicker(signal);

      // 2. Fetch stock data if ticker is public (non-null)
      let stockData: StockData | null = null;
      if (tickerResult?.ticker) {
        stockData = await this.fetchStockData(tickerResult.ticker);
      }

      // 3. If no financial relevance detected at all, return low-confidence partial
      if (!tickerResult) {
        // Still call LLM — maybe it can extract something useful
        const userPrompt = this.buildUserPrompt(signal, null, null);
        const params: LLMGenerateParams = {
          systemPrompt: FINANCE_AGENT_SYSTEM_PROMPT,
          userPrompt,
          maxTokens: 1000,
          temperature: 0.3,
        };

        const extraction = await this.llm.generateJSON<FinanceExtraction>(
          params,
        );
        const findings = this.mapFindings(extraction.findings || []);

        if (findings.length === 0) {
          return {
            agentId: this.id,
            status: 'partial',
            findings: [],
            narrativeHooks: [],
            confidence: 0.1,
            sources: [],
            rawData: { reason: 'No financial relevance detected' },
          };
        }

        return {
          agentId: this.id,
          status: 'partial',
          findings,
          narrativeHooks: extraction.hooks || [],
          confidence: 0.2,
          sources: this.mapSources(extraction.sources || [], signal),
        };
      }

      // 4. Build prompt with available data
      const userPrompt = this.buildUserPrompt(signal, tickerResult, stockData);

      const params: LLMGenerateParams = {
        systemPrompt: FINANCE_AGENT_SYSTEM_PROMPT,
        userPrompt,
        maxTokens: 1200,
        temperature: 0.3,
      };

      const extraction = await this.llm.generateJSON<FinanceExtraction>(params);

      const findings = this.mapFindings(extraction.findings || []);
      const sources = this.mapSources(extraction.sources || [], signal);
      const hooks = extraction.hooks || [];

      // Add Yahoo Finance as source if we fetched stock data
      if (stockData) {
        sources.push({
          title: 'Yahoo Finance',
          url: `https://finance.yahoo.com/quote/${tickerResult.ticker}`,
          source: 'yahoo_finance',
          accessedAt: new Date(),
        });
      }

      return {
        agentId: this.id,
        status: 'success',
        findings,
        narrativeHooks: hooks,
        confidence: this.computeConfidence(findings, stockData !== null),
        sources,
      };
    } catch (error) {
      // Never throw — always return a brief
      return {
        agentId: this.id,
        status: 'failed',
        findings: [],
        narrativeHooks: [],
        confidence: 0,
        sources: [],
        rawData: {
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  private buildUserPrompt(
    signal: ScoredSignal,
    tickerResult: { company: string; ticker: string | null } | null,
    stockData: StockData | null,
  ): string {
    const parts = [
      `Signal Title: ${signal.title}`,
      `Signal Summary: ${signal.summary}`,
      `Source Type: ${signal.sourceType}`,
      `URL: ${signal.url}`,
      `Score: ${signal.score}`,
    ];

    if (tickerResult) {
      parts.push('');
      parts.push(`--- Company Context ---`);
      parts.push(`Company: ${tickerResult.company}`);
      if (tickerResult.ticker) {
        parts.push(`Ticker: ${tickerResult.ticker} (publicly traded)`);
      } else {
        parts.push(`Ticker: N/A (private company)`);
      }
    }

    if (stockData) {
      const change = stockData.currentPrice - stockData.previousClose;
      const changePct =
        stockData.previousClose > 0
          ? ((change / stockData.previousClose) * 100).toFixed(2)
          : '0.00';
      parts.push('');
      parts.push(`--- Recent Stock Data (${stockData.ticker}) ---`);
      parts.push(`Current Price: $${stockData.currentPrice.toFixed(2)}`);
      parts.push(`Previous Close: $${stockData.previousClose.toFixed(2)}`);
      parts.push(`Change: ${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePct}%)`);
      if (stockData.closePrices.length > 0) {
        parts.push(
          `5-Day Closes: ${stockData.closePrices.map((p) => `$${p.toFixed(2)}`).join(', ')}`,
        );
      }
    } else if (tickerResult?.ticker) {
      parts.push('');
      parts.push(
        'Note: Could not fetch real-time stock data. Analyze based on signal context only.',
      );
    }

    return parts.join('\n');
  }

  private mapFindings(raw: Partial<Finding>[]): Finding[] {
    return raw.map((f) => ({
      type: f.type || 'fact',
      headline: f.headline || '',
      detail: f.detail || '',
      importance: f.importance || 'medium',
      ...(f.data ? { data: f.data } : {}),
    }));
  }

  private mapSources(
    raw: Partial<SourceCitation>[],
    signal: ScoredSignal,
  ): SourceCitation[] {
    return raw.map((s) => ({
      title: s.title || '',
      url: s.url || signal.url,
      source: s.source || signal.sourceType,
      accessedAt:
        s.accessedAt instanceof Date
          ? s.accessedAt
          : s.accessedAt
            ? new Date(s.accessedAt as unknown as string)
            : new Date(),
    }));
  }

  private computeConfidence(
    findings: Finding[],
    hasStockData: boolean,
  ): number {
    if (findings.length === 0) return 0.1;

    let score = 0.4;
    score += Math.min(findings.length * 0.1, 0.3);

    const highCount = findings.filter((f) => f.importance === 'high').length;
    score += Math.min(highCount * 0.1, 0.2);

    if (hasStockData) {
      score += 0.1;
    }

    return Math.min(score, 1);
  }
}
