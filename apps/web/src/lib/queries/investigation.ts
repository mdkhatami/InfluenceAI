export async function getInvestigationStatus(db: any, signalId: string) {
  // Check if a research brief exists for this signal
  const { data: brief } = await db
    .from('research_briefs')
    .select('*')
    .eq('signal_id', signalId)
    .single();

  if (!brief) return null;

  // Get angle cards if they exist
  const { data: angles } = await db
    .from('angle_cards')
    .select('*')
    .eq('research_brief_id', brief.id);

  return { brief, angleCards: angles || [] };
}
