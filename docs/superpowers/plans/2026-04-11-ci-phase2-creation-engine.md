# Phase 2: Creation Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Research Briefs into publishable content through angle generation (4-5 diverse angle cards), narrative-structured drafts (6 story arcs), and a voice profile that learns from user edits over time.

**Architecture:** New `packages/creation` package with three components: Angle Generator, Storytelling Engine, Voice DNA. Each component is independently testable. Reads from `research_briefs` table, writes to `angle_cards`, `content_edits`, `voice_profiles`, and `content_items` tables.

**Tech Stack:** TypeScript, OpenAI SDK (via LLMClient), Supabase, Vitest.

**Spec:** `docs/superpowers/specs/2026-04-11-content-intelligence/02-creation-engine.md`
**Errata:** Fixes 3 (exemplar_posts JSONB), 9 (voice profile deactivation), 15 (findingRefs bounds), 16 (CreationResult union), 21 (PLATFORM_FORMATS export)

---

## File Structure

```
packages/creation/
  package.json
  tsconfig.json
  src/
    types.ts                           ← All creation types (AngleCard, StoryArc, VoiceProfile, CreationResult, Draft)
    angles/
      generator.ts                     ← generateAngles(), autoSelectAngle()
    storytelling/
      arcs.ts                          ← 6 story arc definitions (Detective, Experiment, Prophet, Historian, Connector, Underdog)
      engine.ts                        ← selectArc(), generateDraft() (two-step: plan → draft)
    voice/
      tracker.ts                       ← trackEdit(), calculateEditDistance()
      analyzer.ts                      ← analyzeVoice() — background style extraction
      injector.ts                      ← buildVoiceInjection()
    pipeline.ts                        ← createContent() — full pipeline: brief → angles → arc → draft
    index.ts                           ← Public API
    __tests__/
      angles/generator.test.ts
      storytelling/arcs.test.ts
      storytelling/engine.test.ts
      voice/tracker.test.ts
      voice/analyzer.test.ts
      voice/injector.test.ts
      pipeline.test.ts
    __fixtures__/
      angle-response.json
      story-plan-response.json
      draft-with-quality.json
      voice-analysis-response.json

packages/integrations/src/llm/prompts.ts  ← MODIFY: export PLATFORM_FORMATS (Fix 21)
packages/integrations/src/index.ts        ← MODIFY: re-export PLATFORM_FORMATS

packages/database/supabase/migrations/
  00004_creation_engine.sql               ← NEW: angle_cards, content_edits, voice_profiles tables

apps/web/src/app/api/
  creation/angles/route.ts                ← NEW: POST generate angles
  creation/draft/route.ts                 ← NEW: POST generate draft from angle
  voice/profile/route.ts                  ← NEW: GET current voice profile
  voice/analyze/route.ts                  ← NEW: POST trigger voice analysis
  content/[id]/route.ts                   ← MODIFY: add edit tracking on PUT
```

---

### Task 1: Package scaffolding + types

