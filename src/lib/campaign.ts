import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db/client'
import { campaign, campaignQuestion, question, score, type Campaign } from '@/db/schema'
import { IneligibleError, NotFoundError } from '@/lib/errors'
import { initialRating, initialRatingWithDemand } from '@/lib/trueskill'
import { getActiveWorkspaceId } from '@/lib/workspace'
import { getVariantCounts } from '@/lib/submission'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export async function createCampaign(input: {
  prompt: string
  comparisonAxis: string
  workspaceId?: string
}): Promise<Campaign> {
  const workspaceId = input.workspaceId ?? (await getActiveWorkspaceId())
  const [row] = await db
    .insert(campaign)
    .values({ workspaceId, prompt: input.prompt, comparisonAxis: input.comparisonAxis })
    .returning()
  return row
}

export async function listCampaigns(workspaceId?: string): Promise<Campaign[]> {
  const ws = workspaceId ?? (await getActiveWorkspaceId())
  return db
    .select()
    .from(campaign)
    .where(eq(campaign.workspaceId, ws))
    .orderBy(desc(campaign.createdAt))
}

/** Canonical questions available to older admin callers. */
export async function listCanonical(limit = 100, workspaceId?: string) {
  const ws = workspaceId ?? (await getActiveWorkspaceId())
  return db
    .select({ id: question.id, canonicalText: question.canonicalText })
    .from(question)
    .where(and(eq(question.state, 'canonical'), eq(question.workspaceId, ws)))
    .orderBy(asc(question.createdAt))
    .limit(limit)
}

export async function requireCampaignInWorkspace(
  campaignId: string,
  workspaceId: string,
): Promise<Campaign> {
  const [c] = await db
    .select()
    .from(campaign)
    .where(and(eq(campaign.id, campaignId), eq(campaign.workspaceId, workspaceId)))
    .limit(1)
  if (!c) throw new NotFoundError(`Campaign not found: ${campaignId}`)
  return c
}

export async function getCampaign(campaignId: string, workspaceId?: string) {
  const ws = workspaceId ?? (await getActiveWorkspaceId())
  const c = await requireCampaignInWorkspace(campaignId, ws)
  const members = await db
    .select({ id: question.id, canonicalText: question.canonicalText })
    .from(campaignQuestion)
    .innerJoin(question, eq(campaignQuestion.questionId, question.id))
    .where(eq(campaignQuestion.campaignId, campaignId))
    .orderBy(asc(campaignQuestion.addedAt))
  const scores = await db
    .select()
    .from(score)
    .where(eq(score.campaignId, campaignId))
    .orderBy(desc(score.mu))
  return { campaign: c, members, scores }
}

// Curation is allowed while an enquiry is preparing or gathering questions.
async function requireCurating(tx: Tx, campaignId: string): Promise<Campaign> {
  const [c] = await tx.select().from(campaign).where(eq(campaign.id, campaignId)).limit(1)
  if (!c) throw new NotFoundError(`Campaign not found: ${campaignId}`)
  if (c.state !== 'draft' && c.state !== 'open') {
    throw new IneligibleError(`Campaign ${campaignId} is not open for curation (state=${c.state})`)
  }
  return c
}

export async function openForSubmission(
  campaignId: string,
  workspaceId?: string,
): Promise<Campaign> {
  const ws = workspaceId ?? (await getActiveWorkspaceId())
  return db.transaction(async (tx) => {
    const [c] = await tx
      .select()
      .from(campaign)
      .where(and(eq(campaign.id, campaignId), eq(campaign.workspaceId, ws)))
      .limit(1)
    if (!c) throw new NotFoundError(`Campaign not found: ${campaignId}`)
    if (c.state !== 'draft') {
      throw new IneligibleError(`Campaign ${campaignId} cannot open for submission (state=${c.state})`)
    }
    const [updated] = await tx
      .update(campaign)
      .set({ state: 'open' })
      .where(eq(campaign.id, campaignId))
      .returning()
    return updated
  })
}

export async function assertCampaignOpenForSubmission(
  campaignId: string,
  workspaceId: string,
): Promise<Campaign> {
  const [c] = await db
    .select()
    .from(campaign)
    .where(and(eq(campaign.id, campaignId), eq(campaign.workspaceId, workspaceId)))
    .limit(1)
  if (!c) throw new NotFoundError(`Campaign not found: ${campaignId}`)
  if (c.state !== 'open') {
    throw new IneligibleError(`Campaign ${campaignId} is not open for submission`)
  }
  return c
}

/**
 * Add published questions to an enquiry. Both canonical and previously ranked questions are
 * reusable: prior participation should not make a question permanently unavailable.
 */
