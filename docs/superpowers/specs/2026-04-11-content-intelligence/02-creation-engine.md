# Phase 2: Creation Engine

**Parent:** `00-master-spec.md`
**Layer:** 3 (Creation)
**Depends on:** Phase 1 output (research_briefs table)
**Delivers:** Angle cards, narrative-structured drafts, and a voice profile that improves over time

---

## Overview

The Creation Engine transforms a Research Brief into publishable content through three sequential steps:
1. **Angle Generator** — produces 4-5 distinct angle cards from the brief
2. **Storytelling Engine** — wraps the selected angle in a narrative arc
3. **Voice DNA** — applies your learned writing style to the final draft

---

## Package Structure

```
packages/creation/
  src/
    angles/
      generator.ts           ← Angle card generation from research brief
      types.ts               ← AngleType, AngleCard
    storytelling/
      engine.ts              ← Story arc selection + plan + draft generation
      arcs.ts                ← 6 built-in story arc definitions
      types.ts               ← StoryArc, StoryBeat
    voice/
      tracker.ts             ← Edit tracking (hooks into content save)
      analyzer.ts            ← Style extraction from edit history (background job)
      injector.ts            ← Injects voice profile into generation prompts
      types.ts               ← VoiceProfile, StyleRule, Stance
    pipeline.ts              ← Full creation pipeline: brief → angle → story → draft
    types.ts                 ← Re-exports all creation types
    index.ts                 ← Public API
  package.json               ← @influenceai/creation
  tsconfig.json
```

---

## Component 1: Angle Generator

### Purpose

Takes a Research Brief and generates 4-5 angle cards — each a different take on the same material, backed by specific findings.

### Implementation

```typescript
async function generateAngles(
  brief: ResearchBrief,
  platform: Platform,
  llm: LLMClient
): Promise<AngleCard[]> {

  const result = await llm.generateJSON<{ angles: RawAngle[] }>({
    systemPrompt: ANGLE_GENERATOR_SYSTEM_PROMPT,
    userPrompt: `
Signal: "${brief.signal.title}"
${brief.signal.summary}

Top findings:
${brief.topFindings.map(f => `[${f.importance}] ${f.headline}: ${f.detail}`).join('\n')}

Cross-domain connections:
${brief.connections.map(c => `${c.narrativeHook}`).join('\n')}

Most surprising fact: ${brief.unusualFact}

Contributing agents: ${brief.coverage.agents.join(', ')}

Generate exactly 5 angle cards for ${platform}. Each must:
1. Use a DIFFERENT angle type
2. Be backed by SPECIFIC findings from above (reference them)
3. Have a ready-to-use opening hook line
4. Include a 1-2 sentence thesis
5. Estimate engagement potential (high/medium/low)
`,
    maxTokens: 1200,
    temperature: 0.7,  // Higher for creative diversity
  });

  return result.angles.map(raw => ({
    id: generateId(),
    researchBriefId: brief.id,
    angleType: raw.type,
    hook: raw.hook,
    thesis: raw.thesis,
    supportingFindings: raw.findingRefs.map(ref => brief.topFindings[ref]),
    domainSource: raw.primaryDomain,
    estimatedEngagement: raw.engagement,
    reasoning: raw.reasoning,
    status: 'generated' as const,
    createdAt: new Date(),
  }));
}

const ANGLE_GENERATOR_SYSTEM_PROMPT = `You are a content strategist who creates diverse, compelling angles for social media posts.

Given research findings from multiple domains (tech, finance, geopolitics, industry, developer ecosystem, history), generate 5 distinct content angles. Each angle must:

1. Use a different angle type from: contrarian, practical, prediction, historical_parallel, hidden_connection, career_impact, unraveling, david_vs_goliath, financial_signal, geopolitical_chess
2. Reference specific findings by index (0-based)
3. Have a bold, scroll-stopping hook (first line of the post)
4. Have a clear thesis (the argument in 1-2 sentences)
5. Identify which domain primarily drives this angle

DIVERSITY RULE: No two angles may share the same angle type OR the same primary domain source. Maximize how different the angles feel from each other.

