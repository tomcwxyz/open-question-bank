import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { question } from '@/db/schema'
import { getActiveWorkspaceId } from '@/lib/workspace'
import { listPublicQuestions } from '@/lib/discovery'
import { getVariantCounts } from '@/lib/submission'
import { THEMES, UNSORTED, isTheme } from '@/lib/themes'

export type RailQuestion = { id: string; canonicalText: string; state: 'canonical' | 'ranked' }
export type TopCampaignQuestion = RailQuestion & {
  campaignId: string
  campaignPrompt: string
  comparisonAxis: string
  closesAt: Date
}
export type MostAskedQuestion = RailQuestion & { clusterSize: number }
export type ThemeCount = { theme: string; count: number }
export type ActiveQuestionSignal = {
  id: string
  canonicalText: string
  campaignId: string
  campaignPrompt: string
  comparisonAxis: string
  nComparisons: number
}
export type RisingQuestion = ActiveQuestionSignal & { position: number }
export type NeedsInputQuestion = ActiveQuestionSignal

const PUBLIC_STATES = ['canonical', 'ranked'] as const

/** Most recent canonical/ranked questions — delegates to the discovery list (DRY). */
export async function recentQuestions(limit = 6, workspaceId?: string): Promise<RailQuestion[]> {
  return listPublicQuestions(limit, workspaceId)
}

/**
 * Questions currently near the top of active prioritisation enquiries.
 *
 * Crucially, `position` is calculated within each campaign. We do not compare raw TrueSkill
 * mu values across campaigns and pretend they form a global Question Bank score.
 */
export async function risingQuestions(
  limit = 6,
  workspaceId?: string,
): Promise<RisingQuestion[]> {
  const ws = workspaceId ?? (await getActiveWorkspaceId())
  const result = await db.execute(sql`
    WITH ranked AS (
      SELECT
        s.campaign_id,
        s.question_id,
        s.n_comparisons,
        s.last_updated,
        ROW_NUMBER() OVER (
          PARTITION BY s.campaign_id
          ORDER BY s.mu DESC, s.sigma ASC, s.question_id
        ) AS position
      FROM score s
      JOIN campaign c ON c.id = s.campaign_id
      WHERE c.workspace_id = ${ws} AND c.state = 'comparing'
    )
    SELECT
      r.question_id,
      q.canonical_text,
      r.campaign_id,
      c.prompt,
      c.comparison_axis,
      r.n_comparisons,
      r.position
    FROM ranked r
    JOIN campaign c ON c.id = r.campaign_id
    JOIN question q ON q.id = r.question_id
    WHERE q.workspace_id = ${ws} AND r.position <= 3
    ORDER BY c.opens_at DESC NULLS LAST, r.position ASC, r.last_updated DESC
    LIMIT ${limit}
  `)

  return result.rows.map((r) => {
    const row = r as {
      question_id: string
      canonical_text: string
      campaign_id: string
      prompt: string
      comparison_axis: string
      n_comparisons: number
      position: number | string
    }
    return {
      id: row.question_id,
      canonicalText: row.canonical_text,
      campaignId: row.campaign_id,
      campaignPrompt: row.prompt,
      comparisonAxis: row.comparison_axis,
      nComparisons: Number(row.n_comparisons),
      position: Number(row.position),
    }
  })
}

/**
 * Questions in active enquiries where more human judgement would be most useful.
 *
 * Low comparison count is the primary signal; TrueSkill uncertainty (`sigma`) breaks ties.
 * Sigma is deliberately not returned to the public UI — the product translation is simply
 * "this still needs input". The judgement route continues to choose the actual pair adaptively.
 */
