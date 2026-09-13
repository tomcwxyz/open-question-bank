'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AdminShell } from '@/components/ui/AdminShell'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Label, Input, Select } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { EmptyState } from '@/components/ui/EmptyState'

interface CampaignRow {
  id: string
  prompt: string
  comparisonAxis: string
  state: string
}

const AXIS_PRESETS = [
  { value: 'important', label: 'Importance', description: 'Which question matters most to address?' },
  {
    value: 'impactful',
    label: 'Impact',
    description: 'Which question, if answered, would change the most for people?',
  },
  { value: 'urgent', label: 'Urgency', description: 'Which question needs answering soonest?' },
] as const
const CUSTOM_AXIS = '__custom__'

function lifecycle(state: string) {
  if (state === 'draft') {
    return { label: 'Preparing', explanation: 'Choose the questions and decide how participation should open.', action: 'Set up enquiry →' }
  }
  if (state === 'open') {
    return { label: 'Gathering questions', explanation: 'People can contribute questions to this enquiry now.', action: 'Manage gathering →' }
  }
  if (state === 'comparing') {
    return { label: 'Prioritising', explanation: 'People are comparing questions to clarify what matters most.', action: 'Manage prioritisation →' }
  }
  if (state === 'closed') {
    return { label: 'Complete', explanation: 'The prioritised result is published and can be synthesised.', action: 'Review result →' }
  }
  return { label: state, explanation: 'This enquiry is in an operational state.', action: 'Open enquiry →' }
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([])
  const [prompt, setPrompt] = useState('')
  const [axisChoice, setAxisChoice] = useState<string>(AXIS_PRESETS[0].value)
  const [customAxis, setCustomAxis] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const axis = axisChoice === CUSTOM_AXIS ? customAxis.trim() : axisChoice
  const selectedPreset = AXIS_PRESETS.find((p) => p.value === axisChoice)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/campaigns')
    if (res.ok) setCampaigns((await res.json()).campaigns)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, comparisonAxis: axis }),
      })
      const data = await res.json()
      if (res.ok) {
        setPrompt('')
        setAxisChoice(AXIS_PRESETS[0].value)
        setCustomAxis('')
        setMessage('Enquiry created. It is private until you choose how to open participation.')
        await load()
      } else {
        setMessage(data.error ?? 'Could not create the enquiry.')
      }
    } catch {
      setMessage('Network error — please try again.')
    } finally {
      setBusy(false)
    }
  }

  const active = useMemo(() => campaigns.filter((c) => c.state !== 'closed'), [campaigns])
  const completed = useMemo(() => campaigns.filter((c) => c.state === 'closed'), [campaigns])

  function enquiryRow(c: CampaignRow) {
    const stage = lifecycle(c.state)
    return (
      <li key={c.id} className="grid gap-3 py-5 md:grid-cols-[minmax(0,1fr)_13rem_auto] md:items-center md:gap-6">
        <div className="min-w-0">
          <Link
            href={`/admin/campaigns/${c.id}`}
            className="font-display text-xl leading-snug text-ink no-underline hover:text-moss hover:no-underline"
          >
            {c.prompt}
          </Link>
          <p className="mt-1 text-sm text-muted">People compare by {c.comparisonAxis}.</p>
        </div>
        <div>
          <p className="text-sm font-medium text-ink">{stage.label}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">{stage.explanation}</p>
        </div>
        <Link
          href={`/admin/campaigns/${c.id}`}
          className={buttonClasses(c.state === 'closed' ? 'quiet' : 'ghost', 'shrink-0 justify-self-start md:justify-self-end')}
        >
          {stage.action}
        </Link>
      </li>
    )
  }

  return (
    <AdminShell>
      <div className="space-y-2">
        <p className="eyebrow">Enquiries</p>
        <h1 className="text-3xl sm:text-4xl">Run collective enquiry</h1>
        <p className="max-w-2xl text-muted leading-relaxed">
          Start with something you want to understand, gather the questions people think matter,
          then invite them to help prioritise what should be answered first.
        </p>
      </div>

      {message && (
        <Notice role="status" tone="info">
          {message}
        </Notice>
      )}

      <Card className="space-y-5">
        <div>
          <p className="eyebrow">New enquiry</p>
          <h2 className="mt-1 text-2xl">What are we trying to understand?</h2>
        </div>
        <form onSubmit={create} className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
          <div className="space-y-1.5">
            <Label htmlFor="prompt">Enquiry question or prompt</Label>
            <Input
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="What do we most need to understand about…?"
              required
            />
            <p className="text-sm text-muted">This is the public frame people will contribute questions into.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="axis">How should people compare questions?</Label>
            <Select id="axis" value={axisChoice} onChange={(e) => setAxisChoice(e.target.value)}>
              {AXIS_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
              <option value={CUSTOM_AXIS}>Other…</option>
            </Select>
            {axisChoice === CUSTOM_AXIS ? (
              <Input
                aria-label="Custom comparison axis"
                placeholder="e.g. feasible"
                value={customAxis}
                onChange={(e) => setCustomAxis(e.target.value)}
                required
              />
            ) : (
              selectedPreset && <p className="text-sm text-muted">{selectedPreset.description}</p>
            )}
          </div>

          <div className="lg:col-span-2">
            <Button type="submit" variant="accent" disabled={busy || !axis || !prompt.trim()}>
              Create enquiry
            </Button>
          </div>
        </form>
      </Card>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">In progress</p>
            <h2 className="mt-1 text-2xl">Active enquiries</h2>
          </div>
          <p className="text-sm text-muted">{active.length} active</p>
        </div>

        {active.length === 0 ? (
          <EmptyState>No active enquiries. Create one above when there is something worth exploring together.</EmptyState>
        ) : (
          <ul className="divide-y divide-line border-y border-line list-none p-0">{active.map(enquiryRow)}</ul>
        )}
      </section>

      {completed.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Learn from what happened</p>
              <h2 className="mt-1 text-2xl">Completed enquiries</h2>
            </div>
            <p className="text-sm text-muted">{completed.length} complete</p>
          </div>
          <ul className="divide-y divide-line border-y border-line list-none p-0">{completed.map(enquiryRow)}</ul>
        </section>
      )}
    </AdminShell>
  )
}
