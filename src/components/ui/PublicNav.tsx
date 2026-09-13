'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/browse', label: 'Questions', matches: ['/browse', '/questions'] },
  { href: '/campaigns', label: 'Enquiries', matches: ['/campaigns', '/judge'] },
]

export function PublicNav() {
  const pathname = usePathname()

  return (
    <>
      {links.map((link) => {
        const active = link.matches.some(
          (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
        )

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={`no-underline hover:no-underline whitespace-nowrap ${
              active ? 'text-moss font-medium' : 'text-muted hover:text-ink'
            }`}
          >
            {link.label}
          </Link>
        )
      })}

      <Link
        href="/admin/login"
        className="hidden sm:inline text-muted hover:text-ink no-underline hover:no-underline whitespace-nowrap"
      >
        Admin
      </Link>
    </>
  )
}
