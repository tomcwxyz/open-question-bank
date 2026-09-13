'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { buttonClasses } from '@/components/ui/Button'

interface Question {
  id: string
  canonicalText: string
  clusterSize?: number
}

interface Enquiry {
  id: string
  prompt: string
  comparisonAxis: string
  questionCount: number
}

interface EnquiryAction extends Enquiry {
  phase: 'gathering' | 'prioritising'
  actionHref: string
  actionLabel: string
}

interface BrowseResponse {
  mostAsked: Question[]
  recent: Question[]
}

interface CampaignResponse {
  openForSubmission: Enquiry[]
  openForJudging: Enquiry[]
}

export function HomeSignals() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [enquiries, setEnquiries] = useState<EnquiryAction[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [browseResponse, campaignResponse] = await Promise.all([
          fetch('/api/browse'),
          fetch('/api/campaigns'),
        ])

        if (cancelled) return

        if (browseResponse.ok) {
          const data = (await browseResponse.json()) as BrowseResponse
          setQuestions((data.mostAsked.length > 0 ? data.mostAsked : data.recent).slice(0, 4))
        }

        if (campaignResponse.ok) {
          const data = (await campaignResponse.json()) as CampaignResponse
          const acceptingQuestions = (data.openForSubmission ?? []).map((enquiry) => ({
            ...enquiry,
            phase: 'gathering' as const,
            actionHref: `/campaigns/${enquiry.id}/submit`,
            actionLabel: 'Add what we should ask →',
          }))
          const prioritising = (data.openForJudging ?? []).map((enquiry) => ({
            ...enquiry,
            phase: 'prioritising' as const,
            actionHref: `/judge/${enquiry.id}`,
            actionLabel: 'Help decide what matters most →',
          }))
          const active = [...acceptingQuestions, ...prioritising]
          const unique = active.filter(
            (enquiry, index, list) => list.findIndex((item) => item.id === enquiry.id) === index,
          )
          setEnquiries(unique.slice(0, 3))
        }
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)] lg:gap-10">
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">People keep coming back to</p>
            <h2 className="mt-1 text-2xl sm:text-3xl">Questions being asked more than once</h2>
          </div>
          <Link href="/browse" className="hidden sm:inline text-sm no-underline hover:underline">
            Explore all →
          </Link>
        </div>

        {!loaded ? (
          <p className="text-muted">Loading questions…</p>
        ) : questions.length === 0 ? (
          <EmptyState>The bank is just getting started.</EmptyState>
        ) : (
          <div className="divide-y divide-line border-y border-line">
            {questions.map((question) => (
              <Link
                key={question.id}
                href={`/questions/${question.id}`}
                className="group grid gap-1 py-5 text-ink no-underline hover:no-underline sm:grid-cols-[1fr_auto] sm:items-center sm:gap-5"
              >
                <span className="font-display text-xl sm:text-2xl leading-snug group-hover:text-moss transition-colors">
                  {question.canonicalText}
                </span>
                {question.clusterSize && question.clusterSize > 1 ? (
                  <span className="text-sm text-muted whitespace-nowrap">
                    {question.clusterSize} submissions asked versions of this
                  </span>
                ) : (
                  <span className="text-sm text-muted">Explore →</span>
                )}
              </Link>
            ))}
          </div>
        )}

        <Link href="/browse" className="sm:hidden text-sm no-underline hover:underline">
          Explore all questions →
        </Link>
      </section>

      <aside className="space-y-4">
        <div>
          <p className="eyebrow">Open now</p>
          <h2 className="mt-1 text-2xl">What people are exploring together</h2>
        </div>

        {!loaded ? (
          <p className="text-muted">Loading enquiries…</p>
        ) : enquiries.length === 0 ? (
          <Card className="space-y-3">
            <p className="text-muted">No open enquiries right now.</p>
            <Link href="/campaigns" className="text-sm">See past enquiries →</Link>
          </Card>
        ) : (
          <div className="space-y-3">
            {enquiries.map((enquiry) => (
              <Card key={enquiry.id} className="space-y-3">
                <Link
                  href={`/campaigns/${enquiry.id}`}
                  className="block font-display text-xl leading-snug text-ink no-underline hover:text-moss hover:no-underline"
                >
                  {enquiry.prompt}
                </Link>
                <p className="text-sm text-muted">
                  {enquiry.phase === 'gathering'
                    ? 'Gathering the questions people think are worth asking.'
                    : `${enquiry.questionCount} question${enquiry.questionCount === 1 ? '' : 's'} ready for prioritisation.`}
                </p>
                <Link href={enquiry.actionHref} className={buttonClasses('ghost', 'w-full')}>
                  {enquiry.actionLabel}
                </Link>
              </Card>
            ))}
          </div>
        )}

        <Link href="/campaigns" className="inline-block text-sm no-underline hover:underline">
          See all enquiries →
        </Link>
      </aside>
    </div>
  )
}
