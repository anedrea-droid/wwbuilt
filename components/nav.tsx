'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'

const LINKS = [
  { href: '/', label: 'Work Orders' },
  { href: '/customers', label: 'Customers' },
  { href: '/search', label: 'Search' },
  { href: '/shop-equipment', label: 'Shop Equipment' },
  { href: '/parts-inventory', label: 'Parts Inventory' },
  { href: '/reports', label: 'Reports' },
  { href: '/settings', label: 'Settings' },
]

export default function Nav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <nav className="bg-orange-500 text-white sticky top-0 z-40 shadow-sm">
      <div className="px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg min-w-0" onClick={() => setOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/logo.png" alt="" className="h-9 w-9 rounded-full flex-shrink-0" />
          <span className="truncate">
            <span className="sm:hidden">Cavin&apos;s</span>
            <span className="hidden sm:inline">Cavin&apos;s Small Engine Repair</span>
          </span>
        </Link>

        {/* Desktop / tablet links */}
        <div className="hidden md:flex items-center gap-2">
          {LINKS.map(l => (
            <Link key={l.href} href={l.href}
              className={
                'px-3 py-1 rounded-md text-sm ' +
                (pathname === l.href ? 'bg-orange-600 text-white font-semibold' : 'text-orange-100 hover:bg-orange-600')
              }>
              {l.label}
            </Link>
          ))}
          <Link href="/work-orders/new"
            className="bg-white text-orange-500 font-semibold px-4 py-1.5 rounded-lg text-sm hover:bg-orange-50 ml-2">
            + New Job
          </Link>
        </div>

        {/* Mobile controls */}
        <div className="flex md:hidden items-center gap-2">
          <Link href="/work-orders/new"
            className="bg-white text-orange-500 font-semibold px-3 py-1.5 rounded-lg text-sm hover:bg-orange-50">
            + New
          </Link>
          <button onClick={() => setOpen(v => !v)} className="p-1.5 rounded-md hover:bg-orange-600" aria-label="Menu">
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {open && (
        <div className="md:hidden bg-orange-600 border-t border-orange-400 px-2 py-2 space-y-1">
          {LINKS.map(l => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
              className={
                'block px-3 py-2 rounded-md text-sm ' +
                (pathname === l.href ? 'bg-orange-700 text-white font-semibold' : 'text-orange-50 hover:bg-orange-700')
              }>
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  )
}
