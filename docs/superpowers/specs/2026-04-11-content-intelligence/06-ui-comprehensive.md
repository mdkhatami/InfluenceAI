# UI Comprehensive Spec

**Parent:** `00-master-spec.md`
**Purpose:** Complete UI specification for all phases, covering missing components, navigation, workflows, and professional design standards.

---

## Navigation Updates

The sidebar grows from 4 items to 6:

```
Current:                    New:
┌──────────────┐           ┌──────────────────┐
│ Review       │    →      │ Today's Menu  ●3  │  (home, daily menu + review)
│ Content      │           │ Signals           │  (NEW: raw signal inbox)
│ Pipelines    │           │ Content           │  (existing content library)
│ Settings     │           │ Pipelines         │  (existing pipelines)
└──────────────┘           │ Trends            │  (NEW: trend tracker)
                           │ Settings          │  (expanded with new sections)
                           └──────────────────┘
```

- **Today's Menu** replaces "Review" as the home page. Badge shows pending review count.
- **Signals** is new: browsable raw signal inbox with investigate actions.
- **Trends** is new: tracked entities with phase badges and sparkline charts.
- **Settings** expands: adds Agent Config, Voice DNA, Integrations Status sections.

---

## Page Specifications

### 1. Today's Menu (`/` — home page)

**Layout:** Full-width single column. Stats header at top, then scrollable menu items.

```
┌─────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Good morning. April 12, 2026.                               ││
│  │ 12 signals · 3 ready · 1 callback · 2 alerts               ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─ READY TO POST ─────────── 30 sec ─────── green left bar ──┐│
│  │ "OpenAI's new model claims are falling apart"                ││
│  │ Contrarian · LinkedIn · Tech + DevEco agents                 ││
│  │ Quality: [8/10 badge]                                        ││
│  │ [Review Draft]  [Other Angles ▾]  [Skip]                    ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─ CALLBACK ──────────────── 2 min ──────── amber left bar ──┐│
│  │ Your prediction from Mar 19 was RIGHT                        ││
│  │ "Llama 4 will disappoint on reasoning" — benchmarks dropped  ││
│  │ [Write Follow-Up]  [Dismiss]                                 ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─ COLLISION ─────────────── 5 min ──────── orange left bar ──┐│
│  │ "EU AI Act + Anthropic's $5B raise = same story"             ││
│  │ Tech × Geopolitics · High potential                          ││
│  │ [Develop Story]  [See Research]  [Skip]                      ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ... more items ...                                             │
│                                                                 │
│  ───── Existing sections below ─────                            │
│  [Stats Grid]  [Content Trends Chart]                           │
└─────────────────────────────────────────────────────────────────┘
```

**Empty state (`FallbackSignalList`):** When no daily menu exists (first run, batch not yet run):
```
┌──────────────────────────────────────────────────────────┐
│  No menu generated yet. The overnight batch runs at 5 AM. │
│                                                           │
│  In the meantime, here are recent signals:                │
│  [list of recent content_signals with Investigate buttons]│
│                                                           │
│  Or trigger a pipeline manually:                          │
│  [GitHub Trends]  [Signal Amplifier]  [Release Radar]     │
└──────────────────────────────────────────────────────────┘
```

**Components:**
- `DailyMenuContainer` — server component, fetches today's menu
- `MenuHeader` — stats bar (signals processed, drafts ready, callbacks, alerts)
- `MenuItemCard` — 5 variants by readiness (see Phase 4 spec)
- `FallbackSignalList` — empty state with recent signals + pipeline triggers

---

### 2. Signal Inbox (`/signals` — NEW page)

Browsable table of raw signals from `content_signals`. This fills the gap where users can't see uninvestigated signals.

```
┌─────────────────────────────────────────────────────────────────┐
│  Signals                                        [Filter ▾]      │
│                                                                 │
│  Filters: [All Sources ▾] [Last 24h ▾] [Relevance: 3+ ▾]      │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ⬡ GitHub · 8.5 relevance · 2 hours ago                  │   │
│  │ "New framework achieves SOTA on reasoning benchmarks"     │   │
│  │ github.com/example/framework                              │   │
│  │ [Investigate]  [View Brief ✓]                             │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ⬡ RSS · 6.2 relevance · 5 hours ago                     │   │
│  │ "Anthropic announces new safety features for Claude"      │   │
│  │ anthropic.com/news/...                                    │   │
│  │ [Investigate]                                             │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ... more signals ...                                           │
│                                                                 │
│  [← Prev]  Page 1 of 5  [Next →]                               │
└─────────────────────────────────────────────────────────────────┘
```

