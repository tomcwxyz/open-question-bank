'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { AppShell } from '@/components/ui/AppShell'
import { PublicNav } from '@/components/ui/PublicNav'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input, Label } from '@/components/ui/Field'
import { QuestionGraph } from '@/components/charts/QuestionGraph'
import { QuestionListItem } from '@/components/questions/QuestionListItem'

interface Result {
  id: string
  canonicalText: string
  state?: 'canonical' | 'ranked'
}

interface Rising extends Result {
  campaignId: string
  campaignPrompt: string
  comparisonAxis: string
  nComparisons: number
  position: number
}

interface NeedsInput extends Result {
  campaignId: string
  campaignPrompt: string
  comparisonAxis: string
  nComparisons: number
}

interface MostAsked extends Result {
  clusterSize: number
}

interface ThemeCount {
  theme: string
  count: number
}

interface Rails {
  recent: Result[]
  mostAsked: MostAsked[]
  themes: ThemeCount[]
  rising: Rising[]
  needsInput: NeedsInput[]
}

interface GraphNode {
  id: string
  canonicalText: string
  state: string
  theme: string | null
  clusterId: string | null
  variantCount: number
}

interface GraphEdge {
  source: string
  target: string
  clusterId: string
}

interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export default function BrowsePage() {
  const [mode, setMode] = useState<'browse' | 'results'>('browse')
  const [rails, setRails] = useState<Rails | null>(null)
  const [railsError, setRailsError] = useState('')

  const [queryInput, setQueryInput] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [resultsTitle, setResultsTitle] = useState('')

  const [showMap, setShowMap] = useState(false)
  const [graph, setGraph] = useState<GraphData | null>(null)
  const [graphLoading, setGraphLoading] = useState(false)

  const loadQuestions = useCallback(async () => {
    try {
      const response = await fetch('/api/browse')
      if (response.ok) setRails(await response.json())
      else setRailsError('Could not load the question bank.')
    } catch {
      setRailsError('Network error — please try again.')
    }
  }, [])

  useEffect(() => {
    void loadQuestions()
  }, [loadQuestions])

  useEffect(() => {
    if (!showMap || graph) return
    let cancelled = false

    async function loadGraph() {
      setGraphLoading(true)
      try {
        const response = await fetch('/api/browse/graph')
        if (!cancelled && response.ok) setGraph(await response.json())
      } finally {
        if (!cancelled) setGraphLoading(false)
      }
    }

    void loadGraph()
    return () => {
      cancelled = true
    }
  }, [showMap, graph])

  const runSearch = useCallback(async (query: string, nextPage: number) => {
    setLoading(true)
    setMessage('')
    setMode('results')
    setResultsTitle(`Questions matching “${query}”`)

    try {
      const params = new URLSearchParams({ q: query, page: String(nextPage) })
      const response = await fetch(`/api/questions/search?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setResults(data.results)
        setHasMore(data.hasMore)
        setPage(data.page)
      } else {
        setMessage('Could not run that search.')
      }
    } catch {
      setMessage('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  const openTheme = useCallback(async (theme: string) => {
    setLoading(true)
    setMessage('')
    setMode('results')
    setResultsTitle(theme)
    setHasMore(false)
    setPage(0)

    try {
      const response = await fetch(`/api/questions?theme=${encodeURIComponent(theme)}`)
      if (response.ok) setResults((await response.json()).questions)
      else setMessage('Could not load that theme.')
    } catch {
      setMessage('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const query = queryInput.trim()
    if (!query) return
    void runSearch(query, 0)
  }

  const backToQuestions = () => {
    setMode('browse')
    setResults([])
    setMessage('')
    setQueryInput('')
  }

  return (
    <AppShell nav={<PublicNav />}>
      <header className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="max-w-3xl space-y-2">
          <p className="eyebrow">Questions</p>
          <h1 className="text-4xl sm:text-5xl">What are people trying to figure out?</h1>
          <p className="max-w-2xl text-lg leading-relaxed text-muted">
            Explore questions people keep asking, see what is emerging in open enquiries, or find somewhere your judgement can help.
          </p>
        </div>
        <Link href="/submit" className={buttonClasses('accent')}>
          Ask a question
        </Link>
      </header>

      <section className="rounded-xl border border-line bg-surface p-5 sm:p-6" aria-label="Find questions">
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div>
            <Label htmlFor="q">Search questions</Label>
            <Input
              id="q"
              name="q"
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="What are you curious about?"
              autoComplete="off"
              className="text-base sm:text-lg"
            />
          </div>
          <Button type="submit" disabled={loading || queryInput.trim().length === 0} className="sm:min-w-28">
            {loading ? 'Searching…' : 'Search'}
          </Button>
        </form>

        {mode === 'browse' && rails && rails.themes.some((theme) => theme.count > 0) ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <span className="mr-1 text-sm text-muted">Explore a theme</span>
            {rails.themes
              .filter((theme) => theme.count > 0)
              .map((theme) => (
                <button
                  key={theme.theme}
                  type="button"
                  onClick={() => void openTheme(theme.theme)}
                  className={buttonClasses('quiet', 'min-h-9 px-3 py-1.5')}
                >
                  {theme.theme}
                </button>
              ))}
          </div>
        ) : null}
      </section>

      {mode === 'results' ? (
        <section className="space-y-5" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
            <div>
              <p className="eyebrow">Explore</p>
              <h2 className="text-2xl sm:text-3xl">{resultsTitle}</h2>
            </div>
            <Button variant="ghost" onClick={backToQuestions}>
              ← Back to questions
            </Button>
          </div>

          {message ? (
            <Notice role="alert" tone="error">{message}</Notice>
          ) : results.length === 0 ? (
            <EmptyState>
              No questions matched. You can try another search or add the question you were looking for.
            </EmptyState>
          ) : (
            <div className="border-b border-line">
              {results.map((result) => (
                <QuestionListItem key={result.id} id={result.id} question={result.canonicalText} />
              ))}
            </div>
          )}

          {results.length === 0 && !message ? (
            <Link href="/submit" className={buttonClasses('accent')}>
              Ask this question
            </Link>
          ) : null}

          {(page > 0 || hasMore) && results.length > 0 ? (
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                disabled={page === 0 || loading}
                onClick={() => void runSearch(queryInput.trim(), page - 1)}
              >
                ← Previous
              </Button>
              <span className="text-sm text-muted">Page {page + 1}</span>
              <Button
                variant="ghost"
                disabled={!hasMore || loading}
                onClick={() => void runSearch(queryInput.trim(), page + 1)}
              >
                Next →
              </Button>
            </div>
          ) : null}
        </section>
      ) : railsError ? (
        <Notice role="alert" tone="error">{railsError}</Notice>
      ) : !rails ? (
        <p className="text-muted">Loading questions…</p>
      ) : (
        <div className="space-y-12">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)] lg:gap-12">
            <section aria-labelledby="rising-heading">
              <div className="mb-3 max-w-2xl">
                <p className="eyebrow">Taking shape</p>
                <h2 id="rising-heading" className="text-3xl">Rising</h2>
                <p className="mt-1 text-muted">
                  Questions currently near the top of open enquiries. Positions belong to each enquiry — there is no global leaderboard.
                </p>
              </div>

              {rails.rising.length === 0 ? (
                <EmptyState>No enquiries are being prioritised right now.</EmptyState>
              ) : (
                <div className="border-b border-line">
                  {rails.rising.map((question) => (
                    <QuestionListItem
                      key={`${question.campaignId}-${question.id}`}
                      id={question.id}
                      question={question.canonicalText}
                      eyebrow={`#${question.position} in an open enquiry`}
                      meta={
                        <>
                          <Link href={`/campaigns/${question.campaignId}`} className="text-moss no-underline hover:underline">
                            {question.campaignPrompt}
                          </Link>
                          {' · '}still taking shape
                        </>
                      }
                    />
                  ))}
                </div>
              )}
            </section>

            <aside aria-labelledby="input-heading" className="lg:border-l lg:border-line lg:pl-8">
              <div className="mb-3">
                <p className="eyebrow">A useful five minutes</p>
                <h2 id="input-heading" className="text-2xl">Needs your input</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  These questions are in enquiries where more comparisons would make the emerging picture clearer.
                </p>
              </div>

              {rails.needsInput.length === 0 ? (
                <p className="border-t border-line py-4 text-sm text-muted">Nothing needs comparing right now.</p>
              ) : (
                <div className="border-b border-line">
                  {rails.needsInput.slice(0, 4).map((question) => (
                    <QuestionListItem
                      key={`${question.campaignId}-${question.id}`}
                      id={question.id}
                      question={question.canonicalText}
                      compact
                      meta={question.campaignPrompt}
                      trailing={
                        <Link
                          href={`/judge/${question.campaignId}`}
                          className={buttonClasses('ghost', 'w-full sm:w-auto whitespace-nowrap')}
                        >
                          Help decide →
                        </Link>
                      }
                    />
                  ))}
                </div>
              )}
            </aside>
          </div>

          <div className="grid gap-10 md:grid-cols-2 md:gap-12">
            <section aria-labelledby="asked-heading">
              <div className="mb-3">
                <p className="eyebrow">Repeated</p>
                <h2 id="asked-heading" className="text-2xl">Most asked</h2>
                <p className="mt-1 text-sm text-muted">Questions that keep reappearing in different words.</p>
              </div>
              {rails.mostAsked.length === 0 ? (
                <EmptyState>No repeated questions yet.</EmptyState>
              ) : (
                <div className="border-b border-line">
                  {rails.mostAsked.slice(0, 5).map((question) => (
                    <QuestionListItem
                      key={question.id}
                      id={question.id}
                      question={question.canonicalText}
                      compact
                      meta={`${question.clusterSize} submissions asked versions of this`}
                    />
                  ))}
                </div>
              )}
            </section>

            <section aria-labelledby="new-heading">
              <div className="mb-3">
                <p className="eyebrow">Recently added</p>
                <h2 id="new-heading" className="text-2xl">New</h2>
                <p className="mt-1 text-sm text-muted">Fresh questions entering the shared bank.</p>
              </div>
              {rails.recent.length === 0 ? (
                <EmptyState>No questions yet.</EmptyState>
              ) : (
                <div className="border-b border-line">
                  {rails.recent.slice(0, 5).map((question) => (
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
          </div>

          <section className="border-t border-line pt-8" aria-labelledby="map-heading">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <p className="eyebrow">Another way in</p>
                <h2 id="map-heading" className="text-2xl">See how questions connect</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  The map shows themes and question relationships. It is an exploration view, not the main way you need to use the bank.
                </p>
              </div>
              <Button variant="ghost" onClick={() => setShowMap((open) => !open)} aria-expanded={showMap}>
                {showMap ? 'Hide question map' : 'Open question map'}
              </Button>
            </div>

            {showMap ? (
              <div className="mt-6">
                {graphLoading ? (
                  <p className="text-muted">Loading the map…</p>
                ) : graph && graph.nodes.length > 0 ? (
                  <QuestionGraph nodes={graph.nodes} edges={graph.edges} />
                ) : (
                  <EmptyState>There are not enough connected questions to map yet.</EmptyState>
                )}
              </div>
            ) : null}
          </section>
        </div>
      )}
    </AppShell>
  )
}
