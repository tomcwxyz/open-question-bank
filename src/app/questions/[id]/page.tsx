'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { PageShell } from '@/components/ui/PageShell'
import { PublicNav } from '@/components/ui/PublicNav'
import { Notice } from '@/components/ui/Notice'
import { EmptyState } from '@/components/ui/EmptyState'
import { buttonClasses } from '@/components/ui/Button'
import { QuestionListItem } from '@/components/questions/QuestionListItem'
import { TrustDrawer } from '@/components/questions/TrustDrawer'

interface QuestionDetail {
  id: string
  canonicalText: string
  state: 'canonical' | 'under_comparison' | 'ranked'
  cluster: { id: string; representativeText: string | null; size: number } | null
  campaigns: { id: string; prompt: string; state: 'open' | 'comparing' | 'closed' }[]
  refinement: { count: number; criteria: string[] }
  variantCount: number
}

interface Similar {
  id: string
  canonicalText: string
  state: 'canonical' | 'ranked'
  distance: number
}

function technicalStateLabel(state: QuestionDetail['state']) {
  if (state === 'under_comparison') return 'under comparison'
  return state
}

export default function QuestionDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const [detail, setDetail] = useState<QuestionDetail | null>(null)
  const [similar, setSimilar] = useState<Similar[]>([])
  const [loaded, setLoaded] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    try {
      const [detailRes, similarRes] = await Promise.all([
        fetch(`/api/questions/${id}`),
        fetch(`/api/questions/${id}/similar`),
      ])
      if (detailRes.ok) {
        setDetail(await detailRes.json())
      } else if (detailRes.status === 404) {
        setMessage('That question is not public, or does not exist.')
      } else {
        setMessage('Could not load this question.')
      }
      if (similarRes.ok) setSimilar((await similarRes.json()).similar)
    } catch {
      setMessage('Network error — please try again.')
    }
    setLoaded(true)
  }, [id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const comparing = detail?.campaigns.filter((campaign) => campaign.state === 'comparing') ?? []
  const gathering = detail?.campaigns.filter((campaign) => campaign.state === 'open') ?? []
  const published = detail?.campaigns.filter((campaign) => campaign.state === 'closed') ?? []

  return (
    <PageShell nav={<PublicNav />} size="lg">
      <p className="eyebrow">
        <Link href="/browse" className="no-underline hover:underline">
          ← Back to questions
        </Link>
      </p>

      {message ? (
        <Notice role="alert" tone="error">{message}</Notice>
      ) : null}

      {!message && !loaded ? <p className="text-muted">Loading question…</p> : null}

      {detail ? (
        <>
          <header className="max-w-3xl space-y-4">
            <p className="eyebrow">Question</p>
            <h1 className="break-words text-4xl leading-tight sm:text-5xl">{detail.canonicalText}</h1>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
              <span>
                {detail.variantCount > 0
                  ? `${detail.variantCount + 1} submissions asked versions of this`
                  : 'A question in the shared bank'}
              </span>
              {detail.cluster && detail.cluster.size > 1 ? (
                <span>{detail.cluster.size} closely related questions sit nearby</span>
              ) : null}
            </div>
          </header>

          {comparing.length > 0 ? (
            <section className="rounded-xl border border-line bg-surface p-5 sm:p-6" aria-labelledby="contribute-heading">
              <p className="eyebrow">Open now</p>
              <h2 id="contribute-heading" className="mt-1 text-2xl">Help decide what matters most</h2>
              <p className="mt-2 max-w-2xl leading-relaxed text-muted">
                This question is part of an enquiry that is still taking shape. A few pairwise choices can make the emerging picture clearer.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                {comparing.map((campaign) => (
                  <Link key={campaign.id} href={`/judge/${campaign.id}`} className={buttonClasses('accent')}>
                    Help prioritise →
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-4" aria-labelledby="enquiries-heading">
            <div>
              <p className="eyebrow">Context</p>
              <h2 id="enquiries-heading" className="text-2xl">Where this question is being explored</h2>
            </div>

            {detail.campaigns.length === 0 ? (
              <p className="text-muted">This question is not part of a public enquiry yet.</p>
            ) : (
              <div className="border-b border-line">
                {[...comparing, ...gathering, ...published].map((campaign) => (
                  <div
                    key={campaign.id}
                    className="grid gap-2 border-t border-line py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-5"
                  >
                    <div>
                      <p className="font-display text-xl leading-snug text-ink">{campaign.prompt}</p>
                      <p className="mt-1 text-sm text-muted">
                        {campaign.state === 'comparing'
                          ? 'People are helping decide what matters most.'
                          : campaign.state === 'open'
                            ? 'This enquiry is still gathering questions.'
                            : 'This enquiry has published its emerging agenda.'}
                      </p>
                    </div>
                    <Link
                      href={campaign.state === 'comparing' ? `/judge/${campaign.id}` : `/campaigns/${campaign.id}`}
                      className="text-sm text-moss no-underline hover:underline"
                    >
                      {campaign.state === 'comparing'
                        ? 'Help decide →'
                        : campaign.state === 'open'
                          ? 'See enquiry →'
                          : 'See what rose to the top →'}
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4" id="similar" aria-labelledby="similar-heading">
            <div>
              <p className="eyebrow">Nearby</p>
              <h2 id="similar-heading" className="text-2xl">Related questions</h2>
              <p className="mt-1 text-sm text-muted">Other public questions that are close in meaning, but not necessarily the same.</p>
            </div>

            {similar.length === 0 ? (
              <EmptyState>No related public questions found.</EmptyState>
            ) : (
              <div className="border-b border-line">
                {similar.slice(0, 6).map((question) => (
                  <QuestionListItem
                    key={question.id}
                    id={question.id}
                    question={question.canonicalText}
                    compact
                  />
                ))}
              </div>
            )}
          </section>

          <TrustDrawer>
            <dl className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
              <dt className="font-medium text-ink">Question ID</dt>
              <dd className="break-all font-mono text-xs">{detail.id}</dd>

              <dt className="font-medium text-ink">Technical status</dt>
              <dd>{technicalStateLabel(detail.state)}</dd>

              <dt className="font-medium text-ink">Merged submissions</dt>
              <dd>{detail.variantCount}</dd>

              <dt className="font-medium text-ink">Refinement history</dt>
              <dd>
                {detail.refinement.count === 0
                  ? 'No refinements recorded.'
                  : `${detail.refinement.count} refinement${detail.refinement.count === 1 ? '' : 's'} recorded${
                      detail.refinement.criteria.length > 0
                        ? ` against ${detail.refinement.criteria.join(', ')}`
                        : ''
                    }.`}
              </dd>

              <dt className="font-medium text-ink">Relationship group</dt>
              <dd>
                {detail.cluster
                  ? `${detail.cluster.size} visible question${detail.cluster.size === 1 ? '' : 's'} in cluster ${detail.cluster.id}`
                  : 'Not currently grouped into a question cluster.'}
              </dd>
            </dl>
          </TrustDrawer>
        </>
      ) : null}
    </PageShell>
  )
}
