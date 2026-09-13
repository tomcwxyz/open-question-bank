'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AdminShell } from '@/components/ui/AdminShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Label, Textarea } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { EmptyState } from '@/components/ui/EmptyState'

interface Clustered {
  id: string
  canonicalText: string
  createdAt: string
}

interface Critique {
  criterion: string
  verdict: 'pass' | 'fail'
  note: string
}

interface Suggestion {
  suggestedText: string
  critique: Critique[]
  criteriaApplied: string[]
  rationale: string
  model: string
  modelVersion: string
}

interface RefinementRow {
  id: string
  action: 'accept' | 'reject' | 'edit'
  before: string
  after: string | null
  timestamp: string
}

export default function RefinementPage() {
  const [questions, setQuestions] = useState<Clustered[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [active, setActive] = useState<{ id: string; before: string; suggestion: Suggestion } | null>(null)
  const [editedText, setEditedText] = useState('')
  const [history, setHistory] = useState<RefinementRow[]>([])

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/questions?state=clustered')
    if (res.ok) setQuestions((await res.json()).questions)
  }, [])

  async function loadHistory(id: string) {
    const res = await fetch(`/api/admin/questions/${id}/refinements`)
    setHistory(res.ok ? (await res.json()).refinements : [])
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  async function suggest(id: string) {
    setBusy(true)
    setMessage('Getting a second opinion…')
    try {
      const res = await fetch(`/api/admin/questions/${id}/refine/suggest`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setActive({ id, before: data.before, suggestion: data.suggestion })
        setEditedText(data.suggestion.suggestedText)
        setMessage('')
        await loadHistory(id)
      } else {
        setMessage(data.error ?? 'Could not suggest an alternative wording.')
      }
    } catch {
      setMessage('Network error — please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function saveWording() {
    if (!active) return
    const trimmed = editedText.trim()
    if (!trimmed) {
      setMessage('The final wording cannot be empty.')
      return
    }

    const action: 'accept' | 'edit' =
      trimmed === active.suggestion.suggestedText.trim() ? 'accept' : 'edit'

    setBusy(true)
    setMessage('')
    try {
      const res = await fetch(`/api/admin/questions/${active.id}/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          before: active.before,
          llmSuggestedText: active.suggestion.suggestedText,
          finalText: trimmed,
          criteriaApplied: active.suggestion.criteriaApplied,
          critique: active.suggestion.critique,
          rationale: active.suggestion.rationale,
          model: active.suggestion.model,
          modelVersion: active.suggestion.modelVersion,
        }),
      })
      const data = await res.json()
      setMessage(res.ok ? 'Wording saved.' : (data.error ?? 'Could not save the wording.'))
      if (res.ok) setActive(null)
    } catch {
      setMessage('Network error — please try again.')
    } finally {
      setBusy(false)
      load()
    }
  }

  async function keepOriginal() {
    if (!active) return
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch(`/api/admin/questions/${active.id}/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          before: active.before,
          llmSuggestedText: active.suggestion.suggestedText,
          finalText: null,
          criteriaApplied: active.suggestion.criteriaApplied,
          critique: active.suggestion.critique,
          rationale: active.suggestion.rationale,
          model: active.suggestion.model,
          modelVersion: active.suggestion.modelVersion,
        }),
      })
      const data = await res.json()
      setMessage(res.ok ? 'Original wording kept.' : (data.error ?? 'Could not record the decision.'))
      if (res.ok) setActive(null)
    } catch {
      setMessage('Network error — please try again.')
    } finally {
      setBusy(false)
      load()
    }
  }

  const changed = useMemo(() => {
    if (!active) return false
    return editedText.trim() !== active.suggestion.suggestedText.trim()
  }, [active, editedText])

  return (
    <AdminShell>
      <div className="space-y-2">
        <p className="eyebrow">Improve questions</p>
        <h1 className="text-3xl sm:text-4xl">Make the wording clearer</h1>
        <p className="max-w-2xl text-muted leading-relaxed">
          These questions have passed the first review. Use AI as a second pair of eyes if it is useful,
          then decide the wording yourself. Nothing is changed automatically.
        </p>
      </div>

      {message && (
        <Notice role="status" tone="info">
          {message}
        </Notice>
      )}

      {active ? (
        <section className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Question under review</p>
              <p className="mt-1 max-w-3xl font-display text-2xl leading-snug text-ink">{active.before}</p>
            </div>
            <Button type="button" variant="quiet" onClick={() => setActive(null)} disabled={busy}>
              Back to queue
            </Button>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
            <div className="space-y-2">
              <Label htmlFor="refined">Final wording</Label>
              <Textarea
                id="refined"
                aria-label="Final wording"
                className="min-h-40 text-lg leading-relaxed"
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
              />
              <p className="text-sm text-muted">
                {changed ? 'You have edited the suggested wording.' : 'This starts with the suggested wording. Edit it freely.'}
              </p>
            </div>

            <Card className="space-y-4 bg-surface">
              <div>
                <p className="eyebrow">AI second opinion</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{active.suggestion.rationale}</p>
              </div>

              <div className="space-y-2">
                {active.suggestion.critique.map((c) => (
                  <div key={c.criterion} className="border-t border-line pt-2 first:border-t-0 first:pt-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-ink">{c.criterion}</span>
                      <span className={c.verdict === 'pass' ? 'text-xs text-moss' : 'text-xs text-clay'}>
                        {c.verdict === 'pass' ? 'Looks good' : 'Worth checking'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{c.note}</p>
                  </div>
                ))}
              </div>

              <details className="text-sm">
                <summary className="cursor-pointer text-muted hover:text-ink">Technical provenance</summary>
                <p className="mt-2 break-words text-muted">
                  {active.suggestion.model} · {active.suggestion.modelVersion}
                </p>
              </details>
            </Card>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-line pt-5">
            <Button type="button" variant="accent" onClick={saveWording} disabled={busy || editedText.trim().length === 0}>
              Save this wording
            </Button>
            <Button type="button" variant="ghost" onClick={keepOriginal} disabled={busy}>
              Keep the original
            </Button>
          </div>

          {history.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted hover:text-ink">
                Previous wording decisions ({history.length})
              </summary>
              <ul className="mt-3 divide-y divide-line border-y border-line list-none p-0">
                {history.map((h) => (
                  <li key={h.id} className="py-3">
                    <p className="text-xs uppercase tracking-wide text-muted">{h.action}</p>
                    <p className="mt-1 text-ink">{h.before}</p>
                    {h.after && h.after !== h.before && <p className="mt-1 text-muted">→ {h.after}</p>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      ) : questions.length === 0 ? (
        <EmptyState>No questions need wording attention right now.</EmptyState>
      ) : (
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Available to review</p>
              <h2 className="mt-1 text-2xl">{questions.length} question{questions.length === 1 ? '' : 's'}</h2>
            </div>
            <p className="hidden text-sm text-muted sm:block">AI advice is optional.</p>
          </div>

          <ul className="divide-y divide-line border-y border-line list-none p-0">
            {questions.map((q) => (
              <li key={q.id} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="break-words font-display text-xl leading-snug text-ink">{q.canonicalText}</p>
                  <p className="mt-1 text-sm text-muted">Submitted {new Date(q.createdAt).toLocaleDateString()}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="shrink-0 self-start sm:self-auto"
                  onClick={() => suggest(q.id)}
                  disabled={busy}
                >
                  Review wording →
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </AdminShell>
  )
}
