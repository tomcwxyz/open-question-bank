'use client'

import { useCallback, useEffect, useState } from 'react'
import { AdminShell } from '@/components/ui/AdminShell'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { EmptyState } from '@/components/ui/EmptyState'

interface Pending {
  id: string
  canonicalText: string
  createdAt: string
  originatingCampaignId: string | null
  originatingCampaignPrompt: string | null
}

export default function ModerationPage() {
  const [pending, setPending] = useState<Pending[]>([])
  const [message, setMessage] = useState('')
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/questions?state=submitted')
      if (res.ok) setPending((await res.json()).questions)
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  async function approve(id: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/questions/${id}/approve`, { method: 'POST' })
      const data = await res.json()
      setMessage(
        res.ok
          ? data.created
            ? 'Approved — this is the first question like it.'
            : 'Approved — grouped with similar questions already in the queue.'
          : (data.error ?? 'Error'),
      )
    } catch {
      setMessage('Network error — please try again.')
    } finally {
      setBusyId(null)
      void load()
    }
  }

  async function reject(id: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/questions/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reasons[id] ?? '' }),
      })
      const data = await res.json()
      setMessage(res.ok ? 'Rejected.' : (data.error ?? 'Error'))
    } catch {
      setMessage('Network error — please try again.')
    } finally {
      setBusyId(null)
      void load()
    }
  }

  return (
    <AdminShell>
      <header className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="max-w-2xl space-y-1">
          <p className="eyebrow">Needs review</p>
          <h1 className="text-3xl sm:text-4xl">What should enter the question bank?</h1>
          <p className="text-muted">
            Review new submissions before they become part of the shared bank. Approving keeps the question moving; rejection is for submissions that should not enter the process.
          </p>
        </div>
        {loaded ? (
          <div className="text-sm text-muted">
            <span className="font-display text-3xl text-moss tabular-nums">{pending.length}</span>{' '}
            waiting
          </div>
        ) : null}
      </header>

      {message ? (
        <Notice role="status" tone="info">
          {message}
        </Notice>
      ) : null}

      {!loaded ? (
        <p className="text-muted">Loading submissions…</p>
      ) : pending.length === 0 ? (
        <EmptyState>Nothing needs review right now.</EmptyState>
      ) : (
        <ol className="list-none border-b border-line p-0">
          {pending.map((question, index) => (
            <li key={question.id} className="border-t border-line py-6 sm:py-7">
              <article className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start xl:gap-8">
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.12em] text-muted">
                    <span>Submission {index + 1} of {pending.length}</span>
                    {question.originatingCampaignPrompt ? <span>· from an enquiry</span> : null}
                  </div>
                  <p className="break-words font-display text-2xl leading-snug text-ink sm:text-3xl">
                    {question.canonicalText}
                  </p>
                  {question.originatingCampaignPrompt ? (
                    <p className="text-sm leading-relaxed text-muted">
                      Submitted while exploring <span className="text-ink">“{question.originatingCampaignPrompt}”</span>
                    </p>
                  ) : null}
                </div>

                <div className="flex min-w-52 flex-col gap-2 xl:items-stretch">
                  <Button
                    type="button"
                    variant="accent"
                    onClick={() => void approve(question.id)}
                    disabled={busyId === question.id}
                  >
                    Approve question
                  </Button>

                  <details className="rounded-md border border-line bg-surface text-sm">
                    <summary className="cursor-pointer px-3 py-2.5 text-muted hover:text-ink">
                      Reject this submission
                    </summary>
                    <div className="space-y-2 border-t border-line p-3">
                      <Input
                        aria-label={`Reject reason for ${question.id}`}
                        placeholder="Reason (optional)"
                        value={reasons[question.id] ?? ''}
                        onChange={(event) => setReasons((current) => ({ ...current, [question.id]: event.target.value }))}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full"
                        onClick={() => void reject(question.id)}
                        disabled={busyId === question.id}
                      >
                        Confirm rejection
                      </Button>
                    </div>
                  </details>
                </div>
              </article>
            </li>
          ))}
        </ol>
      )}
    </AdminShell>
  )
}
