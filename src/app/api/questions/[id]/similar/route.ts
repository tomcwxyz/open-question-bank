import { NextResponse } from 'next/server'
import { findSimilarQuestions } from '@/lib/similar'
import { getPublicQuestion } from '@/lib/discovery'
import { mapPublicError } from '@/lib/api-errors'

/**
 * Public "find similar": nearest published neighbours of a participant-visible question,
 * reusing existing embeddings (no re-embed). Results stay canonical/ranked, while a source
 * question may also be `under_comparison` when it is visible through an open enquiry.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const limitParam = Number(new URL(request.url).searchParams.get('limit') ?? '10')
  const limit = Number.isFinite(limitParam) ? limitParam : 10
  try {
    // Do not use question state alone as a visibility oracle: `getPublicQuestion` additionally
    // proves an under-comparison source belongs to a public comparing enquiry.
    await getPublicQuestion(id)
    return NextResponse.json({
      similar: await findSimilarQuestions(id, {
        limit,
        sourceStates: ['canonical', 'under_comparison', 'ranked'],
      }),
    })
  } catch (err) {
    return mapPublicError(err, '[GET /api/questions/:id/similar]')
  }
}