Output JSON array of: { type, hook, thesis, findingRefs: number[], primaryDomain, engagement: "high"|"medium"|"low", reasoning }`;
```

### Angle auto-selection (batch mode)

When running overnight without user input, the system auto-selects the best angle per platform:

```typescript
function autoSelectAngle(angles: AngleCard[], platform: Platform): AngleCard {
  // Priority: high engagement > medium > low
  // Tiebreaker: more diverse domain source preferred
  // Platform fit: contrarian/unraveling work best on LinkedIn,
  //               practical works best on Twitter,
  //               hidden_connection works on all platforms
  const platformPreferences: Record<Platform, AngleType[]> = {
    linkedin: ['contrarian', 'hidden_connection', 'career_impact', 'prediction'],
    twitter: ['practical', 'contrarian', 'david_vs_goliath', 'unraveling'],
    instagram: ['practical', 'hidden_connection', 'david_vs_goliath'],
    youtube: ['unraveling', 'historical_parallel', 'prediction', 'practical'],
  };

  return angles
    .sort((a, b) => {
      // 1. Engagement (high > medium > low)
      const engScore = { high: 3, medium: 2, low: 1 };
      const engDiff = engScore[b.estimatedEngagement] - engScore[a.estimatedEngagement];
      if (engDiff !== 0) return engDiff;

      // 2. Platform preference
      const prefs = platformPreferences[platform];
      const aIdx = prefs.indexOf(a.angleType);
      const bIdx = prefs.indexOf(b.angleType);
      return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
    })[0];
}
```

---

## Component 2: Storytelling Engine

### Purpose

Takes a selected angle + research brief and wraps it in a narrative structure. Two-step LLM process: (1) select arc + plan beats, (2) generate full draft.

### 6 Built-In Story Arcs

Defined in `arcs.ts`:

```typescript
const STORY_ARCS: StoryArc[] = [
  {
    id: 'detective',
    name: 'The Detective',
    structure: [
      { name: 'hook', instruction: 'Open with curiosity — something doesn\'t add up, you noticed what others missed', maxLength: '2 sentences' },
      { name: 'investigation', instruction: 'Walk through what you found, step by step, building suspense', maxLength: '3-4 paragraphs' },
      { name: 'reveal', instruction: 'The surprising conclusion — the thing nobody expected', maxLength: '1-2 sentences' },
      { name: 'implication', instruction: 'What this means for the reader. Why they should care.', maxLength: '2-3 sentences' },
    ],
    bestFor: ['contrarian', 'unraveling', 'hidden_connection'],
    platformFit: { linkedin: 0.9, twitter: 0.7, instagram: 0.5, youtube: 0.8 },
  },
  {
    id: 'experiment',
    name: 'The Experiment',
    structure: [
      { name: 'hook', instruction: 'Declare what you tested and tease the result', maxLength: '1-2 sentences' },
      { name: 'setup', instruction: 'What you tested, how, and why — be specific', maxLength: '2-3 paragraphs' },
      { name: 'results', instruction: 'Honest findings with specific numbers. Include surprises and failures.', maxLength: '3-4 paragraphs' },
      { name: 'verdict', instruction: 'Clear recommendation: what works, what doesn\'t, who should care', maxLength: '2-3 sentences' },
    ],
    bestFor: ['practical', 'contrarian'],
    platformFit: { linkedin: 0.8, twitter: 0.8, instagram: 0.6, youtube: 0.9 },
  },
  {
    id: 'prophet',
    name: 'The Prophet',
    structure: [
      { name: 'hook', instruction: 'Bold prediction stated with conviction — no hedging', maxLength: '1-2 sentences' },
      { name: 'evidence', instruction: '3 specific data points that support the prediction', maxLength: '3 paragraphs' },
      { name: 'objection', instruction: 'The strongest counter-argument — show you considered it', maxLength: '1-2 paragraphs' },
      { name: 'rebuttal', instruction: 'Why the prediction still holds despite the objection', maxLength: '1-2 paragraphs' },
    ],
    bestFor: ['prediction', 'financial_signal'],
    platformFit: { linkedin: 0.9, twitter: 0.7, instagram: 0.4, youtube: 0.8 },
  },
  {
    id: 'historian',
    name: 'The Historian',
    structure: [
      { name: 'hook', instruction: 'Draw the parallel immediately — "This happened before"', maxLength: '1-2 sentences' },
      { name: 'parallel', instruction: 'Tell the historical story concisely. Specific names, dates, outcomes.', maxLength: '2-3 paragraphs' },
      { name: 'rhyme', instruction: 'How today\'s event mirrors the history — point by point', maxLength: '2-3 paragraphs' },
      { name: 'divergence', instruction: 'The key difference this time — and what it means for the outcome', maxLength: '1-2 paragraphs' },
    ],
    bestFor: ['historical_parallel', 'geopolitical_chess'],
    platformFit: { linkedin: 0.8, twitter: 0.6, instagram: 0.5, youtube: 0.9 },
  },
  {
    id: 'connector',
    name: 'The Connector',
    structure: [
      { name: 'hook', instruction: 'Two seemingly unrelated events. One hidden story.', maxLength: '1-2 sentences' },
      { name: 'thread_a', instruction: 'First event, told briefly but with a specific detail', maxLength: '1-2 paragraphs' },
      { name: 'thread_b', instruction: 'Second event, same treatment — specific detail', maxLength: '1-2 paragraphs' },
      { name: 'collision', instruction: 'The connection nobody sees. This is the value of the post.', maxLength: '2-3 paragraphs' },
      { name: 'implication', instruction: 'What this combined story means going forward', maxLength: '1-2 sentences' },
    ],
    bestFor: ['hidden_connection', 'geopolitical_chess', 'financial_signal'],
    platformFit: { linkedin: 0.9, twitter: 0.6, instagram: 0.4, youtube: 0.7 },
  },
  {
    id: 'underdog',
    name: 'The Underdog',
    structure: [
      { name: 'hook', instruction: 'Small team/unknown player just beat a giant. State it dramatically.', maxLength: '1-2 sentences' },
      { name: 'stakes', instruction: 'Why this matters — the giant was supposed to win', maxLength: '1-2 paragraphs' },
      { name: 'how', instruction: 'What the underdog did differently. Specific technical or strategic choices.', maxLength: '2-3 paragraphs' },
      { name: 'lesson', instruction: 'The generalizable takeaway for the reader', maxLength: '1-2 sentences' },
    ],
    bestFor: ['david_vs_goliath', 'practical'],
    platformFit: { linkedin: 0.8, twitter: 0.9, instagram: 0.7, youtube: 0.8 },
  },
];
```

### Arc Selection

```typescript
function selectArc(angle: AngleCard, platform: Platform): StoryArc {
  return STORY_ARCS
    .filter(arc => arc.bestFor.includes(angle.angleType))
    .sort((a, b) => b.platformFit[platform] - a.platformFit[platform])[0]
    ?? STORY_ARCS[0]; // Fallback to Detective if no match
}
```

### Two-Step Draft Generation

```typescript
async function generateDraft(
  brief: ResearchBrief,
  angle: AngleCard,
  arc: StoryArc,
  platform: Platform,
  voiceProfile: VoiceProfile | null,
  llm: LLMClient
): Promise<{ title: string; body: string; qualityScore: number; storyPlan: string }> {

  // STEP 1: Generate story plan (fast, structured)
  const plan = await llm.generateJSON<StoryPlan>({
    systemPrompt: 'You are a content strategist. Create a beat-by-beat story plan.',
    userPrompt: `
Angle: ${angle.angleType}
Hook: ${angle.hook}
Thesis: ${angle.thesis}
Story arc: ${arc.name}
Platform: ${platform}

Beats to fill:
${arc.structure.map(b => `- ${b.name}: ${b.instruction} (max: ${b.maxLength})`).join('\n')}

Available findings:
${angle.supportingFindings.map(f => `[${f.importance}] ${f.headline}: ${f.detail}`).join('\n')}

