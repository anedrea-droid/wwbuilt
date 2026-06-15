"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Wrench, Users, Plus, Search } from "lucide-react"
import { cn } from "@/lib/utils"

export function Nav() {
  const pathname = usePathname()

  const isActive = (href: string) => pathname === href

  return (
    <>
      {/* Desktop/Tablet header */}
      <header className="sticky top-0 z-50 border-b bg-orange-600 text-white shadow-sm">
        <div className="flex h-14 items-center px-4 max-w-4xl mx-auto">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg mr-6">
            <Wrench className="h-5 w-5" />
            <span className="hidden sm:inline">WW Small Engine</span>
            <span className="sm:hidden">WW Shop</span>
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-1">
            <Link href="/" className={cn(
              "px-3 py-1.5 rounded text-sm font-medium transition-colors",
              isActive("/") ? "bg-orange-800" : "hover:bg-orange-700"
            )}>Work Orders</Link>
            <Link href="/customers" className={cn(
              "px-3 py-1.5 rounded text-sm font-medium transition-colors",
              isActive("/customers") ? "bg-orange-800" : "hover:bg-orange-700"
            )}>Customers</Link>
            <Link href="/search" className={cn(
              "px-3 py-1.5 rounded text-sm font-medium transition-colors",
              isActive("/search") ? "bg-orange-800" : "hover:bg-orange-700"
            )}>Search</Link>
          </nav>

          <div className="ml-auto hidden md:block">
            <Link
              href="/work-orders/new"
              className="inline-flex items-center gap-1.5 bg-white text-orange-700 hover:bg-orange-50 font-semibold text-sm px-3 py-1.5 rounded-md transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Job
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white shadow-lg md:hidden">
        <div className="grid grid-cols-4">
          <Link href="/" className={cn(
            "flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium",
            isActive("/") ? "text-orange-600" : "text-slate-500"
          )}>
            <Wrench className="h-5 w-5" />
            Jobs
          </Link>
          <Link href="/customers" className={cn(
            "flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium",
            isActive("/customers") ? "text-orange-600" : "text-slate-500"
          )}>
            <Users className="h-5 w-5" />
            Customers
          </Link>
          <Link href="/work-orders/new" className="flex flex-col items-center justify-center py-1">
            <div className="bg-orange-600 rounded-full p-3 shadow-md -mt-5 border-2 border-white">
              <Plus className="h-5 w-5 text-white" />
            </div>
            <span className="text-xs text-slate-500 mt-0.5">New Job</span>
          </Link>
          <Link href="/search" className={cn(
            "flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium",
            isActive("/search") ? "text-orange-600" : "text-slate-500"
          )}>
            <Search className="h-5 w-5" />
            Search
          </Link>
        </div>
      </nav>
    </>
  )
}
