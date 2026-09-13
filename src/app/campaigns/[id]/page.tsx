'use client'

import Link from 'next/link'
import { use, useCallback, useEffect, useState } from 'react'
import { AppShell } from '@/components/ui/AppShell'
import { PublicNav } from '@/components/ui/PublicNav'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { RankingConfidenceChart } from '@/components/charts/RankingConfidenceChart'
import {
  strengthPercent,
  standingLabel,
  confidenceLevel,
  confidenceMeter,
  outcomePhrase,
} from '@/lib/agenda-presentation'

interface EnquiryInfo {
  id: string
  prompt: string
  comparisonAxis: string
  state: 'open' | 'comparing' | 'closed'
  closesAt: string | null
  questionCount: number
}

interface Item {
  rank: number
  questionId: string
  canonicalText: string
  mu: number
  sigma: number
  nComparisons: number
  variantCount: number
}

interface Agenda {
  campaign: { prompt: string; comparisonAxis: string; closesAt: string | null }
  items: Item[]
}

interface Evidence {
  opponentText: string
  outcome: 'won' | 'lost' | 'drew'
  timestamp: string
}

interface PublicSynthesis {
  synthesisedText: string
  rationale: string
  sources: { questionId: string; canonicalText: string }[]
}

export default function EnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [info, setInfo] = useState<EnquiryInfo | null>(null)
  const [agenda, setAgenda] = useState<Agenda | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [message, setMessage] = useState('')
  const [evidence, setEvidence] = useState<Record<string, Evidence[]>>({})
  const [syntheses, setSyntheses] = useState<PublicSynthesis[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const infoResponse = await fetch(`/api/campaigns/${id}`)
      const infoData = await infoResponse.json()
      if (!infoResponse.ok) {
        setMessage(infoData.error ?? 'This enquiry is not available.')
        return
      }

      setInfo(infoData)

      if (infoData.state === 'closed') {
        const [agendaResponse, synthesisResponse] = await Promise.all([
          fetch(`/api/campaigns/${id}/agenda`),
          fetch(`/api/campaigns/${id}/syntheses`),
        ])

        if (agendaResponse.ok) setAgenda(await agendaResponse.json())
        else setMessage('The results of this enquiry could not be loaded.')

        if (synthesisResponse.ok) setSyntheses((await synthesisResponse.json()).syntheses)
      }
    } catch {
      setMessage('Network error — please try again.')
    } finally {
      setLoaded(true)
    }
  }, [id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  async function toggleEvidence(questionId: string) {
    if (openId === questionId) {
      setOpenId(null)
      return
    }
    setOpenId(questionId)
    if (evidence[questionId]) return

    setBusy(true)
    try {
      const response = await fetch(`/api/campaigns/${id}/agenda/${questionId}`)
      if (response.ok) {
        const data = await response.json()
        setEvidence((previous) => ({ ...previous, [questionId]: data.evidence }))
      }
    } finally {
      setBusy(false)
    }
  }

  if (!loaded) {
    return (
      <AppShell nav={<PublicNav />}>
        <p className="text-muted">Loading enquiry…</p>
      </AppShell>
    )
  }

  if (!info || message) {
    return (
      <AppShell nav={<PublicNav />}>
        <Notice role="alert" tone="error">{message || 'This enquiry is not available.'}</Notice>
      </AppShell>
    )
  }

  const completed = info.closesAt ? new Date(info.closesAt).toLocaleDateString() : null
  const maxMu = agenda?.items[0]?.mu ?? 0

  return (
    <AppShell nav={<PublicNav />}>
      <header className="max-w-4xl space-y-4">
        <p className="eyebrow">Enquiry</p>
        <h1 className="text-4xl leading-tight sm:text-5xl">{info.prompt}</h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted">
          {info.state === 'open'
            ? 'This enquiry is still gathering the questions people think are worth asking.'
            : info.state === 'comparing'
              ? 'The questions are gathered. People are now helping work out which ones matter most to answer.'
              : 'This enquiry is complete. Here is the picture that emerged from people comparing the questions.'}
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
          {info.questionCount > 0 ? (
            <span>{info.questionCount} question{info.questionCount === 1 ? '' : 's'} in this enquiry</span>
          ) : null}
          <span>Considering {info.comparisonAxis}</span>
          {completed ? <span>Completed {completed}</span> : null}
        </div>
      </header>

      {info.state === 'open' ? (
        <section className="max-w-3xl rounded-2xl border border-line bg-surface p-6 sm:p-8">
          <p className="eyebrow">What can you add?</p>
          <h2 className="mt-2 text-3xl">What should this enquiry be asking?</h2>
          <p className="mt-3 max-w-2xl leading-relaxed text-muted">
            Add a question in your own words. If someone has already asked something similar, we’ll help you find it rather than creating another copy.
          </p>
          <Link href={`/campaigns/${id}/submit`} className={buttonClasses('accent', 'mt-6')}>
            Add what we should ask →
          </Link>
        </section>
      ) : null}

      {info.state === 'comparing' ? (
        <section className="max-w-3xl rounded-2xl border border-line bg-surface p-6 sm:p-8">
          <p className="eyebrow">A useful five minutes</p>
          <h2 className="mt-2 text-3xl">Help decide what matters most</h2>
          <p className="mt-3 max-w-2xl leading-relaxed text-muted">
            You’ll see two questions at a time. Choose the one you think matters more to answer. Each small judgement helps make the collective priorities clearer.
          </p>
          <Link href={`/judge/${id}`} className={buttonClasses('accent', 'mt-6')}>
            Start comparing →
          </Link>
        </section>
      ) : null}

      {info.state === 'closed' && agenda ? (
        <>
          <section aria-labelledby="results-heading" className="space-y-4">
            <div className="max-w-2xl">
              <p className="eyebrow">What emerged</p>
              <h2 id="results-heading" className="text-3xl">What rose to the top</h2>
              <p className="mt-2 leading-relaxed text-muted">
                These positions come from the comparisons made inside this enquiry. They are not a global score for the question.
              </p>
            </div>

            <ol className="list-none border-b border-line p-0">
              {agenda.items.map((item) => {
                const ratio = maxMu > 0 ? item.mu / maxMu : 1
                const pct = strengthPercent(item.mu, maxMu)
                const label = standingLabel(item.rank, ratio)
                const meter = confidenceMeter(confidenceLevel(item.sigma))
                const evidenceRows = evidence[item.questionId]

                return (
                  <li key={item.questionId} className="border-t border-line py-6 sm:py-7">
                    <div className="grid gap-4 sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:gap-5">
                      <span className="font-display text-3xl text-moss">#{item.rank}</span>
                      <div className="min-w-0 space-y-4">
                        <div>
                          <Link
                            href={`/questions/${item.questionId}`}
                            className="font-display text-2xl leading-snug text-ink no-underline transition-colors hover:text-moss hover:no-underline sm:text-3xl"
                          >
                            {item.canonicalText}
                          </Link>
                          {item.variantCount > 0 ? (
                            <p className="mt-2 text-sm text-muted">
                              {item.variantCount + 1} submissions asked versions of this
                            </p>
                          ) : null}
                        </div>

                        <div className="max-w-xl space-y-2">
                          <div aria-hidden="true" className="h-1.5 w-full overflow-hidden rounded-full bg-line">
                            <div className="h-full rounded-full bg-moss" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                            <span className="font-medium text-ink">{label}</span>
                            <span title={meter.label} aria-label={meter.label} className="tracking-widest">
                              {[0, 1, 2].map((index) => (
                                <span key={index} aria-hidden="true" className={index < meter.filled ? 'text-moss' : 'text-line'}>
                                  ●
                                </span>
                              ))}
                            </span>
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="quiet"
                          onClick={() => void toggleEvidence(item.questionId)}
                          disabled={busy}
                        >
                          {openId === item.questionId ? 'Hide evidence' : 'Show evidence'}
                        </Button>

                        {openId === item.questionId ? (
                          evidenceRows ? (
                            evidenceRows.length === 0 ? (
                              <p className="text-sm text-muted">No comparisons recorded.</p>
                            ) : (
                              <div className="space-y-2 border-l-2 border-line pl-4">
                                <p className="text-sm text-muted">
                                  Compared head-to-head {item.nComparisons} {item.nComparisons === 1 ? 'time' : 'times'}.
                                </p>
                                <ul className="list-none space-y-1 p-0">
                                  {evidenceRows.map((row, index) => (
                                    <li key={`${row.timestamp}-${index}`} className="text-sm text-ink">
                                      <span className="font-medium">{outcomePhrase(row.outcome)}:</span> “{row.opponentText}”
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )
                          ) : (
                            <p className="text-sm text-muted">{busy ? 'Loading evidence…' : 'Couldn’t load evidence — try again.'}</p>
                          )
                        ) : null}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>

          <details className="border-y border-line py-1 text-sm">
            <summary className="cursor-pointer py-4 font-medium text-ink">How was this ranked?</summary>
            <div className="space-y-4 border-t border-line py-5">
              <p className="max-w-3xl leading-relaxed text-muted">
                People compared questions two at a time. Each choice nudged the relative positions and reduced uncertainty. The technical view below exposes the underlying score and confidence information for auditability.
              </p>
              <RankingConfidenceChart
                items={agenda.items.map((item) => ({
                  rank: item.rank,
                  canonicalText: item.canonicalText,
                  mu: item.mu,
                  sigma: item.sigma,
                  nComparisons: item.nComparisons,
                  variantCount: item.variantCount,
                }))}
              />
            </div>
          </details>

          {syntheses.length > 0 ? (
            <section className="space-y-4" aria-labelledby="synthesis-heading">
              <div className="max-w-2xl">
                <p className="eyebrow">Looking across the questions</p>
                <h2 id="synthesis-heading" className="text-3xl">What this might add up to</h2>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                {syntheses.map((synthesis, index) => (
                  <article key={`${synthesis.synthesisedText}-${index}`} className="rounded-xl border border-line bg-surface p-5 sm:p-6">
                    <p className="font-display text-2xl leading-snug text-ink">{synthesis.synthesisedText}</p>
                    <p className="mt-3 text-sm leading-relaxed text-muted">{synthesis.rationale}</p>
                    <details className="mt-4 text-sm text-muted">
                      <summary className="cursor-pointer hover:text-ink">See source questions</summary>
                      <ul className="mt-3 list-none space-y-2 border-l border-line pl-4">
                        {synthesis.sources.map((source) => (
                          <li key={source.questionId}>
                            <Link href={`/questions/${source.questionId}`} className="text-ink no-underline hover:text-moss hover:underline">
                              {source.canonicalText}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      <footer className="border-t border-line pt-6">
        <Link href="/campaigns" className="text-sm text-muted no-underline hover:text-ink hover:underline">
          ← Explore other enquiries
        </Link>
      </footer>
    </AppShell>
  )
}