For each beat, specify: which finding(s) to use, the key point to make, and any specific data/quotes to include.
`,
    maxTokens: 400,
    temperature: 0.4,
  });

  // STEP 2: Generate full draft from plan
  let systemPrompt = buildDraftSystemPrompt(platform, arc);

  // Inject Voice DNA if available and confident
  if (voiceProfile && voiceProfile.confidence >= 0.3) {
    systemPrompt += buildVoiceInjection(voiceProfile);
  }

  const draft = await llm.generateWithQuality({
    systemPrompt,
    userPrompt: `
Write the full post following this exact plan:

ANGLE: ${angle.hook}
THESIS: ${angle.thesis}

STORY PLAN:
${plan.beats.map(b => `[${b.beatName}]: ${b.content} — Use: ${b.findings}`).join('\n')}

RESEARCH DATA (cite specific facts):
${brief.topFindings.map(f => `- ${f.headline}: ${f.detail}`).join('\n')}

Write the complete post now. Follow the beat structure exactly. Cite specific numbers and facts from the research data. Do NOT use generic filler.
`,
    maxTokens: 1500,
    temperature: 0.7,
  });

  return {
    title: extractTitle(draft.content),
    body: draft.content,
    qualityScore: draft.qualityScore,
    storyPlan: JSON.stringify(plan),
  };
}

function buildDraftSystemPrompt(platform: Platform, arc: StoryArc): string {
  const platformFormat = PLATFORM_FORMATS[platform];
  return `You are writing a ${platform} post using the "${arc.name}" narrative structure.

${platformFormat}

NARRATIVE RULES:
- Follow the beat structure: ${arc.structure.map(b => b.name).join(' → ')}
- Every beat must earn the reader's attention for the next beat
- The hook must work as a standalone statement — if someone only reads the first line, they should want to read more
- NEVER start with "I'm excited to share" or "In today's rapidly evolving landscape" or any generic opener
- Cite specific numbers, names, and facts — not vague references
- End with something the reader will want to respond to (question, provocation, or bold claim)
`;
}
```

---

## Component 3: Voice DNA

### Edit Tracker

Hooks into the existing content update API. When a content item is edited, capture the delta.

```typescript
// Called from PUT /api/content/[id] when body or title changes
async function trackEdit(
  db: SupabaseClient,
  contentItemId: string,
  beforeTitle: string,
  beforeBody: string,
  afterTitle: string,
  afterBody: string
): Promise<void> {
  // Only track if meaningful change occurred
  const editDistance = calculateEditDistance(beforeBody, afterBody);
  if (editDistance < 10) return; // Skip trivial edits (typo fixes)

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

function calculateEditDistance(a: string, b: string): number {
  // Word-level edit distance (not character-level)
  const wordsA = a.split(/\s+/);
  const wordsB = b.split(/\s+/);
  // Count words added + removed + changed
  // Returns approximate word-level changes
  const added = wordsB.filter(w => !wordsA.includes(w)).length;
  const removed = wordsA.filter(w => !wordsB.includes(w)).length;
  return added + removed;
}
```

### Style Analyzer (Background Job)

Runs periodically (every 20 new edits, or weekly) to extract style patterns.

```typescript
async function analyzeVoice(
  db: SupabaseClient,
  llm: LLMClient
): Promise<VoiceProfile> {
  // 1. Fetch unanalyzed edits
  const edits = await db.from('content_edits')
    .select('*')
    .eq('analyzed', false)
    .order('created_at', { ascending: true })
    .limit(50);

  if (edits.data.length < 5) {
    throw new Error('Not enough edits to analyze (minimum 5)');
  }

  // 2. Fetch current voice profile (if exists)
  const currentProfile = await getCurrentVoiceProfile(db);

  // 3. Send edits to LLM for style extraction
  const analysis = await llm.generateJSON<VoiceAnalysis>({
    systemPrompt: VOICE_ANALYZER_SYSTEM_PROMPT,
    userPrompt: `
Analyze these content edits to extract the author's writing style:

