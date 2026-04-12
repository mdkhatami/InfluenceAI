import { describe, it, expect, vi } from 'vitest';
import { trackEdit, calculateEditDistance } from '../../voice/tracker';

describe('Edit Tracker', () => {
  it('inserts edit when distance >= 10', async () => {
    const insert = vi.fn().mockResolvedValue({});
    const db = { from: vi.fn().mockReturnValue({ insert }) };

    await trackEdit(db, 'item-1', 'Old Title', 'The old body has many different words here that will change significantly in the next version',
      'New Title', 'The new body has completely rewritten content with totally fresh words and new perspectives');

    expect(db.from).toHaveBeenCalledWith('content_edits');
    expect(insert).toHaveBeenCalled();
  });

  it('skips when distance < 10', async () => {
    const insert = vi.fn();
    const db = { from: vi.fn().mockReturnValue({ insert }) };

    await trackEdit(db, 'item-1', 'Title', 'Hello world foo bar',
      'Title', 'Hello world foo baz');

    expect(insert).not.toHaveBeenCalled();
  });

  it('calculateEditDistance returns word-level change count', () => {
    const a = 'the quick brown fox jumps over the lazy dog';
    const b = 'the fast brown fox leaps over the sleepy cat';
    const distance = calculateEditDistance(a, b);
    // changed: quick->fast, jumps->leaps, lazy->sleepy, dog->cat = 4 removed + 4 added = 8
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(20);
  });
});
