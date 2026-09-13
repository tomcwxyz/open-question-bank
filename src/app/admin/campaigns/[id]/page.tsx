'use client'

import { use, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AdminShell } from '@/components/ui/AdminShell'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Notice } from '@/components/ui/Notice'
import { EmptyState } from '@/components/ui/EmptyState'
import { SynthesisPanel } from '@/components/ui/SynthesisPanel'

interface Member {
  id: string
  canonicalText: string
}
interface ScoreRow {
  questionId: string
  mu: number
  sigma: number
  nComparisons: number
}
interface CampaignDetail {
  campaign: { id: string; prompt: string; comparisonAxis: string; state: string }
  members: Member[]
  scores: ScoreRow[]
}
interface Pair {
  a: Member
  b: Member
  servedReason: string
}
interface Candidate {
  id: string
  canonicalText: string
}

function stageCopy(state: string) {
  if (state === 'draft') return { label: 'Preparing', summary: 'Choose the starting questions and decide how you want people to take part.' }
  if (state === 'open') return { label: 'Gathering questions', summary: 'The enquiry is public and people can add what they think should be explored.' }
  if (state === 'comparing') return { label: 'Prioritising', summary: 'People are comparing questions two at a time to clarify what matters most.' }
  if (state === 'closed') return { label: 'Complete', summary: 'The prioritised result is published. You can now interpret and synthesise what emerged.' }
  return { label: state, summary: 'This enquiry is in an operational state.' }
}

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [detail, setDetail] = useState<CampaignDetail | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [pair, setPair] = useState<Pair | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/campaigns/${id}`)
    if (res.ok) setDetail(await res.json())
    else setMessage('Could not load this enquiry.')
  }, [id])

  const loadCandidates = useCallback(async () => {
    const res = await fetch('/api/admin/questions?state=canonical')
    if (res.ok) setCandidates((await res.json()).questions)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    loadCandidates()
  }, [load, loadCandidates])

  const state = detail?.campaign.state
  const stage = stageCopy(state ?? '')
  const memberIds = useMemo(() => new Set(detail?.members.map((m) => m.id)), [detail?.members])
  const addable = candidates.filter((c) => !memberIds.has(c.id))
  const textById = new Map(detail?.members.map((m) => [m.id, m.canonicalText]))

  async function refreshPair() {
    const res = await fetch(`/api/admin/campaigns/${id}/pair`)
    const data = await res.json()
    if (res.ok) {
      setPair(data.pair)
      setMessage(data.pair ? '' : 'There are no more informative pairs to compare right now.')
    } else {
      setMessage(data.error ?? 'Could not load a pair.')
    }
  }

  async function add(questionId: string) {
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch(`/api/admin/campaigns/${id}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionIds: [questionId] }),
      })
      if (!res.ok) {
        setMessage((await res.json()).error ?? 'Could not add the question.')
        return
      }
      setMessage('Question added to this enquiry.')
      await load()
    } catch {
      setMessage('Network error — please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function transition(path: 'open' | 'close' | 'open-submission') {
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch(`/api/admin/campaigns/${id}/${path}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error ?? 'Could not change the enquiry stage.')
      } else {
        setPair(null)
        if (path === 'open-submission') setMessage('The enquiry is now gathering questions publicly.')
        if (path === 'open') setMessage('Prioritisation is now open.')
        if (path === 'close') setMessage('The result is now published.')
        await load()
      }
    } catch {
      setMessage('Network error — please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function getPair() {
    setBusy(true)
    setMessage('')
    try {
      await refreshPair()
    } catch {
      setMessage('Network error — please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function judge(winnerQuestionId: string | null) {
    if (!pair) return
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch(`/api/admin/campaigns/${id}/comparisons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionAId: pair.a.id,
          questionBId: pair.b.id,
          winnerQuestionId,
          servedReason: pair.servedReason,
        }),
      })
      if (!res.ok) {
        setMessage((await res.json()).error ?? 'Could not record the comparison.')
        return
      }
      await load()
      await refreshPair()
    } catch {
      setMessage('Network error — please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!detail) {
    return (
      <AdminShell>
        {message ? (
          <Notice role="alert" tone="error">{message}</Notice>
        ) : (
          <p className="text-muted">Loading enquiry…</p>
        )}
      </AdminShell>
    )
  }

  const ranked = detail.scores.filter((score) => score.nComparisons > 0)

  return (
    <AdminShell>
      <div className="space-y-5 border-b border-line pb-6">
        <Link href="/admin/campaigns" className="text-sm text-muted no-underline hover:text-ink hover:underline">
          ← All enquiries
        </Link>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-end">
          <div>
            <p className="eyebrow">{stage.label}</p>
            <h1 className="mt-1 max-w-4xl text-3xl sm:text-4xl leading-tight">{detail.campaign.prompt}</h1>
            <p className="mt-3 max-w-2xl text-muted leading-relaxed">{stage.summary}</p>
          </div>
          <div className="text-sm text-muted lg:text-right">
            <p>People compare by</p>
            <p className="font-medium text-ink">{detail.campaign.comparisonAxis}</p>
          </div>
        </div>
      </div>

      {message && <Notice role="status" tone="info">{message}</Notice>}

      {state === 'draft' && (
        <Card className="space-y-4">
          <div>
            <p className="eyebrow">Choose how to begin</p>
            <h2 className="mt-1 text-2xl">How should people take part first?</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              You can open the enquiry to collect more questions, or move straight to prioritisation once the starting set is strong enough.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="accent" onClick={() => transition('open-submission')} disabled={busy}>
              Open to gather questions
            </Button>
            <Button type="button" variant="ghost" onClick={() => transition('open')} disabled={busy}>
              Start prioritisation
            </Button>
          </div>
        </Card>
      )}

      {state === 'open' && (
        <Card className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <p className="eyebrow">Public participation is open</p>
            <h2 className="mt-1 text-2xl">Gathering questions</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Share the public enquiry page while you are collecting what people think should be asked. When the set feels ready, move into prioritisation.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Link href={`/campaigns/${detail.campaign.id}`} className={buttonClasses('ghost')}>
              View public enquiry ↗
            </Link>
            <Button type="button" variant="accent" onClick={() => transition('open')} disabled={busy}>
              Start prioritisation
            </Button>
          </div>
        </Card>
      )}

      {state === 'comparing' && (
        <Card className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <p className="eyebrow">Public participation is open</p>
            <h2 className="mt-1 text-2xl">People are deciding what matters most</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Keep prioritisation open while useful comparisons are still coming in. Closing publishes the current result.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Link href={`/judge/${detail.campaign.id}`} className={buttonClasses('ghost')}>
              View prioritisation ↗
            </Link>
            <Button type="button" variant="accent" onClick={() => transition('close')} disabled={busy}>
              Close and publish result
            </Button>
          </div>
        </Card>
      )}

      {state === 'closed' && (
        <Card className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <p className="eyebrow">Published result</p>
            <h2 className="mt-1 text-2xl">The collective picture is now public</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              The ordering remains traceable to the pairwise choices underneath it. You can now use synthesis to explore what the result might add up to.
            </p>
          </div>
          <Link href={`/campaigns/${detail.campaign.id}`} className={buttonClasses('ghost', 'justify-self-start lg:justify-self-end')}>
            View public result ↗
          </Link>
        </Card>
      )}

      {(state === 'draft' || state === 'open') && (
        <section className="space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Question set</p>
              <h2 className="mt-1 text-2xl">Questions in this enquiry</h2>
            </div>
            <p className="text-sm text-muted">{detail.members.length} selected</p>
          </div>

          {detail.members.length === 0 ? (
            <EmptyState>No questions have been selected yet. Add at least two before prioritisation can begin.</EmptyState>
          ) : (
            <ol className="divide-y divide-line border-y border-line pl-7">
              {detail.members.map((member) => (
                <li key={member.id} className="py-3 pl-2 text-ink">{member.canonicalText}</li>
              ))}
            </ol>
          )}

          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-moss hover:underline">
              Add questions from the bank ({addable.length} available)
            </summary>
            <div className="mt-4">
              {addable.length === 0 ? (
                <p className="text-sm text-muted">No more published questions are available to add.</p>
              ) : (
                <ul className="divide-y divide-line border-y border-line list-none p-0">
                  {addable.map((candidate) => (
                    <li key={candidate.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="min-w-0 break-words text-ink">{candidate.canonicalText}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        className="shrink-0 self-start sm:self-auto"
                        onClick={() => add(candidate.id)}
                        disabled={busy}
                      >
                        Add to enquiry
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>
        </section>
      )}

      {(state === 'comparing' || state === 'closed') && (
        <section className="space-y-4">
          <div>
            <p className="eyebrow">Emerging picture</p>
            <h2 className="mt-1 text-2xl">{state === 'closed' ? 'What rose to the top' : 'Where the questions currently stand'}</h2>
          </div>

          {ranked.length === 0 ? (
            <EmptyState>No comparisons have been recorded yet.</EmptyState>
          ) : (
            <ol className="divide-y divide-line border-y border-line list-none p-0">
              {ranked.map((score, index) => (
                <li key={score.questionId} className="grid gap-2 py-4 sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
                  <span className="font-display text-xl text-moss">#{index + 1}</span>
                  <div className="min-w-0">
                    <p className="break-words text-ink">{textById.get(score.questionId) ?? score.questionId}</p>
                    <p className="mt-1 text-sm text-muted">
                      {score.nComparisons} head-to-head comparison{score.nComparisons === 1 ? '' : 's'}
                    </p>
                  </div>
                  <details className="text-sm sm:text-right">
                    <summary className="cursor-pointer text-muted hover:text-ink">Technical score</summary>
                    <p className="mt-1 text-muted">μ {score.mu.toFixed(1)} · σ {score.sigma.toFixed(1)}</p>
                  </details>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {state === 'comparing' && (
        <details className="rounded-lg border border-line p-4">
          <summary className="cursor-pointer font-medium text-ink">Preview the comparison experience</summary>
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted">
              Use this only to test or contribute a comparison yourself. Public participants use the prioritisation page above.
            </p>
            {!pair ? (
              <Button type="button" variant="ghost" onClick={getPair} disabled={busy}>
                Preview next pair
              </Button>
            ) : (
              <Card className="space-y-4 bg-surface">
                <p className="text-sm text-muted">Which question is more {detail.campaign.comparisonAxis}?</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button type="button" variant="ghost" onClick={() => judge(pair.a.id)} disabled={busy}>
                    {pair.a.canonicalText}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => judge(pair.b.id)} disabled={busy}>
                    {pair.b.canonicalText}
                  </Button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Button type="button" variant="quiet" onClick={() => judge(null)} disabled={busy}>
                    Can&rsquo;t decide
                  </Button>
                  <details className="text-xs text-muted">
                    <summary className="cursor-pointer">Why this pair?</summary>
                    <p className="mt-1">{pair.servedReason}</p>
                  </details>
                </div>
              </Card>
            )}
          </div>
        </details>
      )}

      {state === 'closed' && (
        <section className="space-y-3">
          <div>
            <p className="eyebrow">Interpretation</p>
            <h2 className="mt-1 text-2xl">What might this add up to?</h2>
          </div>
          <SynthesisPanel campaignId={detail.campaign.id} />
        </section>
      )}
    </AdminShell>
  )
}
