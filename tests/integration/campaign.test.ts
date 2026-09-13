import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { db, pool } from '@/db/client'
import { campaign, campaignQuestion, comparison, datasetVersion, question, score } from '@/db/schema'
import { IneligibleError, NotFoundError } from '@/lib/errors'
import {
  addQuestions,
  closeCampaign,
  createCampaign,
  getCampaign,
  listCampaigns,
  listCanonical,
  openComparison,
  removeQuestion,
} from '@/lib/campaign'

let versionId: number
const MISSING = '00000000-0000-0000-0000-000000000000'

function pad(vec: number[]): number[] {
  return [...vec, ...Array(768 - vec.length).fill(0)]
}
async function q(text: string, state: 'clustered' | 'canonical' | 'under_comparison' | 'ranked'): Promise<string> {
  const [row] = await db
    .insert(question)
    .values({
      rawText: text,
      canonicalText: text,
      embedding: pad([1, 0, 0]),
      embeddingModelVersion: 'test@sha256:test',
      datasetVersionId: versionId,
      visibility: 'public',
      state,
    })
    .returning()
  return row.id
}

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE ${comparison} RESTART IDENTITY CASCADE`)
  await db.execute(sql`TRUNCATE TABLE ${score} RESTART IDENTITY CASCADE`)
  await db.execute(sql`TRUNCATE TABLE ${campaignQuestion} RESTART IDENTITY CASCADE`)
  await db.execute(sql`TRUNCATE TABLE ${campaign} RESTART IDENTITY CASCADE`)
  await db.execute(sql`TRUNCATE TABLE ${question} RESTART IDENTITY CASCADE`)
  await db.execute(sql`TRUNCATE TABLE ${datasetVersion} RESTART IDENTITY CASCADE`)
  const [v] = await db
    .insert(datasetVersion)
    .values({ embeddingModel: 'test', embeddingModelDigest: 'sha256:test', embeddingDim: 768 })
    .returning()
  versionId = v.id
})
afterAll(async () => {
  await pool.end()
})

describe('createCampaign + listCanonical', () => {
  it('creates a draft campaign', async () => {
    const c = await createCampaign({ prompt: 'Most important?', comparisonAxis: 'importance' })
    expect(c.state).toBe('draft')
    expect(c.scope).toBe('sealed')
    expect(c.comparisonAxis).toBe('importance')
  })

  it('lists only canonical questions for the legacy canonical listing', async () => {
    await q('clustered one', 'clustered')
    await q('comparing legacy row', 'under_comparison')
    await q('ranked one', 'ranked')
    const canonId = await q('canon one', 'canonical')
    const list = await listCanonical()
    expect(list.map((r) => r.id)).toEqual([canonId])
  })

  it('lists campaigns newest first', async () => {
    const first = await createCampaign({ prompt: 'first', comparisonAxis: 'importance' })
    const second = await createCampaign({ prompt: 'second', comparisonAxis: 'importance' })
    const list = await listCampaigns()
    expect(list.map((c) => c.id)).toEqual([second.id, first.id])
  })
})

describe('addQuestions / removeQuestion', () => {
  it('adds canonical questions and is idempotent', async () => {
    const c = await createCampaign({ prompt: 'p', comparisonAxis: 'importance' })
    const a = await q('a', 'canonical')
    await addQuestions(c.id, [a])
    await addQuestions(c.id, [a])
    const detail = await getCampaign(c.id)
    expect(detail.members).toHaveLength(1)
  })

  it('allows a previously ranked question to be reused in a later enquiry', async () => {
    const c = await createCampaign({ prompt: 'p', comparisonAxis: 'importance' })
    const ranked = await q('ranked from an earlier enquiry', 'ranked')
    await addQuestions(c.id, [ranked])
    expect((await getCampaign(c.id)).members.map((member) => member.id)).toEqual([ranked])
  })

  it('rejects a question that is not yet published', async () => {
    const c = await createCampaign({ prompt: 'p', comparisonAxis: 'importance' })
    const clustered = await q('c', 'clustered')
    await expect(addQuestions(c.id, [clustered])).rejects.toBeInstanceOf(IneligibleError)
  })

  it('rejects a missing question', async () => {
    const c = await createCampaign({ prompt: 'p', comparisonAxis: 'importance' })
    await expect(addQuestions(c.id, [MISSING])).rejects.toBeInstanceOf(NotFoundError)
  })

  it('removes a question while draft', async () => {
    const c = await createCampaign({ prompt: 'p', comparisonAxis: 'importance' })
    const a = await q('a', 'canonical')
    await addQuestions(c.id, [a])
    await removeQuestion(c.id, a)
    expect((await getCampaign(c.id)).members).toHaveLength(0)
  })
})

describe('openComparison', () => {
  it('moves to comparing and seeds scores without hiding the published questions', async () => {
    const c = await createCampaign({ prompt: 'p', comparisonAxis: 'importance' })
    const a = await q('a', 'canonical')
    const b = await q('b', 'canonical')
    await addQuestions(c.id, [a, b])
    const opened = await openComparison(c.id)
    expect(opened.state).toBe('comparing')
    const scores = await db.select().from(score).where(eq(score.campaignId, c.id))
    expect(scores).toHaveLength(2)
    expect(scores.every((row) => row.mu === 25 && row.nComparisons === 0)).toBe(true)
    const [qa] = await db.select().from(question).where(eq(question.id, a))
    expect(qa.state).toBe('canonical')
  })

  it('opens with a mix of canonical and previously ranked questions', async () => {
    const c = await createCampaign({ prompt: 'new enquiry', comparisonAxis: 'importance' })
    const ranked = await q('asked before', 'ranked')
    const fresh = await q('new question', 'canonical')
    await addQuestions(c.id, [ranked, fresh])
    await expect(openComparison(c.id)).resolves.toMatchObject({ state: 'comparing' })
    const [stillRanked] = await db.select().from(question).where(eq(question.id, ranked))
    expect(stillRanked.state).toBe('ranked')
  })

  it('seeds a higher initial mu for questions with merged variants (community demand prior)', async () => {
    const a = await q('a', 'canonical')
    const b = await q('b', 'canonical')
    await db.insert(question).values([
      {
        rawText: 'va1', canonicalText: 'va1', embedding: pad([1, 0, 0]),
        embeddingModelVersion: 'test@sha256:test', datasetVersionId: versionId,
        visibility: 'public', state: 'merged_as_variant', canonicalOf: a,
      },
      {
        rawText: 'va2', canonicalText: 'va2', embedding: pad([1, 0, 0]),
        embeddingModelVersion: 'test@sha256:test', datasetVersionId: versionId,
        visibility: 'public', state: 'merged_as_variant', canonicalOf: a,
      },
      {
        rawText: 'va3', canonicalText: 'va3', embedding: pad([1, 0, 0]),
        embeddingModelVersion: 'test@sha256:test', datasetVersionId: versionId,
        visibility: 'public', state: 'merged_as_variant', canonicalOf: a,
      },
    ])
    const c = await createCampaign({ prompt: 'p', comparisonAxis: 'importance' })
    await addQuestions(c.id, [a, b])
    await openComparison(c.id)

    const scores = await db.select().from(score).where(eq(score.campaignId, c.id))
    const scoreA = scores.find((s) => s.questionId === a)!
    const scoreB = scores.find((s) => s.questionId === b)!
    expect(scoreA.mu).toBeGreaterThan(25)
    expect(scoreB.mu).toBe(25)
    expect(scoreA.sigma).toBeCloseTo(scoreB.sigma, 5)
  })

  it('needs at least two members', async () => {
    const c = await createCampaign({ prompt: 'p', comparisonAxis: 'importance' })
    await addQuestions(c.id, [await q('a', 'canonical')])
    await expect(openComparison(c.id)).rejects.toBeInstanceOf(IneligibleError)
  })

  it('refuses to prioritise the same question in two enquiries at once', async () => {
    const a = await q('a', 'canonical')
    const b = await q('b', 'canonical')
    const c = await q('c', 'canonical')

    const first = await createCampaign({ prompt: 'p1', comparisonAxis: 'importance' })
    await addQuestions(first.id, [a, b])
    await openComparison(first.id)

    const second = await createCampaign({ prompt: 'p2', comparisonAxis: 'importance' })
    await addQuestions(second.id, [a, c])
    await expect(openComparison(second.id)).rejects.toBeInstanceOf(IneligibleError)
  })

  it('allows the same question again after the earlier enquiry is complete', async () => {
    const a = await q('a', 'canonical')
    const b = await q('b', 'canonical')
    const c = await q('c', 'canonical')

    const first = await createCampaign({ prompt: 'p1', comparisonAxis: 'importance' })
    await addQuestions(first.id, [a, b])
    await openComparison(first.id)
    await closeCampaign(first.id)

    const second = await createCampaign({ prompt: 'p2', comparisonAxis: 'importance' })
    await addQuestions(second.id, [a, c])
    await expect(openComparison(second.id)).resolves.toMatchObject({ state: 'comparing' })
  })

  it('rejects add/remove once prioritisation has started', async () => {
    const c = await createCampaign({ prompt: 'p', comparisonAxis: 'importance' })
    const a = await q('a', 'canonical')
    const b = await q('b', 'canonical')
    await addQuestions(c.id, [a, b])
    await openComparison(c.id)
    await expect(addQuestions(c.id, [a])).rejects.toBeInstanceOf(IneligibleError)
    await expect(removeQuestion(c.id, a)).rejects.toBeInstanceOf(IneligibleError)
  })
})

describe('closeCampaign', () => {
  it('closes and records participating questions as ranked', async () => {
    const c = await createCampaign({ prompt: 'p', comparisonAxis: 'importance' })
    const a = await q('a', 'canonical')
    const b = await q('b', 'canonical')
    await addQuestions(c.id, [a, b])
    await openComparison(c.id)
    const closed = await closeCampaign(c.id)
    expect(closed.state).toBe('closed')
    expect(closed.closesAt).toBeInstanceOf(Date)
    const [qa] = await db.select().from(question).where(eq(question.id, a))
    expect(qa.state).toBe('ranked')
  })

  it('normalises a legacy under-comparison member back to ranked on close', async () => {
    const c = await createCampaign({ prompt: 'legacy', comparisonAxis: 'importance' })
    const a = await q('legacy a', 'under_comparison')
    const b = await q('legacy b', 'under_comparison')
    await db.insert(campaignQuestion).values([
      { campaignId: c.id, questionId: a },
      { campaignId: c.id, questionId: b },
    ])
    await db.update(campaign).set({ state: 'comparing' }).where(eq(campaign.id, c.id))

    await closeCampaign(c.id)
    const rows = await db.select().from(question).where(eq(question.id, a))
    expect(rows[0].state).toBe('ranked')
  })

  it('rejects closing a non-comparing campaign', async () => {
    const c = await createCampaign({ prompt: 'p', comparisonAxis: 'importance' })
    await expect(closeCampaign(c.id)).rejects.toBeInstanceOf(IneligibleError)
  })
})
