import type { ReactNode } from 'react'

interface Choice {
  id: string
  canonicalText: string
}

interface PrioritisePairProps {
  a: Choice
  b: Choice
  servedReason: string
  busy?: boolean
  onChoose: (questionId: string | null) => void
  footer?: ReactNode
}

function ChoiceButton({
  choice,
  busy,
  onChoose,
}: {
  choice: Choice
  busy: boolean
  onChoose: (id: string) => void
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => onChoose(choice.id)}
      className="group min-h-48 rounded-2xl border border-line bg-surface p-6 text-left transition hover:border-sage hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-64 sm:p-8"
    >
      <span className="block text-xs font-medium uppercase tracking-[0.12em] text-muted">Choose this question</span>
      <span className="mt-4 block font-display text-2xl leading-snug text-ink transition-colors group-hover:text-moss sm:text-3xl">
        {choice.canonicalText}
      </span>
    </button>
  )
}

/** The core participant interaction: two questions, one judgement, very little machinery. */
export function PrioritisePair({ a, b, servedReason, busy = false, onChoose, footer }: PrioritisePairProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-stretch lg:gap-5">
        <ChoiceButton choice={a} busy={busy} onChoose={onChoose} />
        <div className="flex items-center justify-center text-sm text-muted" aria-hidden="true">or</div>
        <ChoiceButton choice={b} busy={busy} onChoose={onChoose} />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        <button
          type="button"
          onClick={() => onChoose(null)}
          disabled={busy}
          className="min-h-11 rounded-md px-4 text-sm text-muted transition hover:bg-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          I can’t decide / they feel about the same
        </button>

        <details className="text-sm text-muted">
          <summary className="cursor-pointer hover:text-ink">Why these two?</summary>
          <p className="mt-2 max-w-md rounded-md border border-line bg-surface p-3 leading-relaxed">
            The system chose this pair because it is useful for clarifying the emerging ranking. Technical reason: {servedReason}.
          </p>
        </details>
      </div>

      {footer}
    </div>
  )
}
