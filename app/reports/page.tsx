'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

const PRINT_STYLES = '@media print { nav { display: none !important; } .print\\:hidden { display: none !important; } body { background: white !important; } }'

type ReportTab = 'financial' | 'referral' | 'workorders' | 'parts'

function fmt(n: unknown) {
  return '$' + Number(n || 0).toFixed(2)
}
function fmtDate(d: unknown) {
  if (!d) return '-'
  return String(d).slice(0, 10)
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow p-4 space-y-3">
      <h2 className="font-semibold text-gray-800 text-base">{title}</h2>
      {children}
    </div>
  )
}

function Empty() {
  return <p className="text-sm text-gray-400 italic py-4 text-center">No records found</p>
}

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>('financial')

  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = today.slice(0, 8) + '01'

  const [fromDate, setFromDate] = useState(firstOfMonth)
  const [toDate, setToDate] = useState(today)

  const [payouts, setPayouts] = useState<Record<string, unknown>[]>([])
  const [outstanding, setOutstanding] = useState<Record<string, unknown>[]>([])
  const [revenue, setRevenue] = useState<Record<string, unknown>[]>([])
  const [atShop, setAtShop] = useState<Record<string, unknown>[]>([])
  const [refHistory, setRefHistory] = useState<Record<string, unknown>[]>([])
  const [tripDate, setTripDate] = useState(new Date().toISOString().slice(0, 10))
  const [tripData, setTripData] = useState<{ thisTrip: Record<string, unknown>[]; outstanding: Record<string, unknown>[]; tripDate: string } | null>(null)
  const [tripLoading, setTripLoading] = useState(false)
  const [completed, setCompleted] = useState<Record<string, unknown>[]>([])
  const [pendingParts, setPendingParts] = useState<Record<string, unknown>[]>([])
  const [partsReport, setPartsReport] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)

  function printTrip() {
    if (!tripData) return
    const fmtD = (d: unknown) => d ? String(d).slice(0, 10) : '-'
    const fmtM = (n: unknown) => '$' + (Number(n) || 0).toFixed(2)
    const rows1 = tripData.thisTrip.map(r => {
      const inv = Number(r.amount_charged) || 0
      const owes = (Number(r.labor_hours) || 0) * (Number(r.labor_rate) || 0) * 0.20
      return '<tr><td>' + String(r.order_number) + '</td><td>' + String(r.customer_name || '') + '</td><td>' + String(r.equipment_type || '') + ' ' + String(r.make || '') + ' ' + String(r.model || '') + '</td><td>' + String(r.complaint || r.work_done || '') + '</td><td class="right">' + (inv > 0 ? fmtM(inv) : '-') + '</td><td class="right orange">' + (owes > 0 ? fmtM(owes) : '-') + '</td></tr>'
    }).join('')
    const rows2 = tripData.outstanding.map(r => {
      const inv = Number(r.amount_charged) || 0
      const owes = (Number(r.labor_hours) || 0) * (Number(r.labor_rate) || 0) * 0.20
      return '<tr><td>' + String(r.order_number) + '</td><td>' + String(r.customer_name || '') + '</td><td>' + String(r.equipment_type || '') + ' ' + String(r.make || '') + ' ' + String(r.model || '') + '</td><td>' + fmtD(r.referral_dropoff_date) + '</td><td>' + String(r.complaint || r.work_done || '') + '</td><td class="right">' + (inv > 0 ? fmtM(inv) : '-') + '</td><td class="right orange">' + (owes > 0 ? fmtM(owes) : '-') + '</td></tr>'
    }).join('')
    const calcInv = (r: Record<string,unknown>) => { const sa = Number(r.shop_payment_amount)||0; return sa > 0 ? sa : (Number(r.amount_charged)||0) }
    const calcOwes = (r: Record<string,unknown>) => { return (Number(r.labor_hours)||0) * (Number(r.labor_rate)||0) * 0.20 }
    const tot1 = tripData.thisTrip.reduce((s, r) => s + calcOwes(r), 0)
    const tot2 = tripData.outstanding.reduce((s, r) => s + calcOwes(r), 0)
    const invTot1 = tripData.thisTrip.reduce((s, r) => s + calcInv(r), 0)
    const invTot2 = tripData.outstanding.reduce((s, r) => s + calcInv(r), 0)
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write('<html><head><title>Trip Sheet - ' + tripData.tripDate + '</title><style>body{font-family:Arial,sans-serif;padding:20px;font-size:12px}h1{font-size:18px;margin-bottom:4px}h2{font-size:14px;margin:16px 0 6px;border-bottom:1px solid #ccc;padding-bottom:4px}table{width:100%;border-collapse:collapse;margin-bottom:8px;table-layout:fixed}th{text-align:left;border-bottom:2px solid #333;padding:4px 6px 4px 0;font-size:11px;text-transform:uppercase;overflow:hidden}td{padding:4px 6px 4px 0;border-bottom:1px solid #eee;vertical-align:top;overflow:hidden;word-break:break-word}tfoot td{border-top:2px solid #333;font-weight:bold;padding-top:6px}.right{text-align:right}.orange{color:#c2410c}@media print{button{display:none}}</style></head><body>')
    w.document.write('<h1>WW Small Engine - Shop Trip Sheet</h1>')
    w.document.write('<p>Referral Shop: Seguin Small Engine &nbsp;&nbsp; Date: ' + tripData.tripDate + '</p>')
    w.document.write('<button onclick="window.print()" style="background:#f97316;color:white;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;margin-bottom:12px">Print</button>')
    w.document.write('<h2>Dropping Off Today (' + tripData.thisTrip.length + ' items)</h2>')
    w.document.write('<table><thead><tr><th>WO#</th><th>Customer</th><th>Equipment</th><th>Work Done / Notes</th><th class="right">Invoice</th><th class="right orange">WW Owes Shop</th></tr></thead><tbody>' + rows1 + '</tbody><tfoot><tr><td colspan="5" class="right">Total WW Owes (Today)</td><td class="right orange">$' + tot1.toFixed(2) + '</td></tr></tfoot></table>')
    w.document.write('<h2>Previously Returned - Awaiting Shop Payment (' + tripData.outstanding.length + ' items)</h2>')
    w.document.write('<table><thead><tr><th>WO#</th><th>Customer</th><th>Equipment</th><th>Returned</th><th>Notes</th><th class="right">Invoice</th><th class="right orange">WW Owes Shop</th></tr></thead><tbody>' + rows2 + '</tbody><tfoot><tr><td colspan="6" class="right">Total Outstanding</td><td class="right orange">$' + tot2.toFixed(2) + '</td></tr></tfoot></table>')
    w.document.write('<p style="margin-top:20px;font-size:11px;color:#666">Combined WW Owes: $' + (tot1 + tot2).toFixed(2) + '</p>')
    w.document.write('</body></html>')
    w.document.close()
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
    if (tab === 'financial') {
      const [p, o] = await Promise.all([
        fetch(base + 'type=payouts&from=' + fromDate + '&to=' + toDate).then(x => x.json()),
        fetch(base + 'type=outstanding').then(x => x.json()),
      ])
      setPayouts(Array.isArray(p) ? p : [])
      setOutstanding(Array.isArray(o) ? o : [])
    }
    if (tab === 'referral') {
      const [a, h] = await Promise.all([
        fetch(base + 'type=referral-at-shop').then(x => x.json()),
        fetch(base + 'type=referral-history').then(x => x.json()),
      ])
      setAtShop(Array.isArray(a) ? a : [])
      setRefHistory(Array.isArray(h) ? h : [])
    }
    if (tab === 'workorders') {
      const c = await fetch(base + 'type=completed&from=' + fromDate + '&to=' + toDate).then(x => x.json())
      setCompleted(Array.isArray(c) ? c : [])
    }
    if (tab === 'parts') {
      const [pp, r, pr] = await Promise.all([
        fetch(base + 'type=parts-pending').then(x => x.json()),
        fetch(base + 'type=revenue').then(x => x.json()),
        fetch(base + 'type=parts-report&from=' + fromDate + '&to=' + toDate).then(x => x.json()),
      ])
      setPendingParts(Array.isArray(pp) ? pp : [])
      setRevenue(Array.isArray(r) ? r : [])
      setPartsReport(Array.isArray(pr) ? pr : [])
    }
    setLoading(false)
  }, [tab, fromDate, toDate])

  useEffect(() => { load() }, [load])

  const TABS: { id: ReportTab; label: string }[] = [
    { id: 'financial',  label: 'Financial' },
    { id: 'referral',   label: 'Referral Shop' },
    { id: 'workorders', label: 'Work Orders' },
    { id: 'parts',      label: 'Parts' },
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

      {/* Print-only header */}
      <div className="hidden print:block mb-4 pb-3 border-b">
        <div className="text-xl font-bold text-gray-900">WW Small Engine - Reports</div>
        <div className="text-sm text-gray-500 mt-1">
          {tab === 'financial' && 'Financial Reports - ' + fromDate + ' to ' + toDate}
          {tab === 'referral' && 'Referral Shop Reports'}
          {tab === 'workorders' && 'Completed Work Orders - ' + fromDate + ' to ' + toDate}
          {tab === 'parts' && 'Pending Parts Report'}
        </div>
      </div>

      {!loading && tab === 'financial' && (
        <div className="space-y-5">

          {/* Payout Summary */}
          <Section title={'Payout Summary - ' + fromDate + ' to ' + toDate}>
            {payouts.length === 0 ? <Empty /> : (() => {
              const inHouse = payouts.filter(r => r.customer_source !== 'referral')
              const referral = payouts.filter(r => r.customer_source === 'referral')
              let ihWade = 0, ihWayne = 0, ihRev = 0
              let refWade = 0, refWayne = 0, refRev = 0, refCutTotal = 0

              const calcRow = (row: Record<string, unknown>, isRef: boolean) => {
                const partsCharged = Number(row.parts_charged) || 0
                const amtCharged = Number(row.amount_charged) || 0
                const shopAmt = Number(row.shop_payment_amount) || 0
                const laborEst = (Number(row.labor_hours) || 0) * (Number(row.labor_rate) || 80)
                const invoice = isRef
                  ? (shopAmt > 0 ? shopAmt : amtCharged > 0 ? amtCharged : laborEst + partsCharged)
                  : (amtCharged > 0 ? amtCharged : laborEst + partsCharged)
                const isEst = isRef ? shopAmt === 0 : amtCharged === 0
                const afterParts = invoice - partsCharged
                const refCut = isRef && afterParts > 0 ? afterParts * 0.20 : 0
                const net = afterParts - refCut
                const wade = net * 0.60
                const wayne = net * 0.40
                return { invoice, partsCharged, afterParts, refCut, net, wade, wayne, isEst }
              }

              const tbl = (rows: Record<string, unknown>[], isRef: boolean) => (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b text-xs uppercase">
                        <th className="pb-2 pr-3">WO#</th>
                        <th className="pb-2 pr-3">Customer</th>
                        <th className="pb-2 pr-3">Date</th>
                        {isRef && <th className="pb-2 pr-3">Shop</th>}
                        <th className="pb-2 pr-3 text-right">Revenue</th>
                        <th className="pb-2 pr-3 text-right">Parts Chg</th>
                        {isRef && <th className="pb-2 pr-3 text-right">Shop 20%</th>}
                        <th className="pb-2 pr-3 text-right">Net Split</th>
                        <th className="pb-2 pr-3 text-right text-orange-600">Wade</th>
                        <th className="pb-2 text-right text-blue-600">Wayne</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(row => {
                        const c = calcRow(row, isRef)
                        if (isRef) { refRev += c.invoice; refCutTotal += c.refCut; refWade += c.wade; refWayne += c.wayne }
                        else { ihRev += c.invoice; ihWade += c.wade; ihWayne += c.wayne }
                        return (
                          <tr key={String(row.id)} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="py-1.5 pr-3">
                              <Link href={'/work-orders/' + row.id} className="text-blue-600 hover:underline font-mono text-xs">
                                {String(row.order_number)}
                              </Link>
                            </td>
                            <td className="py-1.5 pr-3 whitespace-nowrap">{String(row.customer_name || '-')}</td>
                            <td className="py-1.5 pr-3 text-gray-500 text-xs">{fmtDate(row.date_complete)}</td>
                            {isRef && <td className="py-1.5 pr-3 text-gray-500 text-xs whitespace-nowrap">{String(row.referral_shop || '-')}</td>}
                            <td className="py-1.5 pr-3 text-right">
                              {fmt(c.invoice)}{c.isEst && <span className="text-gray-400 text-xs ml-1">*</span>}
                            </td>
                            <td className="py-1.5 pr-3 text-right text-gray-500">{c.partsCharged > 0 ? fmt(c.partsCharged) : '-'}</td>
                            {isRef && <td className="py-1.5 pr-3 text-right text-orange-500">{fmt(c.refCut)}</td>}
                            <td className="py-1.5 pr-3 text-right">{fmt(c.net)}</td>
                            <td className="py-1.5 pr-3 text-right text-orange-600 font-medium">{fmt(c.wade)}</td>
                            <td className="py-1.5 text-right text-blue-600 font-medium">{fmt(c.wayne)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )

              return (
                <div className="space-y-5">
                  {inHouse.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">In-House Jobs</h3>
                      {tbl(inHouse, false)}
                      <div className="flex justify-end gap-8 mt-2 pt-2 border-t text-sm">
                        <span className="text-gray-500">Subtotal</span>
                        <span className="text-orange-600 font-semibold w-20 text-right">Wade {fmt(ihWade)}</span>
                        <span className="text-blue-600 font-semibold w-20 text-right">Wayne {fmt(ihWayne)}</span>
                      </div>
                    </div>
                  )}
                  {referral.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Referral Jobs</h3>
                      {tbl(referral, true)}
                      <div className="flex justify-end gap-8 mt-2 pt-2 border-t text-sm">
                        <span className="text-gray-500">Subtotal</span>
                        <span className="text-gray-500 font-semibold w-28 text-right">Shop 20% {fmt(refCutTotal)}</span>
                        <span className="text-orange-600 font-semibold w-20 text-right">Wade {fmt(refWade)}</span>
                        <span className="text-blue-600 font-semibold w-20 text-right">Wayne {fmt(refWayne)}</span>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-3 mt-2 pt-3 border-t-2">
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <div className="text-xs text-gray-500 mb-1">Total Revenue</div>
                      <div className="font-bold text-gray-800">{fmt(ihRev + refRev)}</div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-3 text-center">
                      <div className="text-xs text-orange-600 mb-1">Wade Total</div>
                      <div className="font-bold text-orange-600">{fmt(ihWade + refWade)}</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                      <div className="text-xs text-blue-600 mb-1">Wayne Total</div>
                      <div className="font-bold text-blue-600">{fmt(ihWayne + refWayne)}</div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">* Revenue estimated from labor + parts (Shop Payment or Invoice Amount not yet entered)</p>
                </div>
              )
            })()}
          </Section>

          {/* Outstanding Invoices */}
          <Section title="Outstanding Invoices">
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
                      <td colSpan={5} className="pt-2 text-gray-600">Outstanding Balance</td>
                      <td colSpan={2} className="pt-2 text-right text-red-600">
                        {fmt(outstanding.reduce((s, r) => s + (Number(r.amount_charged) || 0) - (Number(r.amount_paid) || 0), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Section>

        </div>
      )}

      {!loading && tab === 'referral' && (
        <div className="space-y-5">

          {/* Trip Report */}
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

            {tripData && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">
                    Dropping Off Today
                    <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-normal">{tripData.thisTrip.length} items</span>
                  </h3>
                  {tripData.thisTrip.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">No drop-offs recorded for this date.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500 border-b text-xs uppercase">
                            <th className="pb-2 pr-3">WO#</th>
                            <th className="pb-2 pr-3">Customer</th>
                            <th className="pb-2 pr-3">Equipment</th>
                            <th className="pb-2 pr-3">Work Done / Notes</th>
                            <th className="pb-2 pr-3 text-right">Invoice</th>
                            <th className="pb-2 text-right text-orange-600">WW Owes Shop</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tripData.thisTrip.map(row => {
                            const shopAmt = Number(row.shop_payment_amount) || 0
                            const inv = shopAmt > 0 ? shopAmt : (Number(row.amount_charged) || 0)
                            const owes = (Number(row.labor_hours) || 0) * (Number(row.labor_rate) || 0) * 0.20
                            return (
                              <tr key={String(row.id)} className="border-b last:border-0 hover:bg-gray-50">
                                <td className="py-1.5 pr-3">
                                  <Link href={'/work-orders/' + row.id} className="text-blue-600 hover:underline font-mono text-xs">{String(row.order_number)}</Link>
                                </td>
                                <td className="py-1.5 pr-3 whitespace-nowrap">{String(row.customer_name || '-')}</td>
                                <td className="py-1.5 pr-3 text-gray-500 text-xs whitespace-nowrap">{String(row.equipment_type || '')} {String(row.make || '')} {String(row.model || '')}</td>
                                <td className="py-1.5 pr-3 text-gray-500 text-xs max-w-xs truncate">{String(row.work_done || row.complaint || '-')}</td>
                                <td className="py-1.5 pr-3 text-right">{inv > 0 ? fmt(inv) : '-'}</td>
                                <td className="py-1.5 text-right text-orange-600 font-medium">{owes > 0 ? fmt(owes) : '-'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 font-semibold">
                            <td colSpan={4}></td>
                            <td className="pt-2 text-right">
                              {fmt(tripData.thisTrip.reduce((s, r) => { const sa = Number(r.shop_payment_amount)||0; return s + (sa > 0 ? sa : (Number(r.amount_charged)||0)) }, 0))}
                            </td>
                            <td className="pt-2 text-right text-orange-600">
                              {fmt(tripData.thisTrip.reduce((s, r) => s + (Number(r.labor_hours)||0) * (Number(r.labor_rate)||0) * 0.20, 0))}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">
                    Previously Returned - Awaiting Shop Payment
                    <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-normal">{tripData.outstanding.length} items</span>
                  </h3>
                  {tripData.outstanding.length === 0 ? (
                    <p className="text-sm text-green-600 italic">All caught up - no outstanding items.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500 border-b text-xs uppercase">
                            <th className="pb-2 pr-3">WO#</th>
                            <th className="pb-2 pr-3">Customer</th>
                            <th className="pb-2 pr-3">Equipment</th>
                            <th className="pb-2 pr-3">Returned</th>
                            <th className="pb-2 pr-3">Notes</th>
                            <th className="pb-2 pr-3 text-right">Invoice</th>
                            <th className="pb-2 text-right text-orange-600">WW Owes Shop</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tripData.outstanding.map(row => {
                            const shopAmt = Number(row.shop_payment_amount) || 0
                            const inv = shopAmt > 0 ? shopAmt : (Number(row.amount_charged) || 0)
                            const owes = (Number(row.labor_hours) || 0) * (Number(row.labor_rate) || 0) * 0.20
                            return (
                              <tr key={String(row.id)} className="border-b last:border-0 hover:bg-gray-50">
                                <td className="py-1.5 pr-3">
                                  <Link href={'/work-orders/' + row.id} className="text-blue-600 hover:underline font-mono text-xs">{String(row.order_number)}</Link>
                                </td>
                                <td className="py-1.5 pr-3 whitespace-nowrap">{String(row.customer_name || '-')}</td>
                                <td className="py-1.5 pr-3 text-gray-500 text-xs whitespace-nowrap">{String(row.equipment_type || '')} {String(row.make || '')} {String(row.model || '')}</td>
                                <td className="py-1.5 pr-3 text-gray-500 text-xs">{fmtDate(row.referral_dropoff_date)}</td>
                                <td className="py-1.5 pr-3 text-gray-500 text-xs max-w-xs truncate">{String(row.work_done || row.complaint || '-')}</td>
                                <td className="py-1.5 pr-3 text-right">{inv > 0 ? fmt(inv) : '-'}</td>
                                <td className="py-1.5 text-right text-orange-600 font-medium">{owes > 0 ? fmt(owes) : '-'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 font-semibold">
                            <td colSpan={5}></td>
                            <td className="pt-2 text-right">
                              {fmt(tripData.outstanding.reduce((s, r) => { const sa = Number(r.shop_payment_amount)||0; return s + (sa > 0 ? sa : (Number(r.amount_charged)||0)) }, 0))}
                            </td>
                            <td className="pt-2 text-right text-orange-600">
                              {fmt(tripData.outstanding.reduce((s, r) => s + (Number(r.labor_hours)||0) * (Number(r.labor_rate)||0) * 0.20, 0))}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Section>

          {/* At the Shop */}
          <Section title="Currently at the Shop (Returned - Awaiting Payment)">
            {atShop.length === 0 ? (
              <p className="text-sm text-green-600 text-center py-4">All caught up - no outstanding items</p>
            ) : (
              <div className="space-y-3">
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
                      {atShop.map(row => {
                        const invoice = Number(row.amount_charged) || 0
                        const partsCharged = Number(row.parts_charged) || 0
                        const afterParts = invoice - partsCharged
                        const wwOwes = afterParts > 0 ? afterParts * 0.20 : 0
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
                        <td colSpan={5} className="pt-2 text-gray-600">Total WW Owes to Shop</td>
                        <td className="pt-2 text-right text-orange-600">
                          {fmt(atShop.reduce((s, row) => {
                            const invoice = Number(row.amount_charged) || 0
                            const partsCharged = Number(row.parts_charged) || 0
                            const afterParts = invoice - partsCharged
                            return s + (afterParts > 0 ? afterParts * 0.20 : 0)
                          }, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
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
                      const paidToShop = afterParts > 0 ? afterParts * 0.20 : 0
                      return (
                        <tr key={String(row.id)} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-1.5 pr-3">
                            <Link href={'/work-orders/' + row.id} className="text-blue-600 hover:underline font-mono text-xs">
                              {String(row.order_number)}
                            </Link>
                          </td>
                          <td className="py-1.5 pr-3 whitespace-nowrap">{String(row.customer_name || '-')}</td>
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
                      <td colSpan={7} className="pt-2 text-gray-600">Total Paid to Shop</td>
                      <td className="pt-2 text-right text-orange-600">
                        {fmt(refHistory.reduce((s, row) => {
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
                        <th className="pb-2 pr-3 text-right">Parts</th>
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
                            <td className="py-1.5 pr-3 text-right text-gray-500">{String(row.parts_count)}</td>
                            <td className="py-1.5 pr-3 text-right text-red-500">{fmt(cost)}</td>
                            <td className="py-1.5 pr-3 text-right">{fmt(charged)}</td>
                            <td className="py-1.5 text-right font-medium text-green-700">{fmt(profit)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 font-semibold">
                        <td colSpan={4} className="pt-2 text-gray-600">{partsReport.length} work order{partsReport.length !== 1 ? 's' : ''} with parts</td>
                        <td className="pt-2 text-right text-gray-500">{partsReport.reduce((s, r) => s + (Number(r.parts_count) || 0), 0)}</td>
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
    </div>
  )
}
