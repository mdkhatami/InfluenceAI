/**
 * Verifies that a request comes from Vercel Cron.
 * Vercel sends an `Authorization: Bearer <CRON_SECRET>` header.
 */
export function verifyCronAuth(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('[cron] CRON_SECRET not configured');
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}
