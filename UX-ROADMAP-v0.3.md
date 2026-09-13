# Question Bank — UX roadmap v0.3

## Intent

v0.2 proved the underlying system: questions can be submitted, deduplicated, grouped, refined, curated, compared, ranked and synthesised with provenance preserved throughout.

v0.3 is not another polish pass. It changes the product model presented to participants.

The current interface exposes the pipeline and data model too directly. The redesign keeps the same rigorous infrastructure, but makes the public experience feel like participating in a shared enquiry:

> **What should we figure out? What are other people wondering? What matters most?**

The guiding principle is:

> **The pipeline is trust infrastructure. The participant experience is collective sensemaking.**

The technical concepts remain available through transparency and audit views, but they should not be the primary language of the public interface.

---

## 1. Product model

The redesign separates three layers that currently blur together.

### Workspace — who is convening

A workspace represents an organisation, network or community operating Question Bank.

Examples:

- The Wildlife Trusts
- a local authority
- a neighbourhood partnership
- an internal organisational learning team
- the public/shared Question Bank itself

The existing workspace seam remains the architectural basis for this.

### Enquiry — what they are trying to understand

The existing `Campaign` model remains valid internally, but public language should normally use **enquiry**, **area of enquiry**, **question**, or context-specific copy rather than “campaign”.

Examples:

- What would make volunteering work better?
- How should we use data better across the movement?
- What should young people be able to expect from this place?

A future schema rename from `Campaign` to `Enquiry` is optional and should not block v0.3. Start with a presentation-layer rename.

### Flow — how people participate

Different organisations need different participation journeys. A flow controls which stages are active and who can take part.

Examples:

- **Open enquiry:** ask → gather → prioritise → publish
- **Imported pool:** import → refine → prioritise internally → publish
- **Public consultation:** ask → merge similar → community prioritisation → synthesis
- **Internal strategy:** invite only → curate → compare → private output

The common engine remains the same. The flow determines which stages are surfaced.

This should eventually become explicit configuration rather than being inferred only from campaign state.

---

## 2. Scope and sharing modes

Organisations must retain control over where questions can travel.

Each enquiry should support one of three conceptual scopes:

### Sealed

Questions belong only to this enquiry. They are not reused or surfaced elsewhere.

Useful for confidential or bounded organisational work.

### Workspace-wide

Questions can connect across multiple enquiries within the same workspace.

Useful for organisations running recurring learning and consultation activity where the same questions reappear over time.

### Shared/open

Questions may connect to the wider public Question Bank where appropriate.

Useful where the convenor explicitly wants cross-organisation learning and reuse.

The existing dataset/campaign scoping model should be evolved towards these terms without weakening workspace isolation, provenance or anonymity guarantees.

---

## 3. Public experience principles

### 3.1 Lead with questions, not system concepts

Participants should encounter questions before they encounter state, ranking, clustering or provenance vocabulary.

Internal/public translations include:

| Internal concept | Participant-facing treatment |
| --- | --- |
| campaign | enquiry / what we are exploring |
| canonical | hidden unless auditing |
| ranked | position conveyed in context |
| cluster | “people have asked versions of this…” |
| variant | “similar submissions” |
| refinement lineage | “how this question changed” |
| comparison axis | natural-language prompt |
| definedness | admin quality signal only |
| served reason | hidden by default; available in audit detail |

### 3.2 One obvious next action

Every public page should answer: **what can I usefully do here now?**

An enquiry may therefore present one primary action depending on its flow/state:

- Add what you think we should ask
- Help decide what matters most
- See what rose to the top
- Explore what people are asking

Do not ask participants to understand the state machine.

### 3.3 Contribution should continue

Avoid dead-end confirmations.

After submitting a question, offer related questions or a small prioritisation task.

After prioritising several pairs, show what their contribution changed and offer either another comparison or the emerging picture.

### 3.4 Transparency is progressive disclosure

The audit trail is a strength and must remain available, but it should sit behind plain-language summaries:

- How did this question get here?
- How was this prioritised?
- Why are these questions grouped together?
- See full history

The exact model, version, score, actor and timestamp remain accessible from these views.

### 3.5 Participation should feel purposeful, not gamified

Do not introduce points, streaks, leaderboards or artificial rewards.

Instead show useful effects:

- “You helped distinguish two questions that were still very close.”
- “Five people have asked versions of this.”
- “This question still needs more comparisons before its position is clear.”

---

## 4. Information architecture

### Public navigation

Move away from implementation-shaped navigation (`Home / Browse / Campaigns / Submit`).

Initial v0.3 navigation:

- **Questions** — the main explore surface
- **Enquiries** — areas currently being explored
- low-emphasis admin/login access

Submission is available contextually and through the persistent Question Composer rather than as a top-level destination that competes with exploration.

### Public routes

Existing routes can remain while the UX migrates.

