export async function trackEdit(
  db: any, // SupabaseClient
  contentItemId: string,
  beforeTitle: string,
  beforeBody: string,
  afterTitle: string,
  afterBody: string,
): Promise<void> {
  const editDistance = calculateEditDistance(beforeBody, afterBody);
  if (editDistance < 10) return; // Skip trivial edits
  await db.from('content_edits').insert({
    content_item_id: contentItemId,
    before_title: beforeTitle,
    before_body: beforeBody,
    after_title: afterTitle,
    after_body: afterBody,
    edit_distance: editDistance,
    analyzed: false,
  });
}

export function calculateEditDistance(a: string, b: string): number {
  const wordsA = a.split(/\s+/).filter(Boolean);
  const wordsB = b.split(/\s+/).filter(Boolean);
  const setA = new Set(wordsA);
  const setB = new Set(wordsB);
  const added = wordsB.filter(w => !setA.has(w)).length;
  const removed = wordsA.filter(w => !setB.has(w)).length;
  return added + removed;
}
