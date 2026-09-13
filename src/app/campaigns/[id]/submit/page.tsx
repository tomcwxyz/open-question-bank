'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { PageShell } from '@/components/ui/PageShell'
import { PublicNav } from '@/components/ui/PublicNav'
import { Notice } from '@/components/ui/Notice'
import { QuestionComposer } from '@/components/questions/QuestionComposer'

interface EnquiryInfo {
  id: string
  prompt: string
  comparisonAxis: string
  state: 'open' | 'comparing' | 'closed'
}

export default function EnquirySubmitPage() {
  const { id } = useParams<{ id: string }>()
  const [enquiry, setEnquiry] = useState<EnquiryInfo | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/campaigns/${id}`)
      if (response.ok) setEnquiry(await response.json())
      else if (response.status === 404) setMessage('That enquiry does not exist.')
      else setMessage('Could not load this enquiry.')
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

  return (
    <PageShell nav={<PublicNav />} size="lg">
      <p className="eyebrow">
        <Link href={`/campaigns/${id}`} className="no-underline hover:underline">
          ← Back to enquiry
        </Link>
      </p>

      {message ? (
        <Notice role="alert" tone="error">{message}</Notice>
      ) : null}

      {!message && !loaded ? <p className="text-muted">Loading enquiry…</p> : null}

      {enquiry ? (
        <>
          <header className="max-w-3xl space-y-3">
            <p className="eyebrow">Add to this enquiry</p>
            <h1 className="break-words text-3xl leading-tight sm:text-4xl">{enquiry.prompt}</h1>
          </header>

          {enquiry.state === 'open' ? (
            <QuestionComposer
              campaignId={enquiry.id}
              prompt="What should this enquiry be asking?"
              placeholder="Write the question you think this enquiry should explore…"
            />
          ) : (
            <Notice role="status" tone="info">
              This enquiry is not gathering new questions right now.{' '}
              {enquiry.state === 'comparing' ? (
                <Link href={`/judge/${enquiry.id}`}>Help decide what matters most instead →</Link>
              ) : (
                <Link href={`/campaigns/${enquiry.id}`}>See what rose to the top →</Link>
              )}
            </Notice>
          )}
        </>
      ) : null}
    </PageShell>
  )
}
