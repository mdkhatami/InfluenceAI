const INVALID_PREFIXES = [
  'login',
  'signup',
  'sponsors',
  'orgs',
  'settings',
  'collections',
  'topics',
  'features',
  'marketplace',
  'explore',
  'notifications',
  'new',
  'codespaces',
];

/**
 * Validates that a path extracted from GitHub trending HTML is a real owner/repo path.
 * Rejects login redirects, known GitHub UI paths, and malformed paths.
 */
export function isValidRepoPath(path: string): boolean {
  if (!path || !path.includes('/')) return false;
  const parts = path.split('/');
  if (parts.length !== 2) return false;
  const [owner, repo] = parts;
  if (!owner || !repo) return false;
  if (INVALID_PREFIXES.includes(owner.toLowerCase())) return false;

  // Reject characters that can't appear in GitHub usernames or repo names
  if (!/^[a-zA-Z0-9._-]+$/.test(owner) || !/^[a-zA-Z0-9._-]+$/.test(repo)) return false;

  return true;
}
