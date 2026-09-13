# Question state vs enquiry activity

## Decision

A published question's state describes the reusable question record. It does **not** describe whether that question is currently participating in an enquiry.

From UX v0.3 onwards:

- `canonical` means a published question in the shared/workspace bank that has not yet completed a prioritisation;
- `ranked` means a published question that has participated in at least one completed prioritisation;
- active prioritisation is represented by `campaign_question` membership plus `campaign.state = 'comparing'`;
- `under_comparison` is retained only as a legacy state for existing data and compatibility paths. New comparison runs should not write it.

This keeps **publication** and **participation** as separate concerns.

## Why

The earlier model changed every member question to `under_comparison` when a campaign opened. That made the question state double as a lock for campaign activity.

This created two product problems:

1. a published question temporarily disappeared from the normal Question Bank/search while it was being prioritised;
2. after a completed enquiry changed the question to `ranked`, the normal campaign curation path treated it as no longer reusable.

Both behaviours contradict the v0.3 product model. The Question Bank is intended to accumulate reusable questions; an enquiry is context in which some of those questions are gathered, compared and interpreted.

A question taking part in an enquiry should not stop being the same public question.

## Concurrency rule

The product still prevents the same question from being actively prioritised in two enquiries at once.

`openComparison()` therefore:

1. locks the member question rows;
2. verifies each member is a published `canonical` or `ranked` question;
3. checks for membership in any other campaign whose state is `comparing`;
4. rejects the transition if a conflict exists;
5. creates/initialises the campaign-specific score projection;
6. changes the campaign to `comparing` without changing the question state.

The question-row lock serialises competing attempts that involve the same questions, while the active campaign membership is the semantic lock.

## Closing an enquiry

When a comparing enquiry closes, participating published questions are set to `ranked`.

That state means **has participated in a completed ranking**, not **belongs to one particular ranking**. A ranked question remains public and may be selected into a later enquiry.

Closing also normalises legacy `under_comparison` member rows to `ranked` so older data can move forward safely.

## Public read behaviour

Normal Question Bank discovery continues to expose `canonical` and `ranked` questions.

Because opening an enquiry no longer changes those states, active-enquiry questions remain:

- searchable;
- browsable;
- linkable from their question page;
- available for similarity/discovery interactions.

The public question detail page still understands legacy `under_comparison` records, but only exposes one when it can prove the question belongs to a genuinely public comparing enquiry. A stray legacy `under_comparison` record remains private.

## Reuse rule

Admin enquiry setup may select both:

- `canonical` questions;
- `ranked` questions from earlier completed enquiries.

The live Question Bank is therefore the source pool for new enquiries, not only the subset that has never been prioritised before.

A question may be reused sequentially across many enquiries, but not concurrently in two active comparison runs.

## What must not regress

Future changes should not:

- set `question.state = 'under_comparison'` when starting a new prioritisation;
- remove a published question from public discovery merely because it is active in an enquiry;
- treat `ranked` as terminal or non-reusable;
- use a global question state as the primary concurrency lock for enquiry participation;
- weaken workspace checks when reusing questions.

## Longer-term direction

A future explicit enquiry-participation model or flow configuration may make these semantics even clearer, especially for sealed/workspace-wide/shared scopes. Until then, `campaign_question` plus campaign state is the authoritative participation context, and `question.state` remains about the lifecycle of the reusable question record.