${edits.data.map((e, i) => `
--- Edit ${i + 1} ---
BEFORE: ${e.before_body.substring(0, 500)}
AFTER: ${e.after_body.substring(0, 500)}
`).join('\n')}

${currentProfile ? `Current voice profile (update, don't replace):\n${JSON.stringify(currentProfile.styleRules)}` : 'No existing profile — create from scratch.'}

Extract:
1. Style rules (patterns in what the author consistently changes)
2. Vocabulary preferences (words added vs removed)
3. Opening patterns (how they prefer to start posts)
4. CTA patterns (how they end posts)
5. Overall tone descriptor
6. Any topic-specific stances revealed by edits
`,
    maxTokens: 800,
    temperature: 0.3,
  });

  // 4. Select exemplar posts (approved posts with lowest edit distance = system got it right)
  const exemplars = await db.from('content_items')
    .select('id, platform, title, body, quality_score')
    .eq('status', 'approved')
    .order('quality_score', { ascending: false })
    .limit(20);

  // 5. Build and store new voice profile
  const totalEditsAnalyzed = (currentProfile?.editsAnalyzed ?? 0) + edits.data.length;
  const confidence = Math.min(1.0, totalEditsAnalyzed / 50); // Reaches 1.0 at 50 edits

  const profile: VoiceProfile = {
    id: generateId(),
    version: (currentProfile?.version ?? 0) + 1,
    confidence,
    styleRules: analysis.styleRules,
    vocabularyPreferences: analysis.vocabularyPreferences,
    openingPatterns: analysis.openingPatterns,
    ctaPatterns: analysis.ctaPatterns,
    toneDescriptor: analysis.toneDescriptor,
    stances: analysis.stances,
    exemplarPosts: exemplars.data.map(e => ({
      contentItemId: e.id,
      platform: e.platform,
      title: e.title,
      body: e.body,
      qualityScore: e.quality_score,
      editDistance: 0, // Would be populated from content_edits join
    })),
    updatedAt: new Date(),
  };

  await storeVoiceProfile(db, profile);

  // 6. Mark edits as analyzed
  await db.from('content_edits')
    .update({ analyzed: true })
    .in('id', edits.data.map(e => e.id));

  return profile;
}

const VOICE_ANALYZER_SYSTEM_PROMPT = `You analyze before/after content edits to extract an author's writing style. Focus on:

1. PATTERNS, not individual edits. A rule is only valid if you see it applied 3+ times.
2. What the author consistently ADDS (their signature elements)
3. What the author consistently REMOVES (their pet peeves)
4. Sentence structure preferences (short/long, simple/complex)
5. Tone shifts (formal→casual, passive→active, etc.)
6. Topic-specific opinions revealed through edits

Output JSON with: styleRules[], vocabularyPreferences: {preferred[], avoided[]}, openingPatterns[], ctaPatterns[], toneDescriptor, stances[]

Each styleRule needs: rule (the pattern), evidence (specific examples from edits), strength (0-1, how consistent).`;
```

### Voice Injector

Builds the voice profile section that gets appended to the generation system prompt.

```typescript
function buildVoiceInjection(profile: VoiceProfile): string {
  if (profile.confidence < 0.3) return ''; // Not confident enough

  let injection = '\n\n--- AUTHOR VOICE PROFILE ---\n';
  injection += `Tone: ${profile.toneDescriptor}\n\n`;

  // Style rules (only high-strength ones)
  const strongRules = profile.styleRules.filter(r => r.strength >= 0.5);
  if (strongRules.length > 0) {
    injection += 'Writing rules:\n';
    injection += strongRules.map(r => `- ${r.rule}`).join('\n');
    injection += '\n\n';
  }

  // Vocabulary
  if (profile.vocabularyPreferences.avoided.length > 0) {
    injection += `NEVER use these words/phrases: ${profile.vocabularyPreferences.avoided.join(', ')}\n`;
  }
  if (profile.vocabularyPreferences.preferred.length > 0) {
    injection += `Preferred vocabulary: ${profile.vocabularyPreferences.preferred.join(', ')}\n`;
  }

  // Stances (if relevant to current topic — caller should filter)
  if (profile.stances.length > 0) {
    injection += '\nAuthor positions on recurring topics:\n';
    injection += profile.stances.map(s => `- ${s.topic}: ${s.position}`).join('\n');
    injection += '\n';
  }

  // Exemplar posts (up to 3 as few-shot examples)
  const topExemplars = profile.exemplarPosts.slice(0, 3);
  if (topExemplars.length > 0) {
    injection += '\nExamples of the author\'s approved posts (match this style):\n';
    topExemplars.forEach((e, i) => {
      injection += `\n--- Example ${i + 1} (${e.platform}) ---\n${e.body.substring(0, 400)}\n`;
    });
  }

  return injection;
}
```

