'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Notice } from '@/components/ui/Notice'
import { Textarea } from '@/components/ui/Field'

interface Candidate {
  id: string
  canonicalText: string
  distance: number
}

interface Precomputed {
  embedding: number[]
  embeddingModelVersion: string
  workspaceId: string
  datasetVersionId: number
}

type Phase = 'writing' | 'related' | 'done'

interface QuestionComposerProps {
  campaignId?: string
  prompt?: string
  placeholder?: string
  compact?: boolean
}

/**
 * Public contribution flow that treats deduplication as discovery rather than an
 * error/checkpoint. It intentionally uses the existing submission API and its
 * precomputed embedding hand-off, so the UX can evolve without changing the
 * provenance or deduplication model underneath it.
 */
export function QuestionComposer({
  campaignId,
  prompt = 'What should we figure out?',
  placeholder = 'Write the question you think is worth exploring…',
  compact = false,
}: QuestionComposerProps) {
  const [text, setText] = useState('')
  const [visibility, setVisibility] = useState<'anonymous' | 'public'>('public')
  const [phase, setPhase] = useState<Phase>('writing')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [precomputed, setPrecomputed] = useState<Precomputed | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [matchedQuestionId, setMatchedQuestionId] = useState<string | null>(null)

  async function post(body: Record<string, unknown>) {
    setBusy(true)
    setMessage('')

    try {
      const payload = campaignId ? { ...body, campaignId } : { ...body }
      // The cached embedding belongs to the exact wording that produced the candidate set.
      // Reuse it only for the subsequent candidate decision, never for a fresh submission.
      if (precomputed && body.decision) {
        Object.assign(payload, { precomputed })
      }

      const response = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) {
        return { error: data.error ?? 'Something went wrong.' }
      }
      return data
    } catch {
      return { error: 'Network error — please try again.' }
    } finally {
      setBusy(false)
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const rawText = text.trim()
    if (!rawText) return

    const result = await post({ rawText, visibility })

    if (result.status === 'candidates') {
      setCandidates(result.candidates)
      setPrecomputed({
        embedding: result.embedding,
        embeddingModelVersion: result.embeddingModelVersion,
        workspaceId: result.workspaceId,
        datasetVersionId: result.datasetVersionId,
      })
      setPhase('related')
      return
    }

    if (result.status === 'created') {
      setMessage('Added. We’ll check it before it joins the public question bank.')
      setPhase('done')
      return
    }

    setMessage(result.error ?? 'Something went wrong.')
  }

  async function addAsNew() {
    const result = await post({
      rawText: text.trim(),
      visibility,
      decision: { type: 'new' },
    })

    if (result.status === 'created') {
      setMessage('Added as a new question. We’ll check it before it joins the public question bank.')
      setPhase('done')
      return
    }

    setMessage(result.error ?? 'Something went wrong.')
  }

  async function chooseExisting(candidate: Candidate) {
    const result = await post({
      rawText: text.trim(),
      visibility,
      decision: { type: 'merge', canonicalId: candidate.id },
    })

    if (result.status === 'merged') {
      setMatchedQuestionId(candidate.id)
      setMessage('Added. Your question now strengthens an existing question people are already asking.')
      setPhase('done')
      return
    }

    setMessage(result.error ?? 'Something went wrong.')
  }

  function editQuestion() {
    setCandidates([])
    setPrecomputed(null)
    setMessage('')
    setPhase('writing')
  }

  function reset() {
    setText('')
    setCandidates([])
    setPrecomputed(null)
    setMatchedQuestionId(null)
    setMessage('')
    setPhase('writing')
  }

  return (
    <section className={compact ? 'space-y-5' : 'space-y-6'} aria-live="polite">
      {phase === 'writing' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <label htmlFor="question-composer" className="block font-display text-3xl sm:text-4xl leading-tight text-ink">
            {prompt}
          </label>

          <Textarea
            id="question-composer"
            aria-label="Your question"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={compact ? 3 : 4}
            placeholder={placeholder}
            className={`resize-y bg-paper ${compact ? 'text-base' : 'text-lg sm:text-xl px-4 py-4 sm:px-5 sm:py-5'}`}
            required
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <details className="text-sm text-muted">
              <summary className="cursor-pointer select-none hover:text-ink">Posting options</summary>
              <fieldset className="mt-3 space-y-2">
                <legend className="sr-only">Visibility</legend>
                <label className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="composer-visibility"
                    className="mt-1 accent-[var(--moss)]"
                    checked={visibility === 'public'}
                    onChange={() => setVisibility('public')}
                  />
                  <span><strong className="font-medium text-ink">Public</strong> — include this submission in the open record.</span>
                </label>
                <label className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="composer-visibility"
                    className="mt-1 accent-[var(--moss)]"
                    checked={visibility === 'anonymous'}
                    onChange={() => setVisibility('anonymous')}
                  />
                  <span><strong className="font-medium text-ink">Anonymous</strong> — do not attach submitter identity to the public record.</span>
                </label>
              </fieldset>
            </details>

            <Button
              type="submit"
              variant="accent"
              className={compact ? '' : 'sm:min-h-12 sm:px-6'}
              disabled={busy || text.trim().length === 0}
            >
              {busy ? 'Looking…' : 'Add this question →'}
            </Button>
          </div>
        </form>
      )}

      {phase === 'related' && (
        <div className="space-y-5">
          <div className="space-y-2 max-w-2xl">
            <p className="eyebrow">Already being explored</p>
            <h2 className="text-2xl sm:text-3xl">Someone may already be asking something close to this.</h2>
            <p className="text-muted leading-relaxed">
              If one of these captures what you mean, choosing it helps show that more than one person is asking the same underlying question.
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {candidates.map((candidate) => (
              <Card key={candidate.id} className="flex h-full flex-col gap-4 justify-between bg-paper">
                <p className="text-lg leading-relaxed text-ink break-words">{candidate.canonicalText}</p>
                <Button
                  type="button"
                  variant="ghost"
                  className="self-start"
                  onClick={() => chooseExisting(candidate)}
                  disabled={busy}
                >
                  Yes — this captures what I mean
                </Button>
              </Card>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="accent" onClick={addAsNew} disabled={busy}>
              Mine is different — add it
            </Button>
            <Button type="button" variant="quiet" onClick={editQuestion} disabled={busy}>
              ← Edit my question
            </Button>
          </div>
        </div>
      )}

      {message && phase !== 'done' && (
        <Notice role="alert" tone="error">{message}</Notice>
      )}

      {phase === 'done' && (
        <div className="space-y-4">
          <Notice role="status" tone="info">{message}</Notice>
          <div className="flex flex-wrap gap-3">
            {matchedQuestionId && (
              <Link href={`/questions/${matchedQuestionId}`} className={buttonClasses('primary')}>
                See the question →
              </Link>
            )}
            <Link href="/browse" className={buttonClasses(matchedQuestionId ? 'ghost' : 'primary')}>
              Explore what people are asking
            </Link>
            <Button type="button" variant="quiet" onClick={reset}>
              Ask another
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
