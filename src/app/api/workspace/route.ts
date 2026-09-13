import { NextResponse } from 'next/server'
import { getActiveWorkspace, DEFAULT_WORKSPACE_SLUG } from '@/lib/workspace'
import { mapPublicError } from '@/lib/api-errors'

/**
 * Minimal public workspace identity. This deliberately exposes no membership/admin information;
 * it is the presentation seam for organisation-run Question Bank experiences.
 */
export async function GET() {
  try {
    const workspace = await getActiveWorkspace()
    return NextResponse.json({
      slug: workspace.slug,
      name: workspace.name,
      isDefault: workspace.slug === DEFAULT_WORKSPACE_SLUG,
    })
  } catch (err) {
    return mapPublicError(err, '[GET /api/workspace]')
  }
}
