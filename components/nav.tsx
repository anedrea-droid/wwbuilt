'use client'
import Link from 'next/link'

export default function Nav() {
  return (
    <nav className="bg-orange-500 text-white px-4 py-3 flex items-center gap-4">
      <Link href="/" className="font-bold text-lg mr-4">
        🔧 WW Small Engine
      </Link>
      <Link href="/" className="text-orange-100 hover:bg-orange-600 px-3 py-1 rounded-md text-sm">
        Work Orders
      </Link>
      <Link href="/customers" className="text-orange-100 hover:bg-orange-600 px-3 py-1 rounded-md text-sm">
        Customers
      </Link>
      <Link href="/search" className="text-orange-100 hover:bg-orange-600 px-3 py-1 rounded-md text-sm">
        Search
      </Link>
      <div className="ml-auto">
        <Link href="/settings" className="text-orange-100 hover:bg-orange-600 px-3 py-1 rounded-md text-sm">
          ⚙️ Settings
        </Link>
      </div>
    </nav>
  )
}
