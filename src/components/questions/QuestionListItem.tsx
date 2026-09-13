import Link from 'next/link'
import type { ReactNode } from 'react'

interface QuestionListItemProps {
  id: string
  question: string
  eyebrow?: ReactNode
  meta?: ReactNode
  trailing?: ReactNode
  compact?: boolean
}

/**
 * Participant-facing question row. Deliberately avoids exposing internal state stamps; context
 * belongs in plain language around the question, while provenance stays on the detail view.
 */
export function QuestionListItem({
  id,
  question,
  eyebrow,
  meta,
  trailing,
  compact = false,
}: QuestionListItemProps) {
  return (
    <article className={`group border-t border-line ${compact ? 'py-4' : 'py-5 sm:py-6'}`}>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-6">
        <div className="min-w-0">
          {eyebrow ? <div className="mb-1 text-xs font-medium uppercase tracking-[0.12em] text-muted">{eyebrow}</div> : null}
          <Link
            href={`/questions/${id}`}
            className={`block font-display leading-snug text-ink no-underline transition-colors group-hover:text-moss group-hover:no-underline ${
              compact ? 'text-lg' : 'text-xl sm:text-2xl'
            }`}
          >
            {question}
          </Link>
          {meta ? <div className="mt-2 text-sm leading-relaxed text-muted">{meta}</div> : null}
        </div>
        {trailing ? <div className="sm:pt-1">{trailing}</div> : null}
      </div>
    </article>
  )
}
