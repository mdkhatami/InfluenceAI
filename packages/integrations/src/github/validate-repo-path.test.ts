import { describe, it, expect } from 'vitest';
import { isValidRepoPath } from './validate-repo-path';

describe('isValidRepoPath', () => {
  it('accepts "facebook/react"', () => {
    expect(isValidRepoPath('facebook/react')).toBe(true);
  });

  it('accepts "vercel/next.js"', () => {
    expect(isValidRepoPath('vercel/next.js')).toBe(true);
  });

  it('rejects "login?return_to=/trending"', () => {
    expect(isValidRepoPath('login?return_to=/trending')).toBe(false);
  });

  it('rejects "singleword"', () => {
    expect(isValidRepoPath('singleword')).toBe(false);
  });

  it('rejects "org/repo/extra"', () => {
    expect(isValidRepoPath('org/repo/extra')).toBe(false);
  });

  it('rejects "sponsors/someone"', () => {
    expect(isValidRepoPath('sponsors/someone')).toBe(false);
  });

  it('rejects "orgs/myorg"', () => {
    expect(isValidRepoPath('orgs/myorg')).toBe(false);
  });

  it('rejects "settings/profile"', () => {
    expect(isValidRepoPath('settings/profile')).toBe(false);
  });

  it('rejects "collections/ai"', () => {
    expect(isValidRepoPath('collections/ai')).toBe(false);
  });

  it('rejects "topics/machine-learning"', () => {
    expect(isValidRepoPath('topics/machine-learning')).toBe(false);
  });

  it('rejects empty string ""', () => {
    expect(isValidRepoPath('')).toBe(false);
  });

  it('rejects "/repo" (empty owner)', () => {
    expect(isValidRepoPath('/repo')).toBe(false);
  });

  it('rejects "org/" (empty repo)', () => {
    expect(isValidRepoPath('org/')).toBe(false);
  });
});