- `/` — front door + Question Composer + meaningful live rails
- `/browse` — becomes the main **Questions** experience
- `/questions/[id]` — story of a question, with audit detail progressively disclosed
- `/campaigns` — public label becomes **Enquiries**
- `/campaigns/[id]` — enquiry page with one contextual next action
- `/judge/[id]` — immersive prioritisation flow
- `/submit` — retained as a focused/direct submission route and fallback

A route rename can happen later if worthwhile; copy and IA should change before URLs.

---

## 5. Layout architecture

The current `PageShell` is optimised for reading and forms, with narrow maximum widths. v0.3 introduces two explicit surface types.

### ReadingShell

For:

- focused submission
- question history/audit
- explanatory content
- login

Approximate width: current `max-w-2xl` / `max-w-3xl` behaviour.

### AppShell

For:

- homepage
- question discovery
- enquiry discovery
- ranking and prioritisation
- admin workspaces

Approximate width: `max-w-6xl` or `max-w-7xl`, with responsive grid regions.

The public header should become less crowded, especially on mobile. Theme switching should not consume primary navigation space.

Admin should ultimately use its own operational shell rather than inheriting the public reading layout.

---

## 6. Core experience: the Question Composer

The Question Composer becomes the primary entry point to the product.

### Prompt

Default public language:

> **What should we figure out?**

Workspace/enquiry deployments can override this prompt.

### Interaction

1. Participant starts writing a question.
2. The system checks for similar existing questions.
3. Similar questions are shown as useful discoveries, not as a duplicate-error state.
4. Participant can choose:
   - **Yes — this captures what I mean**
   - **Mine is different — add it**
5. Visibility/privacy controls remain available but are visually secondary and should be explained in plain language.
6. Success should continue into another useful contribution.

The underlying deduplication API and precomputed embedding path remain unchanged.

### Component direction

Introduce reusable question-domain components rather than continuing to place every interaction inside generic `Card` components:

- `QuestionComposer`
- `QuestionCandidate`
- `QuestionListItem`
- `QuestionContext`
- `ContributionPrompt`
- `QuestionHistory`
- `TrustDrawer`

The existing UI primitives remain useful underneath these components.

---

## 7. Questions experience

`/browse` becomes the Question Bank rather than a collection of feature rails.

Initial views:

### Rising

Questions currently gaining importance within active enquiries.

### Needs your input

Questions/pairs where additional human comparison would most improve confidence.

### Most asked

Clusters where many people have submitted versions of the same underlying question.

### New

Recently added/published questions.

### Themes

Themes become filtering/navigation rather than a separate dominant content rail.

### Search

Search remains first-class, but similarity should be surfaced naturally on question detail and during composition. Remove repeated “Find similar” controls from every card once those paths exist.

### Definedness

Remove definedness from default public filtering. Keep it in admin/curation and audit contexts.

### Question map

Retain the graph as an optional exploration mode, not the bottom of the default feed.

---

## 8. Question detail

The question page should tell the story of the question rather than render its database relationships.

Primary hierarchy:

1. the question
2. how widely it has been echoed / similar submissions
3. where it currently matters (active enquiries / published agendas)
4. related questions
5. useful contribution action
6. progressive transparency/audit details

Example plain-language metadata:

- “People have asked versions of this 14 times.”
- “Currently #6 in ‘What should Middlesbrough focus on?’”
- “This wording was refined once for clarity.”

Advanced disclosure:

> **How did this question get here?**

That view exposes canonical/variant relationships, refinements, model/version provenance, definedness scores and other audit data.

---

## 9. Prioritisation experience

Pairwise comparison is a core product interaction and should get its own immersive surface.

### Presentation

- enquiry context quietly above
- one plain-language comparison prompt
- two large question choices
- neutral “can’t decide / both” action
- no internal `servedReason` stamp in the primary UI

### Rhythm

Choice → immediate next pair.

After a small set (for example five comparisons), provide a contribution checkpoint:

- how many comparisons they made
- whether they helped reduce uncertainty
- continue / see emerging picture

No points or leaderboard.

### Adaptive pairing

The existing TrueSkill/information-gain system remains unchanged. Its benefit should be explained through outcomes rather than exposing implementation language.

---

## 10. Enquiry experience

The current campaign state sections become participant-centred enquiry pages.

An enquiry page contains:

- the question the convenor is exploring
- short context/description
- who is convening it
- relevant timeframe
- the one most useful action now
- emerging/published questions where appropriate
- how the process works (secondary)

State-to-action examples:

- submission phase → **Add what we should ask**
- comparing phase → **Help decide what matters most**
- closed → **See what rose to the top**

Workspace branding should allow the enquiry to feel like the organisation’s activity rather than a generic copy of Question Bank.

---

## 11. Organisational/workspace experience

The redesign must strengthen rather than erase organisational use.

