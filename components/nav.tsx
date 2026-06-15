'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Wrench, Settings } from 'lucide-react'

export default function Nav() {
  const path = usePathname()
  const link = (href: string, label: string) => (
    <Link
      href={href}
      className={`px-3 py-1 rounded-md text-sm font-medium transition ${
        path === href || path.startsWith(href + '/')
          ? 'bg-orange-700 text-white'
          : 'text-orange-100 hover:bg-orange-600'
      }`}
    >
      {label}
    </Link>
  )

  return (
    <nav className="bg-orange-500 text-white px-4 py-3 flex items-center gap-4">
      <Link href="/" className="flex items-center gap-2 font-bold text-lg mr-4">
        <Wrench className="w-5 h-5" />
        WW Small Engine
      </Link>
      {link('/work-orders', 'Work Orders')}
      {link('/customers', 'Customers')}
      {link('/search', 'Search')}
      <div className="ml-auto">
        <Link
          href="/settings"
          className={`flex items-center gap-1 px-3 py-1 rounded-md text-sm font-medium transition ${
            path === '/settings'
              ? 'bg-orange-700 text-white'
              : 'text-orange-100 hover:bg-orange-600'
          }`}
        >
          <Settings className="w-4 h-4" />
          Settings
        </Link>
      </div>
    </nav>
  )
}
