"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { Search, Users, Wrench, ChevronRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { WorkOrderStatus } from "@/types"

interface SearchResult {
  customers: { id: string; name: string; phone: string; source: string; referralShop: string }[]
  workOrders: {
    id: string; orderNumber: string; status: WorkOrderStatus; technician: string; complaint: string; dateIn: string
    customer?: { name: string }
    equipment?: { type: string; make: string; model: string }
  }[]
  equipment: {
    id: string; type: string; make: string; model: string; serialNumber: string
    customer?: { id: string; name: string }
    workOrders: number
  }[]
}

const STATUS_CFG: Record<WorkOrderStatus, { label: string; cls: string }> = {
  'pending':       { label: 'Pending',           cls: 'bg-gray-100 text-gray-600' },
  'in-progress':   { label: 'In Progress',        cls: 'bg-blue-100 text-blue-700' },
  'waiting-parts': { label: 'Waiting Parts',      cls: 'bg-amber-100 text-amber-700' },
  'complete':      { label: 'Ready for Pickup',   cls: 'bg-green-100 text-green-700' },
  'at-shop':       { label: 'At Referral Shop',   cls: 'bg-purple-100 text-purple-700' },
  'picked-up':     { label: 'Picked Up',          cls: 'bg-slate-100 text-slate-500' },
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults(null); return }
    setLoading(true)
    try {
      const res = await fetch('/api/search?q=' + encodeURIComponent(q))
      setResults(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    doSearch(val)
  }

  const hasResults = results && (results.customers.length + results.workOrders.length + results.equipment.length > 0)

  return (
    <div className="max-w-2xl mx-auto px-3 pt-4">
      <h1 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
        <Search className="h-5 w-5 text-orange-500" />
        Search
      </h1>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <Input
          autoFocus
          value={query}
          onChange={handleChange}
          placeholder="Search customers, equipment, work orders..."
          className="pl-10 h-12 text-base"
        />
      </div>

      {query.length > 0 && query.length < 2 && (
        <p className="text-sm text-slate-400 text-center py-4">Type at least 2 characters to search</p>
      )}

      {loading && (
        <p className="text-sm text-slate-400 text-center py-4">Searching...</p>
      )}

      {!loading && results && !hasResults && query.length >= 2 && (
        <div className="text-center py-12">
          <Search className="h-12 w-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500">No results for &quot;{query}&quot;</p>
          <p className="text-slate-400 text-sm mt-1">Try searching by name, phone, make, model, or WO number</p>
        </div>
      )}

      {!loading && results && hasResults && (
        <div className="space-y-5">
          {results.customers.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> Customers ({results.customers.length})
              </p>
              <div className="space-y-1.5">
                {results.customers.map(c => (
                  <Link key={c.id} href={'/customers/' + c.id}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {c.name.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-slate-800">{c.name}</div>
                          <div className="text-sm text-slate-500">
                            {c.phone}
                            {c.source === 'referral' && <span className="ml-2 text-xs text-slate-400">via {c.referralShop}</span>}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {results.equipment.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Wrench className="h-3.5 w-3.5" /> Equipment ({results.equipment.length})
              </p>
              <div className="space-y-1.5">
                {results.equipment.map(e => (
                  <Link key={e.id} href={e.customer ? '/customers/' + e.customer.id : '#'}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                          <Wrench className="h-4 w-4 text-slate-500" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-slate-800">{e.type} - {e.make} {e.model}</div>
                          <div className="text-sm text-slate-500">
                            {e.customer?.name}
                            {e.serialNumber && <span className="ml-2 text-xs text-slate-400">S/N: {e.serialNumber}</span>}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {results.workOrders.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Work Orders ({results.workOrders.length})
              </p>
              <div className="space-y-1.5">
                {results.workOrders.map(wo => {
                  const scfg = STATUS_CFG[wo.status] ?? { label: wo.status, cls: 'bg-gray-100 text-gray-600' }
                  return (
                    <Link key={wo.id} href={'/work-orders/' + wo.id}>
                      <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="p-3 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-mono font-bold text-sm text-slate-700">{wo.orderNumber}</span>
                              <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", scfg.cls)}>{scfg.label}</span>
                            </div>
                            <div className="text-sm text-slate-600">{wo.customer?.name}</div>
                            {wo.equipment && (
                              <div className="text-xs text-slate-400">{wo.equipment.type} - {wo.equipment.make} {wo.equipment.model}</div>
                            )}
                            {wo.complaint && <p className="text-xs text-slate-400 truncate italic">&quot;{wo.complaint}&quot;</p>}
                          </div>
                          <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
                        </CardContent>
                      </Card>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