export async function needsInputQuestions(
  limit = 6,
  workspaceId?: string,
): Promise<NeedsInputQuestion[]> {
  const ws = workspaceId ?? (await getActiveWorkspaceId())
  const result = await db.execute(sql`
    SELECT
      s.question_id,
      q.canonical_text,
      s.campaign_id,
      c.prompt,
      c.comparison_axis,
      s.n_comparisons
    FROM score s
    JOIN campaign c ON c.id = s.campaign_id
    JOIN question q ON q.id = s.question_id
    WHERE c.workspace_id = ${ws}
      AND c.state = 'comparing'
      AND q.workspace_id = ${ws}
    ORDER BY s.n_comparisons ASC, s.sigma DESC, s.last_updated ASC, s.question_id
    LIMIT ${limit}
  `)

  return result.rows.map((r) => {
    const row = r as {
      question_id: string
      canonical_text: string
      campaign_id: string
      prompt: string
      comparison_axis: string
      n_comparisons: number
    }
    return {
      id: row.question_id,
      canonicalText: row.canonical_text,
      campaignId: row.campaign_id,
      campaignPrompt: row.prompt,
      comparisonAxis: row.comparison_axis,
      nComparisons: Number(row.n_comparisons),
    }
  })
}

/**
 * For the most recently CLOSED campaigns, the single highest-mu (winning) question each,
 * labelled with its campaign. One row per campaign; campaign-anchored, not a global score.
 *
 * Retained as a public API compatibility rail while v0.3 moves the default Questions surface
 * towards active participation.
 */
export async function topOfRecentCampaigns(
  limit = 6,
  workspaceId?: string,
): Promise<TopCampaignQuestion[]> {
  const ws = workspaceId ?? (await getActiveWorkspaceId())
  const result = await db.execute(sql`
    SELECT * FROM (
      SELECT DISTINCT ON (c.id)
        c.id AS campaign_id, c.prompt, c.comparison_axis, c.closes_at,
        q.id AS question_id, q.canonical_text, q.state
      FROM campaign c
      JOIN score s ON s.campaign_id = c.id
      JOIN question q ON q.id = s.question_id
      WHERE c.workspace_id = ${ws} AND c.state = 'closed' AND q.workspace_id = ${ws} AND q.state IN ('canonical','ranked')
      ORDER BY c.id, s.mu DESC, s.sigma ASC
    ) top
    ORDER BY top.closes_at DESC NULLS LAST
    LIMIT ${limit}
  `)
  return result.rows.map((r) => {
    const row = r as {
      campaign_id: string; prompt: string; comparison_axis: string; closes_at: string
      question_id: string; canonical_text: string; state: string
    }
    return {
      id: row.question_id,
      canonicalText: row.canonical_text,
      state: row.state as 'canonical' | 'ranked',
      campaignId: row.campaign_id,
      campaignPrompt: row.prompt,
      comparisonAxis: row.comparison_axis,
      closesAt: new Date(row.closes_at),
    }
  })
}

/**
 * The clusters with the most canonical/ranked members (a demand signal), each represented by a
 * canonical/ranked member — the stored representative if it qualifies, else the newest member.
 */
export async function mostAskedQuestions(
  limit = 6,
  workspaceId?: string,
): Promise<MostAskedQuestion[]> {
  const ws = workspaceId ?? (await getActiveWorkspaceId())
  const result = await db.execute(sql`
    SELECT * FROM (
      SELECT DISTINCT ON (q.cluster_id)
        q.id AS question_id, q.canonical_text, q.state, cnt.size AS cluster_size
      FROM question q
      JOIN (
        SELECT cluster_id, count(*)::int AS size
        FROM question
        WHERE workspace_id = ${ws} AND cluster_id IS NOT NULL AND state IN ('canonical','ranked')
        GROUP BY cluster_id
      ) cnt ON cnt.cluster_id = q.cluster_id
      LEFT JOIN cluster cl ON cl.id = q.cluster_id
      WHERE q.workspace_id = ${ws} AND q.state IN ('canonical','ranked')
      ORDER BY q.cluster_id, (q.id = cl.representative_question_id) DESC, q.created_at DESC
    ) m
    ORDER BY m.cluster_size DESC, m.question_id
    LIMIT ${limit}
  `)
  return result.rows.map((r) => {
    const row = r as { question_id: string; canonical_text: string; state: string; cluster_size: number }
    return {
      id: row.question_id,
      canonicalText: row.canonical_text,
      state: row.state as 'canonical' | 'ranked',
      clusterSize: Number(row.cluster_size),
    }
  })
}