A workspace should eventually support:

- name, description and lightweight brand configuration
- workspace-level Question Bank landing page
- multiple concurrent/past enquiries
- default participation flow
- default visibility/scope rules
- public, invite-only and internal enquiries
- workspace-wide question reuse when enabled
- sealed enquiries when required
- export/open-data policy within platform guardrails

Suggested future hierarchy:

```text
Workspace
  ├── Enquiry
  │     ├── Flow configuration
  │     ├── Questions
  │     ├── Comparisons
  │     └── Outputs
  ├── Enquiry
  └── Workspace question bank
```

Do not implement full tenancy UI in the first UX slice. Preserve the seam and design components/routes so workspace context can be added without another redesign.

---

## 12. Admin experience

Admin remains out of the first implementation slice, but needs a later redesign.

The current navigation mirrors pipeline stages. A future admin workspace should instead organise around work needing attention:

- Needs review
- Questions
- Enquiries
- Participation
- Outputs
- Settings

Pipeline state and technical provenance remain visible inside those areas.

Admin should use a wide operational shell with a sidebar, queue counts and responsive workspace patterns.

---

## 13. Implementation phases

### Phase 0 — language and architecture seam

- add this roadmap
- add `AppShell`
- simplify public navigation
- keep existing `PageShell` as the focused/reading shell
- introduce question-domain component folder
- do not change schema or core APIs

**Done when:** homepage can use a wide application layout without affecting focused forms/admin pages.

### Phase 1 — front door + Question Composer

- rebuild homepage around “What should we figure out?”
- create `QuestionComposer`
- treat dedup candidates as discovery
- use plain-language candidate actions
- make visibility controls secondary
- add useful post-submit continuation
- surface a small set of live question/enquiry signals below the composer

**Done when:** a first-time visitor can understand the product and contribute without learning “campaign”, “canonical”, “cluster”, “definedness” or “TrueSkill”.

### Phase 2 — Questions

- redesign `/browse` as the main Questions surface
- introduce domain-specific question list components
- prioritise Rising / Needs your input / Most asked / New
- demote theme chips to filters
- remove definedness from default public UI
- integrate search into the same experience
- make graph an optional mode

**Done when:** the bank feels explorable before it feels searchable.

### Phase 3 — question story

- rebuild `/questions/[id]`
- translate cluster/variant data into human language
- show active/published enquiry context
- show related questions naturally
- add “How did this question get here?” transparency disclosure
- retain access to full provenance

**Done when:** the primary page can be understood by a participant, while an auditor can still inspect the complete record.

### Phase 4 — immersive prioritisation

- redesign `/judge/[id]`
- remove pipeline language from primary interaction
- use large choice targets
- add contribution checkpoints
- show confidence impact in plain language where possible
- retain adaptive pairing and provenance unchanged

**Done when:** comparing questions is one of the most engaging interactions in the product.

### Phase 5 — Enquiries

- relabel public Campaign surfaces as Enquiries
- redesign index around what people can participate in now
- redesign enquiry page around one primary action
- show convenor/workspace context
- support flow-specific presentation

**Done when:** participants never need to understand the campaign state machine.

### Phase 6 — workspace presentation and flow configuration

- workspace public landing page
- lightweight brand/context configuration
- explicit enquiry flow configuration
- explicit sealed / workspace-wide / shared scope
- participation/access settings
- prepare routes for multi-workspace hosted instances

**Done when:** an organisation can operate its own coherent Question Bank experience while using the same underlying engine.

### Phase 7 — admin workspace

- introduce dedicated admin shell
- reorganise around attention/work rather than pipeline stages
- retain technical state and provenance as secondary detail
- improve mobile/tablet operations where appropriate

---

## 14. Guardrails

The UX redesign must not weaken the core commitments already established by the project.

### Preserve

- append-only transformation history
- pinned embedding model per dataset version
- reproducible rankings
- human decision over LLM suggestions
- anonymity guarantees
- workspace scoping
- exportability
- accessible focus/reduced-motion behaviour

### Avoid

- silently applying refinements
- hiding uncertainty in ranking
- turning provenance into decorative “AI transparency” copy
- gamification
- forcing account creation for flows that currently support open participation
- schema churn purely to match new public language
- assuming every organisation wants its questions in a shared public pool

---

## 15. v0.3 success criteria

A participant should be able to arrive cold and, within a few seconds, understand that they can:

1. ask something worth figuring out;
2. discover that others may already be asking related things;
3. contribute their version without wrestling with duplicate handling;
4. help decide which questions matter most;
5. see an emerging collective picture;
6. inspect how that picture was produced if they want to.

An organisation should be able to see a credible path to using the same product for its own enquiries without losing control of scope, participation or provenance.

The ultimate test is that the product feels less like operating a prioritisation pipeline and more like taking part in a thoughtful shared enquiry.
