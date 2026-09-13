import type { ReactNode } from 'react'
import Link from 'next/link'
import { ThemeSwitcher } from './ThemeSwitcher'

interface AppShellProps {
  children: ReactNode
  nav?: ReactNode
  actions?: ReactNode
}

/**
 * Wide application chrome for discovery, participation and enquiry surfaces.
 *
 * `PageShell` remains the focused reading/form shell. Keeping the two explicit
 * stops the public product from collapsing back into a narrow document layout
 * as richer question and enquiry experiences are added.
 */
export function AppShell({ children, nav, actions }: AppShellProps) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8 min-h-16 py-3 flex items-center gap-5">
          <Link
            href="/"
            className="font-display text-lg text-moss no-underline hover:no-underline shrink-0"
          >
            Question Bank
          </Link>

          <nav className="ml-auto flex items-center gap-3 sm:gap-5 text-sm" aria-label="Primary">
            {nav}
          </nav>

          {(actions || nav) && <span className="hidden sm:block h-5 w-px bg-line" aria-hidden="true" />}

          <div className="flex items-center gap-2">
            {actions}
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      <main className="reveal mx-auto max-w-6xl px-5 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10">
        {children}
      </main>
    </div>
  )
}
