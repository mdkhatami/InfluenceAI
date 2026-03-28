import type { Signal, SignalSource } from '@influenceai/core';

export interface AdapterConfig {
  maxAge?: number;
  [key: string]: unknown;
}

export interface SignalAdapter {
  source: SignalSource;
  fetch(config?: AdapterConfig): Promise<Signal[]>;
}