---

## Full Creation Pipeline

The main entry point that chains all three components:

```typescript
interface CreationResult {
  angleCards: AngleCard[];
  selectedAngle: AngleCard;
  storyArc: StoryArc;
  draft: {
    title: string;
    body: string;
    qualityScore: number;
    storyPlan: string;
  };
}

async function createContent(
  brief: ResearchBrief,
  platform: Platform,
  options: {
    selectedAngleId?: string;    // If user pre-selected (interactive mode)
    autoSelect?: boolean;        // If true, auto-pick best angle (batch mode)
  },
  db: SupabaseClient,
  llm: LLMClient
): Promise<CreationResult> {

  // 1. Generate angle cards
  const angleCards = await generateAngles(brief, platform, llm);
  await storeAngleCards(db, angleCards);

  // 2. Select angle (user-chosen or auto)
  let selectedAngle: AngleCard;
  if (options.selectedAngleId) {
    selectedAngle = angleCards.find(a => a.id === options.selectedAngleId)!;
  } else if (options.autoSelect) {
    selectedAngle = autoSelectAngle(angleCards, platform);
  } else {
    // Return angle cards only — wait for user selection
    // This path is used in interactive mode: UI shows cards, user picks
    return { angleCards, selectedAngle: null!, storyArc: null!, draft: null! };
  }

  await updateAngleStatus(db, selectedAngle.id, 'selected');

  // 3. Select story arc
  const storyArc = selectArc(selectedAngle, platform);

  // 4. Get voice profile
  const voiceProfile = await getCurrentVoiceProfile(db);

  // 5. Generate draft
  const draft = await generateDraft(brief, selectedAngle, storyArc, platform, voiceProfile, llm);

  return { angleCards, selectedAngle, storyArc, draft };
}
```

---

## Database Schema

```sql
-- Migration: 00004_creation_engine.sql

-- Angle cards generated per research brief
CREATE TABLE angle_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  research_brief_id UUID REFERENCES research_briefs(id) ON DELETE CASCADE,
  signal_id UUID REFERENCES content_signals(id),
  angle_type TEXT NOT NULL,
  hook TEXT NOT NULL,
  thesis TEXT NOT NULL,
  supporting_findings JSONB DEFAULT '[]',
  domain_source TEXT,
  estimated_engagement TEXT DEFAULT 'medium',
  reasoning TEXT,
  story_arc TEXT,                 -- Set when arc is selected
  status TEXT DEFAULT 'generated',  -- 'generated' | 'selected' | 'dismissed'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_angle_cards_brief ON angle_cards(research_brief_id);
CREATE INDEX idx_angle_cards_status ON angle_cards(status);

-- Edit tracking for Voice DNA
CREATE TABLE content_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
  before_title TEXT,
  before_body TEXT,
  after_title TEXT,
  after_body TEXT,
  edit_distance INTEGER DEFAULT 0,
  analyzed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_content_edits_analyzed ON content_edits(analyzed) WHERE analyzed = false;

-- Voice profile (versioned, one active at a time)
CREATE TABLE voice_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INTEGER NOT NULL DEFAULT 1,
  confidence FLOAT DEFAULT 0,
  style_rules JSONB DEFAULT '[]',
  vocabulary_preferences JSONB DEFAULT '{}',
  opening_patterns JSONB DEFAULT '[]',
  cta_patterns JSONB DEFAULT '[]',
  tone_descriptor TEXT,
  stances JSONB DEFAULT '[]',
  exemplar_post_ids UUID[] DEFAULT '{}',
  edits_analyzed INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_voice_profiles_active ON voice_profiles(is_active) WHERE is_active = true;

-- RLS policies
ALTER TABLE angle_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read" ON angle_cards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert" ON angle_cards FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON angle_cards FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read" ON content_edits FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert" ON content_edits FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated all" ON voice_profiles FOR ALL TO authenticated USING (true);
```

