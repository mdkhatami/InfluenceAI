// packages/intelligence/src/index.ts
export * from './types';
export * from './config';
export { dispatchSwarm } from './dispatcher';
export { synthesizeBriefs, createFallbackBrief } from './synthesis';
export { selectAgents } from './agents/selector';
export { allAgents } from './agents/registry';
