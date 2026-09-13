import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { db, pool } from '@/db/client'
import {
  campaign,
  campaignQuestion,
  cluster,
  comparison,
  datasetVersion,
  question,
  score,
  synthesis,
} from '@/db/schema'
import { needsInputQuestions, risingQuestions } from '@/lib/browse'
import { repeatedQuestions } from '@/lib/question-demand'

let versionId: number

function pad(vec: number[]): number[] {
  return [...vec, ...Array(768 - vec.length).fill(0)]
}

async function insertQuestion(
  text: string,
  state: 'canonical' | 'ranked' | 'under_comparison' | 'merged_as_variant',
  canonicalOf?: string,
) {
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
      canonicalOf: canonicalOf ?? null,
    })
    .returning()
  return row.id
}

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE
    ${synthesis}, ${score}, ${comparison}, ${campaignQuestion}, ${campaign},
    ${cluster}, ${question}, ${datasetVersion} RESTART IDENTITY CASCADE`)
  const [version] = await db
    .insert(datasetVersion)
    .values({
      embeddingModel: 'test',
      embeddingModelDigest: 'sha256:test',
      embeddingDim: 768,
      dedupThreshold: 0.15,
      clusterThreshold: 0.3,
    })
    .returning()
  versionId = version.id
})

afterAll(async () => {
  await pool.end()
})

describe('active question signals', () => {
  it('keeps Rising positions within an enquiry and prioritises uncertain questions for input', async () => {
    // Active enquiry membership, not question.state, now represents participation.
    const first = await insertQuestion('First emerging question', 'canonical')
    const second = await insertQuestion('Second emerging question', 'canonical')
    const uncertain = await insertQuestion('Question that still needs judgement', 'canonical')

    const [active] = await db
      .insert(campaign)
      .values({
        prompt: 'What should this place focus on?',
        comparisonAxis: 'importance',
        state: 'comparing',
        opensAt: new Date('2026-09-01T10:00:00Z'),
      })
      .returning()

    await db.insert(campaignQuestion).values([
      { campaignId: active.id, questionId: first },
      { campaignId: active.id, questionId: second },
      { campaignId: active.id, questionId: uncertain },
    ])
    await db.insert(score).values([
      { campaignId: active.id, questionId: first, mu: 32, sigma: 3, nComparisons: 6 },
      { campaignId: active.id, questionId: second, mu: 29, sigma: 4, nComparisons: 2 },
      { campaignId: active.id, questionId: uncertain, mu: 24, sigma: 8, nComparisons: 0 },
    ])

    const rising = await risingQuestions()
    expect(rising.map((item) => [item.canonicalText, item.position])).toEqual([
      ['First emerging question', 1],
      ['Second emerging question', 2],
      ['Question that still needs judgement', 3],
    ])
    expect(rising.every((item) => item.campaignId === active.id)).toBe(true)

    const needsInput = await needsInputQuestions()
    expect(needsInput[0].canonicalText).toBe('Question that still needs judgement')
    expect(needsInput[0].nComparisons).toBe(0)
    expect(needsInput[1].canonicalText).toBe('Second emerging question')
  })

  it('does not mix closed enquiry results into active discovery signals', async () => {
    const q = await insertQuestion('A closed result', 'ranked')
    const [closed] = await db
      .insert(campaign)
      .values({ prompt: 'Finished enquiry', comparisonAxis: 'importance', state: 'closed' })
      .returning()
    await db.insert(score).values({ campaignId: closed.id, questionId: q, mu: 40, sigma: 1, nComparisons: 10 })

    expect(await risingQuestions()).toEqual([])
    expect(await needsInputQuestions()).toEqual([])
  })
})

describe('repeated question demand', () => {
  it('counts merged submissions as repeated demand even without a multi-question cluster', async () => {
    const canonical = await insertQuestion('How could buses work better?', 'canonical')
    await insertQuestion('How do we improve the buses?', 'merged_as_variant', canonical)
    await insertQuestion('What would make local buses better?', 'merged_as_variant', canonical)
    await insertQuestion('A completely different question', 'canonical')

    const rows = await repeatedQuestions()
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe(canonical)
    expect(rows[0].clusterSize).toBe(3)
    expect(rows[0].clusteredQuestions).toBe(1)
  })
})
