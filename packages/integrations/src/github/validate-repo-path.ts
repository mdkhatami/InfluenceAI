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

export function isValidRepoPath(path: string): boolean {
  if (!path || !path.includes('/')) return false;
  const parts = path.split('/');
  if (parts.length !== 2) return false;
  const [owner, repo] = parts;
  if (!owner || !repo) return false;
  if (INVALID_PREFIXES.some((prefix) => owner.toLowerCase().startsWith(prefix))) return false;
  return true;
}