**Files:**
- Create: `packages/creation/package.json`
- Create: `packages/creation/tsconfig.json`
- Create: `packages/creation/src/types.ts`
- Create: `packages/creation/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@influenceai/creation",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "@influenceai/core": "workspace:*",
    "@influenceai/database": "workspace:*",
    "@influenceai/integrations": "workspace:*",
    "@influenceai/intelligence": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json** (same pattern as other packages)

- [ ] **Step 3: Create types.ts**

Write all creation types from master spec `00-master-spec.md` Creation Types section: `AngleType`, `AngleCard`, `StoryArc`, `StoryBeat`, `VoiceProfile` (with `editsAnalyzed` — Fix 3), `StyleRule`, `ExtractedStance`, `Stance`, `ExemplarPost`, `Draft`, `CreationResult` discriminated union (Fix 16). Also add `RawAngle` (LLM output), `StoryPlan`, `VoiceAnalysis` types for internal use.

- [ ] **Step 4: Create index.ts stub**

```typescript
export * from './types';
```

- [ ] **Step 5: Install + type-check**

Run: `pnpm install && cd packages/creation && pnpm exec tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add packages/creation/
git commit -m "feat(creation): scaffold package with types"
```

---

### Task 2: Export PLATFORM_FORMATS (Fix 21)

**Files:**
- Modify: `packages/integrations/src/llm/prompts.ts`
- Modify: `packages/integrations/src/index.ts`

- [ ] **Step 1: Read current prompts.ts and verify PLATFORM_FORMATS exists**

Read `packages/integrations/src/llm/prompts.ts`. The `PLATFORM_FORMATS` record should already be defined but not exported.

- [ ] **Step 2: Add export keyword**

Add `export` before `const PLATFORM_FORMATS` in `packages/integrations/src/llm/prompts.ts`.

- [ ] **Step 3: Re-export from index.ts**

Add to `packages/integrations/src/index.ts`:
```typescript
export { PLATFORM_FORMATS } from './llm/prompts';
```

- [ ] **Step 4: Commit**

```bash
git add packages/integrations/src/llm/prompts.ts packages/integrations/src/index.ts
git commit -m "fix(integrations): export PLATFORM_FORMATS (Fix 21)"
```

---

### Task 3: Story arcs + arc selection

**Files:**
- Create: `packages/creation/src/storytelling/arcs.ts`
- Test: `packages/creation/src/__tests__/storytelling/arcs.test.ts`

- [ ] **Step 1: Write arc selection test**

```typescript
// packages/creation/src/__tests__/storytelling/arcs.test.ts
import { describe, it, expect } from 'vitest';
import { STORY_ARCS, selectArc } from '../storytelling/arcs';
import type { AngleCard } from '../types';

function mockAngle(overrides: Partial<AngleCard> = {}): AngleCard {
  return {
    id: '1', researchBriefId: 'b1', angleType: 'contrarian', hook: 'Hook',
    thesis: 'Thesis', supportingFindings: [], domainSource: 'tech',
    estimatedEngagement: 'high', reasoning: 'test', status: 'generated', createdAt: new Date(),
    ...overrides,
  };
}

