'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'

const PRINT_STYLES = '@media print { nav { display: none !important; } .print\\:hidden { display: none !important; } body { background: white !important; } }'

type ReportTab = 'financial' | 'referral' | 'workorders' | 'parts' | 'admin'

function fmt(n: unknown) {
  return '$' + Number(n || 0).toFixed(2)
}
function fmtDate(d: unknown) {
  if (!d) return '-'
  return String(d).slice(0, 10)
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow p-4 space-y-3">
      <div>
        <h2 className="font-semibold text-gray-800 text-base">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function Empty() {
  return <p className="text-sm text-gray-400 italic py-4 text-center">No records found</p>
}

const STATUS_BADGE: Record<string, string> = {
  'pending':       'bg-yellow-100 text-yellow-800',
  'in-progress':   'bg-blue-100 text-blue-800',
  'waiting-parts': 'bg-orange-100 text-orange-800',
  'at-shop':       'bg-purple-100 text-purple-700',
}
function statusLabel(s: unknown) {
  return String(s || '-').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}
function daysOpen(dateIn: unknown) {
  if (!dateIn) return null
  const start = new Date(String(dateIn).slice(0, 10) + 'T00:00:00')
  const now = new Date()
  const diff = Math.floor((now.getTime() - start.getTime()) / 86400000)
  return diff >= 0 ? diff : null
}

const UNPAID_REASONS: { id: string; label: string; cls: string }[] = [
  { id: 'never-paid', label: 'Picked Up - No Payment', cls: 'bg-red-100 text-red-700' },
  { id: 'abandoned',  label: 'Abandoned',             cls: 'bg-amber-100 text-amber-800' },
  { id: 'donated',    label: 'Donated',               cls: 'bg-purple-100 text-purple-700' },
  { id: 'no-charge',  label: 'No Charge',             cls: 'bg-gray-100 text-gray-600' },
]
function unpaidValue(r: Record<string, unknown>) {
  const charged = Number(r.amount_charged) || 0
  const shopAmt = Number(r.shop_payment_amount) || 0
  if (charged > 0) return { value: charged, est: false }
  if (shopAmt > 0) return { value: shopAmt, est: false }
  const est = (Number(r.labor_hours) || 0) * (Number(r.labor_rate) || 80) + (Number(r.parts_charged) || 0)
  return { value: est, est: true }
}

const ABANDON_AFTER_DAYS = 60

async function markAbandonedFromReport(row: Record<string, unknown>) {
  const patch = await fetch('/api/work-orders/' + row.id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'abandoned' }),
  })
  if (!patch.ok) return false
  const desc = [row.make, row.model, row.equipment_type].filter(Boolean).map(String).join(' ')
  const se = await fetch('/api/shop-equipment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      work_order_id: row.id,
      equipment_description: desc || 'Unknown Equipment',
      acquisition_type: 'abandoned',
      acquired_date: new Date().toISOString().slice(0, 10),
      condition_notes: 'Marked abandoned from the Thursday check report',
      status: 'available',
    }),
  })
  return se.ok
}

async function markNoPaymentRecorded(id: string, note: string) {
  const res = await fetch('/api/work-orders/' + id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ never_paid: true, never_paid_date: new Date().toISOString().slice(0, 10), never_paid_note: note }),
  })
  return res.ok
}

function ReportsPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = today.slice(0, 8) + '01'

  const validTabs: ReportTab[] = ['financial', 'referral', 'workorders', 'parts', 'admin']
  const initialTab = (searchParams.get('tab') as ReportTab) || 'financial'
  const [tab, setTab] = useState<ReportTab>(validTabs.includes(initialTab) ? initialTab : 'financial')

  const [fromDate, setFromDate] = useState(searchParams.get('from') || firstOfMonth)
  const [toDate, setToDate] = useState(searchParams.get('to') || today)

  // Keep the URL in sync with the current tab/date range so browser back/forward
  // (and links here from work orders) return to the exact report you were viewing,
  // instead of resetting to the default tab and date range.
  useEffect(() => {
    const params = new URLSearchParams()
    params.set('tab', tab)
    params.set('from', fromDate)
    params.set('to', toDate)
    router.replace('/reports?' + params.toString(), { scroll: false })
  }, [tab, fromDate, toDate, router])

  const [payouts, setPayouts] = useState<Record<string, unknown>[]>([])
  const [outstanding, setOutstanding] = useState<Record<string, unknown>[]>([])
  const [noCharge, setNoCharge] = useState<Record<string, unknown>[]>([])
  const [unpaidWork, setUnpaidWork] = useState<Record<string, unknown>[]>([])
  const [unpaidFilter, setUnpaidFilter] = useState<string>('all')
  const [needsReminder, setNeedsReminder] = useState<Record<string, unknown>[]>([])
  const [loadError, setLoadError] = useState('')
  const [invoiceFill, setInvoiceFill] = useState<{ rows: Record<string, unknown>[]; backupCount: number }>({ rows: [], backupCount: 0 })
  const [thursdayCheck, setThursdayCheck] = useState<{ rows: Record<string, unknown>[]; cutoff: string }>({ rows: [], cutoff: '' })
  const [deniedService, setDeniedService] = useState<Record<string, unknown>[]>([])
  const [revenue, setRevenue] = useState<Record<string, unknown>[]>([])
  const [atShop, setAtShop] = useState<Record<string, unknown>[]>([])
  const [refHistory, setRefHistory] = useState<Record<string, unknown>[]>([])
  const [tripDate, setTripDate] = useState(new Date().toISOString().slice(0, 10))
  const [tripData, setTripData] = useState<{ thisTrip: Record<string, unknown>[]; outstanding: Record<string, unknown>[]; tripDate: string } | null>(null)
  const [tripLoading, setTripLoading] = useState(false)
  const [settleDate, setSettleDate] = useState(new Date().toISOString().slice(0, 10))
  const [settleData, setSettleData] = useState<Record<string, unknown>[]>([])
  const [settleLoading, setSettleLoading] = useState(false)
  const [hasRunSettlement, setHasRunSettlement] = useState(false)
  const [completed, setCompleted] = useState<Record<string, unknown>[]>([])
  const [openOrders, setOpenOrders] = useState<Record<string, unknown>[]>([])
  const [donatedAbandoned, setDonatedAbandoned] = useState<Record<string, unknown>[]>([])
  const [pendingParts, setPendingParts] = useState<Record<string, unknown>[]>([])
  const [partsReport, setPartsReport] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)

  function groupByShop(rows: Record<string, unknown>[]): Record<string, Record<string, unknown>[]> {
    const groups: Record<string, Record<string, unknown>[]> = {}
    rows.forEach(r => {
      const shop = String(r.referral_shop || 'Other Shop')
      if (!groups[shop]) groups[shop] = []
      groups[shop].push(r)
    })
    return groups
  }

  function printTrip() {
    if (!tripData) return
    const fmtD = (d: unknown) => d ? String(d).slice(0, 10) : '-'
    const fmtM = (n: unknown) => '$' + (Number(n) || 0).toFixed(2)
    const calcInv = (r: Record<string,unknown>) => { const sa = Number(r.shop_payment_amount)||0; return sa > 0 ? sa : (Number(r.amount_charged)||0) }
    const calcOwes = (r: Record<string,unknown>) => { return (Number(r.labor_hours)||0) * (Number(r.labor_rate)||0) * 0.20 }

    const thisTripByShop = groupByShop(tripData.thisTrip)
    const outstandingByShop = groupByShop(tripData.outstanding)
    const allShops = Array.from(new Set([...Object.keys(thisTripByShop), ...Object.keys(outstandingByShop)])).sort()

    const tot1 = tripData.thisTrip.reduce((s, r) => s + calcOwes(r), 0)
    const tot2 = tripData.outstanding.reduce((s, r) => s + calcOwes(r), 0)

    const w = window.open('', '_blank')
    if (!w) return
    w.document.write('<html><head><title>Trip Sheet - ' + tripData.tripDate + '</title><style>body{font-family:Arial,sans-serif;padding:20px;font-size:12px}h1{font-size:18px;margin-bottom:4px}h2{font-size:14px;margin:16px 0 6px;border-bottom:1px solid #ccc;padding-bottom:4px}h3{font-size:13px;margin:12px 0 4px;color:#1d4ed8}table{width:100%;border-collapse:collapse;margin-bottom:6px;table-layout:fixed}th{text-align:left;border-bottom:2px solid #333;padding:4px 6px 4px 0;font-size:11px;text-transform:uppercase;overflow:hidden}td{padding:4px 6px 4px 0;border-bottom:1px solid #eee;vertical-align:top;overflow:hidden;word-break:break-word}tfoot td{border-top:2px solid #333;font-weight:bold;padding-top:6px}.right{text-align:right}.orange{color:#c2410c}.shop-total{font-size:11px;color:#444;margin-bottom:14px;text-align:right}@media print{button{display:none}}</style></head><body>')
    w.document.write('<h1>WW Small Engine - Shop Trip Sheet</h1>')
    w.document.write('<p>Date: ' + tripData.tripDate + '</p>')
    w.document.write('<button onclick="window.print()" style="background:#f97316;color:white;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;margin-bottom:12px">Print</button>')

    w.document.write('<h2>Dropping Off Today (' + tripData.thisTrip.length + ' items)</h2>')
    if (tripData.thisTrip.length === 0) {
      w.document.write('<p style="color:#888;font-style:italic;">No drop-offs recorded for this date.</p>')
    } else {
      allShops.forEach(shop => {
        const rows = thisTripByShop[shop]
        if (!rows || rows.length === 0) return
        const shopInv = rows.reduce((s, r) => s + calcInv(r), 0)
        const shopOwes = rows.reduce((s, r) => s + calcOwes(r), 0)
        const rowsHtml = rows.map(r => {
          const inv = Number(r.amount_charged) || 0
          const owes = calcOwes(r)
          return '<tr><td>' + String(r.order_number) + '</td><td>' + String(r.customer_name || '') + '</td><td>' + String(r.equipment_type || '') + ' ' + String(r.make || '') + ' ' + String(r.model || '') + '</td><td>' + String(r.complaint || r.work_done || '') + '</td><td class="right">' + (inv > 0 ? fmtM(inv) : '-') + '</td><td class="right orange">' + (owes > 0 ? fmtM(owes) : '-') + '</td></tr>'
        }).join('')
        w.document.write('<h3>' + shop + '</h3>')
        w.document.write('<table><thead><tr><th>WO#</th><th>Customer</th><th>Equipment</th><th>Work Done / Notes</th><th class="right">Invoice</th><th class="right orange">WW Owes Shop</th></tr></thead><tbody>' + rowsHtml + '</tbody></table>')
        w.document.write('<div class="shop-total">' + shop + ' subtotal - Invoice: $' + shopInv.toFixed(2) + ' &nbsp;|&nbsp; WW Owes: $' + shopOwes.toFixed(2) + '</div>')
      })
    }

    w.document.write('<h2>Previously Returned - Awaiting Shop Payment (' + tripData.outstanding.length + ' items)</h2>')
    if (tripData.outstanding.length === 0) {
      w.document.write('<p style="color:#888;font-style:italic;">Nothing outstanding.</p>')
    } else {
      allShops.forEach(shop => {
        const rows = outstandingByShop[shop]
        if (!rows || rows.length === 0) return
        const shopInv = rows.reduce((s, r) => s + calcInv(r), 0)
        const shopOwes = rows.reduce((s, r) => s + calcOwes(r), 0)
        const rowsHtml = rows.map(r => {
          const inv = Number(r.amount_charged) || 0
          const owes = calcOwes(r)
          return '<tr><td>' + String(r.order_number) + '</td><td>' + String(r.customer_name || '') + '</td><td>' + String(r.equipment_type || '') + ' ' + String(r.make || '') + ' ' + String(r.model || '') + '</td><td>' + fmtD(r.referral_dropoff_date) + '</td><td>' + String(r.complaint || r.work_done || '') + '</td><td class="right">' + (inv > 0 ? fmtM(inv) : '-') + '</td><td class="right orange">' + (owes > 0 ? fmtM(owes) : '-') + '</td></tr>'
        }).join('')
        w.document.write('<h3>' + shop + '</h3>')
        w.document.write('<table><thead><tr><th>WO#</th><th>Customer</th><th>Equipment</th><th>Returned</th><th>Notes</th><th class="right">Invoice</th><th class="right orange">WW Owes Shop</th></tr></thead><tbody>' + rowsHtml + '</tbody></table>')
        w.document.write('<div class="shop-total">' + shop + ' subtotal - Invoice: $' + shopInv.toFixed(2) + ' &nbsp;|&nbsp; WW Owes: $' + shopOwes.toFixed(2) + '</div>')
      })
    }

    w.document.write('<p style="margin-top:20px;font-size:13px;font-weight:bold;color:#333">Combined WW Owes (All Shops): $' + (tot1 + tot2).toFixed(2) + '</p>')
    w.document.write('</body></html>')
    w.document.close()
  }

    async function loadSettlement(date: string) {
    setSettleLoading(true)
    setHasRunSettlement(true)
    try {
      const res = await fetch('/api/reports?type=shop-settlement&date=' + date)
      const data = await res.json()
      setSettleData(Array.isArray(data.rows) ? data.rows : [])
    } catch {
      setSettleData([])
    }
    setSettleLoading(false)
  }

    async function loadTrip(date: string) {
    setTripLoading(true)
    try {
      const res = await fetch('/api/reports?type=referral-trip&date=' + date)
      const data = await res.json()
      setTripData({
        thisTrip: Array.isArray(data.thisTrip) ? data.thisTrip : [],
        outstanding: Array.isArray(data.outstanding) ? data.outstanding : [],
        tripDate: data.tripDate || date,
      })
    } catch {
      setTripData({ thisTrip: [], outstanding: [], tripDate: date })
    }
    setTripLoading(false)
  }

    const load = useCallback(async () => {
    setLoading(true)
    const base = '/api/reports?'
    // Collect any error a report sends back so it shows on screen instead of looking like "no records".
    const errors: string[] = []
    const getJson = (url: string) => fetch(url)
      .then(x => x.json())
      .then(d => {
        if (d && typeof d === 'object' && !Array.isArray(d) && d.error) errors.push(String(d.error))
        return d
      })
      .catch(e => { errors.push(String(e)); return [] })
    if (tab === 'financial') {
      const [p, o, nc, np] = await Promise.all([
        getJson(base + 'type=payouts&from=' + fromDate + '&to=' + toDate),
        getJson(base + 'type=outstanding'),
        getJson(base + 'type=no-charge'),
        getJson(base + 'type=never-paid'),
      ])
      setPayouts(Array.isArray(p) ? p : [])
      setOutstanding(Array.isArray(o) ? o : [])
      setNoCharge(Array.isArray(nc) ? nc : [])
      setUnpaidWork(Array.isArray(np) ? np : [])
    }
    if (tab === 'referral') {
      const [a, h] = await Promise.all([
        getJson(base + 'type=referral-at-shop'),
        getJson(base + 'type=referral-history'),
      ])
      setAtShop(Array.isArray(a) ? a : [])
      setRefHistory(Array.isArray(h) ? h : [])
    }
    if (tab === 'workorders') {
      const [c, op, da] = await Promise.all([
        getJson(base + 'type=completed&from=' + fromDate + '&to=' + toDate),
        getJson(base + 'type=open'),
        getJson(base + 'type=donated-abandoned'),
      ])
      setCompleted(Array.isArray(c) ? c : [])
      setOpenOrders(Array.isArray(op) ? op : [])
      setDonatedAbandoned(Array.isArray(da) ? da : [])
    }
    if (tab === 'parts') {
      const [pp, r, pr] = await Promise.all([
        getJson(base + 'type=parts-pending'),
        getJson(base + 'type=revenue'),
        getJson(base + 'type=parts-report&from=' + fromDate + '&to=' + toDate),
      ])
      setPendingParts(Array.isArray(pp) ? pp : [])
      setRevenue(Array.isArray(r) ? r : [])
      setPartsReport(Array.isArray(pr) ? pr : [])
    }
    if (tab === 'admin') {
      const [nr, ds, tc, inv] = await Promise.all([
        getJson(base + 'type=needs-reminder'),
        getJson(base + 'type=denied-service'),
        getJson(base + 'type=thursday-check'),
        getJson('/api/admin/invoice-backfill'),
      ])
      setInvoiceFill(inv && Array.isArray(inv.rows) ? inv : { rows: [], backupCount: 0 })
      setNeedsReminder(Array.isArray(nr) ? nr : [])
      setDeniedService(Array.isArray(ds) ? ds : [])
      setThursdayCheck(tc && Array.isArray(tc.rows) ? tc : { rows: [], cutoff: '' })
    }
    setLoadError(errors.length ? Array.from(new Set(errors)).join(' | ') : '')
    setLoading(false)
  }, [tab, fromDate, toDate])

  useEffect(() => { load() }, [load])

  const TABS: { id: ReportTab; label: string }[] = [
    { id: 'financial',  label: 'Financial' },
    { id: 'referral',   label: 'Referral Shop' },
    { id: 'workorders', label: 'Work Orders' },
    { id: 'parts',      label: 'Parts' },
    { id: 'admin',      label: 'Administrative' },
  ]

  const needsDates = tab === 'financial' || tab === 'workorders' || tab === 'parts'

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Reports</h1>
        <div className="flex items-center gap-3">
          {needsDates && (
            <div className="flex items-center gap-2 text-sm print:hidden">
              <label className="text-gray-500">From</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="border rounded px-2 py-1 text-sm" />
              <label className="text-gray-500">To</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="border rounded px-2 py-1 text-sm" />
              <button onClick={load}
                className="bg-orange-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-orange-600">
                Run
              </button>
            </div>
          )}
          <button onClick={() => window.print()}
            className="print:hidden flex items-center gap-1.5 bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50">
            Print / Save PDF
          </button>
        </div>
      </div>

      <div className="flex gap-2 print:hidden">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={'px-4 py-2 rounded-lg text-sm font-medium ' + (tab === t.id ? 'bg-orange-500 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50')}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-gray-400 text-center py-8">Loading...</p>}

      {!loading && loadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 print:hidden">
          <p className="font-semibold">A report could not load, so some sections below may look empty when they are not.</p>
          <p className="text-xs mt-1 break-words">{loadError}</p>
        </div>
      )}

      {/* Print-only header */}
      <div className="hidden print:block mb-4 pb-3 border-b">
        <div className="text-xl font-bold text-gray-900">WW Small Engine - Reports</div>
        <div className="text-sm text-gray-500 mt-1">
          {tab === 'financial' && 'Financial Reports - ' + fromDate + ' to ' + toDate}
          {tab === 'referral' && 'Referral Shop Reports'}
          {tab === 'workorders' && 'Completed Work Orders - ' + fromDate + ' to ' + toDate}
          {tab === 'parts' && 'Pending Parts Report'}
          {tab === 'admin' && 'Administrative - Unpaid Follow-Up'}
        </div>
      </div>

      {!loading && tab === 'financial' && (
        <div className="space-y-5">

          {/* Payout Summary */}
          <Section title={'Money Paid Out Summary - ' + fromDate + ' to ' + toDate} subtitle="Only jobs actually paid so far - not invoiced estimates. Direct jobs are listed by the date paid (older jobs without one use the completion date). Jobs paid after 2026-07-01 go 100% to whoever is assigned (50/50 if Both); jobs paid on or before that date still split 60/40 Wade/Wayne to match how they were actually paid out.">
            {payouts.length === 0 ? <Empty /> : (() => {
              const totalPartsCostAll = payouts.reduce((s, r) => s + (Number(r.parts_cost) || 0), 0)

              const calcRow = (row: Record<string, unknown>, isRef: boolean) => {
                const partsCharged = Number(row.parts_charged) || 0
                const amtPaid = Number(row.amount_paid) || 0
                const shopAmt = Number(row.shop_payment_amount) || 0
                const shopReceived = row.shop_payment_received === true
                const isPaid = isRef ? shopReceived : (amtPaid > 0)
                const paidAmount = isRef ? shopAmt : amtPaid
                const afterParts = paidAmount - partsCharged
                const refCut = isRef && afterParts > 0 ? afterParts * 0.20 : 0
                const net = afterParts - refCut
                return { paidAmount, partsCharged, afterParts, refCut, net, isPaid }
              }

              const inHouse = payouts.filter(r => r.customer_source !== 'referral' && calcRow(r, false).isPaid)
              const referral = payouts.filter(r => r.customer_source === 'referral' && calcRow(r, true).isPaid)

              // Per-technician payout method changed on 2026-07-30: jobs completed/paid
              // Payout method changed for anything paid after 2026-07-01: jobs paid on
              // or before that date still split 60/40 (matching how they were actually paid
              // out in real life); jobs paid after that date pay 100% to whoever is assigned
              // (Wade or Wayne solo), or 50/50 if marked Both.
              const SPLIT_CUTOVER_DATE = '2026-07-01'

              const sumRows = (rows: Record<string, unknown>[], isRef: boolean) => {
                let revenue = 0, parts = 0, partsCost = 0, shopCut = 0, net = 0
                const byTech: Record<string, number> = {}
                rows.forEach(row => {
                  const c = calcRow(row, isRef)
                  revenue += c.paidAmount; parts += c.partsCharged; shopCut += c.refCut
                  net += c.net
                  partsCost += Number(row.parts_cost) || 0
                  const effDate = row.effective_date ? String(row.effective_date).slice(0, 10) : ''
                  if (effDate && effDate <= SPLIT_CUTOVER_DATE) {
                    byTech['Wade'] = (byTech['Wade'] || 0) + c.net * 0.60
                    byTech['Wayne'] = (byTech['Wayne'] || 0) + c.net * 0.40
                  } else if (row.technician === 'Wade') {
                    byTech['Wade'] = (byTech['Wade'] || 0) + c.net
                  } else if (row.technician === 'Wayne') {
                    byTech['Wayne'] = (byTech['Wayne'] || 0) + c.net
                  } else if (row.technician === 'Both') {
                    byTech['Wade'] = (byTech['Wade'] || 0) + c.net * 0.50
                    byTech['Wayne'] = (byTech['Wayne'] || 0) + c.net * 0.50
                  } else {
                    const tech = String(row.technician || 'Unassigned')
                    byTech[tech] = (byTech[tech] || 0) + c.net
                  }
                })
                return { revenue, parts, partsCost, shopCut, net, byTech }
              }

              const ihTotals = sumRows(inHouse, false)
              const refTotals = sumRows(referral, true)
              const totalPaid = ihTotals.revenue + refTotals.revenue

              const combinedByTech: Record<string, number> = {}
              for (const [tech, amt] of Object.entries(ihTotals.byTech)) combinedByTech[tech] = (combinedByTech[tech] || 0) + amt
              for (const [tech, amt] of Object.entries(refTotals.byTech)) combinedByTech[tech] = (combinedByTech[tech] || 0) + amt

              const tbl = (rows: Record<string, unknown>[], isRef: boolean, totals: { revenue: number; parts: number; shopCut: number; net: number }) => (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b text-xs uppercase">
                        <th className="pb-2 pr-3">WO#</th>
                        <th className="pb-2 pr-3">Customer</th>
                        <th className="pb-2 pr-3">Date</th>
                        {isRef && <th className="pb-2 pr-3">Shop</th>}
                        <th className="pb-2 pr-3">Technician</th>
                        <th className="pb-2 pr-3 text-right">Amount Paid</th>
                        <th className="pb-2 pr-3 text-right">Parts Chg</th>
                        {isRef && <th className="pb-2 pr-3 text-right">Shop 20%</th>}
                        <th className="pb-2 text-right">Net Earned</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(row => {
                        const c = calcRow(row, isRef)
                        return (
                          <tr key={String(row.id)} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="py-1.5 pr-3">
                              <Link href={'/work-orders/' + row.id} className="text-blue-600 hover:underline font-mono text-xs">
                                {String(row.order_number)}
                              </Link>
                            </td>
                            <td className="py-1.5 pr-3 whitespace-nowrap">{String(row.customer_name || '-')}</td>
                            <td className="py-1.5 pr-3 text-gray-500 text-xs">{fmtDate(row.effective_date ?? row.date_complete)}</td>
                            {isRef && <td className="py-1.5 pr-3 text-gray-500 text-xs whitespace-nowrap">{String(row.referral_shop || '-')}</td>}
                            <td className="py-1.5 pr-3">
                              <span className={'text-xs px-2 py-0.5 rounded font-medium ' + (row.technician === 'Wade' ? 'bg-orange-100 text-orange-700' : row.technician === 'Wayne' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600')}>
                                {String(row.technician || 'Unassigned')}
                              </span>
                              {(row.effective_date ? String(row.effective_date).slice(0, 10) : '') <= '2026-07-01' && (
                                <span className="text-[10px] text-gray-400 ml-1" title="Split 60/40 Wade/Wayne - before payout method change">*60/40</span>
                              )}
                            </td>
                            <td className="py-1.5 pr-3 text-right">{fmt(c.paidAmount)}</td>
                            <td className="py-1.5 pr-3 text-right text-gray-500">{c.partsCharged > 0 ? fmt(c.partsCharged) : '-'}</td>
                            {isRef && <td className="py-1.5 pr-3 text-right text-orange-500">{fmt(c.refCut)}</td>}
                            <td className="py-1.5 text-right font-medium">{fmt(c.net)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 font-semibold text-sm">
                        <td className="pt-2 text-gray-500" colSpan={isRef ? 5 : 4}>Subtotal</td>
                        <td className="pt-2 text-right">{fmt(totals.revenue)}</td>
                        <td className="pt-2 text-right text-gray-600">{totals.parts > 0 ? fmt(totals.parts) : '-'}</td>
                        {isRef && <td className="pt-2 text-right text-orange-500">{fmt(totals.shopCut)}</td>}
                        <td className="pt-2 text-right">{fmt(totals.net)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )

              return (
                <div className="space-y-5">
                  {inHouse.length === 0 && referral.length === 0 ? (
                    <p className="text-sm text-gray-400 italic py-4 text-center">No paid jobs in this date range yet - check Outstanding Invoices below</p>
                  ) : (
                    <>
                      {inHouse.length > 0 && (
                        <div>
                          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">In-House Jobs</h3>
                          {tbl(inHouse, false, ihTotals)}
                        </div>
                      )}
                      {referral.length > 0 && (
                        <div>
                          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Referral Jobs</h3>
                          {tbl(referral, true, refTotals)}
                        </div>
                      )}
                    </>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-2 pt-3 border-t-2">
                    <div className="bg-red-50 rounded-lg p-3 text-center">
                      <div className="text-xs text-red-500 mb-1">Total Spent (Parts)</div>
                      <div className="font-bold text-red-600">{fmt(totalPartsCostAll)}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">All completed jobs</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <div className="text-xs text-green-600 mb-1">Total Paid</div>
                      <div className="font-bold text-green-700">{fmt(totalPaid)}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">Actually received</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <div className="text-xs text-gray-500 mb-1">Net (Paid - Spent)</div>
                      <div className="font-bold text-gray-800">{fmt(totalPaid - totalPartsCostAll)}</div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-3 text-center">
                      <div className="text-xs text-orange-600 mb-1">Wade Total</div>
                      <div className="font-bold text-orange-600">{fmt(combinedByTech['Wade'] || 0)}</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                      <div className="text-xs text-blue-600 mb-1">Wayne Total</div>
                      <div className="font-bold text-blue-600">{fmt(combinedByTech['Wayne'] || 0)}</div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">Total Spent (Parts) includes every completed job in this date range, whether paid or not. Wade and Wayne totals show what each tech earned from the jobs assigned to them - no splitting between them.</p>
                </div>
              )
            })()}
          </Section>

          {/* Outstanding Invoices */}
          <Section title="Outstanding Invoices" subtitle={"Current as of today (" + today + ") \u2014 completed work not yet paid or picked up, in-house and referral"}>
            {outstanding.length === 0 ? <Empty /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b text-xs uppercase">
                      <th className="pb-2 pr-3">WO#</th>
                      <th className="pb-2 pr-3">Customer</th>
                      <th className="pb-2 pr-3">Type</th>
                      <th className="pb-2 pr-3">Equipment</th>
                      <th className="pb-2 pr-3">Date In</th>
                      <th className="pb-2 pr-3">Completed / Returned</th>
                      <th className="pb-2 pr-3 text-right">Invoiced</th>
                      <th className="pb-2 pr-3 text-right">Paid</th>
                      <th className="pb-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outstanding.map(row => {
                      const isRef = row.customer_source === 'referral'
                      const charged = Number(row.amount_charged) || 0
                      const paid = Number(row.amount_paid) || 0
                      const completedDate = isRef ? row.referral_dropoff_date : row.date_complete
                      return (
                        <tr key={String(row.id)} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-1.5 pr-3">
                            <Link href={'/work-orders/' + row.id} className="text-blue-600 hover:underline font-mono text-xs">
                              {String(row.order_number)}
                            </Link>
                          </td>
                          <td className="py-1.5 pr-3">{String(row.customer_name || '-')}</td>
                          <td className="py-1.5 pr-3">
                            {isRef
                              ? <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{String(row.referral_shop || 'Referral')}</span>
                              : <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">Direct</span>}
                          </td>
                          <td className="py-1.5 pr-3 text-gray-500 text-xs">{String(row.equipment_type || '')} {String(row.make || '')} {String(row.model || '')}</td>
                          <td className="py-1.5 pr-3 text-gray-500 text-xs">{fmtDate(row.date_in)}</td>
                          <td className="py-1.5 pr-3 text-gray-500 text-xs">{fmtDate(completedDate)}</td>
                          <td className="py-1.5 pr-3 text-right font-medium">
                            {charged > 0
                              ? fmt(charged)
                              : <span className="text-gray-400 text-xs">not invoiced</span>}
                          </td>
                          <td className="py-1.5 pr-3 text-right text-red-500">{paid > 0 ? fmt(paid) : '-'}</td>
                          <td className="py-1.5 text-right font-semibold text-orange-600">
                            {charged > 0
                              ? fmt(charged - paid)
                              : <span className="text-gray-400 text-xs">-</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-semibold">
                      <td colSpan={6} className="pt-2 text-gray-600">Outstanding Balance</td>
                      <td colSpan={3} className="pt-2 text-right text-red-600">
                        {fmt(outstanding.reduce((s, r) => s + (Number(r.amount_charged) || 0) - (Number(r.amount_paid) || 0), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Section>

          {/* No Charge Work Orders */}
          <Section title="No Charge Work Orders" subtitle="Completed work marked No Charge - excluded from Outstanding Invoices above">
            {noCharge.length === 0 ? <Empty /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b text-xs uppercase">
                      <th className="pb-2 pr-3">WO#</th>
                      <th className="pb-2 pr-3">Customer</th>
                      <th className="pb-2 pr-3">Type</th>
                      <th className="pb-2 pr-3">Equipment</th>
                      <th className="pb-2 pr-3">Date In</th>
                      <th className="pb-2 pr-3">Date Complete</th>
                      <th className="pb-2 text-right">Parts Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {noCharge.map(row => {
                      const isRef = row.customer_source === 'referral'
                      return (
                        <tr key={String(row.id)} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-1.5 pr-3">
                            <Link href={'/work-orders/' + row.id} className="text-blue-600 hover:underline font-mono text-xs">
                              {String(row.order_number)}
                            </Link>
                          </td>
                          <td className="py-1.5 pr-3">{String(row.customer_name || '-')}</td>
                          <td className="py-1.5 pr-3">
                            {isRef
                              ? <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{String(row.referral_shop || 'Referral')}</span>
                              : <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">Direct</span>}
                          </td>
                          <td className="py-1.5 pr-3 text-gray-500 text-xs">{String(row.equipment_type || '')} {String(row.make || '')} {String(row.model || '')}</td>
                          <td className="py-1.5 pr-3 text-gray-500 text-xs">{fmtDate(row.date_in)}</td>
                          <td className="py-1.5 pr-3 text-gray-500 text-xs">{fmtDate(row.date_complete)}</td>
                          <td className="py-1.5 text-right text-red-500">{Number(row.parts_cost) > 0 ? fmt(row.parts_cost) : '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-semibold">
                      <td colSpan={6} className="pt-2 text-gray-600">{noCharge.length} work order{noCharge.length !== 1 ? 's' : ''}</td>
                      <td className="pt-2 text-right text-red-600">
                        {fmt(noCharge.reduce((s, r) => s + (Number(r.parts_cost) || 0), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Section>

          {/* Not Paid - every way Cavin's didn't get paid */}
          <Section title="Not Paid - Work Done, No Payment Received" subtitle="Every work order we did not get paid for: equipment picked up or returned with no payment recorded, abandoned, donated, or done for no charge. Full history. Values are invoice totals before any referral shop share, or an estimate (labor + parts charged) when no invoice amount was entered.">
            {unpaidWork.length === 0 ? <Empty /> : (() => {
              const filteredUnpaid = unpaidFilter === 'all' ? unpaidWork : unpaidWork.filter(r => r.reason === unpaidFilter)
              const totalsFor = (rows: Record<string, unknown>[]) => rows.reduce<{ value: number; parts: number; unpaid: number }>((t, r) => {
                const v = unpaidValue(r).value
                const paid = Number(r.amount_paid) || 0
                return { value: t.value + v, parts: t.parts + (Number(r.parts_cost) || 0), unpaid: t.unpaid + Math.max(v - paid, 0) }
              }, { value: 0, parts: 0, unpaid: 0 })
              const tot = totalsFor(filteredUnpaid)
              return (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2 print:hidden">
                    <button onClick={() => setUnpaidFilter('all')}
                      className={'text-xs px-3 py-1 rounded-full border ' + (unpaidFilter === 'all' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 hover:bg-gray-50')}>
                      All ({unpaidWork.length})
                    </button>
                    {UNPAID_REASONS.map(rs => {
                      const n = unpaidWork.filter(r => r.reason === rs.id).length
                      return (
                        <button key={rs.id} onClick={() => setUnpaidFilter(rs.id)}
                          className={'text-xs px-3 py-1 rounded-full border ' + (unpaidFilter === rs.id ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 hover:bg-gray-50')}>
                          {rs.label} ({n})
                        </button>
                      )
                    })}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {UNPAID_REASONS.map(rs => {
                      const rows = unpaidWork.filter(r => r.reason === rs.id)
                      const t = totalsFor(rows)
                      return (
                        <div key={rs.id} className="border rounded-lg p-2.5">
                          <span className={'text-xs px-2 py-0.5 rounded font-medium ' + rs.cls}>{rs.label}</span>
                          <div className="text-lg font-bold text-gray-800 mt-1.5">{rows.length}</div>
                          <div className="text-xs text-gray-500">Value {fmt(t.value)}</div>
                          <div className="text-xs text-red-500">Parts cost {fmt(t.parts)}</div>
                        </div>
                      )
                    })}
                  </div>

                  {filteredUnpaid.length === 0 ? <Empty /> : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500 border-b text-xs uppercase">
                            <th className="pb-2 pr-3">WO#</th>
                            <th className="pb-2 pr-3">Customer</th>
                            <th className="pb-2 pr-3">Type</th>
                            <th className="pb-2 pr-3">Equipment</th>
                            <th className="pb-2 pr-3">Reason</th>
                            <th className="pb-2 pr-3">Date</th>
                            <th className="pb-2 pr-3">Note</th>
                            <th className="pb-2 pr-3 text-right">Value</th>
                            <th className="pb-2 pr-3 text-right">Parts Cost</th>
                            <th className="pb-2 text-right">Not Paid</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredUnpaid.map(row => {
                            const isRef = row.customer_source === 'referral'
                            const rs = UNPAID_REASONS.find(x => x.id === row.reason)
                            const { value, est } = unpaidValue(row)
                            const paid = Number(row.amount_paid) || 0
                            const when = row.never_paid_date || row.referral_dropoff_date || row.date_complete || row.date_in
                            return (
                              <tr key={String(row.id)} className="border-b last:border-0 hover:bg-gray-50">
                                <td className="py-1.5 pr-3">
                                  <Link href={'/work-orders/' + row.id} className="text-blue-600 hover:underline font-mono text-xs">
                                    {String(row.order_number)}
                                  </Link>
                                </td>
                                <td className="py-1.5 pr-3 whitespace-nowrap">{String(row.customer_name || '-')}</td>
                                <td className="py-1.5 pr-3 text-xs whitespace-nowrap">
                                  {isRef
                                    ? <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{String(row.referral_shop || 'Referral')}</span>
                                    : <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">Direct</span>}
                                </td>
                                <td className="py-1.5 pr-3 text-gray-500 text-xs whitespace-nowrap">{String(row.equipment_type || '')} {String(row.make || '')} {String(row.model || '')}</td>
                                <td className="py-1.5 pr-3 whitespace-nowrap">
                                  <span className={'text-xs px-2 py-0.5 rounded font-medium ' + (rs ? rs.cls : 'bg-gray-100 text-gray-600')}>{rs ? rs.label : String(row.reason)}</span>
                                </td>
                                <td className="py-1.5 pr-3 text-gray-500 text-xs whitespace-nowrap">{fmtDate(when)}</td>
                                <td className="py-1.5 pr-3 text-gray-500 text-xs">{row.never_paid_note ? String(row.never_paid_note) : '-'}</td>
                                <td className="py-1.5 pr-3 text-right">
                                  {value > 0
                                    ? (est ? <span className="text-gray-400 text-xs italic">est. {fmt(value)}</span> : fmt(value))
                                    : <span className="text-gray-400 text-xs">-</span>}
                                </td>
                                <td className="py-1.5 pr-3 text-right text-red-500">{Number(row.parts_cost) > 0 ? fmt(row.parts_cost) : '-'}</td>
                                <td className="py-1.5 text-right font-semibold text-orange-600">{value > 0 ? fmt(Math.max(value - paid, 0)) : '-'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 font-semibold">
                            <td colSpan={7} className="pt-2 text-gray-600">{filteredUnpaid.length} work order{filteredUnpaid.length !== 1 ? 's' : ''}</td>
                            <td className="pt-2 pr-3 text-right">{fmt(tot.value)}</td>
                            <td className="pt-2 pr-3 text-right text-red-600">{fmt(tot.parts)}</td>
                            <td className="pt-2 text-right text-orange-600">{fmt(tot.unpaid)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )
            })()}
          </Section>

        </div>
      )}

      {!loading && tab === 'referral' && (
        <div className="space-y-5">

          {/* Trip Report */}
          {/* Shop Payment Settlement */}
          <Section title="Shop Payment Settlement" subtitle="Mark work orders as paid on the referral shop's page, then run this for the day you visited the shop">
            <div className="flex items-end gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Payment Date</label>
                <input type="date" value={settleDate} onChange={e => setSettleDate(e.target.value)}
                  className="border rounded-md px-3 py-1.5 text-sm" />
              </div>
              <button onClick={() => loadSettlement(settleDate)}
                className="bg-orange-500 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-orange-600">
                {settleLoading ? 'Loading...' : 'Generate Report'}
              </button>
            </div>
            {!hasRunSettlement ? (
              <p className="text-sm text-gray-400 italic py-4 text-center">Pick the date you were paid at the shop and click Generate Report</p>
            ) : settleData.length === 0 ? (
              <Empty />
            ) : (() => {
              const SPLIT_CUTOVER_DATE = '2026-07-01'
              // This report is already filtered to a single shop_payment_date (settleDate),
              // so the cutover check is based on the actual payment date, not the job's
              // completion date.
              const useOldSplit = settleDate <= SPLIT_CUTOVER_DATE
              const calc = (row: Record<string, unknown>) => {
                const partsCharged = Number(row.parts_charged) || 0
                const partsCost = Number(row.parts_cost) || 0
                const shopAmt = Number(row.shop_payment_amount) || 0
                const amtCharged = Number(row.amount_charged) || 0
                const laborEst = (Number(row.labor_hours) || 0) * (Number(row.labor_rate) || 80)
                const paid = shopAmt > 0 ? shopAmt : amtCharged > 0 ? amtCharged : laborEst + partsCharged
                const afterParts = paid - partsCharged
                const shopCut = afterParts > 0 ? afterParts * 0.20 : 0
                const net = afterParts - shopCut
                return { paid, partsCharged, partsCost, shopCut, net, useOldSplit }
              }
              const addToByTech = (byTech: Record<string, number>, row: Record<string, unknown>, c: { net: number; useOldSplit: boolean }) => {
                if (c.useOldSplit) {
                  byTech['Wade'] = (byTech['Wade'] || 0) + c.net * 0.60
                  byTech['Wayne'] = (byTech['Wayne'] || 0) + c.net * 0.40
                } else if (row.technician === 'Wade') {
                  byTech['Wade'] = (byTech['Wade'] || 0) + c.net
                } else if (row.technician === 'Wayne') {
                  byTech['Wayne'] = (byTech['Wayne'] || 0) + c.net
                } else if (row.technician === 'Both') {
                  byTech['Wade'] = (byTech['Wade'] || 0) + c.net * 0.50
                  byTech['Wayne'] = (byTech['Wayne'] || 0) + c.net * 0.50
                } else {
                  const tech = String(row.technician || 'Unassigned')
                  byTech[tech] = (byTech[tech] || 0) + c.net
                }
              }

              const shopGroups: Record<string, Record<string, unknown>[]> = {}
              settleData.forEach(row => {
                const shop = String(row.referral_shop || 'Other Shop')
                if (!shopGroups[shop]) shopGroups[shop] = []
                shopGroups[shop].push(row)
              })

              const grandTotals = { paid: 0, parts: 0, partsCost: 0, shopCut: 0, byTech: {} as Record<string, number> }
              settleData.forEach(row => {
                const c = calc(row)
                grandTotals.paid += c.paid; grandTotals.parts += c.partsCharged
                grandTotals.partsCost += c.partsCost; grandTotals.shopCut += c.shopCut
                addToByTech(grandTotals.byTech, row, c)
              })

              return (
                <div className="space-y-6">
                  {Object.keys(shopGroups).sort().map(shop => {
                    const rows = shopGroups[shop]
                    const shopTotals = { paid: 0, parts: 0, partsCost: 0, shopCut: 0, byTech: {} as Record<string, number> }
                    rows.forEach(row => {
                      const c = calc(row)
                      shopTotals.paid += c.paid; shopTotals.parts += c.partsCharged
                      shopTotals.partsCost += c.partsCost; shopTotals.shopCut += c.shopCut
                      addToByTech(shopTotals.byTech, row, c)
                    })
                    return (
                      <div key={shop}>
                        <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">{shop}</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-gray-500 border-b text-xs uppercase">
                                <th className="pb-2 pr-3">WO#</th>
                                <th className="pb-2 pr-3">Customer</th>
                                <th className="pb-2 pr-3">Technician</th>
                                <th className="pb-2 pr-3 text-right">Amount Paid</th>
                                <th className="pb-2 pr-3 text-right">Parts Chg to Customer</th>
                                <th className="pb-2 pr-3 text-right">Actual Part Cost</th>
                                <th className="pb-2 pr-3 text-right">To Referral Shop</th>
                                <th className="pb-2 text-right">Net Earned</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map(row => {
                                const c = calc(row)
                                return (
                                  <tr key={String(row.id)} className="border-b last:border-0 hover:bg-gray-50">
                                    <td className="py-1.5 pr-3">
                                      <Link href={'/work-orders/' + row.id} className="text-blue-600 hover:underline font-mono text-xs">
                                        {String(row.order_number)}
                                      </Link>
                                    </td>
                                    <td className="py-1.5 pr-3 whitespace-nowrap">{String(row.customer_name || '-')}</td>
                                    <td className="py-1.5 pr-3">
                                      <span className={'text-xs px-2 py-0.5 rounded font-medium ' + (row.technician === 'Wade' ? 'bg-orange-100 text-orange-700' : row.technician === 'Wayne' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600')}>
                                        {String(row.technician || 'Unassigned')}
                                      </span>
                                      {c.useOldSplit && (
                                        <span className="text-[10px] text-gray-400 ml-1" title="Split 60/40 Wade/Wayne - before payout method change">*60/40</span>
                                      )}
                                    </td>
                                    <td className="py-1.5 pr-3 text-right font-medium">{fmt(c.paid)}</td>
                                    <td className="py-1.5 pr-3 text-right text-gray-500">{c.partsCharged > 0 ? fmt(c.partsCharged) : '-'}</td>
                                    <td className="py-1.5 pr-3 text-right text-red-500">{c.partsCost > 0 ? fmt(c.partsCost) : '-'}</td>
                                    <td className="py-1.5 pr-3 text-right text-orange-500">{fmt(c.shopCut)}</td>
                                    <td className="py-1.5 text-right font-medium">{fmt(c.net)}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="border-t-2 font-semibold">
                                <td colSpan={3} className="pt-2 text-gray-600">{shop} subtotal ({rows.length} WO{rows.length !== 1 ? 's' : ''})</td>
                                <td className="pt-2 text-right">{fmt(shopTotals.paid)}</td>
                                <td className="pt-2 text-right text-gray-600">{fmt(shopTotals.parts)}</td>
                                <td className="pt-2 text-right text-red-600">{fmt(shopTotals.partsCost)}</td>
                                <td className="pt-2 text-right text-orange-500">{fmt(shopTotals.shopCut)}</td>
                                <td className="pt-2 text-right">-</td>
                              </tr>
                              <tr>
                                <td colSpan={8} className="pt-2">
                                  <div className="flex gap-4 justify-end text-sm font-semibold">
                                    <span className="text-orange-600">Wade: {fmt(shopTotals.byTech['Wade'] || 0)}</span>
                                    <span className="text-blue-600">Wayne: {fmt(shopTotals.byTech['Wayne'] || 0)}</span>
                                  </div>
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )
                  })}

                  <div className="pt-3 border-t-2">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Grand Totals - All Shops ({settleData.length} WO{settleData.length !== 1 ? 's' : ''})</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-500 mb-1">Amount Paid</div>
                        <div className="font-bold text-gray-800">{fmt(grandTotals.paid)}</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-500 mb-1">Parts Charged</div>
                        <div className="font-bold text-gray-800">{fmt(grandTotals.parts)}</div>
                      </div>
                      <div className="bg-red-50 rounded-lg p-3 text-center">
                        <div className="text-xs text-red-500 mb-1">Actual Part Cost</div>
                        <div className="font-bold text-red-600">{fmt(grandTotals.partsCost)}</div>
                      </div>
                      <div className="bg-orange-50 rounded-lg p-3 text-center">
                        <div className="text-xs text-orange-600 mb-1">Wade</div>
                        <div className="font-bold text-orange-600">{fmt(grandTotals.byTech['Wade'] || 0)}</div>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-3 text-center">
                        <div className="text-xs text-blue-600 mb-1">Wayne</div>
                        <div className="font-bold text-blue-600">{fmt(grandTotals.byTech['Wayne'] || 0)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </Section>

          <Section title="Shop Trip Report">
            <div className="flex items-end gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Trip Date</label>
                <input type="date" value={tripDate} onChange={e => setTripDate(e.target.value)}
                  className="border rounded-md px-3 py-1.5 text-sm" />
              </div>
              <button onClick={() => loadTrip(tripDate)}
                className="bg-orange-500 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-orange-600">
                {tripLoading ? 'Loading...' : 'Generate Report'}
              </button>
              {tripData && (
                <button onClick={printTrip}
                  className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700">
                  Print Trip Sheet
                </button>
              )}
            </div>

            {tripData && (() => {
              const groupByShop = (rows: Record<string, unknown>[]) => {
                const groups: Record<string, Record<string, unknown>[]> = {}
                rows.forEach(r => {
                  const shop = String(r.referral_shop || 'Other Shop')
                  if (!groups[shop]) groups[shop] = []
                  groups[shop].push(r)
                })
                return groups
              }
              const calcInv = (r: Record<string, unknown>) => { const sa = Number(r.shop_payment_amount) || 0; return sa > 0 ? sa : (Number(r.amount_charged) || 0) }
              const calcOwes = (r: Record<string, unknown>) => (Number(r.labor_hours) || 0) * (Number(r.labor_rate) || 0) * 0.20

              const shopSection = (rows: Record<string, unknown>[], showReturnedCol: boolean) => {
                const groups = groupByShop(rows)
                return Object.keys(groups).sort().map(shop => {
                  const shopRows = groups[shop]
                  const shopInv = shopRows.reduce((s, r) => s + calcInv(r), 0)
                  const shopOwes = shopRows.reduce((s, r) => s + calcOwes(r), 0)
                  return (
                    <div key={shop} className="mb-4">
                      <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">{shop}</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-500 border-b text-xs uppercase">
                              <th className="pb-2 pr-3">WO#</th>
                              <th className="pb-2 pr-3">Customer</th>
                              <th className="pb-2 pr-3">Equipment</th>
                              {showReturnedCol && <th className="pb-2 pr-3">Returned</th>}
                              <th className="pb-2 pr-3">{showReturnedCol ? 'Notes' : 'Work Done / Notes'}</th>
                              <th className="pb-2 pr-3 text-right">Invoice</th>
                              <th className="pb-2 text-right text-orange-600">WW Owes Shop</th>
                            </tr>
                          </thead>
                          <tbody>
                            {shopRows.map(row => {
                              const inv = calcInv(row)
                              const owes = calcOwes(row)
                              return (
                                <tr key={String(row.id)} className="border-b last:border-0 hover:bg-gray-50">
                                  <td className="py-1.5 pr-3">
                                    <Link href={'/work-orders/' + row.id} className="text-blue-600 hover:underline font-mono text-xs">{String(row.order_number)}</Link>
                                  </td>
                                  <td className="py-1.5 pr-3 whitespace-nowrap">{String(row.customer_name || '-')}</td>
                                  <td className="py-1.5 pr-3 text-gray-500 text-xs whitespace-nowrap">{String(row.equipment_type || '')} {String(row.make || '')} {String(row.model || '')}</td>
                                  {showReturnedCol && <td className="py-1.5 pr-3 text-gray-500 text-xs">{fmtDate(row.referral_dropoff_date)}</td>}
                                  <td className="py-1.5 pr-3 text-gray-500 text-xs max-w-xs truncate">{String(row.work_done || row.complaint || '-')}</td>
                                  <td className="py-1.5 pr-3 text-right">{inv > 0 ? fmt(inv) : '-'}</td>
                                  <td className="py-1.5 text-right text-orange-600 font-medium">{owes > 0 ? fmt(owes) : '-'}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 font-semibold">
                              <td colSpan={showReturnedCol ? 4 : 3}>{shop} subtotal</td>
                              <td className="pt-2 text-right">{fmt(shopInv)}</td>
                              <td className="pt-2 text-right text-orange-600">{fmt(shopOwes)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )
                })
              }

              return (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-2">
                      Dropping Off Today
                      <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-normal">{tripData.thisTrip.length} items</span>
                    </h3>
                    {tripData.thisTrip.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">No drop-offs recorded for this date.</p>
                    ) : shopSection(tripData.thisTrip, false)}
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-700 mb-2">
                      Previously Returned - Awaiting Shop Payment
                      <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-normal">{tripData.outstanding.length} items</span>
                    </h3>
                    {tripData.outstanding.length === 0 ? (
                      <p className="text-sm text-green-600 italic">All caught up - no outstanding items.</p>
                    ) : shopSection(tripData.outstanding, true)}
                  </div>
                </div>
              )
            })()}
          </Section>

          {/* At the Shop */}
          <Section title="Currently at the Shop (Returned - Awaiting Payment)">
            {atShop.length === 0 ? (
              <p className="text-sm text-green-600 text-center py-4">All caught up - no outstanding items</p>
            ) : (() => {
              const groups: Record<string, Record<string, unknown>[]> = {}
              atShop.forEach(row => {
                const shop = String(row.referral_shop || 'Other Shop')
                if (!groups[shop]) groups[shop] = []
                groups[shop].push(row)
              })
              const calcOwes = (row: Record<string, unknown>) => {
                const invoice = Number(row.amount_charged) || 0
                const partsCharged = Number(row.parts_charged) || 0
                const afterParts = invoice - partsCharged
                return afterParts > 0 ? afterParts * 0.20 : 0
              }
              return (
                <div className="space-y-5">
                  {Object.keys(groups).sort().map(shop => {
                    const rows = groups[shop]
                    const shopInv = rows.reduce((s, row) => s + (Number(row.amount_charged) || 0), 0)
                    const shopOwes = rows.reduce((s, row) => s + calcOwes(row), 0)
                    return (
                      <div key={shop}>
                        <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">{shop}</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-gray-500 border-b text-xs uppercase">
                                <th className="pb-2 pr-3">WO#</th>
                                <th className="pb-2 pr-3">Customer</th>
                                <th className="pb-2 pr-3">Equipment</th>
                                <th className="pb-2 pr-3">Returned</th>
                                <th className="pb-2 pr-3 text-right">Invoice</th>
                                <th className="pb-2 text-right text-orange-600">WW Owes Shop (20%)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map(row => {
                                const invoice = Number(row.amount_charged) || 0
                                const wwOwes = calcOwes(row)
                                return (
                                  <tr key={String(row.id)} className="border-b last:border-0 hover:bg-gray-50">
                                    <td className="py-1.5 pr-3">
                                      <Link href={'/work-orders/' + row.id} className="text-blue-600 hover:underline font-mono text-xs">
                                        {String(row.order_number)}
                                      </Link>
                                    </td>
                                    <td className="py-1.5 pr-3">{String(row.customer_name || '-')}</td>
                                    <td className="py-1.5 pr-3 text-gray-500 text-xs">{String(row.equipment_type || '')} {String(row.make || '')} {String(row.model || '')}</td>
                                    <td className="py-1.5 pr-3 text-gray-500 text-xs">{fmtDate(row.referral_dropoff_date)}</td>
                                    <td className="py-1.5 pr-3 text-right">{invoice > 0 ? fmt(invoice) : '-'}</td>
                                    <td className="py-1.5 text-right text-orange-600 font-medium">{wwOwes > 0 ? fmt(wwOwes) : '-'}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="border-t-2 font-semibold">
                                <td colSpan={4} className="pt-2 text-gray-600">{shop} subtotal</td>
                                <td className="pt-2 text-right">{fmt(shopInv)}</td>
                                <td className="pt-2 text-right text-orange-600">{fmt(shopOwes)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )
                  })}
                  <div className="flex justify-end gap-6 pt-2 border-t-2 text-sm font-semibold">
                    <span>All Shops Invoice Total: {fmt(atShop.reduce((s, row) => s + (Number(row.amount_charged) || 0), 0))}</span>
                    <span className="text-orange-600">All Shops WW Owes: {fmt(atShop.reduce((s, row) => s + calcOwes(row), 0))}</span>
                  </div>
                </div>
              )
            })()}
          </Section>

          {/* Full Referral History */}
          <Section title="Referral Settlement History">
            {refHistory.length === 0 ? <Empty /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b text-xs uppercase">
                      <th className="pb-2 pr-3">WO#</th>
                      <th className="pb-2 pr-3">Customer</th>
                      <th className="pb-2 pr-3">Shop</th>
                      <th className="pb-2 pr-3">Equipment</th>
                      <th className="pb-2 pr-3">Returned to Shop</th>
                      <th className="pb-2 pr-3 text-right">Invoice Amount</th>
                      <th className="pb-2 pr-3 text-right">Invoice Paid Date</th>
                      <th className="pb-2 pr-3 text-right text-orange-600">Paid to Shop</th>
                      <th className="pb-2 text-right">Shop Paid Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {refHistory.map(row => {
                      const shopAmt = Number(row.shop_payment_amount) || 0
                      const amtCharged = Number(row.amount_charged) || 0
                      const partsCharged = Number(row.parts_charged) || 0
                      const laborEst = (Number(row.labor_hours) || 0) * (Number(row.labor_rate) || 80)
                      const invoice = shopAmt > 0 ? shopAmt : amtCharged > 0 ? amtCharged : 0
                      const isEst = invoice === 0
                      const estTotal = laborEst + partsCharged
                      const afterParts = invoice > 0 ? invoice - partsCharged : estTotal - partsCharged
                      const neverPaid = row.never_paid === true
                      const paidToShop = !neverPaid && afterParts > 0 ? afterParts * 0.20 : 0
                      return (
                        <tr key={String(row.id)} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-1.5 pr-3">
                            <Link href={'/work-orders/' + row.id} className="text-blue-600 hover:underline font-mono text-xs">
                              {String(row.order_number)}
                            </Link>
                          </td>
                          <td className="py-1.5 pr-3 whitespace-nowrap">{String(row.customer_name || '-')}</td>
                          <td className="py-1.5 pr-3 text-xs whitespace-nowrap">
                            <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{String(row.referral_shop || 'Other Shop')}</span>
                            {neverPaid && <span className="ml-1 bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">No Payment Recorded</span>}
                          </td>
                          <td className="py-1.5 pr-3 text-gray-500 text-xs whitespace-nowrap">{String(row.equipment_type || '')} {String(row.make || '')} {String(row.model || '')}</td>
                          <td className="py-1.5 pr-3 text-gray-500 text-xs">{fmtDate(row.referral_dropoff_date)}</td>
                          <td className="py-1.5 pr-3 text-right">
                            {isEst
                              ? <span className="text-gray-400 text-xs italic">{estTotal > 0 ? 'est. ' + fmt(estTotal) : '-'}</span>
                              : <span className="font-medium">{fmt(invoice)}</span>}
                          </td>
                          <td className="py-1.5 pr-3 text-right text-gray-500 text-xs">{row.shop_payment_date ? String(row.shop_payment_date).slice(0,10) : '-'}</td>
                          <td className="py-1.5 pr-3 text-right text-orange-600 font-medium">{paidToShop > 0 ? fmt(paidToShop) : '-'}</td>
                          <td className="py-1.5 text-right text-gray-500 text-xs">{row.commission_paid_date ? String(row.commission_paid_date).slice(0,10) : '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-semibold">
                      <td colSpan={8} className="pt-2 text-gray-600">Total Paid to Shop (All Shops)</td>
                      <td className="pt-2 text-right text-orange-600">
                        {fmt(refHistory.reduce((s, row) => {
                          if (row.never_paid === true) return s
                          const shopAmt = Number(row.shop_payment_amount) || 0
                          const amtCharged = Number(row.amount_charged) || 0
                          const partsCharged = Number(row.parts_charged) || 0
                          const laborEst = (Number(row.labor_hours) || 0) * (Number(row.labor_rate) || 80)
                          const invoice = shopAmt > 0 ? shopAmt : amtCharged > 0 ? amtCharged : laborEst + partsCharged
                          const afterParts = invoice - partsCharged
                          return s + (afterParts > 0 ? afterParts * 0.20 : 0)
                        }, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Section>
        </div>
      )}

      {!loading && tab === 'workorders' && (
        <div className="space-y-5">
          <Section title="Currently Open Work Orders" subtitle={"Current as of today (" + today + ") \u2014 not yet completed, picked up, donated, or abandoned"}>
            {openOrders.length === 0 ? <Empty /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b text-xs uppercase">
                      <th className="pb-2 pr-3">WO#</th>
                      <th className="pb-2 pr-3">Customer</th>
                      <th className="pb-2 pr-3">Type</th>
                      <th className="pb-2 pr-3">Equipment</th>
                      <th className="pb-2 pr-3">Technician</th>
                      <th className="pb-2 pr-3">Status</th>
                      <th className="pb-2 pr-3">Date In</th>
                      <th className="pb-2 text-right">Days Open</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openOrders.map(row => {
                      const isRef = row.customer_source === 'referral'
                      const days = daysOpen(row.date_in)
                      return (
                        <tr key={String(row.id)} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-1.5 pr-3">
                            <Link href={'/work-orders/' + row.id} className="text-blue-600 hover:underline font-mono text-xs">
                              {String(row.order_number)}
                            </Link>
                          </td>
                          <td className="py-1.5 pr-3">{String(row.customer_name || '-')}</td>
                          <td className="py-1.5 pr-3">
                            {isRef
                              ? <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{String(row.referral_shop || 'Referral')}</span>
                              : <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">Direct</span>}
                          </td>
                          <td className="py-1.5 pr-3 text-gray-500 text-xs">{String(row.equipment_type || '')} {String(row.make || '')} {String(row.model || '')}</td>
                          <td className="py-1.5 pr-3">
                            <span className={'text-xs px-2 py-0.5 rounded font-medium ' + (row.technician === 'Wade' ? 'bg-orange-100 text-orange-700' : row.technician === 'Wayne' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600')}>
                              {String(row.technician || '-')}
                            </span>
                          </td>
                          <td className="py-1.5 pr-3">
                            <span className={'text-xs px-2 py-0.5 rounded font-medium ' + (STATUS_BADGE[String(row.status)] || 'bg-gray-100 text-gray-600')}>
                              {statusLabel(row.status)}
                            </span>
                          </td>
                          <td className="py-1.5 pr-3 text-gray-500 text-xs">{fmtDate(row.date_in)}</td>
                          <td className="py-1.5 text-right text-gray-600">{days !== null ? days + 'd' : '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-semibold">
                      <td colSpan={8} className="pt-2 text-gray-600">{openOrders.length} open work order{openOrders.length !== 1 ? 's' : ''}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Section>

          <Section title={'Completed Jobs - ' + fromDate + ' to ' + toDate}>
            {completed.length === 0 ? <Empty /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b text-xs uppercase">
                      <th className="pb-2 pr-3">WO#</th>
                      <th className="pb-2 pr-3">Customer</th>
                      <th className="pb-2 pr-3">Equipment</th>
                      <th className="pb-2 pr-3">Technician</th>
                      <th className="pb-2 pr-3">Completed</th>
                      <th className="pb-2 pr-3 text-right">Hours</th>
                      <th className="pb-2 text-right">Charged</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completed.map(row => (
                      <tr key={String(row.id)} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-1.5 pr-3">
                          <Link href={'/work-orders/' + row.id} className="text-blue-600 hover:underline font-mono text-xs">
                            {String(row.order_number)}
                          </Link>
                        </td>
                        <td className="py-1.5 pr-3">{String(row.customer_name || '-')}</td>
                        <td className="py-1.5 pr-3 text-gray-500 text-xs">{String(row.equipment_type || '')} {String(row.make || '')} {String(row.model || '')}</td>
                        <td className="py-1.5 pr-3">
                          <span className={'text-xs px-2 py-0.5 rounded font-medium ' + (row.technician === 'Wade' ? 'bg-orange-100 text-orange-700' : row.technician === 'Wayne' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600')}>
                            {String(row.technician || '-')}
                          </span>
                        </td>
                        <td className="py-1.5 pr-3 text-gray-500 text-xs">{fmtDate(row.date_complete)}</td>
                        <td className="py-1.5 pr-3 text-right text-gray-500">{String(row.labor_hours || 0)}h</td>
                        <td className="py-1.5 text-right font-medium">{fmt(row.amount_charged)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-semibold">
                      <td colSpan={5} className="pt-2 text-gray-600">{completed.length} jobs</td>
                      <td className="pt-2 text-right text-gray-600">
                        {completed.reduce((s, r) => s + Number(r.labor_hours || 0), 0).toFixed(1)}h
                      </td>
                      <td className="pt-2 text-right">
                        {fmt(completed.reduce((s, r) => s + Number(r.amount_charged || 0), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Section>

          <Section title="Donated / Abandoned Equipment" subtitle="Full history \u2014 not tracked as revenue or outstanding invoices">
            {donatedAbandoned.length === 0 ? <Empty /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b text-xs uppercase">
                      <th className="pb-2 pr-3">WO#</th>
                      <th className="pb-2 pr-3">Customer</th>
                      <th className="pb-2 pr-3">Equipment</th>
                      <th className="pb-2 pr-3">Status</th>
                      <th className="pb-2 pr-3">Date In</th>
                      <th className="pb-2 pr-3">Shop Status</th>
                      <th className="pb-2 pr-3 text-right">Asking Price</th>
                      <th className="pb-2 text-right">Sale Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {donatedAbandoned.map(row => (
                      <tr key={String(row.id)} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-1.5 pr-3">
                          <Link href={'/work-orders/' + row.id} className="text-blue-600 hover:underline font-mono text-xs">
                            {String(row.order_number)}
                          </Link>
                        </td>
                        <td className="py-1.5 pr-3">{String(row.customer_name || '-')}</td>
                        <td className="py-1.5 pr-3 text-gray-500 text-xs">
                          {String(row.equipment_type || '')} {String(row.make || '')} {String(row.model || '')}
                          {row.serial_number ? <span className="text-gray-400"> (S/N: {String(row.serial_number)})</span> : null}
                        </td>
                        <td className="py-1.5 pr-3">
                          <span className={'text-xs px-2 py-0.5 rounded font-medium ' + (row.status === 'donated' ? 'bg-purple-100 text-purple-800' : 'bg-red-100 text-red-800')}>
                            {row.status === 'donated' ? 'Donated' : 'Abandoned'}
                          </span>
                        </td>
                        <td className="py-1.5 pr-3 text-gray-500 text-xs">{fmtDate(row.date_in)}</td>
                        <td className="py-1.5 pr-3 text-gray-500 text-xs capitalize">{String(row.shop_status || '-')}</td>
                        <td className="py-1.5 pr-3 text-right">{row.asking_price ? fmt(row.asking_price) : '-'}</td>
                        <td className="py-1.5 text-right text-green-600 font-medium">{row.sale_price ? fmt(row.sale_price) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-semibold">
                      <td colSpan={8} className="pt-2 text-gray-600">{donatedAbandoned.length} item{donatedAbandoned.length !== 1 ? 's' : ''}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Section>
        </div>
      )}

      {!loading && tab === 'parts' && (
        <div className="space-y-5">
          <Section title="Parts Ordered - Not Yet Received">
            {pendingParts.length === 0 ? (
              <p className="text-sm text-green-600 text-center py-4">All parts have been received</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b text-xs uppercase">
                      <th className="pb-2 pr-3">Part</th>
                      <th className="pb-2 pr-3">Part #</th>
                      <th className="pb-2 pr-3">Supplier</th>
                      <th className="pb-2 pr-3">Work Order</th>
                      <th className="pb-2 pr-3">Customer</th>
                      <th className="pb-2 pr-3">Equipment</th>
                      <th className="pb-2 pr-3 text-right">Qty</th>
                      <th className="pb-2 pr-3">Ordered</th>
                      <th className="pb-2 text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingParts.map(row => (
                      <tr key={String(row.id)} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-1.5 pr-3 font-medium">{String(row.name)}</td>
                        <td className="py-1.5 pr-3 text-gray-500 text-xs font-mono">{String(row.part_number || '-')}</td>
                        <td className="py-1.5 pr-3 text-gray-500 text-xs">{String(row.supplier || '-')}</td>
                        <td className="py-1.5 pr-3">
                          <Link href={'/work-orders/' + row.work_order_id} className="text-blue-600 hover:underline font-mono text-xs">
                            {String(row.order_number)}
                          </Link>
                        </td>
                        <td className="py-1.5 pr-3 text-gray-600 text-xs">{String(row.customer_name || '-')}</td>
                        <td className="py-1.5 pr-3 text-gray-500 text-xs">{String(row.equipment_type || '')} {String(row.make || '')} {String(row.model || '')}</td>
                        <td className="py-1.5 pr-3 text-right">{String(row.quantity)}</td>
                        <td className="py-1.5 pr-3 text-gray-500 text-xs">{fmtDate(row.date_ordered)}</td>
                        <td className="py-1.5 text-right text-red-500">{fmt(Number(row.cost) * Number(row.quantity))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-semibold">
                      <td colSpan={8} className="pt-2 text-gray-600">{pendingParts.length} item{pendingParts.length !== 1 ? 's' : ''} pending</td>
                      <td className="pt-2 text-right text-red-600">
                        {fmt(pendingParts.reduce((s, r) => s + Number(r.cost || 0) * Number(r.quantity || 0), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Section>

          {/* Parts Profit Report */}
          <Section title={'Parts Report - ' + fromDate + ' to ' + toDate}>
            {partsReport.length === 0 ? <Empty /> : (() => {
              const totalCost = partsReport.reduce((s, r) => s + (Number(r.parts_cost) || 0), 0)
              const totalCharged = partsReport.reduce((s, r) => s + (Number(r.parts_charged) || 0), 0)
              const totalProfit = totalCharged - totalCost
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b text-xs uppercase">
                        <th className="pb-2 pr-3">WO#</th>
                        <th className="pb-2 pr-3">Date In</th>
                        <th className="pb-2 pr-3">Customer</th>
                        <th className="pb-2 pr-3">Equipment</th>
                        <th className="pb-2 pr-3">Part(s)</th>
                        <th className="pb-2 pr-3 text-right">WW Paid</th>
                        <th className="pb-2 pr-3 text-right">Charged to Customer</th>
                        <th className="pb-2 text-right text-green-700">Parts Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partsReport.map(row => {
                        const cost = Number(row.parts_cost) || 0
                        const charged = Number(row.parts_charged) || 0
                        const profit = charged - cost
                        return (
                          <tr key={String(row.id)} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="py-1.5 pr-3">
                              <Link href={'/work-orders/' + row.id} className="text-blue-600 hover:underline font-mono text-xs">
                                {String(row.order_number)}
                              </Link>
                            </td>
                            <td className="py-1.5 pr-3 text-gray-500 text-xs">{fmtDate(row.date_in)}</td>
                            <td className="py-1.5 pr-3 whitespace-nowrap">{String(row.customer_name || '-')}</td>
                            <td className="py-1.5 pr-3 text-gray-500 text-xs whitespace-nowrap">{String(row.equipment_type || '')} {String(row.make || '')} {String(row.model || '')}</td>
                            <td className="py-1.5 pr-3 text-xs text-gray-600">{String(row.part_names || '-')}</td>
                            <td className="py-1.5 pr-3 text-right text-red-500">{fmt(cost)}</td>
                            <td className="py-1.5 pr-3 text-right">{fmt(charged)}</td>
                            <td className="py-1.5 text-right font-medium text-green-700">{fmt(profit)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 font-semibold">
                        <td colSpan={5} className="pt-2 text-gray-600">{partsReport.length} work order{partsReport.length !== 1 ? 's' : ''} with parts</td>
                        <td className="pt-2 text-right text-red-600">{fmt(totalCost)}</td>
                        <td className="pt-2 text-right">{fmt(totalCharged)}</td>
                        <td className="pt-2 text-right text-green-700">{fmt(totalProfit)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )
            })()}
          </Section>

          {/* Revenue vs Parts Cost */}
          <Section title="Revenue vs Parts Cost (Monthly)">
            {revenue.length === 0 ? <Empty /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b text-xs uppercase">
                      <th className="pb-2 pr-3">Month</th>
                      <th className="pb-2 pr-3 text-right">Jobs</th>
                      <th className="pb-2 pr-3 text-right">Revenue</th>
                      <th className="pb-2 pr-3 text-right">Parts Cost</th>
                      <th className="pb-2 text-right">Gross Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenue.map(row => {
                      const rev = Number(row.revenue) || 0
                      const cost = Number(row.parts_cost) || 0
                      const margin = rev - cost
                      return (
                        <tr key={String(row.month)} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-1.5 pr-3 font-medium">{String(row.month)}</td>
                          <td className="py-1.5 pr-3 text-right text-gray-500">{String(row.job_count)}</td>
                          <td className="py-1.5 pr-3 text-right">{fmt(rev)}</td>
                          <td className="py-1.5 pr-3 text-right text-red-500">{fmt(cost)}</td>
                          <td className="py-1.5 text-right font-medium text-green-700">{fmt(margin)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>
      )}

      {!loading && tab === 'admin' && (
        <div className="space-y-5">
          <Section title="Equipment Not in the Shop? - Unpaid and Not Texted Since Thursday" subtitle={'Still unpaid, ready before ' + (thursdayCheck.cutoff || 'last Thursday') + ', and no pickup-reminder text logged since then. Because you only skip the Thursday text when the equipment is not there (or there is no phone number), these are probably picked up with no payment recorded. Check each one, then mark it or enter the payment. Equipment that is still here after ' + ABANDON_AFTER_DAYS + '+ days can be marked Abandoned.'}>
            {(() => {
              const withPhone = thursdayCheck.rows.filter(r => r.has_phone)
              const noPhone = thursdayCheck.rows.filter(r => !r.has_phone)
              const renderRow = (row: Record<string, unknown>, canMark: boolean) => {
                const daysReady = daysOpen(row.referral_dropoff_date || row.date_complete || row.date_in)
                const canAbandon = daysReady !== null && daysReady >= ABANDON_AFTER_DAYS
                const isRef = row.customer_source === 'referral'
                const charged = Number(row.amount_charged) || 0
                const paid = Number(row.amount_paid) || 0
                const readyDate = row.referral_dropoff_date || row.date_complete || row.date_in
                return (
                  <tr key={String(row.id)} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-1.5 pr-3">
                      <Link href={'/work-orders/' + row.id} className="text-blue-600 hover:underline font-mono text-xs">
                        {String(row.order_number)}
                      </Link>
                    </td>
                    <td className="py-1.5 pr-3">{String(row.customer_name || '-')}</td>
                    <td className="py-1.5 pr-3">
                      {isRef
                        ? <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{String(row.referral_shop || 'Referral')}</span>
                        : <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">Direct</span>}
                    </td>
                    <td className="py-1.5 pr-3 text-gray-500 text-xs whitespace-nowrap">{String(row.equipment_type || '')} {String(row.make || '')} {String(row.model || '')}</td>
                    <td className="py-1.5 pr-3 text-xs">{statusLabel(row.status)}</td>
                    <td className="py-1.5 pr-3 text-gray-500 text-xs whitespace-nowrap">
                      {fmtDate(readyDate)}
                      {daysReady !== null && <span className={'ml-1 ' + (canAbandon ? 'text-red-600 font-medium' : 'text-gray-400')}>({daysReady}d)</span>}
                    </td>
                    <td className="py-1.5 pr-3 text-xs">
                      {row.last_text_at
                        ? <span className="text-gray-500">{fmtDate(row.last_text_at)}</span>
                        : <span className="text-red-500 font-medium">Never texted</span>}
                    </td>
                    <td className="py-1.5 pr-3 text-right font-semibold text-orange-600">
                      {charged > 0 ? fmt(charged - paid) : <span className="text-gray-400 text-xs">not invoiced</span>}
                    </td>
                    <td className="py-1.5 text-right whitespace-nowrap print:hidden">
                      <div className="flex gap-1.5 justify-end">
                        {canMark && (
                          <button
                            onClick={async () => {
                              if (!confirm('Mark ' + String(row.order_number) + ' as Picked Up - No Payment Recorded? Use Undo on the work order if this was a mistake.')) return
                              const ok = await markNoPaymentRecorded(String(row.id), 'Not in shop at Thursday check (no text since ' + thursdayCheck.cutoff + ')')
                              if (ok) load()
                            }}
                            className="text-xs bg-amber-100 text-amber-800 border border-amber-300 px-2 py-1 rounded hover:bg-amber-200">
                            Picked up - no payment
                          </button>
                        )}
                        {canAbandon && (
                          <button
                            onClick={async () => {
                              if (!confirm('Mark ' + String(row.order_number) + ' as Abandoned? The equipment becomes WW property and is added to Shop Equipment. Only do this if the equipment is still in the shop.')) return
                              const ok = await markAbandonedFromReport(row)
                              if (ok) load()
                              else alert('Something went wrong marking this abandoned - open the work order and try Mark as WW Property.')
                            }}
                            className="text-xs bg-red-100 text-red-700 border border-red-200 px-2 py-1 rounded hover:bg-red-200">
                            Abandoned
                          </button>
                        )}
                        {!canMark && !canAbandon && <span className="text-gray-400 text-xs">open WO to check</span>}
                      </div>
                    </td>
                  </tr>
                )
              }
              const head = (
                <thead>
                  <tr className="text-left text-gray-500 border-b text-xs uppercase">
                    <th className="pb-2 pr-3">WO#</th>
                    <th className="pb-2 pr-3">Customer</th>
                    <th className="pb-2 pr-3">Type</th>
                    <th className="pb-2 pr-3">Equipment</th>
                    <th className="pb-2 pr-3">Status</th>
                    <th className="pb-2 pr-3">Ready Since</th>
                    <th className="pb-2 pr-3">Last Text</th>
                    <th className="pb-2 pr-3 text-right">Balance</th>
                    <th className="pb-2 text-right print:hidden">Action</th>
                  </tr>
                </thead>
              )
              return (
                <div className="space-y-4">
                  {withPhone.length === 0 ? (
                    <p className="text-sm text-green-600 text-center py-4">Everything unpaid with a phone number was texted since {thursdayCheck.cutoff || 'last Thursday'} - nothing to check</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        {head}
                        <tbody>{withPhone.map(r => renderRow(r, true))}</tbody>
                        <tfoot>
                          <tr className="border-t-2 font-semibold">
                            <td colSpan={7} className="pt-2 text-gray-600">{withPhone.length} work order{withPhone.length !== 1 ? 's' : ''} to check</td>
                            <td className="pt-2 pr-3 text-right text-orange-600">
                              {fmt(withPhone.reduce((s, r) => s + (Number(r.amount_charged) || 0) - (Number(r.amount_paid) || 0), 0))}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                  {noPhone.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">No phone number on file ({noPhone.length}) - you could not have texted these, so the missing text does not tell us anything. Check them by hand.</p>
                      <div className="overflow-x-auto opacity-80">
                        <table className="w-full text-sm">
                          {head}
                          <tbody>{noPhone.map(r => renderRow(r, false))}</tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
          </Section>

          <Section title="Newly Ready - Not Texted Yet" subtitle="Unpaid work orders that became ready (or went to the referral shop) since last Thursday and haven't had a pickup text yet. These are the ones to text on your next Thursday round. Older unpaid jobs are in the report above.">
            {needsReminder.length === 0 ? (
              <p className="text-sm text-green-600 text-center py-4">Everything newly ready has been texted - nothing to send</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b text-xs uppercase">
                      <th className="pb-2 pr-3">WO#</th>
                      <th className="pb-2 pr-3">Customer</th>
                      <th className="pb-2 pr-3">Phone</th>
                      <th className="pb-2 pr-3">Type</th>
                      <th className="pb-2 pr-3">Equipment</th>
                      <th className="pb-2 pr-3">Ready Since</th>
                      <th className="pb-2 pr-3">Last Text</th>
                      <th className="pb-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {needsReminder.map(row => {
                      const isRef = row.customer_source === 'referral'
                      const charged = Number(row.amount_charged) || 0
                      const paid = Number(row.amount_paid) || 0
                      return (
                        <tr key={String(row.id)} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-1.5 pr-3">
                            <Link href={'/work-orders/' + row.id} className="text-blue-600 hover:underline font-mono text-xs">
                              {String(row.order_number)}
                            </Link>
                          </td>
                          <td className="py-1.5 pr-3">{String(row.customer_name || '-')}</td>
                          <td className="py-1.5 pr-3">
                            {row.customer_phone ? (
                              <a href={'tel:' + String(row.customer_phone).replace(/[^0-9+]/g, '')} className="text-orange-600 hover:underline text-xs">
                                {String(row.customer_phone)}
                              </a>
                            ) : <span className="text-gray-400 text-xs">-</span>}
                          </td>
                          <td className="py-1.5 pr-3">
                            {isRef
                              ? <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{String(row.referral_shop || 'Referral')}</span>
                              : <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">Direct</span>}
                          </td>
                          <td className="py-1.5 pr-3 text-gray-500 text-xs whitespace-nowrap">{String(row.equipment_type || '')} {String(row.make || '')} {String(row.model || '')}</td>
                          <td className="py-1.5 pr-3 text-gray-500 text-xs">{fmtDate(row.referral_dropoff_date || row.date_complete || row.date_in)}</td>
                          <td className="py-1.5 pr-3 text-xs">
                            {row.last_text_at
                              ? <span className="text-gray-500">{fmtDate(row.last_text_at)}</span>
                              : <span className="text-red-500 font-medium">Never texted</span>}
                          </td>
                          <td className="py-1.5 text-right font-semibold text-orange-600">
                            {charged > 0
                              ? fmt(charged - paid)
                              : <span className="text-gray-400 text-xs">not invoiced</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-semibold">
                      <td colSpan={7} className="pt-2 text-gray-600">{needsReminder.length} work order{needsReminder.length !== 1 ? 's' : ''} to text</td>
                      <td className="pt-2 text-right text-orange-600">
                        {fmt(needsReminder.reduce((s, r) => s + (Number(r.amount_charged) || 0) - (Number(r.amount_paid) || 0), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Section>

          <Section title="Completed Jobs With No Invoice Amount" subtitle="Finished jobs where the invoice total was never entered, which leaves reports and receipts guessing. Filling copies in the shop payment or amount already paid if there is one, otherwise the labor + parts estimate. No Charge, donated, abandoned, denied-service and no-payment-recorded jobs are skipped. You can undo the last fill.">
            {invoiceFill.rows.length === 0 ? (
              <p className="text-sm text-green-600 text-center py-4">Every finished job has an invoice amount</p>
            ) : (
              <div className="space-y-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b text-xs uppercase">
                        <th className="pb-2 pr-3">WO#</th>
                        <th className="pb-2 pr-3">Customer</th>
                        <th className="pb-2 pr-3">Type</th>
                        <th className="pb-2 pr-3">Status</th>
                        <th className="pb-2 pr-3 text-right">Estimate</th>
                        <th className="pb-2 pr-3 text-right">Paid</th>
                        <th className="pb-2 pr-3 text-right">Would Fill With</th>
                        <th className="pb-2">Based On</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceFill.rows.map(row => (
                        <tr key={String(row.id)} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-1.5 pr-3">
                            <Link href={'/work-orders/' + row.id} className="text-blue-600 hover:underline font-mono text-xs">{String(row.order_number)}</Link>
                          </td>
                          <td className="py-1.5 pr-3">{String(row.customer_name || '-')}</td>
                          <td className="py-1.5 pr-3 text-xs">{row.customer_source === 'referral' ? 'Referral' : 'Direct'}</td>
                          <td className="py-1.5 pr-3 text-xs">{statusLabel(row.status)}</td>
                          <td className="py-1.5 pr-3 text-right text-gray-500">{fmt(row.estimate)}</td>
                          <td className="py-1.5 pr-3 text-right text-green-600">{Number(row.amount_paid) > 0 ? fmt(row.amount_paid) : '-'}</td>
                          <td className="py-1.5 pr-3 text-right font-semibold">{fmt(row.proposed)}</td>
                          <td className="py-1.5 text-xs text-gray-500">{String(row.based_on)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 font-semibold">
                        <td colSpan={6} className="pt-2 text-gray-600">{invoiceFill.rows.length} job{invoiceFill.rows.length !== 1 ? 's' : ''}</td>
                        <td className="pt-2 pr-3 text-right">{fmt(invoiceFill.rows.reduce((t, r) => t + (Number(r.proposed) || 0), 0))}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="flex items-center gap-3 print:hidden">
                  <button
                    onClick={async () => {
                      if (!confirm('Fill the invoice amount on ' + invoiceFill.rows.length + ' work order(s) as shown? You can undo this afterwards.')) return
                      const res = await fetch('/api/admin/invoice-backfill', { method: 'POST' })
                      const data = await res.json()
                      if (!res.ok) alert('Something went wrong: ' + (data.error || 'unknown error'))
                      else alert('Filled ' + data.updated + ' invoice amount(s).')
                      load()
                    }}
                    className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-600">
                    Fill {invoiceFill.rows.length} invoice{invoiceFill.rows.length !== 1 ? 's' : ''}
                  </button>
                </div>
              </div>
            )}
            {invoiceFill.backupCount > 0 && (
              <div className="mt-3 pt-3 border-t flex items-center gap-3 flex-wrap print:hidden">
                <span className="text-xs text-gray-500">{invoiceFill.backupCount} invoice amount{invoiceFill.backupCount !== 1 ? 's were' : ' was'} filled in earlier.</span>
                <button
                  onClick={async () => {
                    if (!confirm('Undo the earlier fill? Invoices you changed since then are left alone.')) return
                    const res = await fetch('/api/admin/invoice-backfill', { method: 'DELETE' })
                    const data = await res.json()
                    if (!res.ok) alert('Something went wrong: ' + (data.error || 'unknown error'))
                    else alert('Restored ' + data.restored + ' invoice(s) to empty.')
                    load()
                  }}
                  className="text-xs bg-white text-gray-700 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50">
                  Undo last fill
                </button>
              </div>
            )}
          </Section>

          <Section title="Denied Service - Diagnostic Fee Only" subtitle="Work orders where the customer declined the recommended repair but still owes a diagnostic fee for the evaluation">
            {deniedService.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No denied-service jobs on record</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b text-xs uppercase">
                      <th className="pb-2 pr-3">WO#</th>
                      <th className="pb-2 pr-3">Customer</th>
                      <th className="pb-2 pr-3">Phone</th>
                      <th className="pb-2 pr-3">Equipment</th>
                      <th className="pb-2 pr-3">Technician</th>
                      <th className="pb-2 pr-3">Date In</th>
                      <th className="pb-2 pr-3 text-right">Fee Charged</th>
                      <th className="pb-2 pr-3 text-right">Paid</th>
                      <th className="pb-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deniedService.map(row => {
                      const charged = Number(row.amount_charged) || 0
                      const paid = Number(row.amount_paid) || 0
                      return (
                        <tr key={String(row.id)} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-1.5 pr-3">
                            <Link href={'/work-orders/' + row.id} className="text-blue-600 hover:underline font-mono text-xs">
                              {String(row.order_number)}
                            </Link>
                          </td>
                          <td className="py-1.5 pr-3">{String(row.customer_name || '-')}</td>
                          <td className="py-1.5 pr-3">
                            {row.customer_phone ? (
                              <a href={'tel:' + String(row.customer_phone).replace(/[^0-9+]/g, '')} className="text-orange-600 hover:underline text-xs">
                                {String(row.customer_phone)}
                              </a>
                            ) : <span className="text-gray-400 text-xs">-</span>}
                          </td>
                          <td className="py-1.5 pr-3 text-gray-500 text-xs whitespace-nowrap">{String(row.equipment_type || '')} {String(row.make || '')} {String(row.model || '')}</td>
                          <td className="py-1.5 pr-3">
                            <span className={'text-xs px-2 py-0.5 rounded font-medium ' + (row.technician === 'Wade' ? 'bg-orange-100 text-orange-700' : row.technician === 'Wayne' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600')}>
                              {String(row.technician || 'Unassigned')}
                            </span>
                          </td>
                          <td className="py-1.5 pr-3 text-gray-500 text-xs">{fmtDate(row.date_in)}</td>
                          <td className="py-1.5 pr-3 text-right">{charged > 0 ? fmt(charged) : <span className="text-gray-400 text-xs">not invoiced</span>}</td>
                          <td className="py-1.5 pr-3 text-right text-green-600">{paid > 0 ? fmt(paid) : '-'}</td>
                          <td className="py-1.5 text-right font-semibold text-orange-600">
                            {charged > 0 ? fmt(charged - paid) : <span className="text-gray-400 text-xs">-</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-semibold">
                      <td colSpan={6} className="pt-2 text-gray-600">{deniedService.length} denied-service job{deniedService.length !== 1 ? 's' : ''}</td>
                      <td className="pt-2 text-right">{fmt(deniedService.reduce((s, r) => s + (Number(r.amount_charged) || 0), 0))}</td>
                      <td className="pt-2 text-right text-green-600">{fmt(deniedService.reduce((s, r) => s + (Number(r.amount_paid) || 0), 0))}</td>
                      <td className="pt-2 text-right text-orange-600">
                        {fmt(deniedService.reduce((s, r) => s + (Number(r.amount_charged) || 0) - (Number(r.amount_paid) || 0), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  )
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Loading...</div>}>
      <ReportsPageInner />
    </Suspense>
  )
}
