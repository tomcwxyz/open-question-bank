import type { ReactNode } from 'react'

interface TrustDrawerProps {
  title?: string
  summary?: string
  children: ReactNode
}

/** Progressive disclosure for provenance and technical detail without leading with it. */
export function TrustDrawer({
  title = 'How did this question get here?',
  summary = 'See the underlying history and system record',
  children,
}: TrustDrawerProps) {
  return (
    <details className="group border-y border-line py-1">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-4 text-left [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block font-medium text-ink">{title}</span>
          <span className="mt-0.5 block text-sm text-muted">{summary}</span>
        </span>
        <span className="text-muted transition-transform group-open:rotate-45" aria-hidden="true">
          +
        </span>
      </summary>
      <div className="border-t border-line py-5 text-sm leading-relaxed text-muted">
        {children}
      </div>
    </details>
  )
}
