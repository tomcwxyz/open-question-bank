# UX v0.3 implementation status

This page tracks implementation against `UX-ROADMAP-v0.3.md`. It describes the branch state, not a released version.

## Implemented on `ux-v0.3`

### Public experience

- wide application shell and simplified Questions / Enquiries navigation;
- homepage led by the Question Composer rather than pipeline explanation;
- deduplication presented as discovery of existing questions;
- continued contribution after submission rather than a dead-end receipt;
- Questions surface organised around Rising, Needs your input, Most asked and New;
- themes treated as filters and the question graph as an optional exploration mode;
- public definedness controls removed;
- question detail rebuilt around the question, repeated demand, enquiry context and related questions;
- provenance and transformation mechanics available through progressive disclosure;
- pairwise prioritisation rebuilt as an immersive two-question choice;
- adaptive-pair rationale hidden from the primary flow but still inspectable;
- contribution checkpoints and a route back to the emerging picture;
- Campaign presentation renamed to Enquiries without schema churn;
- lifecycle-aware enquiry pages for gathering, prioritising and published results;
- synthesis presented as interpretation rather than an opaque pipeline output;
- lightweight workspace/convenor identity in public shell chrome.

### Admin experience

- dedicated wide operational shell with responsive sidebar;
- navigation organised as Overview / Needs review / Improve questions / Question bank / Enquiries;
- Overview leads with work requiring attention, with pipeline diagnostics retained underneath;
- moderation reframed as the explicit decision about what should enter the bank;
- wording improvement makes AI an optional second opinion and keeps the human final wording decision explicit;
- Question bank separates questions awaiting publication from the live published bank;
- definedness/quality scoring remains optional advice rather than a publication gate;
- Enquiries admin follows Preparing → Gathering questions → Prioritising → Complete;
- technical ranking values and adaptive-pair rationale are progressively disclosed rather than primary controls.

### Question reuse architecture

The v0.3 implementation separates reusable question state from enquiry participation.

- published `canonical` and `ranked` questions remain discoverable while taking part in an active enquiry;
- questions can be reused in later enquiries;
- simultaneous prioritisation of the same question in two enquiries is prevented by active campaign membership, with member rows locked during the transition;
- new comparison runs no longer write `under_comparison` to the question record;
- legacy `under_comparison` records remain supported and are normalised when their enquiry closes.

See `architecture-question-state-vs-enquiry-activity.md` for the full decision and invariants.

### Verification

A GitHub Actions workflow now verifies:

1. dependency installation;
2. ESLint;
3. database migrations and the Vitest suite against pgvector/Postgres;
4. a production Next.js build.

The Playwright browser suite is not yet part of the first CI job because its current setup expects real Ollama embeddings. Its contracts have been updated alongside the UX changes and should still be run locally or in a later dedicated e2e job.

## Deliberately deferred

These remain future slices rather than prerequisites for the current UX redesign:

- explicit configurable enquiry flows;
- sealed / workspace-wide / shared scope controls in the UI;
- invite-only and internal participation settings;
- full multi-workspace routing/hosted tenancy;
- workspace brand configuration beyond the current identity seam;
- a deliberate migration/removal strategy for the legacy `under_comparison` enum value;
- browser e2e CI with a reproducible embedding service or deterministic embedding test adapter.

## Release gate

Before merging/releasing v0.3:

- CI must pass on the pull request;
- the Playwright suite should pass in an environment with its embedding dependency available;
- the main public flows should receive a real visual/mobile QA pass;
- any failure discovered by CI should be fixed on the branch rather than bypassed.
