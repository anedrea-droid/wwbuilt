"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Users, Phone, ChevronRight, Plus, Search } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { Customer } from "@/types"

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetch('/api/customers')
      .then(r => r.json())
      .then(data => { setCustomers(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = customers.filter(c => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.referralShop || '').toLowerCase().includes(q)
  })

  const own = filtered.filter(c => c.source === 'own')
  const referral = filtered.filter(c => c.source === 'referral')

  return (
    <div className="max-w-2xl mx-auto px-3 pt-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Users className="h-5 w-5 text-orange-500" />
          Customers
        </h1>
        <span className="text-sm text-slate-400">{customers.length} total</span>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name, phone…"
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500">No customers found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {own.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-1">Our Customers ({own.length})</p>
              <div className="space-y-1.5">
                {own.map(c => <CustomerCard key={c.id} customer={c} />)}
              </div>
            </section>
          )}
          {referral.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-1">Referrals ({referral.length})</p>
              <div className="space-y-1.5">
                {referral.map(c => <CustomerCard key={c.id} customer={c} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function CustomerCard({ customer: c }: { customer: Customer }) {
  return (
    <Link href={`/customers/${c.id}`}>
      <Card className="hover:shadow-md active:scale-[0.99] transition-all cursor-pointer">
        <CardContent className="p-3.5 flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0",
            c.source === 'referral' ? "bg-slate-400" : "bg-orange-500"
          )}>
            {c.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-slate-800">{c.name}</div>
            <div className="text-sm text-slate-500 flex items-center gap-1">
              {c.phone ? (
                <><Phone className="h-3 w-3" /> {c.phone}</>
              ) : (
                <span className="italic text-slate-400">No phone</span>
              )}
            </div>
            {c.source === 'referral' && c.referralShop && (
              <div className="text-xs text-slate-400">via {c.referralShop}</div>
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
        </CardContent>
      </Card>
    </Link>
  )
}
