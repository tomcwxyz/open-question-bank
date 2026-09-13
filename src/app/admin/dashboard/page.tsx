import Link from 'next/link'
import { AdminShell } from '@/components/ui/AdminShell'
import { Card } from '@/components/ui/Card'
import { buttonClasses } from '@/components/ui/Button'
import { ChartCard } from '@/components/charts/ChartCard'
import { QuestionGraph } from '@/components/charts/QuestionGraph'
import {
  clusterSizes,
  comparisonsByDay,
  definednessBands,
  pipelineTotals,
  questionStateCounts,
  refinementsByDay,
  submissionsByDay,
} from '@/lib/analytics'
import { questionGraph } from '@/lib/browse'
import { listCampaigns } from '@/lib/campaign'

export const dynamic = 'force-dynamic'

const STATE_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  flagged: 'Flagged',
  rejected: 'Rejected',
  merged_as_variant: 'Merged as duplicate',
  clustered: 'Grouped',
  canonical: 'Ready',
  under_comparison: 'Being compared',
  ranked: 'Ranked',
  synthesised: 'Summarised',
  archived: 'Archived',
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="space-y-1">
      <div className="font-display text-3xl text-moss tabular-nums">{value}</div>
      <div className="text-sm text-muted">{label}</div>
    </Card>
  )
}

export default async function AdminDashboardPage() {
  const [totals, submissions, states, comparisons, refinements, bands, clusters, graph, campaigns] = await Promise.all([
    pipelineTotals(),
    submissionsByDay(30),
    questionStateCounts(),
    comparisonsByDay(30),
    refinementsByDay(30),
    definednessBands(),
    clusterSizes(10),
    questionGraph(200),
    listCampaigns(),
  ])

  const activeEnquiries = campaigns.filter((item) => item.state === 'open' || item.state === 'comparing').length
  const draftEnquiries = campaigns.filter((item) => item.state === 'draft').length
  const hasAttention = totals.pending > 0 || draftEnquiries > 0 || activeEnquiries > 0

  return (
    <AdminShell>
      <header className="space-y-1">
        <p className="eyebrow">Overview</p>
        <h1 className="text-3xl sm:text-4xl">What needs attention?</h1>
        <p className="text-muted">Start with the work that needs a decision, then use the diagnostics to understand the wider system.</p>
      </header>

      <section aria-labelledby="next-up-heading" className="space-y-3">
        <h2 id="next-up-heading" className="text-xl">Next up</h2>
        {hasAttention ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {totals.pending > 0 ? (
              <Card className="flex flex-col gap-4">
                <div>
                  <p className="font-display text-3xl text-clay tabular-nums">{totals.pending}</p>
                  <p className="mt-1 font-medium text-ink">submission{totals.pending === 1 ? '' : 's'} waiting for review</p>
                  <p className="mt-1 text-sm text-muted">Decide what enters the question bank before doing lower-priority tidy-up work.</p>
                </div>
                <Link href="/admin/moderation" className={buttonClasses('accent', 'mt-auto self-start')}>
                  Review submissions →
                </Link>
              </Card>
            ) : null}

            {activeEnquiries > 0 ? (
              <Card className="flex flex-col gap-4">
                <div>
                  <p className="font-display text-3xl text-moss tabular-nums">{activeEnquiries}</p>
                  <p className="mt-1 font-medium text-ink">active enquir{activeEnquiries === 1 ? 'y' : 'ies'}</p>
                  <p className="mt-1 text-sm text-muted">Check participation and move each enquiry forward when it has enough signal.</p>
                </div>
                <Link href="/admin/campaigns" className={buttonClasses('ghost', 'mt-auto self-start')}>
                  Open enquiries →
                </Link>
              </Card>
            ) : null}

            {draftEnquiries > 0 ? (
              <Card className="flex flex-col gap-4">
                <div>
                  <p className="font-display text-3xl text-ink tabular-nums">{draftEnquiries}</p>
                  <p className="mt-1 font-medium text-ink">draft enquir{draftEnquiries === 1 ? 'y' : 'ies'}</p>
                  <p className="mt-1 text-sm text-muted">Finish setup, add the initial question pool if needed, or open the enquiry to participants.</p>
                </div>
                <Link href="/admin/campaigns" className={buttonClasses('ghost', 'mt-auto self-start')}>
                  Continue setup →
                </Link>
              </Card>
            ) : null}
          </div>
        ) : (
          <Card>
            <p className="font-medium text-ink">Nothing is asking for immediate attention.</p>
            <p className="mt-1 text-sm text-muted">Use the diagnostics below to explore the health of the question bank.</p>
          </Card>
        )}
      </section>

      <section className="space-y-4 border-t border-line pt-7" aria-labelledby="pipeline-health-heading">
        <div>
          <p className="eyebrow">Diagnostics</p>
          <h2 id="pipeline-health-heading" className="text-2xl">Pipeline health</h2>
          <p className="mt-1 text-sm text-muted">Useful operational detail, without making the pipeline the navigation model.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <Stat label="Questions" value={totals.questions} />
          <Stat label="Awaiting moderation" value={totals.pending} />
          <Stat label="Ready" value={totals.canonical} />
          <Stat label="Ranked" value={totals.ranked} />
          <Stat label="Enquiries" value={totals.campaigns} />
          <Stat label="Comparisons" value={totals.comparisons} />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Submissions (last 30 days)" data={submissions} kind="line" color="var(--moss)" valueLabel="Submissions" empty="No submissions in the last 30 days." />
        <ChartCard
          title="Questions by state"
          data={states.map((state) => ({ ...state, label: STATE_LABELS[state.label] ?? state.label }))}
          kind="bar"
          color="var(--moss)"
          valueLabel="Questions"
        />
        <ChartCard title="Comparisons (last 30 days)" data={comparisons} kind="line" color="var(--clay)" valueLabel="Comparisons" empty="No comparisons in the last 30 days." />
        <ChartCard title="Refinements (last 30 days)" data={refinements} kind="line" color="var(--clay)" valueLabel="Refinements" empty="No refinements in the last 30 days." />
        <ChartCard title="Quality scores" data={bands} kind="bar" color="var(--sage)" valueLabel="Questions" empty="No scored questions yet." />
        <ChartCard title="Biggest question groups" data={clusters} kind="bar" color="var(--sage)" valueLabel="Questions" empty="No groups yet." />
      </div>

      <section className="space-y-3 border-t border-line pt-7">
        <div>
          <p className="eyebrow">Relationships</p>
          <h2 className="text-2xl">Question map</h2>
        </div>
        <QuestionGraph nodes={graph.nodes} edges={graph.edges} />
      </section>
    </AdminShell>
  )
}
