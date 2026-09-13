import { sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { getActiveWorkspaceId } from '@/lib/workspace'

export type RepeatedQuestion = {
  id: string
  canonicalText: string
  state: 'canonical' | 'ranked'
  /** Public compatibility name: total times this underlying question has appeared. */
  clusterSize: number
  /** Number of distinct published questions grouped into the underlying question. */
  clusteredQuestions: number
}

/**
 * Demand signal for "Most asked".
 *
 * The older browse rail counted only canonical/ranked questions sharing a cluster. That missed
 * submissions deduplicated into `merged_as_variant`, which are precisely the strongest evidence
 * that people independently asked the same thing. This query combines both signals and also
 * handles a canonical question with variants before it has joined a multi-question cluster.
 */
export async function repeatedQuestions(
  limit = 6,
  workspaceId?: string,
): Promise<RepeatedQuestion[]> {
  const ws = workspaceId ?? (await getActiveWorkspaceId())
  const result = await db.execute(sql`
    WITH published AS (
      SELECT id, cluster_id, canonical_text, state, created_at
      FROM question
      WHERE workspace_id = ${ws} AND state IN ('canonical', 'ranked')
    ),
    demand AS (
      SELECT
        COALESCE(p.cluster_id, p.id) AS group_id,
        count(DISTINCT p.id)::int AS clustered_questions,
        (count(DISTINCT p.id) + count(v.id))::int AS ask_count
      FROM published p
      LEFT JOIN question v
        ON v.canonical_of = p.id
        AND v.workspace_id = ${ws}
        AND v.state = 'merged_as_variant'
      GROUP BY COALESCE(p.cluster_id, p.id)
    ),
    represented AS (
      SELECT
        p.id AS question_id,
        p.canonical_text,
        p.state,
        d.clustered_questions,
        d.ask_count,
        ROW_NUMBER() OVER (
          PARTITION BY d.group_id
          ORDER BY
            CASE WHEN cl.representative_question_id = p.id THEN 0 ELSE 1 END,
            p.created_at DESC,
            p.id
        ) AS representative_rank
      FROM published p
      JOIN demand d ON d.group_id = COALESCE(p.cluster_id, p.id)
      LEFT JOIN cluster cl ON cl.id = p.cluster_id
      WHERE d.ask_count > 1
    )
    SELECT question_id, canonical_text, state, clustered_questions, ask_count
    FROM represented
    WHERE representative_rank = 1
    ORDER BY ask_count DESC, clustered_questions DESC, question_id
    LIMIT ${limit}
  `)

  return result.rows.map((r) => {
    const row = r as {
      question_id: string
      canonical_text: string
      state: string
      clustered_questions: number
      ask_count: number
    }
    return {
      id: row.question_id,
      canonicalText: row.canonical_text,
      state: row.state as 'canonical' | 'ranked',
      clusterSize: Number(row.ask_count),
      clusteredQuestions: Number(row.clustered_questions),
    }
  })
}