export async function addQuestions(campaignId: string, questionIds: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    const c = await requireCurating(tx, campaignId)
    if (questionIds.length === 0) return
    const qs = await tx
      .select({ id: question.id, state: question.state, workspaceId: question.workspaceId })
      .from(question)
      .where(inArray(question.id, questionIds))
    const found = new Map(qs.map((row) => [row.id, row]))
    for (const qid of questionIds) {
      const q = found.get(qid)
      if (!q) throw new NotFoundError(`Question not found: ${qid}`)
      if (q.state !== 'canonical' && q.state !== 'ranked') {
        throw new IneligibleError(`Question ${qid} is not published and reusable (state=${q.state})`)
      }
      if (q.workspaceId !== c.workspaceId) {
        throw new IneligibleError(`Question ${qid} belongs to a different workspace`)
      }
    }
    await tx
      .insert(campaignQuestion)
      .values(questionIds.map((questionId) => ({ campaignId, questionId })))
      .onConflictDoNothing()
  })
}

export async function removeQuestion(campaignId: string, questionId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await requireCurating(tx, campaignId)
    await tx
      .delete(campaignQuestion)
      .where(and(eq(campaignQuestion.campaignId, campaignId), eq(campaignQuestion.questionId, questionId)))
  })
}

/**
 * Begin prioritisation without turning participation into a global question state.
 *
 * `question.state` describes the reusable public question record. Active comparison is instead
 * represented by campaign membership + `campaign.state = comparing`. We lock member question rows
 * before checking for conflicting active memberships, so two enquiries cannot open the same
 * question concurrently even under competing transactions.
 */
export async function openComparison(campaignId: string): Promise<Campaign> {
  return db.transaction(async (tx) => {
    await requireCurating(tx, campaignId)
    const members = await tx
      .select({ id: question.id, state: question.state })
      .from(campaignQuestion)
      .innerJoin(question, eq(campaignQuestion.questionId, question.id))
      .where(eq(campaignQuestion.campaignId, campaignId))
      .for('update')

    if (members.length < 2) {
      throw new IneligibleError(`Campaign ${campaignId} needs at least 2 questions to open`)
    }
    for (const member of members) {
      if (member.state !== 'canonical' && member.state !== 'ranked') {
        throw new IneligibleError(`Question ${member.id} is not available (state=${member.state})`)
      }
    }

    const activeElsewhere = await tx
      .select({ questionId: campaignQuestion.questionId, campaignId: campaign.id })
      .from(campaignQuestion)
      .innerJoin(campaign, eq(campaignQuestion.campaignId, campaign.id))
      .where(
        and(
          inArray(campaignQuestion.questionId, members.map((member) => member.id)),
          eq(campaign.state, 'comparing'),
        ),
      )
      .limit(1)

    if (activeElsewhere.length > 0) {
      throw new IneligibleError(
        `Question ${activeElsewhere[0].questionId} is already being prioritised in another campaign`,
      )
    }

    const variantCounts = await getVariantCounts(members.map((member) => member.id), tx)
    const init = initialRating()
    await tx
      .insert(score)
      .values(
        members.map((member) => {
          const variantCount = variantCounts.get(member.id) ?? 0
          const rating = variantCount > 0 ? initialRatingWithDemand(variantCount) : init
          return { campaignId, questionId: member.id, mu: rating.mu, sigma: rating.sigma }
        }),
      )
      .onConflictDoNothing()

    const [updated] = await tx
      .update(campaign)
      .set({ state: 'comparing', opensAt: new Date() })
      .where(eq(campaign.id, campaignId))
      .returning()
    return updated
  })
}

export async function closeCampaign(campaignId: string): Promise<Campaign> {
  return db.transaction(async (tx) => {
    const [c] = await tx.select().from(campaign).where(eq(campaign.id, campaignId)).limit(1)
    if (!c) throw new NotFoundError(`Campaign not found: ${campaignId}`)
    if (c.state !== 'comparing') {
      throw new IneligibleError(`Campaign ${campaignId} is not comparing (state=${c.state})`)
    }
    const members = await tx
      .select({ questionId: campaignQuestion.questionId })
      .from(campaignQuestion)
      .where(eq(campaignQuestion.campaignId, campaignId))

    if (members.length > 0) {
      // Closing records that these published questions have now participated in a completed
      // prioritisation. Legacy `under_comparison` rows are also normalised back to ranked here.
      await tx
        .update(question)
        .set({ state: 'ranked' })
        .where(
          and(
            inArray(question.id, members.map((member) => member.questionId)),
            inArray(question.state, ['canonical', 'ranked', 'under_comparison']),
          ),
        )
    }

    const [updated] = await tx
      .update(campaign)
      .set({ state: 'closed', closesAt: new Date() })
      .where(eq(campaign.id, campaignId))
      .returning()
    return updated
  })
}
