'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { AppShell } from './AppShell'
import { Button } from './Button'

const links = [
  { href: '/admin/dashboard', label: 'Overview', hint: 'What is happening' },
  { href: '/admin/moderation', label: 'Needs review', hint: 'New submissions' },
  { href: '/admin/refinement', label: 'Improve questions', hint: 'Clarity and wording' },
  { href: '/admin/curation', label: 'Question bank', hint: 'Published questions' },
  { href: '/admin/campaigns', label: 'Enquiries', hint: 'Run participation' },
]

/**
 * Operational admin chrome. Public surfaces are participant-first; this surface is deliberately
 * task-first and wide enough for queues, tables and comparison work.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  return (
    <AppShell
      nav={
        <Link href="/" className="hidden sm:inline text-muted no-underline hover:text-ink hover:no-underline">
          View public site
        </Link>
      }
      actions={
        <Button variant="quiet" onClick={logout}>
          Log out
        </Button>
      }
    >
      <div className="grid gap-7 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
        <aside className="lg:border-r lg:border-line lg:pr-6" aria-label="Admin sections">
          <div className="mb-3 hidden lg:block">
            <p className="eyebrow">Workspace</p>
            <p className="mt-1 font-display text-xl text-ink">Manage Question Bank</p>
          </div>

          <nav className="-mx-1 flex gap-1 overflow-x-auto pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:pb-0">
            {links.map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`min-w-max rounded-md px-3 py-2.5 no-underline transition hover:no-underline lg:min-w-0 ${
                    active ? 'bg-surface text-moss' : 'text-muted hover:bg-surface hover:text-ink'
                  }`}
                >
                  <span className="block text-sm font-medium">{link.label}</span>
                  <span className="mt-0.5 hidden text-xs text-muted lg:block">{link.hint}</span>
                </Link>
              )
            })}
          </nav>
        </aside>

        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </AppShell>
  )
}
