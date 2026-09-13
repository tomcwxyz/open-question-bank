'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AdminShell } from '@/components/ui/AdminShell'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Notice } from '@/components/ui/Notice'
import { EmptyState } from '@/components/ui/EmptyState'

interface QuestionRow {
  id: string
  canonicalText: string
  createdAt?: string
  state?: 'canonical' | 'ranked'
  variantCount?: number
}

interface ScoreRow {
  id: string
  criterion: string
  score: number
  rationale: string
  model: string
  modelVersion: string
  timestamp: string
}

export default function CurationPage() {
  const [ready, setReady] = useState<QuestionRow[]>([])
  const [published, setPublished] = useState<QuestionRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [active, setActive] = useState<QuestionRow | null>(null)
  const [current, setCurrent] = useState<ScoreRow[]>([])
  const [history, setHistory] = useState<ScoreRow[]>([])

  const load = useCallback(async () => {
    try {
      const [readyRes, bankRes] = await Promise.all([
        fetch('/api/admin/questions?state=clustered'),
        fetch('/api/admin/questions?state=bank'),
      ])
      if (readyRes.ok) setReady((await readyRes.json()).questions)
      if (bankRes.ok) setPublished((await bankRes.json()).questions)
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  async function loadScores(id: string) {
    const res = await fetch(`/api/admin/questions/${id}/scores`)
    if (res.ok) {
      const data = await res.json()
      setCurrent(data.current)
      setHistory(data.history)
    }
  }

  async function review(q: QuestionRow) {
    setActive(q)
    setCurrent([])
    setHistory([])
    setMessage('')
    await loadScores(q.id)
  }

  async function score() {
    if (!active) return
    setBusy(true)
    setMessage('Getting an advisory quality check…')
    try {
      const res = await fetch(`/api/admin/questions/${active.id}/score`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setMessage('')
        await loadScores(active.id)
      } else {
        setMessage(data.error ?? 'Could not run the quality check.')
      }
    } catch {
      setMessage('Network error — please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function publish() {
    if (!active) return
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch(`/api/admin/questions/${active.id}/promote`, { method: 'POST' })
      const data = await res.json()
      setMessage(res.ok ? 'Published to the question bank.' : (data.error ?? 'Could not publish the question.'))
      if (res.ok) setActive(null)
    } catch {
      setMessage('Network error — please try again.')
    } finally {
      setBusy(false)
      load()
    }
  }

  const average =
    current.length > 0
      ? (current.reduce((sum, row) => sum + row.score, 0) / current.length).toFixed(1)
      : null

  const runCount = new Set(history.map((row) => row.timestamp)).size

  return (
    <AdminShell>
      <div className="space-y-2">
        <p className="eyebrow">Question bank</p>
        <h1 className="text-3xl sm:text-4xl">Decide what becomes public</h1>
        <p className="max-w-2xl text-muted leading-relaxed">
          Publish questions when they are clear enough to be useful. The optional quality check is advice,
          not a gate. Once published, questions remain visible here even when they later take part in an enquiry.
        </p>
      </div>

      {message && (
        <Notice role="status" tone="info">
          {message}
        </Notice>
      )}

      {active ? (
        <section className="space-y-6">
          <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="eyebrow">Publication decision</p>
              <h2 className="mt-1 max-w-3xl font-display text-2xl sm:text-3xl leading-snug text-ink">
                {active.canonicalText}
              </h2>
              {active.variantCount && active.variantCount > 0 ? (
                <p className="mt-2 text-sm text-muted">
                  {active.variantCount + 1} submissions point to this underlying question.
                </p>
              ) : null}
            </div>
            <Button type="button" variant="quiet" onClick={() => setActive(null)} disabled={busy}>
              Back to bank
            </Button>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
            <Card className="space-y-4">
              <div>
                <p className="eyebrow">Your decision</p>
                <h3 className="mt-1 text-2xl">Is this ready for the public bank?</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Publishing makes the question discoverable and available to add to enquiries. You can publish
                  without running an AI quality check.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="accent" onClick={publish} disabled={busy}>
                  Publish to question bank
                </Button>
                <Button type="button" variant="ghost" onClick={score} disabled={busy}>
                  Get an AI quality check
                </Button>
              </div>
            </Card>

            <Card className="space-y-4 bg-surface">
              <div>
                <p className="eyebrow">Optional advice</p>
                {current.length > 0 ? (
                  <p className="mt-1 text-sm text-muted">
                    Latest quality check: <strong className="font-medium text-ink">{average} / 5 average</strong>.
                    This does not determine publication.
                  </p>
                ) : (
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    No quality check has been run. That is fine: publication remains a human decision.
                  </p>
                )}
              </div>

              {current.length > 0 && (
                <div className="space-y-3">
                  {current.map((row) => (
                    <div key={row.criterion} className="border-t border-line pt-3 first:border-t-0 first:pt-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-medium text-ink">{row.criterion}</span>
                        <span className="text-sm text-moss">{row.score} / 5</span>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-muted">{row.rationale}</p>
                    </div>
                  ))}
                </div>
              )}

              {runCount > 1 && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted hover:text-ink">Previous quality checks ({runCount})</summary>
                  <ul className="mt-3 space-y-2 list-none p-0">
                    {history.map((row) => (
                      <li key={row.id} className="text-muted">
                        {new Date(row.timestamp).toLocaleString()} · {row.criterion}: {row.score} / 5
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </Card>
          </div>
        </section>
      ) : (
        <div className="space-y-10">
          <section className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Ready for a decision</p>
                <h2 className="mt-1 text-2xl">Ready to publish</h2>
              </div>
              {loaded && <p className="text-sm text-muted">{ready.length} waiting</p>}
            </div>

            {!loaded ? (
              <p className="text-muted">Loading questions…</p>
            ) : ready.length === 0 ? (
              <EmptyState>No questions are waiting for publication.</EmptyState>
            ) : (
              <ul className="divide-y divide-line border-y border-line list-none p-0">
                {ready.map((q) => (
                  <li key={q.id} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="break-words font-display text-xl leading-snug text-ink">{q.canonicalText}</p>
                      {q.variantCount && q.variantCount > 0 ? (
                        <p className="mt-1 text-sm text-muted">
                          {q.variantCount + 1} submissions point here
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-muted">One submission so far</p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="shrink-0 self-start sm:self-auto"
                      onClick={() => review(q)}
                      disabled={busy}
                    >
                      Review for publication →
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Public now</p>
                <h2 className="mt-1 text-2xl">Live question bank</h2>
              </div>
              {loaded && <p className="text-sm text-muted">{published.length} published</p>}
            </div>

            {!loaded ? null : published.length === 0 ? (
              <EmptyState>Nothing has been published to the question bank yet.</EmptyState>
            ) : (
              <ul className="divide-y divide-line border-y border-line list-none p-0">
                {published.map((q) => (
                  <li key={q.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
                    <div className="min-w-0">
                      <p className="break-words text-ink">{q.canonicalText}</p>
                      <p className="mt-1 text-sm text-muted">
                        {q.state === 'ranked' ? 'Has taken part in a completed enquiry' : 'Available for enquiries'}
                        {q.variantCount && q.variantCount > 0 ? ` · ${q.variantCount + 1} submissions` : ''}
                      </p>
                    </div>
                    <Link
                      href={`/questions/${q.id}`}
                      className={buttonClasses('quiet', 'shrink-0 self-start sm:self-auto')}
                    >
                      View public question →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </AdminShell>
  )
}
