import type { ReactNode } from 'react'
import { ThemeSwitcher } from './ThemeSwitcher'
import { WorkspaceBrand } from '@/components/workspace/WorkspaceBrand'

type Size = 'sm' | 'md' | 'lg'

const widths: Record<Size, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-3xl',
}

interface PageShellProps {
  children: ReactNode
  nav?: ReactNode
  actions?: ReactNode
  size?: Size
}

/** Focused chrome for forms, reading and narrow task surfaces. */
export function PageShell({ children, nav, actions, size = 'md' }: PageShellProps) {
  const width = widths[size]
  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className={`mx-auto ${width} px-6 min-h-16 py-3 flex items-center gap-4`}>
          <WorkspaceBrand />
          <nav className="ml-auto flex items-center gap-3 sm:gap-5 text-sm" aria-label="Primary">
            {nav}
            {actions}
            <ThemeSwitcher />
          </nav>
        </div>
      </header>
      <main className={`reveal mx-auto ${width} px-6 py-12 space-y-6`}>{children}</main>
    </div>
  )
}
