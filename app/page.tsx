"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { Wrench, Calendar, Package, ChevronRight, Clock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { WorkOrderStatus, TechName } from "@/types"

interface WorkOrderCard {
  id: string
  orderNumber: string
  status: WorkOrderStatus
  technician: TechName
  complaint: string
  dateIn: string
  customer?: { id: string; name: string; phone: string; source: string; referralShop: string }
  equipment?: { type: string; make: string; model: string }
  parts?: { id: string; status: string }[]
}

const STATUS_CFG: Record<WorkOrderStatus, { label: string; cls: string; dot: string }> = {
  'pending':       { label: 'Pending',          cls: 'bg-gray-100 text-gray-700',   dot: 'bg-gray-400' },
  'in-progress':   { label: 'In Progress',       cls: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500' },
  'waiting-parts': { label: 'Waiting Parts',     cls: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  'complete':      { label: 'Ready for Pickup',  cls: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  'picked-up':     { label: 'Picked Up',         cls: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
}

const TECH_CFG: Record<string, string> = {
  'Wade':  'bg-orange-100 text-orange-700',
  'Wayne': 'bg-blue-100 text-blue-700',
  'Both':  'bg-purple-100 text-purple-700',
}

type FilterTab = 'active' | 'wade' | 'wayne' | 'parts' | 'ready' | 'done'

export default function WorkOrdersDashboard() {
  const [orders, setOrders] = useState<WorkOrderCard[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<FilterTab>('active')

  useEffect(() => {
    fetch('/api/work-orders')
      .then(r => r.json())
      .then(data => { setOrders(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const isActive = (o: WorkOrderCard) => o.status !== 'picked-up'

  const filtered = orders.filter(o => {
    if (tab === 'active')  return isActive(o)
    if (tab === 'wade')    return o.technician === 'Wade' && isActive(o)
    if (tab === 'wayne')   return o.technician === 'Wayne' && isActive(o)
    if (tab === 'parts')   return o.status === 'waiting-parts'
    if (tab === 'ready')   return o.status === 'complete'
    if (tab === 'done')    return o.status === 'picked-up'
    return true
  })

  const stats = {
    active: orders.filter(isActive).length,
    wade:   orders.filter(o => o.technician === 'Wade' && isActive(o)).length,
    wayne:  orders.filter(o => o.technician === 'Wayne' && isActive(o)).length,
    parts:  orders.filter(o => o.status === 'waiting-parts').length,
    ready:  orders.filter(o => o.status === 'complete').length,
  }

  const TABS: { id: FilterTab; label: string; count?: number }[] = [
    { id: 'active', label: 'All Active', count: stats.active },
    { id: 'wade',   label: 'Wade',       count: stats.wade },
    { id: 'wayne',  label: 'Wayne',      count: stats.wayne },
    { id: 'parts',  label: 'Parts ⚠️',   count: stats.parts },
    { id: 'ready',  label: '✅ Ready',   count: stats.ready },
    { id: 'done',   label: 'Done' },
  ]

  return (
    <div className="max-w-3xl mx-auto px-3 pt-4 pb-2">
      {/* Stats row */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {[
          { label: 'Active', val: stats.active, cls: 'text-slate-800' },
          { label: 'Wade',   val: stats.wade,   cls: 'text-orange-600' },
          { label: 'Wayne',  val: stats.wayne,  cls: 'text-blue-600' },
          { label: 'On Order', val: stats.parts, cls: 'text-amber-600' },
          { label: 'Pickup', val: stats.ready,  cls: 'text-green-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-lg border p-2 text-center">
            <div className={cn("text-xl font-bold", s.cls)}>{loading ? '—' : s.val}</div>
            <div className="text-xs text-slate-500 leading-tight">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 scrollbar-hide">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0",
              tab === t.id
                ? "bg-orange-600 text-white shadow-sm"
                : "bg-white border text-slate-600 hover:bg-slate-50"
            )}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && tab !== t.id && (
              <span className="ml-1 text-xs opacity-70">({t.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Work order list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Wrench className="h-12 w-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No work orders here</p>
          <p className="text-slate-400 text-sm mt-1">Tap + New Job to get started</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(wo => {
            const cfg = STATUS_CFG[wo.status]
            const orderedParts = wo.parts?.filter(p => p.status === 'ordered') || []
            return (
              <Link key={wo.id} href={`/work-orders/${wo.id}`} className="block">
                <Card className="hover:shadow-md active:scale-[0.99] transition-all border-l-4 border-l-orange-400 cursor-pointer">
                  <CardContent className="p-3.5">
                    {/* Row 1: WO# + status */}
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-800 text-sm">{wo.orderNumber}</span>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1", cfg.cls)}>
                          <span className={cn("w-1.5 h-1.5 rounded-full inline-block", cfg.dot)} />
                          {cfg.label}
                        </span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    </div>

                    {/* Row 2: Customer + Equipment */}
                    <div className="mb-1.5">
                      <div className="font-semibold text-slate-800 text-sm leading-tight">
                        {wo.customer?.name || 'Unknown Customer'}
                      </div>
                      {wo.equipment && (
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Wrench className="h-3 w-3" />
                          {wo.equipment.type} — {wo.equipment.make} {wo.equipment.model}
                        </div>
                      )}
                    </div>

                    {/* Row 3: Badges + Date */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={cn("text-xs px-2 py-0.5 rounded font-medium", TECH_CFG[wo.technician] || 'bg-slate-100 text-slate-600')}>
                        {wo.technician}
                      </span>
                      {wo.customer?.source === 'referral' && (
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-500">
                          via {wo.customer.referralShop || 'Other Shop'}
                        </span>
                      )}
                      <span className="text-xs text-slate-400 flex items-center gap-0.5 ml-auto">
                        <Clock className="h-3 w-3" />
                        {wo.dateIn ? format(parseISO(wo.dateIn + 'T12:00:00'), 'MMM d') : '—'}
                      </span>
                    </div>

                    {/* Complaint preview */}
                    {wo.complaint && (
                      <p className="text-xs text-slate-400 mt-1.5 truncate italic">"{wo.complaint}"</p>
                    )}

                    {/* Parts warning */}
                    {orderedParts.length > 0 && (
                      <div className="flex items-center gap-1 mt-1.5 text-xs text-amber-600 font-medium">
                        <Package className="h-3 w-3" />
                        {orderedParts.length} part{orderedParts.length > 1 ? 's' : ''} on order
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
