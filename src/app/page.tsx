import { AppShell } from '@/components/ui/AppShell'
import { PublicNav } from '@/components/ui/PublicNav'
import { QuestionComposer } from '@/components/questions/QuestionComposer'
import { HomeSignals } from '@/components/questions/HomeSignals'

export default function Home() {
  return (
    <AppShell nav={<PublicNav />}>
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)] lg:items-end lg:gap-12">
        <div className="space-y-5">
          <div className="space-y-3 max-w-3xl">
            <p className="eyebrow">A shared question bank</p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl leading-[1.02]">
              Start with what we need to figure out.
            </h1>
          </div>
          <p className="max-w-2xl text-lg sm:text-xl leading-relaxed text-muted">
            Add a question, discover when other people are wondering the same thing, and help work out what matters most to explore together.
          </p>
        </div>

        <div className="border-l-2 border-moss pl-5 py-1 text-sm leading-relaxed text-muted">
          <p>
            Questions can be gathered by an organisation or community, connected to related questions, and prioritised together. The full history stays open to inspect.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-8 lg:p-10 shadow-[0_18px_50px_rgba(33,28,22,0.04)]">
        <QuestionComposer />
      </section>

      <HomeSignals />
    </AppShell>
  )
}
