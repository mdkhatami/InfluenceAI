# InfluenceAI Dashboard Rebuild — Implementation Plan Index

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement plans task-by-task.

**Execute phases in order.** Each phase depends on the previous. Within a phase, execute parts in order (A → B → C → D).

---

## Phase 1: Pipeline Intelligence — Fix Content Quality

**Goal:** Pipelines only produce AI-relevant content. Non-AI signals dropped before generation.

| Part | File | Scope |
|------|------|-------|
| A | [phase1-part-a-relevance-scoring.md](2026-04-11-phase1-part-a-relevance-scoring.md) | `scoreRelevance()` function + tests + type change |
| B | [phase1-part-b-runner-integration.md](2026-04-11-phase1-part-b-runner-integration.md) | Wire into runner + GitHub scraper fix + cleanup |

**Spec:** [../specs/2026-04-11-phase1-pipeline-intelligence-design.md](../specs/2026-04-11-phase1-pipeline-intelligence-design.md)

---

## Phase 2: UI Rebuild — 4-Page Dashboard

**Goal:** Replace 7-page dashboard with 4 focused pages. No mock data.

| Part | File | Scope |
|------|------|-------|
| A | [phase2-part-a-foundation.md](2026-04-11-phase2-part-a-foundation.md) | Delete old pages, sidebar, layout, query updates |
| B | [phase2-part-b-review-page.md](2026-04-11-phase2-part-b-review-page.md) | Review home page + ContentCard + placeholder detail |
| C | [phase2-part-c-content-pipelines.md](2026-04-11-phase2-part-c-content-pipelines.md) | Content page + Pipelines page + trigger button |
| D | [phase2-part-d-detail-settings.md](2026-04-11-phase2-part-d-detail-settings.md) | Pipeline detail page + Settings rewrite |

**Spec:** [../specs/2026-04-11-phase2-ui-rebuild-design.md](../specs/2026-04-11-phase2-ui-rebuild-design.md)

---

## Phase 3: Content Review Workflow

**Goal:** Full workflow: edit inline, copy to clipboard, approve/reject, navigate between items.

| Part | File | Scope |
|------|------|-------|
| A | [phase3-part-a-backend.md](2026-04-11-phase3-part-a-backend.md) | API route changes + navigation query |
| B | [phase3-part-b-components.md](2026-04-11-phase3-part-b-components.md) | EditableTitle, EditableBody, ReviewActions, SourceSignalCard |
| C | [phase3-part-c-detail-page.md](2026-04-11-phase3-part-c-detail-page.md) | Review detail page assembly + keyboard shortcuts |

**Spec:** [../specs/2026-04-11-phase3-review-workflow-design.md](../specs/2026-04-11-phase3-review-workflow-design.md)

---

## Phase 4: Pipeline Management — Run Details

**Goal:** See what happened in each pipeline run. Debug failures.

| Part | File | Scope |
|------|------|-------|
| A | [phase4-part-a-backend.md](2026-04-11-phase4-part-a-backend.md) | Query functions + trigger API fix |
| B | [phase4-part-b-run-detail-page.md](2026-04-11-phase4-part-b-run-detail-page.md) | Run detail page + trigger button enhancement |

**Spec:** [../specs/2026-04-11-phase4-pipeline-management-design.md](../specs/2026-04-11-phase4-pipeline-management-design.md)
