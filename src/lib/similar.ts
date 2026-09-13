import { and, asc, cosineDistance, eq, inArray, isNotNull, lt, ne, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { datasetVersion, question } from '@/db/schema'
import { NotFoundError } from '@/lib/errors'
import { PUBLIC_SEARCH_STATES, type QuestionState } from '@/lib/search'
import { getActiveWorkspaceId } from '@/lib/workspace'

export interface SimilarQuestion {
  id: string
  canonicalText: string
  state: QuestionState
  /** Cosine distance from the source question (0 = identical, larger = less similar). */
  distance: number
}

export interface FindSimilarOptions {
  limit?: number
  /** States the RESULT questions may have (defaults to the public search set). */
  states?: QuestionState[]
  /** States the SOURCE question may have (defaults to `states`). */
  sourceStates?: QuestionState[]
  workspaceId?: string
}

/**
 * Browsable "find similar": nearest neighbours of an existing question, reusing the embeddings
 * already stored for the active dataset version — NO re-embedding, no new model call. Scoped to
 * the source question's dataset version, which keeps results within the same workspace and the
 * same pinned model (the reproducibility commitment).
 */
export async function findSimilarQuestions(
  questionId: string,
  options: FindSimilarOptions = {},
): Promise<SimilarQuestion[]> {
  const limit = Math.min(50, Math.max(1, Math.floor(options.limit ?? 10)))
  const states = options.states ?? PUBLIC_SEARCH_STATES
  const sourceStates = options.sourceStates ?? states
  if (states.length === 0 || sourceStates.length === 0) return []
  const workspaceId = options.workspaceId ?? (await getActiveWorkspaceId())

  // Scope the SOURCE fetch to the workspace AND explicitly permitted source states. Public callers
  // can therefore use an `under_comparison` question as the pivot while still restricting results
  // to the normal canonical/ranked bank.
  const [source] = await db
    .select({
      embedding: question.embedding,
      datasetVersionId: question.datasetVersionId,
      similarityThreshold: datasetVersion.similarityThreshold,
    })
    .from(question)
    .innerJoin(datasetVersion, eq(question.datasetVersionId, datasetVersion.id))
    .where(
      and(
        eq(question.id, questionId),
        eq(question.workspaceId, workspaceId),
        inArray(question.state, sourceStates),
      ),
    )
    .limit(1)
  if (!source) throw new NotFoundError(`Question not found: ${questionId}`)
  if (!source.embedding) return []

  const distance = cosineDistance(question.embedding, source.embedding)
  const rows = await db
    .select({
      id: question.id,
      canonicalText: question.canonicalText,
      state: question.state,
      distance: sql<number>`${distance}`,
    })
    .from(question)
    .where(
      and(
        eq(question.datasetVersionId, source.datasetVersionId),
        ne(question.id, questionId),
        inArray(question.state, states),
        isNotNull(question.embedding),
        lt(distance, source.similarityThreshold),
      ),
    )
    .orderBy(asc(distance))
    .limit(limit)

  return rows.map((r) => ({
    id: r.id,
    canonicalText: r.canonicalText,
    state: r.state as QuestionState,
    distance: Number(r.distance),
  }))
}
