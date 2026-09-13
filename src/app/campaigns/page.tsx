'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { AppShell } from '@/components/ui/AppShell'
import { PublicNav } from '@/components/ui/PublicNav'
import { buttonClasses } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { EmptyState } from '@/components/ui/EmptyState'

interface PublicCampaign {
  id: string
  prompt: string
  comparisonAxis: string
  closesAt: string | null
  questionCount: number
}

type ActiveEnquiry = PublicCampaign & { phase: 'gathering' | 'prioritising' }

export default function CampaignsIndexPage() {
  const [published, setPublished] = useState<PublicCampaign[]>([])
  const [active, setActive] = useState<ActiveEnquiry[]>([])
  const [loaded, setLoaded] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/campaigns')
      if (response.ok) {
        const data = await response.json()
        setPublished(data.published ?? [])
        setActive([
          ...(data.openForSubmission ?? []).map((item: PublicCampaign) => ({ ...item, phase: 'gathering' as const })),
          ...(data.openForJudging ?? []).map((item: PublicCampaign) => ({ ...item, phase: 'prioritising' as const })),
        ])
      } else {
        setMessage('Could not load enquiries.')
      }
    } catch {
      setMessage('Network error — please try again.')
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  return (
    <AppShell nav={<PublicNav />}>
      <header className="max-w-3xl space-y-3">
        <p className="eyebrow">Enquiries</p>
        <h1 className="text-4xl sm:text-5xl">Questions people are exploring together</h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted">
          Join something that is open now, or look back at what people collectively decided was worth paying attention to.
        </p>
      </header>

      {message ? (
        <Notice role="alert" tone="error">{message}</Notice>
      ) : null}

      {!message ? (
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(19rem,0.7fr)] lg:gap-14">
          <section aria-labelledby="active-enquiries-heading">
            <div className="mb-4">
              <p className="eyebrow">Open now</p>
              <h2 id="active-enquiries-heading" className="text-3xl">Take part in an enquiry</h2>
            </div>

            {!loaded ? (
              <p className="text-muted">Loading enquiries…</p>
            ) : active.length === 0 ? (
              <EmptyState>There are no open enquiries right now.</EmptyState>
            ) : (
              <ul className="list-none border-b border-line p-0">
                {active.map((enquiry) => {
                  const gathering = enquiry.phase === 'gathering'
                  return (
                    <li
                      key={`${enquiry.phase}-${enquiry.id}`}
                      className="grid gap-4 border-t border-line py-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/campaigns/${enquiry.id}`}
                          className="font-display text-2xl leading-snug text-ink no-underline transition-colors hover:text-moss hover:no-underline"
                        >
                          {enquiry.prompt}
                        </Link>
                        <p className="mt-2 text-sm leading-relaxed text-muted">
                          {gathering
                            ? 'People are still adding the questions this enquiry should consider.'
                            : `People are comparing ${enquiry.questionCount} question${enquiry.questionCount === 1 ? '' : 's'} to make the priorities clearer.`}
                        </p>
                      </div>
                      <Link
                        href={gathering ? `/campaigns/${enquiry.id}/submit` : `/judge/${enquiry.id}`}
                        className={buttonClasses(gathering ? 'accent' : 'primary', 'shrink-0 self-start sm:self-auto')}
                      >
                        {gathering ? 'Add what we should ask →' : 'Help decide what matters most →'}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <aside aria-labelledby="past-enquiries-heading" className="lg:border-l lg:border-line lg:pl-9">
            <div className="mb-4">
              <p className="eyebrow">What emerged</p>
              <h2 id="past-enquiries-heading" className="text-2xl">Past enquiries</h2>
            </div>

            {!loaded ? (
              <p className="text-muted">Loading…</p>
            ) : published.length === 0 ? (
              <p className="border-t border-line py-4 text-sm text-muted">No completed enquiries yet.</p>
            ) : (
              <ul className="list-none border-b border-line p-0">
                {published.map((enquiry) => (
                  <li key={enquiry.id} className="border-t border-line py-5">
                    <Link
                      href={`/campaigns/${enquiry.id}`}
                      className="font-display text-xl leading-snug text-ink no-underline transition-colors hover:text-moss hover:no-underline"
                    >
                      {enquiry.prompt}
                    </Link>
                    <p className="mt-2 text-sm text-muted">
                      {enquiry.questionCount} question{enquiry.questionCount === 1 ? '' : 's'} considered
                      {enquiry.closesAt ? ` · completed ${new Date(enquiry.closesAt).toLocaleDateString()}` : ''}
                    </p>
                    <Link
                      href={`/campaigns/${enquiry.id}`}
                      className="mt-3 inline-block text-sm text-moss no-underline hover:underline"
                    >
                      See what rose to the top →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      ) : null}
    </AppShell>
  )
}
