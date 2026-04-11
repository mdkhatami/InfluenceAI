type EnvRequirement = {
  key: string;
  required: boolean;
  description: string;
  category: 'supabase' | 'llm' | 'auth' | 'integrations' | 'cron';
};

const ENV_REQUIREMENTS: EnvRequirement[] = [
  // Supabase -- required for core functionality
  {
    key: 'NEXT_PUBLIC_SUPABASE_URL',
    required: true,
    description: 'Supabase project URL (e.g., https://xxx.supabase.co)',
    category: 'supabase',
  },
  {
    key: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    required: false, // falls back to ANON_KEY
    description: 'Supabase publishable key (or set NEXT_PUBLIC_SUPABASE_ANON_KEY)',
    category: 'supabase',
  },
  {
    key: 'SUPABASE_SERVICE_ROLE_KEY',
    required: false, // only needed for server-side pipeline execution
    description: 'Supabase service role key (needed for pipeline execution)',
    category: 'supabase',
  },

  // LLM -- needed for content generation
  {
    key: 'LLM_BASE_URL',
    required: false,
    description: 'LLM API base URL (e.g., https://api.openai.com/v1)',
    category: 'llm',
  },
  {
    key: 'LLM_API_KEY',
    required: false,
    description: 'LLM API key',
    category: 'llm',
  },
  {
    key: 'LLM_MODEL',
    required: false,
    description: 'LLM model name (e.g., gpt-4o)',
    category: 'llm',
  },

  // Auth
  {
    key: 'ALLOWED_EMAILS',
    required: false,
    description: 'Comma-separated email whitelist for auth',
    category: 'auth',
  },

  // Integrations
  {
    key: 'GITHUB_TOKEN',
    required: false,
    description: 'GitHub token (increases rate limit from 60 to 5000/hr)',
    category: 'integrations',
  },

  // Vercel Cron
  {
    key: 'CRON_SECRET',
    required: false,
    description: 'Secret for securing Vercel Cron endpoints',
    category: 'cron',
  },
];

export interface EnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

let cachedResult: EnvValidationResult | null = null;

/**
 * Validates environment variables and returns a result with errors and warnings.
 * Results are cached after the first call.
 */
export function validateEnv(): EnvValidationResult {
  if (cachedResult) return cachedResult;

  const errors: string[] = [];
  const warnings: string[] = [];

  for (const req of ENV_REQUIREMENTS) {
    const value = process.env[req.key];
    const isSet = value !== undefined && value !== '';

    if (req.required && !isSet) {
      errors.push(`Missing required env var: ${req.key} -- ${req.description}`);
    } else if (!req.required && !isSet) {
      warnings.push(`Optional env var not set: ${req.key} -- ${req.description}`);
    }
  }

  // Special case: check that at least one Supabase key is set
  const hasPublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY !== undefined &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY !== '';
  const hasAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== undefined &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== '';

  if (!hasPublishableKey && !hasAnonKey) {
    warnings.push(
      'Neither NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY nor NEXT_PUBLIC_SUPABASE_ANON_KEY is set. Auth will be disabled (dev mode).',
    );
  }

  // Special case: LLM vars should all be set together
  const llmVars = ['LLM_BASE_URL', 'LLM_API_KEY', 'LLM_MODEL'];
  const llmSet = llmVars.filter((k) => process.env[k] && process.env[k] !== '');
  if (llmSet.length > 0 && llmSet.length < 3) {
    warnings.push(
      `Partial LLM configuration: ${llmSet.join(', ')} set but ${llmVars.filter((k) => !llmSet.includes(k)).join(', ')} missing. Pipelines may fail.`,
    );
  }

  // Special case: CRON_SECRET should be set for production cron jobs
  if (!process.env.CRON_SECRET || process.env.CRON_SECRET === '') {
    warnings.push(
      'CRON_SECRET not set. Vercel Cron endpoints will reject all requests.',
    );
  }

  cachedResult = {
    valid: errors.length === 0,
    errors,
    warnings,
  };

  return cachedResult;
}

/**
 * Log env validation results once at startup.
 * Call from middleware or instrumentation.
 */
let hasLogged = false;

export function logEnvValidation(): void {
  if (hasLogged) return;
  hasLogged = true;

  const result = validateEnv();

  if (result.errors.length > 0) {
    console.error('\n========== ENVIRONMENT ERRORS ==========');
    for (const err of result.errors) {
      console.error(`  [ERROR] ${err}`);
    }
    console.error('=========================================\n');
  }

  if (result.warnings.length > 0) {
    console.warn('\n========== ENVIRONMENT WARNINGS ==========');
    for (const warn of result.warnings) {
      console.warn(`  [WARN] ${warn}`);
    }
    console.warn('==========================================\n');
  }

  if (result.valid && result.warnings.length === 0) {
    console.log('[env] All environment variables configured correctly.');
  }
}
