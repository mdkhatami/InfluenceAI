# InfluenceAI — End-to-End Review & MVP Roadmap

> Review date: 2026-05-28. Scope decisions: **solo tool, demo-polished**;
> **manual posting acceptable for v1** (no OAuth publishing required); deliver this
> report first, then implement top-priority items.

## Context

InfluenceAI is an AI-influencer content management dashboard (Turborepo + pnpm,
Next.js 15 / React 19, Supabase, Vercel). This document is a full technical +
product review and a prioritized roadmap to reach a stable, demoable MVP suitable
for advertising and early-stage sales.

Central finding: **the codebase is far more ambitious and far more complete than
its own documentation claims** — but a small number of high-impact gaps (no real
publishing, no CI/lint, no frontend tests, no mobile nav, a handful of stubbed UI
actions) block a credible demo/MVP.

---

## 1. Current System Assessment

**Architecture (strong).** Clean monorepo. 1 app + **7 packages** (not the 3 the
CLAUDE.md implies): `core`, `database`, `integrations`, `intelligence`,
`creation`, `pipelines`, `memory`. ~7,900 LOC TS + ~784 LOC SQL, 202 TS/TSX files,
32 API routes, 19 DB tables across 6 migrations, ~28 unit-test files / 171 passing
tests. TypeScript strict everywhere.

**What genuinely works (verified):**
- **Data ingestion** — GitHub Trending (JSON API + HTML-scrape fallback), RSS
  (RSS2.0 + Atom), HackerNews. Robust, timeouts, graceful degradation.
  `packages/integrations/src/{github,sources}/`.
- **Pipeline engine** — ingest → dedup (sha256 hash set) → relevance score
  (threshold) → filter → generate → persist, with per-step logging to
  `pipeline_logs`. `packages/pipelines/src/engine/runner.ts`.
- **Investigation swarm** — 6 real LLM agents (tech, history, finance, dev-eco,
  geopolitics, industry) with timeouts, SSRF guard, JSON-mode + fallback, then a
  synthesis step into a `research_brief`. `packages/intelligence/`.
- **Creation engine** — angle-card generation, story-arc selection, voice-DNA
  learning from user edits, drafting. `packages/creation/`.
- **LLM client** — OpenAI-SDK based, LiteLLM-compatible, token tracking, JSON
  mode, embeddings, self-assessed quality score. `packages/integrations/src/llm/client.ts`.
- **DB design** — UUID PKs, sensible FKs/cascades, JSONB where appropriate,
  good indexes, **pgvector HNSW** for semantic memory, RLS enabled
  (authenticated-user policy) on v2+ tables.
- **Web app** — ~11 pages wired to real Supabase data (review queue, content
  library, pipelines + run detail + logs, signals, trends, investigate,
  daily-menu, settings, login). Real loading/empty states, toast errors,
  inline editing with per-platform char limits, error boundary.
- **Auth/security** — middleware session guard + `ALLOWED_EMAILS` whitelist
  (signs out non-whitelisted users); dual Supabase key support; **cron routes ARE
  authenticated** via `verifyCronAuth` (Bearer `CRON_SECRET`, fails closed).
- **Approval workflow IS wired** — `PUT /api/content/[id]` handles status
  transitions (approve/reject/publish), rejection reason, edit tracking.

**Maturity:** ~60–70% toward a production product; strong "draft engine," thin on
delivery, ops, and polish.

---

## 2. Gap Analysis vs. Intended Vision

The product vision (per CLAUDE.md): manage AI content "across LinkedIn,
Instagram, YouTube, Twitter with varying levels of automation."

| Vision element | Reality | Gap |
|---|---|---|
| Publish to 4 platforms | Content stops at `approved`; `published_at`/`published_url` are **dead columns**; "publish" only flips a status. No social API code at all. | **Largest gap** (accepted as manual for v1) |
| 8 automation pipelines | **3 of 8 implemented** (github-trends, signal-amplifier, release-radar). 5 are registry metadata only (youtube-series, weekly-strategy, auto-podcast, infographic-factory, digital-twin). | UI advertises 8, only 3 run |
| 7 content pillars | Metadata/config only (by design — used as prompt config). | OK |
| Analytics / engagement | `content_analytics` table exists; **nothing populates it** (no publishing → no metrics). Analytics page referenced in docs is **absent**. | Missing |
| Docs match product | CLAUDE.md describes 3 packages / 6 tables / "github-trends MVP"; real system has 7 packages / 19 tables / swarm + memory + creation. | Docs badly stale |