describe('Story Arcs', () => {
  it('has exactly 6 arcs defined', () => {
    expect(STORY_ARCS).toHaveLength(6);
  });

  it('contrarian → Detective on LinkedIn', () => {
    const arc = selectArc(mockAngle({ angleType: 'contrarian' }), 'linkedin');
    expect(arc.id).toBe('detective');
  });

  it('prediction → Prophet on LinkedIn', () => {
    const arc = selectArc(mockAngle({ angleType: 'prediction' }), 'linkedin');
    expect(arc.id).toBe('prophet');
  });

  it('historical_parallel → Historian on YouTube', () => {
    const arc = selectArc(mockAngle({ angleType: 'historical_parallel' }), 'youtube');
    expect(arc.id).toBe('historian');
  });

  it('fallback to Detective when no match', () => {
    const arc = selectArc(mockAngle({ angleType: 'career_impact' }), 'linkedin');
    expect(arc).toBeDefined();
    // career_impact isn't in any arc's bestFor, so falls back to first arc (detective)
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/creation/src/__tests__/storytelling/arcs.test.ts`

- [ ] **Step 3: Implement arcs.ts**

Write `packages/creation/src/storytelling/arcs.ts` with all 6 story arcs exactly as defined in spec `02-creation-engine.md` "6 Built-In Story Arcs" section. Each arc has `id`, `name`, `structure` (StoryBeat[]), `bestFor` (AngleType[]), `platformFit` (Record<Platform, number>).

Export `STORY_ARCS` array and `selectArc(angle, platform)` function that filters arcs by `bestFor.includes(angle.angleType)`, sorts by `platformFit[platform]` descending, returns first match or falls back to `STORY_ARCS[0]`.

- [ ] **Step 4: Run test**

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/creation/src/storytelling/arcs.ts packages/creation/src/__tests__/storytelling/arcs.test.ts
git commit -m "feat(creation): 6 story arcs with platform-aware selection"
```

---

### Task 4: Angle Generator

**Files:**
- Create: `packages/creation/src/angles/generator.ts`
- Create: `packages/creation/src/__fixtures__/angle-response.json`
- Test: `packages/creation/src/__tests__/angles/generator.test.ts`

- [ ] **Step 1: Create fixture**

```json
{
  "angles": [
    { "type": "contrarian", "hook": "Everyone's celebrating this launch. Here's why they shouldn't be.", "thesis": "The benchmarks hide a critical limitation.", "findingRefs": [0, 2], "primaryDomain": "tech", "engagement": "high", "reasoning": "Contrarian takes on popular news perform well" },
    { "type": "historical_parallel", "hook": "This happened before. In 2014, with Docker.", "thesis": "The adoption curve mirrors Docker's — and we know how that ended.", "findingRefs": [1], "primaryDomain": "history", "engagement": "high", "reasoning": "History parallels are shareable" },
    { "type": "practical", "hook": "I tested this for 3 hours. Here's what actually works.", "thesis": "The framework excels at X but fails at Y.", "findingRefs": [0], "primaryDomain": "tech", "engagement": "medium", "reasoning": "Practical testing content is evergreen" },
    { "type": "prediction", "hook": "This model will be irrelevant in 6 months. Here's why.", "thesis": "The open-source velocity will commoditize this within two release cycles.", "findingRefs": [0, 1], "primaryDomain": "deveco", "engagement": "medium", "reasoning": "Bold predictions drive debate" },
    { "type": "career_impact", "hook": "If you're an ML engineer, this changes your job tomorrow.", "thesis": "The skill requirements for ML engineers just shifted dramatically.", "findingRefs": [0], "primaryDomain": "industry", "engagement": "medium", "reasoning": "Career content resonates on LinkedIn" }
  ]
}
```

- [ ] **Step 2: Write test**

```typescript
// packages/creation/src/__tests__/angles/generator.test.ts
import { describe, it, expect } from 'vitest';
import { generateAngles, autoSelectAngle } from '../angles/generator';
import { createMockLLMClient } from '@influenceai/intelligence/__mocks__/llm-mock'; // reuse

describe('Angle Generator', () => {
  it('generates exactly 5 angle cards', async () => {
    const brief = mockResearchBrief();
    const angles = await generateAngles(brief, 'linkedin', createMockLLMClient());
    expect(angles).toHaveLength(5);
  });

  it('all 5 have different angleType values', async () => {
    const angles = await generateAngles(mockResearchBrief(), 'linkedin', createMockLLMClient());
    const types = new Set(angles.map(a => a.angleType));
    expect(types.size).toBe(5);
  });

  it('handles out-of-range findingRefs with bounds checking (Fix 15)', async () => {
    // Fixture has findingRefs [0, 2] but brief only has 2 findings (indices 0, 1)
    const brief = mockResearchBrief({ topFindings: [mockFinding(), mockFinding()] });
    const angles = await generateAngles(brief, 'linkedin', createMockLLMClient());
    // Should not crash — out-of-range refs filtered out
    angles.forEach(a => {
      a.supportingFindings.forEach(f => expect(f).toBeDefined());
    });
  });

  it('autoSelectAngle picks highest engagement', () => {
    const angles = [
      mockAngle({ estimatedEngagement: 'low', angleType: 'practical' }),
      mockAngle({ estimatedEngagement: 'high', angleType: 'contrarian' }),
      mockAngle({ estimatedEngagement: 'medium', angleType: 'prediction' }),
    ];
    const selected = autoSelectAngle(angles, 'linkedin');
    expect(selected.estimatedEngagement).toBe('high');
  });

  it('autoSelectAngle uses platform preference tiebreaker', () => {
    const angles = [
      mockAngle({ estimatedEngagement: 'high', angleType: 'practical' }),
      mockAngle({ estimatedEngagement: 'high', angleType: 'contrarian' }),
    ];
    // LinkedIn prefers contrarian over practical
    const selected = autoSelectAngle(angles, 'linkedin');
    expect(selected.angleType).toBe('contrarian');
  });
});
```

- [ ] **Step 3: Implement generator.ts**

Write `packages/creation/src/angles/generator.ts` following spec `02-creation-engine.md` Angle Generator section:
- `generateAngles(brief, platform, llm)` — calls `llm.generateJSON()` with `ANGLE_GENERATOR_SYSTEM_PROMPT`, maps raw output to `AngleCard[]`. Apply Fix 15: filter `findingRefs` with bounds check before mapping to `supportingFindings`.
- `autoSelectAngle(angles, platform)` — sort by engagement score then platform preference index.

- [ ] **Step 4: Run test**

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/creation/src/angles/ packages/creation/src/__tests__/angles/ packages/creation/src/__fixtures__/angle-response.json
git commit -m "feat(creation): angle generator with 5 diverse angles per brief"
```

---

### Task 5: Storytelling Engine (draft generation)

**Files:**
- Create: `packages/creation/src/storytelling/engine.ts`
- Create: `packages/creation/src/__fixtures__/story-plan-response.json`
- Create: `packages/creation/src/__fixtures__/draft-with-quality.json`
- Test: `packages/creation/src/__tests__/storytelling/engine.test.ts`

- [ ] **Step 1: Create fixtures + write test**

`story-plan-response.json`: `{ "beats": [{ "beatName": "hook", "content": "Open with...", "findings": "Finding 0" }, ...] }`

`draft-with-quality.json`: `{ "content": "Everyone's celebrating the launch of...[full post ~300 words]...", "qualityScore": 8 }`

Test:
- `story plan produces beats matching arc structure`
- `full draft produces non-empty body`
- `qualityScore between 1-10`

- [ ] **Step 2: Implement engine.ts**

Write `packages/creation/src/storytelling/engine.ts` following spec `02-creation-engine.md` Two-Step Draft Generation:
- `generateDraft(brief, angle, arc, platform, voiceProfile, llm)` — Step 1: `llm.generateJSON<StoryPlan>()` for beat-by-beat plan. Step 2: `llm.generateWithQuality()` for full draft. Voice injection added when `voiceProfile?.confidence >= 0.3` (calls `buildVoiceInjection` from voice/injector.ts — stub for now).
- `buildDraftSystemPrompt(platform, arc)` — constructs system prompt with platform format and narrative rules.

Import `PLATFORM_FORMATS` from `@influenceai/integrations`.

- [ ] **Step 3: Run test**

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/creation/src/storytelling/engine.ts packages/creation/src/__fixtures__/story-plan-response.json packages/creation/src/__fixtures__/draft-with-quality.json packages/creation/src/__tests__/storytelling/engine.test.ts
git commit -m "feat(creation): two-step storytelling engine (plan + draft)"
```

---

### Task 6: Voice DNA (tracker + analyzer + injector)

**Files:**
- Create: `packages/creation/src/voice/tracker.ts`
- Create: `packages/creation/src/voice/analyzer.ts`
- Create: `packages/creation/src/voice/injector.ts`
- Create: `packages/creation/src/__fixtures__/voice-analysis-response.json`
- Test: `packages/creation/src/__tests__/voice/tracker.test.ts`
- Test: `packages/creation/src/__tests__/voice/analyzer.test.ts`
- Test: `packages/creation/src/__tests__/voice/injector.test.ts`

- [ ] **Step 1: Write tracker test**

Test `trackEdit()`:
- `inserts edit when distance >= 10`
- `skips when distance < 10`

Test `calculateEditDistance()`:
- returns word-level change count

- [ ] **Step 2: Implement tracker.ts**

```typescript
// packages/creation/src/voice/tracker.ts
import type { SupabaseClient } from '@supabase/supabase-js';

export async function trackEdit(
  db: SupabaseClient, contentItemId: string,
  beforeTitle: string, beforeBody: string,
  afterTitle: string, afterBody: string,
): Promise<void> {
  const editDistance = calculateEditDistance(beforeBody, afterBody);
  if (editDistance < 10) return;
  await db.from('content_edits').insert({
    content_item_id: contentItemId,
    before_title: beforeTitle, before_body: beforeBody,
    after_title: afterTitle, after_body: afterBody,
    edit_distance: editDistance, analyzed: false,
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
```

- [ ] **Step 3: Write injector test**

Test `buildVoiceInjection()`:
- `returns empty string when confidence < 0.3`
- `includes only strong rules (strength >= 0.5)`
- `includes max 3 exemplar posts`

- [ ] **Step 4: Implement injector.ts**

Write `packages/creation/src/voice/injector.ts` following spec `02-creation-engine.md` Voice Injector section. `buildVoiceInjection(profile)` returns empty string if `confidence < 0.3`, otherwise builds prompt section with tone, style rules (strength >= 0.5), vocabulary prefs, stances, and up to 3 exemplar posts.

- [ ] **Step 5: Write analyzer test**

Test `analyzeVoice()`:
- `throws when fewer than 5 edits`
- `confidence scales with edit count`
- `deactivates previous profile before insert` (Fix 9)
- `marks edits as analyzed`

- [ ] **Step 6: Implement analyzer.ts**

Write `packages/creation/src/voice/analyzer.ts` following spec `02-creation-engine.md` Style Analyzer section. Key: before inserting new profile, deactivate all existing active profiles (Fix 9):
```typescript
await db.from('voice_profiles').update({ is_active: false }).eq('is_active', true);
```
Then insert new profile with `is_active: true`.

- [ ] **Step 7: Run all voice tests**

Run: `pnpm vitest run packages/creation/src/__tests__/voice/`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/creation/src/voice/ packages/creation/src/__tests__/voice/ packages/creation/src/__fixtures__/voice-analysis-response.json
git commit -m "feat(creation): voice DNA tracker, analyzer, and injector"
```

---

### Task 7: Full creation pipeline

**Files:**
- Create: `packages/creation/src/pipeline.ts`
- Test: `packages/creation/src/__tests__/pipeline.test.ts`

- [ ] **Step 1: Write pipeline test**

```typescript
describe('createContent', () => {
  it('batch mode: returns complete result with selectedAngle + draft', async () => {
    const result = await createContent(mockBrief(), 'linkedin', { autoSelect: true }, mockDb, mockLlm);
    expect(result.phase).toBe('complete');
    if (result.phase === 'complete') {
      expect(result.draft.body).toBeTruthy();
      expect(result.selectedAngle).toBeDefined();
      expect(result.storyArc).toBeDefined();
    }
  });

  it('interactive: returns angles_only when no selection provided', async () => {
    const result = await createContent(mockBrief(), 'linkedin', {}, mockDb, mockLlm);
    expect(result.phase).toBe('angles_only');
    expect(result.angleCards.length).toBe(5);
  });
});
```

- [ ] **Step 2: Implement pipeline.ts**

Write `packages/creation/src/pipeline.ts` following spec `02-creation-engine.md` Full Creation Pipeline section. Use the `CreationResult` discriminated union (Fix 16) instead of returning `null!`:

```typescript
export async function createContent(
  brief: ResearchBrief, platform: Platform,
  options: { selectedAngleId?: string; autoSelect?: boolean },
  db: SupabaseClient, llm: LLMClient,
): Promise<CreationResult> {
  const angleCards = await generateAngles(brief, platform, llm);
  await storeAngleCards(db, angleCards);

  let selectedAngle: AngleCard;
  if (options.selectedAngleId) {
    selectedAngle = angleCards.find(a => a.id === options.selectedAngleId)!;
  } else if (options.autoSelect) {
    selectedAngle = autoSelectAngle(angleCards, platform);
  } else {
    return { phase: 'angles_only', angleCards };
  }

  await updateAngleStatus(db, selectedAngle.id, 'selected');
  const storyArc = selectArc(selectedAngle, platform);
  const voiceProfile = await getCurrentVoiceProfile(db);
  const draft = await generateDraft(brief, selectedAngle, storyArc, platform, voiceProfile, llm);

  return { phase: 'complete', angleCards, selectedAngle, storyArc, draft };
}
```

- [ ] **Step 3: Update index.ts**

Export everything from pipeline, angles, storytelling, and voice modules.

- [ ] **Step 4: Run test**

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/creation/src/pipeline.ts packages/creation/src/__tests__/pipeline.test.ts packages/creation/src/index.ts
git commit -m "feat(creation): full creation pipeline with discriminated union result"
```

---

### Task 8: Database migration

**Files:**
- Create: `packages/database/supabase/migrations/00004_creation_engine.sql`

- [ ] **Step 1: Write migration**

Create `00004_creation_engine.sql` following spec `02-creation-engine.md` Database Schema section. Key changes from spec:
- `voice_profiles.exemplar_posts JSONB DEFAULT '[]'` instead of `exemplar_post_ids UUID[]` (Fix 3)
- Add `edits_analyzed INTEGER DEFAULT 0` to `voice_profiles` (Fix 3)
- Include RLS policies matching existing pattern

- [ ] **Step 2: Commit**

```bash
git add packages/database/supabase/migrations/00004_creation_engine.sql
git commit -m "feat(database): add angle_cards, content_edits, voice_profiles tables"
```

---

### Task 9: API routes + content edit tracking

**Files:**
- Create: `apps/web/src/app/api/creation/angles/route.ts`
- Create: `apps/web/src/app/api/creation/draft/route.ts`
- Create: `apps/web/src/app/api/voice/profile/route.ts`
- Create: `apps/web/src/app/api/voice/analyze/route.ts`
- Modify: `apps/web/src/app/api/content/[id]/route.ts` — add edit tracking

- [ ] **Step 1: Implement POST /api/creation/angles**

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { LLMClient } from '@influenceai/integrations';
import { generateAngles } from '@influenceai/creation';

export async function POST(request: Request) {
  try {
    const { researchBriefId, platform } = await request.json();
    const supabase = await createClient();
    const llm = LLMClient.fromEnv();

    // Fetch research brief
    const { data: brief } = await supabase
      .from('research_briefs').select('*').eq('id', researchBriefId).single();
    if (!brief) return NextResponse.json({ error: 'Brief not found' }, { status: 404 });

    // Parse brief from DB row to ResearchBrief type (reconstruct signal from signal_data)
    const parsedBrief = { ...brief, signal: brief.signal_data, topFindings: brief.top_findings };
    const angleCards = await generateAngles(parsedBrief, platform, llm);

    return NextResponse.json({ angleCards });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate angles' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Implement POST /api/creation/draft**

Similar pattern — accepts `researchBriefId`, `angleCardId`, `platform`. Calls `createContent()` with `selectedAngleId`. Stores resulting draft in `content_items` with `status: 'pending_review'`. Returns `{ draft, storyArc, contentItemId }`.

- [ ] **Step 3: Implement GET /api/voice/profile and POST /api/voice/analyze**

`GET /api/voice/profile` — fetch active voice profile from `voice_profiles` where `is_active = true`.
`POST /api/voice/analyze` — call `analyzeVoice(db, llm)`, return `{ version, confidence, rulesExtracted, editsAnalyzed }`.

- [ ] **Step 4: Add edit tracking to PUT /api/content/[id]**

Read existing `apps/web/src/app/api/content/[id]/route.ts`. In the PUT handler, before updating:
```typescript
import { trackEdit } from '@influenceai/creation';

// Fetch current version before update
const { data: current } = await supabase.from('content_items').select('title, body').eq('id', params.id).single();

// Track the edit if content changed
if (current && (current.title !== title || current.body !== body)) {
  await trackEdit(supabase, params.id, current.title, current.body, title, body);
}
```

- [ ] **Step 5: Build check**

Run: `pnpm -F @influenceai/web build`
Expected: Succeeds

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/creation/ apps/web/src/app/api/voice/ apps/web/src/app/api/content/
git commit -m "feat(api): creation endpoints (angles, draft, voice) + edit tracking"
```

---

## Summary

| Task | What | Tests |
|------|------|-------|
| 1 | Package scaffold + types | Type-check |
| 2 | PLATFORM_FORMATS export (Fix 21) | — |
| 3 | Story arcs + selection | 4 arc tests |
| 4 | Angle generator | 5 angle tests |
| 5 | Storytelling engine | 3 engine tests |
| 6 | Voice DNA (tracker + analyzer + injector) | 8 voice tests |
| 7 | Full creation pipeline | 2 pipeline tests |
| 8 | DB migration | SQL validation |
| 9 | API routes + edit tracking | Build check |

**Total: ~22 tests, ~9 commits**