---

## API Routes

### Generate angles for a research brief

```
POST /api/creation/angles
Body: { researchBriefId: string, platform: Platform }

Response: { angleCards: AngleCard[] }
```

### Select angle and generate draft

```
POST /api/creation/draft
Body: { researchBriefId: string, angleCardId: string, platform: Platform }

Response: {
  draft: { title, body, qualityScore, storyPlan },
  storyArc: { id, name },
  contentItemId: string  // Saved to content_items with status 'pending_review'
}
```

### Get current voice profile

```
GET /api/voice/profile

Response: VoiceProfile (or null if no edits analyzed yet)
```

### Trigger voice analysis (manual or scheduled)

```
POST /api/voice/analyze

Response: { version: number, confidence: number, rulesExtracted: number, editsAnalyzed: number }
```

---

## Integration with Pipeline Runner

Phase 2 replaces the Phase 1 temporary generation step (`buildPromptFromBrief`) with the full creation pipeline:

```typescript
// In runner.ts, the generate step becomes:
for (const signal of topSignals) {
  const brief = await dispatchSwarm(signal, swarmConfig, db, llm);

  for (const platform of definition.platforms) {
    // Phase 2: full creation pipeline
    const result = await createContent(brief, platform, { autoSelect: true }, db, llm);

    await insertContentItem(db, {
      title: result.draft.title,
      body: result.draft.body,
      pillarSlug: definition.pillar,
      pipelineSlug: definition.id,
      platform,
      signalId: signal.sourceId,
      pipelineRunId: runId,
      qualityScore: result.draft.qualityScore,
      status: 'pending_review',
      metadata: {
        angleType: result.selectedAngle.angleType,
        storyArc: result.storyArc.id,
        researchBriefId: brief.id,
        angleCardId: result.selectedAngle.id,
      },
    });
  }
}
```

---

## Modification to Existing Content API

The `PUT /api/content/[id]` route needs one addition — call `trackEdit()` before saving:

```typescript
// In apps/web/src/app/api/content/[id]/route.ts
export async function PUT(request: Request, { params }) {
  const { title, body, status } = await request.json();

  // Fetch current version before update
  const { data: current } = await supabase.from('content_items').select('title, body').eq('id', params.id).single();

  // Track the edit if content changed (NEW)
  if (current && (current.title !== title || current.body !== body)) {
    await trackEdit(supabase, params.id, current.title, current.body, title, body);
  }

  // Existing update logic...
  const { data, error } = await supabase.from('content_items').update({ title, body, status }).eq('id', params.id);
  // ...
}
```

---

## Implementation Steps (for planning phase)

1. Create `packages/creation` package with types
2. Implement Angle Generator (LLM-based, core output: angle cards)
3. Define 6 story arcs in `arcs.ts` with beat structures
4. Implement Story Arc selector (angle type + platform → best arc)
5. Implement two-step draft generator (plan → draft)
6. Implement Edit Tracker (hook into content update API)
7. Implement Style Analyzer (background job, LLM-based extraction)
8. Implement Voice Injector (profile → system prompt augmentation)
9. Implement full creation pipeline (`createContent()`)
10. Create DB migration for angle_cards, content_edits, voice_profiles
11. Create API routes (angles, draft, voice profile, voice analyze)
12. Modify pipeline runner to use creation pipeline
13. Modify content API to track edits
14. Tests for angle generation, arc selection, voice injection
