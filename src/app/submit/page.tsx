import { PageShell } from '@/components/ui/PageShell'
import { PublicNav } from '@/components/ui/PublicNav'
import { QuestionComposer } from '@/components/questions/QuestionComposer'

export default function SubmitPage() {
  return (
    <PageShell nav={<PublicNav />} size="lg">
      <header className="max-w-2xl space-y-2">
        <p className="eyebrow">Add to the shared bank</p>
        <h1 className="text-3xl sm:text-4xl">Ask a question</h1>
        <p className="leading-relaxed text-muted">
          Start in your own words. If people are already asking something close, we’ll show you before adding another version.
        </p>
      </header>
      <QuestionComposer />
    </PageShell>
  )
}
