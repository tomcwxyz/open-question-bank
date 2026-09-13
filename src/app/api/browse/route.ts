import { NextResponse } from 'next/server'
import {
  recentQuestions,
  topOfRecentCampaigns,
  mostAskedQuestions,
  themeCounts,
  risingQuestions,
  needsInputQuestions,
} from '@/lib/browse'
import { mapPublicError } from '@/lib/api-errors'

export async function GET() {
  try {
    const [recent, topOfCampaigns, mostAsked, themes, rising, needsInput] = await Promise.all([
      recentQuestions(),
      topOfRecentCampaigns(),
      mostAskedQuestions(),
      themeCounts(),
      risingQuestions(),
      needsInputQuestions(),
    ])
    return NextResponse.json({ recent, topOfCampaigns, mostAsked, themes, rising, needsInput })
  } catch (err) {
    return mapPublicError(err, '[GET /api/browse]')
  }
}
