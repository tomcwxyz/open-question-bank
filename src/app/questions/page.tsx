import { redirect } from 'next/navigation'

/**
 * `/browse` is the v0.3 Questions experience. Keep the old route as a compatibility entry point
 * rather than maintaining a second, state-heavy public index.
 */
export default function QuestionsIndexPage() {
  redirect('/browse')
}
