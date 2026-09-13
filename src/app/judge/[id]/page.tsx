'use client'

import Link from 'next/link'
import { use, useCallback, useEffect, useState } from 'react'
import { AppShell } from '@/components/ui/AppShell'
import { PublicNav } from '@/components/ui/PublicNav'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { PrioritisePair } from '@/components/questions/PrioritisePair'

interface Pair {
  a: { id: string; canonicalText: string }
  b: { id: string; canonicalText: string }
  servedReason: string
}

interface Info {
  prompt: string
  comparisonAxis: string
}

export default function JudgePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [info, setInfo] = useState<Info | null>(null)
  const [pair, setPair] = useState<Pair | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [comparisonCount, setComparisonCount] = useState(0)
  const [checkpoint, setCheckpoint] = useState(false)

  const loadPair = useCallback(async () => {
    const response = await fetch(`/api/campaigns/${id}/pair`)
    const data = await response.json()
    if (response.ok) {
      setInfo(data.campaign)
      setPair(data.pair)
    } else {
      setMessage(data.error ?? 'This enquiry is not available.')
    }
    setLoaded(true)
  }, [id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPair()
  }, [loadPair])

  async function judge(winnerQuestionId: string | null) {
    if (!pair) return
    setBusy(true)
    setMessage('')

    try {
      const response = await fetch(`/api/campaigns/${id}/comparisons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionAId: pair.a.id,
          questionBId: pair.b.id,
          winnerQuestionId,
          servedReason: pair.servedReason,
        }),
      })

      if (!response.ok) {
        setMessage((await response.json()).error ?? 'Could not record your choice.')
        return
      }

      const nextCount = comparisonCount + 1
      setComparisonCount(nextCount)

      const nextResponse = await fetch(`/api/campaigns/${id}/pair`)
      const data = await nextResponse.json()
      if (nextResponse.ok) {
        setInfo(data.campaign)
        setPair(data.pair)
        setCheckpoint(Boolean(data.pair) && nextCount % 5 === 0)
      } else {
        setMessage(data.error ?? 'This enquiry is not available.')
      }
    } catch {
      setMessage('Network error — please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!loaded) {
    return (
      <AppShell nav={<PublicNav />}>
        <p className="text-muted">Loading the next choice…</p>
      </AppShell>
    )
  }

  return (
    <AppShell nav={<PublicNav />}>
      {message ? (
        <Notice role="alert" tone="error">{message}</Notice>
      ) : null}

      {info ? (
        <header className="mx-auto max-w-3xl space-y-3 text-center">
          <p className="eyebrow">Help decide what matters most</p>
          <h1 className="text-3xl leading-tight sm:text-4xl">{info.prompt}</h1>
          <p className="text-lg text-muted">Which question matters more to answer?</p>
          <p className="text-sm text-muted">This enquiry is weighing questions by {info.comparisonAxis}.</p>
        </header>
      ) : null}

      {checkpoint && pair ? (
        <section className="mx-auto max-w-2xl rounded-2xl border border-line bg-surface p-6 text-center sm:p-8">
          <p className="eyebrow">Your contribution</p>
          <h2 className="mt-2 text-3xl">You’ve helped clarify {comparisonCount} comparisons</h2>
          <p className="mx-auto mt-3 max-w-xl leading-relaxed text-muted">
            Those choices are now part of the emerging picture. You can keep going, or have a look at the enquiry as it stands.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button type="button" onClick={() => setCheckpoint(false)}>
              Keep comparing
            </Button>
            <Link href={`/campaigns/${id}`} className={buttonClasses('ghost')}>
              See the emerging picture →
            </Link>
          </div>
        </section>
      ) : pair ? (
        <PrioritisePair
          a={pair.a}
          b={pair.b}
          servedReason={pair.servedReason}
          busy={busy}
          onChoose={(questionId) => void judge(questionId)}
          footer={
            comparisonCount > 0 ? (
              <p className="text-center text-sm text-muted">
                {comparisonCount} comparison{comparisonCount === 1 ? '' : 's'} made in this visit
              </p>
            ) : null
          }
        />
      ) : !message ? (
        <section className="mx-auto max-w-2xl rounded-2xl border border-line bg-surface p-6 text-center sm:p-8">
          <p className="eyebrow">Thank you</p>
          <h2 className="mt-2 text-3xl">That’s all for now</h2>
          <p className="mx-auto mt-3 max-w-xl leading-relaxed text-muted">
            No more pairs for you right now.{comparisonCount > 0 ? ` You made ${comparisonCount} useful comparison${comparisonCount === 1 ? '' : 's'}.` : ''}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href={`/campaigns/${id}`} className={buttonClasses('primary')}>
              See the emerging picture →
            </Link>
            <Link href="/browse" className={buttonClasses('ghost')}>
              Explore questions
            </Link>
          </div>
        </section>
      ) : null}
    </AppShell>
  )
}