**Key features:**
- Source type icon/badge (GitHub, RSS, HN, ArXiv)
- Relevance score with color coding (8+ green, 5-8 amber, <5 zinc)
- "Investigate" button → navigates to `/investigate/[signalId]`
- "View Brief" badge (green check) if a research brief already exists → links to brief view
- Filters: source type, time range, minimum relevance
- Pagination (20 per page)

**Components:**
- `SignalInboxPage` — server component with filters
- `SignalCard` — individual signal row with actions
- `RelevanceScoreBadge` — color-coded relevance indicator

---

### 3. Investigation Page (`/investigate/[signalId]` — NEW page)

Full-page interactive investigation flow. This is the "Investigate Now" experience.

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Signals                                              │
│                                                                 │
│  Investigating: "New framework achieves SOTA on reasoning..."   │
│  Source: GitHub · Relevance: 8.5 · 2 hours ago                  │
│                                                                 │
│  ┌── Agent Progress ──────────────────────────────────────────┐ │
│  │ ✓ Tech Deep-Dive        3.2s    4 findings                 │ │
│  │ ✓ Finance              5.1s    2 findings                  │ │
│  │ ⟳ Geopolitics          running...                          │ │
│  │ ✓ Industry Impact       4.8s    3 findings                 │ │
│  │ ✓ Dev Ecosystem         6.3s    5 findings                 │ │
│  │ ○ Historical Pattern    pending                             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Research Brief (4/6 agents) ─────────────────────────────┐ │
│  │                                                             │ │
│  │ TOP FINDINGS                                                │ │
│  │ 1. [HIGH] Claims 2x speed but benchmarks show 1.3x         │ │
│  │ 2. [HIGH] NVDA up 2.1% since announcement                  │ │
│  │ 3. [MEDIUM] npm downloads: 12K/week, up 300% MoM           │ │
│  │                                                             │ │
│  │ CROSS-DOMAIN CONNECTIONS                                    │ │
│  │ • Tech + Finance: Model commoditization pricing in market   │ │
│  │                                                             │ │
│  │ MOST SURPRISING: "The technique is restricted under EU..."  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Choose an Angle ─────────────────────────────────────────┐ │
│  │                                                             │ │
│  │ [5 AngleCard components, same as AnglePicker from Phase 4]  │ │
│  │                                                             │ │
│  │ Select an angle to generate a draft →                       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Draft Preview (after angle selection) ───────────────────┐ │
│  │                                                             │ │
│  │ Platform: [LinkedIn ▾]   Story Arc: The Detective           │ │
│  │                                                             │ │
│  │ "Everyone's celebrating this release. But the benchmarks    │ │
│  │  tell a different story..."                                 │ │
│  │                                                             │ │
│  │ [Edit & Review →]  [Generate for Twitter too]               │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Flow states:**
1. **Investigating** — agents running, progress indicator polling every 2s
2. **Brief ready** — research brief displayed, angle cards shown
3. **Angle selected** — draft generating (loading state)
4. **Draft ready** — draft preview with "Edit & Review" link to `/review/[id]`

**Components:**
- `InvestigateNowPage` — server component, fetches signal + existing brief
- `InvestigationProgress` — client component, polls agent status (from Phase 4 spec)
- `ResearchBriefView` — displays top findings, connections, unusual fact
- `AnglePicker` — angle card selection (from Phase 4 spec)
- `DraftPreview` — shows generated draft with platform selector and edit link

---

### 4. Review Detail (`/review/[id]` — MODIFIED)

The existing review page gets new panels in the right column:

```
┌─────────────────────────────────────────┬───────────────────────┐
│  EDITABLE CONTENT (left column)          │  RIGHT COLUMN         │
│                                          │                       │
│  [EditableTitle]                         │  Status / Actions     │
│  [EditableBody]                          │  ──────────────       │
│  [ReviewActions: copy/approve/reject]    │  Quality: [8/10]      │
│                                          │  Platform: LinkedIn   │
│                                          │  Pipeline: github-... │
│                                          │  Model: gpt-4o        │
│                                          │                       │
│                                          │  Story Arc (NEW)      │
│                                          │  ──────────────       │
│                                          │  🔍 The Detective     │
│                                          │  hook → investigation │
│                                          │  → reveal → implicat. │
│                                          │                       │
│                                          │  Research Brief (NEW) │
│                                          │  ──────────────       │
│                                          │  [collapsible panel]  │
│                                          │  5 top findings       │
│                                          │  2 connections        │
│                                          │  4/6 agents ✓         │
│                                          │                       │
│                                          │  Other Angles (NEW)   │
│                                          │  ──────────────       │
│                                          │  [4 dismissed angles  │
│                                          │   with hooks preview] │
│                                          │  [Regenerate with     │
│                                          │   this angle →]       │
│                                          │                       │
│                                          │  Source Signal         │
│                                          │  ──────────────       │
│                                          │  [existing card]      │
│                                          │  [Investigate ▸]      │
│                                          │                       │
└─────────────────────────────────────────┴───────────────────────┘
```

