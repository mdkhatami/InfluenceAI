import { http, HttpResponse } from 'msw';

export const handlers = [
  // GitHub API — repo details
  http.get('https://api.github.com/repos/:owner/:repo', ({ params }) => {
    if (params.owner === 'fail') {
      return new HttpResponse(null, { status: 500 });
    }
    return HttpResponse.json({
      full_name: `${params.owner}/${params.repo}`,
      description: 'A test repository',
      stargazers_count: 15000,
      forks_count: 2000,
      open_issues_count: 150,
      language: 'Python',
      license: { spdx_id: 'Apache-2.0' },
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2026-04-01T00:00:00Z',
    });
  }),

  // GitHub API — README
  http.get(
    'https://api.github.com/repos/:owner/:repo/readme',
    ({ params }) => {
      if (params.owner === 'fail') {
        return new HttpResponse(null, { status: 500 });
      }
      const readmeContent =
        '# Test Repo\n\n' +
        'A new open-source LLM framework that achieves 95% accuracy on MMLU ' +
        'benchmarks with 3x fewer parameters than GPT-4.\n\n' +
        '## Features\n' +
        '- Efficient inference\n' +
        '- Apache 2.0 license\n' +
        '- Multi-GPU support';
      return HttpResponse.json({
        content: Buffer.from(readmeContent).toString('base64'),
        encoding: 'base64',
      });
    },
  ),

  // HackerNews Algolia API
  http.get('https://hn.algolia.com/api/v1/search', () => {
    return HttpResponse.json({
      hits: [
        {
          objectID: '1',
          title: 'Show HN: New AI framework',
          points: 150,
          num_comments: 45,
          created_at: '2026-04-10T00:00:00Z',
        },
        {
          objectID: '2',
          title: 'Discussion on AI trends',
          points: 80,
          num_comments: 20,
          created_at: '2026-04-09T00:00:00Z',
        },
      ],
      nbHits: 2,
    });
  }),

  // npm registry
  http.get('https://api.npmjs.org/downloads/point/last-week/:pkg', () => {
    return HttpResponse.json({
      downloads: 50000,
      package: 'test-package',
    });
  }),

  // PyPI stats
  http.get('https://pypistats.org/api/packages/:pkg/recent', () => {
    return HttpResponse.json({
      data: { last_week: 120000 },
    });
  }),

  // Yahoo Finance (for finance agent later)
  http.get(
    'https://query1.finance.yahoo.com/v8/finance/chart/:symbol',
    () => {
      return HttpResponse.json({
        chart: {
          result: [
            {
              meta: { regularMarketPrice: 150.0, previousClose: 145.0 },
              indicators: {
                quote: [{ close: [140, 142, 145, 148, 150] }],
              },
            },
          ],
        },
      });
    },
  ),
];
