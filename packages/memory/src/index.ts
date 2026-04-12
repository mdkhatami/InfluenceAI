export * from './types';
export { indexContentItem, batchIndexContent } from './content-memory/indexer';
export { findSimilarContent, findByEntity, findOpenPredictions, findStances, findCoverageGaps } from './content-memory/queries';
export { collectTrendData, fetchGitHubMetrics, fetchNpmDownloads, fetchPyPIDownloads, fetchHNMentions } from './trends/collector';
export { analyzeTrends, selectPrimaryMetric, computeVelocity, computeAcceleration, detectPhase, computeContentSignal } from './trends/analyzer';
export { discoverNewEntities } from './trends/analyzer';