**New components for review detail:**
- `StoryArcBadge` — shows arc name + beat structure as tooltip
- `ResearchBriefPanel` — collapsible, shows top findings, connections, coverage bar
- `AgentCoverageBar` — inline badges: `✓Tech ✓Finance ✗Geo ✓Industry ✓DevEco ✓History`
- `AngleCardsPanel` — shows the other 4 angles that weren't selected, with "Regenerate" action
- `InvestigateButton` — added to SourceSignalCard, links to investigation page

---

### 5. Trends Page (`/trends` — NEW page)

Dashboard for all tracked trend entities.

```
┌─────────────────────────────────────────────────────────────────┐
│  Trends                              [+ Add Entity]             │
│                                                                 │
│  ┌── Summary ────────────────────────────────────────────────┐  │
│  │ 24 entities tracked · 3 accelerating · 2 peak · 1 alert  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Filter: [All ▾] [Accelerating ▾] [Technology ▾]               │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ LangChain                        technology               │   │
│  │ Phase: [PEAK]  Signal: [HOLD]  Velocity: +1.2K/week      │   │
│  │ ▁▂▃▅▇█▇▆▅▃  (4-week sparkline)                          │   │
│  │ Your coverage: 3 posts · Last: 12 days ago                │   │
│  │ [View Detail]  [Write About This]  [Stop Tracking]        │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Claude Code                      technology               │   │
│  │ Phase: [ACCELERATING]  Signal: [STRONG BUY]               │   │
│  │ ▁▁▂▃▅▇▇█  (4-week sparkline)                             │   │
│  │ Your coverage: 0 posts · Never covered                    │   │
│  │ [View Detail]  [Write About This]  [Stop Tracking]        │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ... more entities ...                                          │
└─────────────────────────────────────────────────────────────────┘
```

**Phase badges:** Color-coded inline badges:
- Emerging: `zinc-500`
- Accelerating: `green-500`
- Peak: `amber-500`
- Decelerating: `red-400`
- Plateau: `zinc-400`
- Declining: `red-600`

**Signal badges:** Investment-style labels:
- Strong Buy: `green-600` (you should cover this)
- Buy: `green-400`
- Hold: `zinc-400`
- Sell: `amber-500`
- Strong Sell: `red-500`

**Components:**
- `TrendsPage` — server component with filters
- `TrendEntityCard` — entity row with sparkline, phase/signal badges, actions
- `TrendSparkline` — small Recharts line chart (4 weeks of data)
- `TrendEntityForm` — modal/drawer for adding new entity (name, type, GitHub repo, npm pkg)
- `PhaseBadge` — reusable phase indicator
- `SignalBadge` — reusable content signal indicator

---

### 6. Settings Page — New Sections

Settings expands from 2 sections to 6:

```
Settings
├── Profile                    (existing)
├── Content Pillars            (existing)
├── Voice DNA (NEW)
│   ├── Confidence bar: [████░░░░░░] 42%
│   ├── Style rules (top 5):
│   │   • "Short punchy sentences, max 15 words" (strength: 0.8)
│   │   • "Never use 'game-changer' or 'excited to share'" (0.9)
│   │   • "Open with a number or bold claim" (0.7)
│   ├── Tone: "Direct, slightly provocative, data-driven"
│   ├── Vocabulary avoided: [game-changer, excited, leverage, synergy]
│   ├── Stances: [{AGI timelines: skeptical}, {open-source: bullish}]
│   ├── Edits analyzed: 28 / Next analysis at: 40 edits
│   ├── [Run Analysis Now]  [Reset Profile]
│   └── Exemplar posts: [list of 5 best posts with links]
│
├── Investigation Agents (NEW)
│   ├── Tech Deep-Dive      [enabled ✓]  Timeout: 45s
│   ├── Finance              [enabled ✓]  Timeout: 45s   Needs: YAHOO_FINANCE
│   ├── Geopolitics          [enabled ✓]  Timeout: 45s
│   ├── Industry Impact      [enabled ✓]  Timeout: 45s
│   ├── Dev Ecosystem        [enabled ✓]  Timeout: 45s
│   ├── Historical Pattern   [enabled ✓]  Timeout: 45s
│   └── Default swarm timeout: [90s]
│
├── Integrations Status (NEW)
│   ├── LLM Endpoint: ✓ Connected (gpt-4o via LiteLLM)
│   ├── GitHub Token: ✓ Valid (rate limit: 4,800/5,000)
│   ├── Yahoo Finance: ✓ Available (unofficial, no key needed)
│   ├── Alpha Vantage: ✗ Not configured (optional)
│   ├── Reddit API: ✗ Not configured (optional)
│   ├── Crunchbase: ✗ Not configured (optional)
│   ├── ProductHunt: ✗ Not configured (optional)
│   └── Embedding Model: text-embedding-3-small
│
├── Predictions Tracker (NEW)
│   ├── Open predictions: 8
│   │   • "GPT-5 will disappoint on reasoning" — made Mar 19
│   │   • "LangChain peaks by Q2 2026" — made Mar 25
│   │   • ... [see all →]
│   ├── Resolved: 3 correct, 1 wrong, 2 partial
│   └── [View all predictions →]
│
└── Overnight Batch (NEW)
    ├── Last run: Today 5:14 AM — Completed ✓
    │   Steps: Pipelines ✓ → Investigation ✓ → Creation ✓ → Menu ✓
    │   5 signals → 3 briefs → 6 drafts → 8 menu items
    ├── Schedule: Daily at 5:00 AM
    ├── Signals per batch: 5
    └── [Run Now]  [View Logs]
```

**Components:**
- `VoiceProfileCard` — confidence bar, rules, tone, stances, trigger button
- `AgentToggleList` — list of agents with enable/disable switches and timeout inputs
- `IntegrationStatusList` — API key status indicators with setup hints
- `PredictionTrackerCard` — summary + link to full predictions page
- `BatchStatusCard` — last run summary with step-by-step status

---

### 7. Predictions Page (`/settings/predictions` — NEW page)

Full list of all predictions with resolution tracking:

```
┌─────────────────────────────────────────────────────────────────┐
│  Predictions Scorecard                                          │
│                                                                 │
│  Score: 3 correct / 1 wrong / 2 partial / 8 open               │
│  Accuracy: 60% (of resolved)                                    │
│                                                                 │
│  Filter: [All ▾] [Open ▾] [2026 ▾]                             │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ● OPEN  "GPT-5 will disappoint on reasoning"             │   │
│  │ Made: Mar 19, 2026 · Timeframe: by Q3 2026               │   │
│  │ Post: [link to original content item]                     │   │
│  │ [Mark Correct]  [Mark Wrong]  [Mark Partial]              │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ✓ CORRECT  "Llama 4 will disappoint on reasoning"         │   │
│  │ Made: Feb 12 · Resolved: Apr 8 · Timeframe: Q1 2026      │   │
│  │ Evidence: Benchmarks dropped 15% below GPT-4o             │   │
│  │ Post: [original] → Follow-up: [link]                      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Design Standards

### Color system (consistent with existing dark theme)

```
Background:      zinc-950 (page), zinc-900 (cards)
Text:            zinc-100 (primary), zinc-400 (secondary), zinc-500 (muted)
Accent:          violet-500 (primary actions, active states)
Borders:         zinc-800 (card borders), zinc-700 (hover)

Menu card left borders:
  ready_to_post:   green-500
  callback:        amber-500
  collision:       orange-500
  trend_alert:     blue-500
  pick_an_angle:   violet-500

Phase badges:
  emerging:        zinc-500 bg, zinc-300 text
  accelerating:    green-900 bg, green-300 text
  peak:            amber-900 bg, amber-300 text
  decelerating:    red-900 bg, red-300 text
  plateau:         zinc-800 bg, zinc-400 text
  declining:       red-950 bg, red-400 text

Quality scores:
  8-10:  green-400
  6-7:   amber-400
  1-5:   red-400