/** Count of canonical/ranked questions per theme — every THEME zero-filled, plus Unsorted if any. */
export async function themeCounts(workspaceId?: string): Promise<ThemeCount[]> {
  const ws = workspaceId ?? (await getActiveWorkspaceId())
  const rows = await db
    .select({ theme: question.theme, count: sql<number>`count(*)::int` })
    .from(question)
    .where(and(eq(question.workspaceId, ws), inArray(question.state, [...PUBLIC_STATES])))
    .groupBy(question.theme)
  const byTheme = new Map<string, number>()
  let unsorted = 0
  for (const r of rows) {
    if (isTheme(r.theme)) byTheme.set(r.theme, Number(r.count))
    else unsorted += Number(r.count)
  }
  const counts: ThemeCount[] = THEMES.map((t) => ({ theme: t, count: byTheme.get(t) ?? 0 }))
  if (unsorted > 0) counts.push({ theme: UNSORTED, count: unsorted })
  return counts
}

/** Canonical/ranked questions for one theme, newest-first. Unknown theme → empty. */
export async function questionsByTheme(
  theme: string,
  limit = 50,
  workspaceId?: string,
): Promise<RailQuestion[]> {
  if (!isTheme(theme)) return []
  const ws = workspaceId ?? (await getActiveWorkspaceId())
  const rows = await db
    .select({ id: question.id, canonicalText: question.canonicalText, state: question.state })
    .from(question)
    .where(and(eq(question.workspaceId, ws), inArray(question.state, [...PUBLIC_STATES]), eq(question.theme, theme)))
    .orderBy(desc(question.createdAt))
    .limit(limit)
  return rows.map((r) => ({ id: r.id, canonicalText: r.canonicalText, state: r.state as 'canonical' | 'ranked' }))
}

// ---- Graph data ----

export interface GraphNode {
  id: string
  canonicalText: string
  state: string
  theme: string | null
  clusterId: string | null
  variantCount: number
}

export interface GraphEdge {
  /** Question IDs that share a cluster. */
  source: string
  target: string
  /** Shared cluster ID (for tooltip/debug). */
  clusterId: string
}

export interface QuestionGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

/**
 * The question relationship graph: nodes are published questions (canonical/ranked),
 * edges connect questions that share a cluster (embedding-similarity grouping).
 * Nodes carry theme (for colour) and variantCount (for size — community demand).
 * Anonymised: no submitter refs, no embeddings. Edges are derived from cluster
 * membership only — no raw cosine distances are exposed.
 *
 * `maxNodes` caps the total to keep the SVG render manageable (default 200).
 */
export async function questionGraph(
  maxNodes = 200,
  workspaceId?: string,
): Promise<QuestionGraph> {
  const ws = workspaceId ?? (await getActiveWorkspaceId())

  const rows = await db
    .select({
      id: question.id,
      canonicalText: question.canonicalText,
      state: question.state,
      theme: question.theme,
      clusterId: question.clusterId,
    })
    .from(question)
    .where(and(eq(question.workspaceId, ws), inArray(question.state, [...PUBLIC_STATES])))
    .orderBy(desc(question.createdAt))
    .limit(maxNodes)

  if (rows.length === 0) return { nodes: [], edges: [] }

  const variantCounts = await getVariantCounts(rows.map((r) => r.id))

  const nodes: GraphNode[] = rows.map((r) => ({
    id: r.id,
    canonicalText: r.canonicalText,
    state: r.state,
    theme: r.theme,
    clusterId: r.clusterId,
    variantCount: variantCounts.get(r.id) ?? 0,
  }))

  const byCluster = new Map<string, GraphNode[]>()
  for (const node of nodes) {
    if (!node.clusterId) continue
    const group = byCluster.get(node.clusterId)
    if (group) group.push(node)
    else byCluster.set(node.clusterId, [node])
  }

  const edges: GraphEdge[] = []
  for (const [clusterId, group] of byCluster) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        edges.push({ source: group[i].id, target: group[j].id, clusterId })
      }
    }
  }

  return { nodes, edges }
}