---

## 3. Critical Technical Issues & Risks

1. **Pipeline runner is fully sequential** (signals × platforms, plus optional
   swarm per signal). Each step is multiple LLM calls; on a real signal batch this
   risks Vercel's function timeout (cron set to `maxDuration=300`). Risk of partial
   runs / silent under-generation. `runner.ts` generation loop.
2. **No idempotency on runs** — re-triggering a pipeline over the same signals can
   create duplicate `content_items` (dedup is on signals, not on generation).
3. **Type-safety erosion** — ~85 `any` usages, notably `db: any` threaded through
   `creation`, `intelligence`, `memory`; unchecked `metadata as {...}` casts; some
   `JSON.parse` without schema validation. Strict mode is undermined at the seams.
4. **No CI/CD** — no `.github/workflows`. Tests/type-check/build never run
   automatically; regressions can merge freely.
5. **No lint/format config** — no ESLint/Prettier/pre-commit. `next lint` only.
6. **Zero frontend/API/e2e tests** — 0 tests in `apps/web`. The 171 tests cover
   packages only; the actual user-facing surface is untested.
7. **No error tracking / observability** — only `console.*`. No Sentry, no cron
   failure alerting, no Web Vitals. A failed nightly cron is invisible.
8. **Base-schema RLS gap** — `00001` core tables (`content_items`,
   `content_signals`, `pipeline_runs`, …) have **no RLS policies**; only v2+ tables
   do. Acceptable for solo use but should be made consistent and documented.
9. **Dev secret in repo** — `litellm-config.yaml` has `master_key: sk-influence-ai-dev`
   (dev-only, but should be env-driven before any shared deployment).

---

## 4. Missing Functionality & Usability Problems

- **Stubbed daily-menu actions** — `menu-item-card.tsx` buttons "Skip", "Write
  Follow-Up", "Dismiss", "Track Silently", "Develop Story", "See Research" have
  **no handlers**. The flagship "daily menu" feature looks broken on click.
- **Settings integrations & prompt-template UIs built but not wired** —
  `integration-config-dialog.tsx` and `prompt-template-editor.tsx` exist; settings
  page never mounts them. API routes exist but are unreachable from UI.
- **Not mobile-responsive** — fixed `w-64` sidebar + hardcoded `pl-64`
  (`(dashboard)/layout.tsx:30`, `sidebar.tsx`); unusable on phones (bad for demos
  shown on a phone).
- **Pipelines page shows only 3** but registry/UX implies 8 — no "coming soon"
  affordance, so it reads as missing features rather than roadmap.
- **No analytics page** despite nav/vision references.
- **No client-side data caching** — every nav refetches (`force-dynamic`
  everywhere); no SWR/React Query, no optimistic updates.
- **Layout route metadata** only covers 4 of ~11 routes → generic "InfluenceAI"
  title on most pages.
- Minor: some catch blocks swallow errors silently; no request cancellation on
  navigation; sparse ARIA on custom toggles.

---

## 5. Recommended Architectural & Product Improvements

- **Make demoable scope honest:** clearly mark the 3 live pipelines as active and
  the 5 stubs as "Coming soon" (don't delete — they're good positioning), so demos
  never hit dead ends.
- **Finish the daily-menu loop:** wire the stubbed action buttons to existing APIs
  (skip/dismiss/track → status or a lightweight `menu_item_actions` update;
  develop-story/see-research → existing investigate/creation routes).
- **Wire settings:** mount the existing integration + prompt-template components to
  their existing API routes. Low effort, high "it's real" payoff.
- **Responsive shell:** collapsible/overlay sidebar + remove hardcoded `pl-64`.
- **Harden the runner:** parallelize per-platform generation with bounded
  concurrency (`Promise.all` + limit); add a generation-level dedup guard for
  idempotency; surface partial-success clearly.
- **Tighten types at the seams:** introduce a shared `SupabaseClient` type and a
  `zod` parse layer for LLM JSON + signal metadata (zod already a dep in
  `integrations`).
- **Manual-publish polish for v1:** since auto-publish is out of scope, make the
  manual path excellent — per-platform formatted copy, "open composer" deep links
  (X/LinkedIn intent URLs), and a clear "Mark as posted → published_url" capture so
  analytics can be entered/imported later.
- **Ops baseline:** Sentry (browser + server + cron), Vercel Analytics/Web Vitals,
  structured logging helper to replace `console.*`.