```

### Component patterns

- **Cards:** `bg-zinc-900 border border-zinc-800 rounded-lg p-4`
- **Badges:** Use existing shadcn Badge variants + custom variants for new states
- **Buttons:** Primary = violet, Ghost = zinc-700 hover, Destructive = red (for reject/dismiss)
- **Collapsible panels:** Use shadcn Collapsible with ChevronDown icon
- **Sparklines:** Recharts `LineChart` with `height={40}`, no axes, just the line + area fill
- **Loading states:** Skeleton components matching card dimensions
- **Modals/Drawers:** Use shadcn Sheet (drawer from right) for entity forms and angle detail

### Information density

- Menu item cards: **max 4 lines** of content visible. Details in expandable sections or link-outs.
- `reason` field: Format as human sentence with badges, not debug output. Example: `"LinkedIn post ready — Quality [8/10 badge]"` not `"Quality score: 8/10. linkedin post ready."`
- Angle cards in picker: Use a **sheet/drawer** (not inline expansion) to avoid destabilizing the menu layout when opened.

---

## Workflow Completeness Checklist

| User Action | Destination | Status |
|-------------|-------------|--------|
| Morning: open app | `/` Daily Menu | Specified |
| Click "Review Draft" on ready item | `/review/[id]` | Specified (existing page + new panels) |
| Click "Other Angles" on ready item | Sheet/drawer with angle cards | Needs component |
| Click "Write Follow-Up" on callback | `/review/new?callback=[predictionId]` — pre-filled draft | Needs route + component |
| Click "Develop Story" on collision | `/investigate/collision/[id]` — investigation using both signals | Needs route + component |
| Click "See Research" on collision | Sheet/drawer with both signals' briefs | Needs component |
| Click "Investigate" on any signal | `/investigate/[signalId]` | Specified |
| Select angle → generate draft | Loading state → draft preview → "Edit & Review" link | Specified |
| "Edit & Review" on investigation page | `/review/[contentItemId]` | Specified (existing page) |
| Browse raw signals | `/signals` | Specified |
| Browse trends | `/trends` | Specified |
| Add trend entity | Modal form on `/trends` | Needs component |
| View/manage voice profile | `/settings` → Voice DNA section | Specified |
| View predictions | `/settings/predictions` | Specified |
| Toggle agents on/off | `/settings` → Investigation Agents section | Specified |
| View batch status | `/settings` → Overnight Batch section | Specified |

---

## Component Inventory (all new components)

| Component | Location | Type | Priority |
|-----------|----------|------|----------|
| `DailyMenuContainer` | `components/dashboard/daily-menu/` | Server | P1 (Phase 4) |
| `MenuHeader` | `components/dashboard/daily-menu/` | Server | P1 |
| `MenuItemCard` | `components/dashboard/daily-menu/` | Client | P1 |
| `AnglePicker` | `components/dashboard/daily-menu/` | Client | P1 |
| `FallbackSignalList` | `components/dashboard/daily-menu/` | Server | P1 |
| `SignalInboxPage` | `app/(dashboard)/signals/` | Server | P2 (Phase 1) |
| `SignalCard` | `components/dashboard/signals/` | Client | P2 |
| `RelevanceScoreBadge` | `components/dashboard/` | Server | P2 |
| `InvestigateNowPage` | `app/(dashboard)/investigate/[signalId]/` | Server+Client | P1 (Phase 4) |
| `InvestigationProgress` | `components/dashboard/investigation/` | Client | P1 |
| `ResearchBriefView` | `components/dashboard/investigation/` | Server | P1 |
| `DraftPreview` | `components/dashboard/investigation/` | Client | P2 |
| `ResearchBriefPanel` | `components/dashboard/` | Client | P1 (Phase 1) |
| `AgentCoverageBar` | `components/dashboard/` | Server | P2 |
| `AngleCardsPanel` | `components/dashboard/` | Client | P2 (Phase 2) |
| `StoryArcBadge` | `components/dashboard/` | Server | P3 |
| `InvestigateButton` | `components/dashboard/` | Client | P2 |
| `TrendsPage` | `app/(dashboard)/trends/` | Server | P3 (Phase 3) |
| `TrendEntityCard` | `components/dashboard/trends/` | Client | P3 |
| `TrendSparkline` | `components/dashboard/trends/` | Client | P3 |
| `TrendEntityForm` | `components/dashboard/trends/` | Client | P3 |
| `PhaseBadge` | `components/ui/` | Server | P3 |
| `SignalBadge` | `components/ui/` | Server | P3 |
| `VoiceProfileCard` | `components/settings/` | Client | P2 (Phase 2) |
| `AgentToggleList` | `components/settings/` | Client | P2 |
| `IntegrationStatusList` | `components/settings/` | Server | P3 |
| `PredictionTrackerCard` | `components/settings/` | Server | P3 |
| `BatchStatusCard` | `components/settings/` | Client | P3 |
| `PredictionsPage` | `app/(dashboard)/settings/predictions/` | Server | P3 |
| `CallbackDetailPanel` | `components/dashboard/` | Client | P2 |
| `CollisionDetailPanel` | `components/dashboard/` | Client | P2 |
