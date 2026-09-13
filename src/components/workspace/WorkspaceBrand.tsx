'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

interface WorkspaceIdentity {
  name: string
  slug: string
  isDefault: boolean
}

/**
 * Keeps Question Bank as the product identity while allowing an organisation/network to be the
 * visible convenor. The default workspace renders exactly the generic wordmark.
 */
export function WorkspaceBrand() {
  const [workspace, setWorkspace] = useState<WorkspaceIdentity | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/workspace')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data) setWorkspace(data)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  if (!workspace || workspace.isDefault || workspace.name === 'Default workspace') {
    return (
      <Link href="/" className="shrink-0 font-display text-lg text-moss no-underline hover:no-underline">
        Question Bank
      </Link>
    )
  }

  return (
    <Link href="/" className="min-w-0 shrink-0 no-underline hover:no-underline" aria-label={`${workspace.name} Question Bank`}>
      <span className="block max-w-48 truncate font-display text-base leading-tight text-ink sm:max-w-64">
        {workspace.name}
      </span>
      <span className="block text-xs leading-tight text-moss">Question Bank</span>
    </Link>
  )
}