- **Docs:** rewrite CLAUDE.md + README to match reality (7 packages, swarm/memory/
  creation, 19 tables, manual-publish model).

---

## 6. Prioritized Implementation Roadmap

Ordering = demo/MVP impact ÷ effort. P0 = blocks a credible demo; P1 = MVP
stability/credibility; P2 = scale/commercialization later.

**P0 — Make the demo work end-to-end (target: ~1 week)**
1. Wire stubbed daily-menu buttons → no dead clicks. `menu-item-card.tsx`.
2. Mobile-responsive app shell (overlay sidebar, drop `pl-64`).
   `(dashboard)/layout.tsx`, `sidebar.tsx`.
3. Mark 5 stub pipelines "Coming soon"; ensure the 3 live ones shine.
   `packages/core/src/pipelines/registry.ts` + pipelines page.
4. Mount Settings → integrations + prompt-template UIs to their existing routes.
5. Manual-publish polish: per-platform copy + composer deep-links + "mark posted"
   capture. `review-actions.tsx`, `PUT /api/content/[id]`.
6. Fill remaining route titles in layout metadata.

**P1 — Stability & credibility for onboarding (target: ~1–2 weeks)**
7. CI: GitHub Actions running install → type-check → lint → test → build on PR.
8. ESLint + Prettier + lint-staged/husky.
9. Frontend/API tests for critical flows (review→approve, content CRUD, daily-menu,
   pipeline trigger) + 2–3 Playwright e2e happy paths.
10. Sentry + Vercel Analytics + structured logging; cron failure alerting.
11. Runner: bounded-concurrency generation + generation idempotency guard.
12. Consistent RLS across `00001` tables; move litellm master key to env.
13. Tighten `db: any` and add zod validation for LLM JSON + metadata.
14. Rewrite CLAUDE.md/README to match the real system.

**P2 — Scale & commercialization (post-MVP, when moving beyond solo)**
15. Implement 1–2 more pipelines (release-radar is done; pick highest-value stub).
16. Auto-publish to one platform (Buffer or X) → unlocks real `content_analytics`.
17. Analytics page (charts already have Recharts dep).
18. Multi-tenant readiness: tenant-scoped RLS, accounts, billing, onboarding.
19. Job queue/worker (durable runs beyond Vercel cron limits).

---

## 7. Definition of a Stable MVP State

MVP is reached when:
- Every visible control does something (no stubbed buttons; stubs labeled).
- App is usable on desktop **and** mobile.
- The 3 live pipelines run reliably (cron + manual) without timeouts; failures are
  visible (Sentry/alert) and logged.
- Core flow works end-to-end: signal → (optional swarm) → draft → review/edit →
  approve → **manual post via formatted copy/deep-link** → mark published.
- Settings (integrations, pillars, prompt templates, preferences) all functional.
- CI green on PRs (type-check + lint + unit + a few e2e); no secrets in repo;
  RLS consistent.
- Docs accurately describe the system.

---

## 8. Launch Readiness, Scalability & Commercialization

- **Demo/advertising:** lead with the differentiators that already work — the
  6-agent investigation swarm, voice-DNA learning, and the daily content menu.
  These are genuinely novel; record a scripted end-to-end demo once P0 lands.
- **Onboarding (solo, demo-polished):** invite-only via `ALLOWED_EMAILS` is fine;
  add a short setup runbook (Supabase URL/keys, LLM env, CRON_SECRET, ALLOWED_EMAILS,
  Vercel root `apps/web`).
- **Scalability when it matters:** the sequential runner and Vercel-cron execution
  are the first ceilings; a queue/worker and parallelized generation are the P2
  unlocks. DB design (pgvector, indexes) already scales well.
- **Commercialization path:** manual-publish MVP proves value cheaply; the
  step-change to paid/SaaS is (a) auto-publish + real analytics and (b) multi-tenant
  isolation. Keep schema tenancy-aware in P1 changes so the P2 pivot isn't a rewrite.

---

## Verification (for the follow-up implementation pass)

- `pnpm install && pnpm type-check && pnpm test && pnpm build` must pass.
- `pnpm -F @influenceai/web dev`; manually walk: login → review → edit/approve →
  copy/deep-link → mark published; trigger a pipeline and watch a run + logs;
  open daily menu and exercise every button; resize to mobile width.
- New CI workflow green on a PR; Sentry receives a test event; cron route returns
  401 without `CRON_SECRET`, 200 with it.
- New frontend/e2e tests pass locally and in CI.
