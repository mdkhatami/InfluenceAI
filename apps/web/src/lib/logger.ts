type Level = 'info' | 'warn' | 'error';

interface LogFields {
  [key: string]: unknown;
}

function emit(level: Level, message: string, fields?: LogFields) {
  // Structured single-line JSON so logs stay greppable in Vercel/host logs.
  const line = JSON.stringify({ level, message, time: new Date().toISOString(), ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (message: string, fields?: LogFields) => emit('info', message, fields),
  warn: (message: string, fields?: LogFields) => emit('warn', message, fields),
  error: (message: string, fields?: LogFields) => emit('error', message, fields),
};

/**
 * Best-effort alert for background/cron failures. Always logs the error, and
 * additionally POSTs a short payload to ERROR_WEBHOOK_URL (e.g. a Slack or
 * Discord incoming webhook) when that env var is set. Never throws — alerting
 * must not break the request path.
 */
export async function reportError(
  context: string,
  error: unknown,
  fields?: LogFields,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(`${context}: ${message}`, { context, ...fields });

  const url = process.env.ERROR_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `🚨 InfluenceAI [${context}] ${message}` }),
    });
  } catch {
    // Swallow — alerting failures must never surface to the caller.
  }
}
