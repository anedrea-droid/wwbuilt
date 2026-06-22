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
  const [completed, setCompleted] = useState<Record<string, unknown>[]>([])
  const [pendingParts, setPendingParts] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const base = '/api/reports?'
    if (tab === 'financial') {
      const [p, o, r] = await Promise.all([
        fetch(base + 'type=payouts&from=' + fromDate + '&to=' + toDate).then(x => x.json()),
        fetch(base + 'type=outstanding').then(x => x.json()),
        fetch(base + 'type=revenue').then(x => x.json()),
      ])
      setPayouts(Array.isArray(p) ? p : [])
      setOutstanding(Array.isArray(o) ? o : [])
      setRevenue(Array.isArray(r) ? r : [])
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
      const pp = await fetch(base + 'type=parts-pending').then(x => x.json())
      setPendingParts(Array.isArray(pp) ? pp : [])
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

  const needsDates = tab === 'financial' || tab === 'workorders'

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
                      <th className="pb-2 pr-3">Equipment</th>
                      <th className="pb-2 pr-3">Date In</th>
                      <th className="pb-2 pr-3 text-right">Invoiced</th>
                      <th className="pb-2 pr-3 text-right">Paid</th>
                      <th className="pb-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outstanding.map(row => (
                      <tr key={String(row.id)} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-1.5 pr-3">
                          <Link href={'/work-orders/' + row.id} className="text-blue-600 hover:underline font-mono text-xs">
                            {String(row.order_number)}
                          </Link>
                        </td>
                        <td className="py-1.5 pr-3">{String(row.customer_name || '-')}</td>
                        <td className="py-1.5 pr-3 text-gray-500 text-xs">{String(row.equipment_type || '')} {String(row.make || '')} {String(row.model || '')}</td>
                        <td className="py-1.5 pr-3 text-gray-500 text-xs">{fmtDate(row.date_in)}</td>
                        <td className="py-1.5 pr-3 text-right font-medium">
                          {Number(row.amount_charged) > 0
                            ? fmt(row.amount_charged)
                            : <span className="text-gray-400 text-xs">not invoiced</span>}
                        </td>
                        <td className="py-1.5 pr-3 text-right text-red-500">{Number(row.amount_paid) > 0 ? fmt(row.amount_paid) : '-'}</td>
                        <td className="py-1.5 text-right font-semibold text-orange-600">
                          {Number(row.amount_charged) > 0
                            ? fmt(Number(row.amount_charged) - Number(row.amount_paid))
                            : <span className="text-gray-400 text-xs">-</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-semibold">
                      <td colSpan={4} className="pt-2 text-gray-600">Outstanding Balance</td>
                      <td colSpan={2} className="pt-2 text-right text-red-600">
                        {fmt(outstanding.reduce((s, r) => s + Number(r.amount_charged || 0) - Number(r.amount_paid || 0), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
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
                      <th className="pb-2 pr-3 text-right">Parts Chg</th>
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

      {!loading && tab === 'referral' && (
        <div className="space-y-5">

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
                        <th className="pb-2 pr-3 text-right">Parts Chg</th>
                        <th className="pb-2 text-right text-green-700">WW Owes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {atShop.map(row => {
                        const invoice = Number(row.amount_charged) || 0
                        const partsCharged = Number(row.parts_charged) || 0
                        const afterParts = invoice - partsCharged
                        const refCut = afterParts * 0.20
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
                            <td className="py-1.5 pr-3 text-right">{fmt(invoice)}</td>
                            <td className="py-1.5 pr-3 text-right text-red-500">{fmt(partsCharged)}</td>
                            <td className="py-1.5 text-right text-green-700 font-medium">{fmt(refCut)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 font-semibold">
                        <td colSpan={6} className="pt-2 text-gray-600">Total Outstanding to Shop</td>
                        <td className="pt-2 text-right text-green-700">
                          {fmt(atShop.reduce((s, row) => {
                            const invoice = Number(row.amount_charged) || 0
                            const partsCost = Number(row.parts_cost) || 0
                            const afterParts = invoice - partsCost
                            return s + afterParts * 0.20
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
                      <th className="pb-2 pr-3 text-right">Invoice</th>
                      <th className="pb-2 pr-3 text-right">Parts Chg</th>
                      <th className="pb-2 pr-3 text-right">Net</th>
                      <th className="pb-2 pr-3 text-right">Shop 20%</th>
                      <th className="pb-2 pr-3 text-right">WW Rcvd</th>
                      <th className="pb-2 pr-3 text-center">Status</th>
                      <th className="pb-2 pr-3 text-right">Date Settled</th>
                      <th className="pb-2 pr-3 text-center">Comm. Paid</th>
                      <th className="pb-2 text-right">Comm. Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {refHistory.map(row => {
                      const invoice = Number(row.amount_charged) || 0
                      const partsCharged = Number(row.parts_charged) || 0
                      const afterParts = invoice - partsCharged
                      const refCut = afterParts > 0 ? afterParts * 0.20 : 0
                      const wwRcvd = invoice > 0 ? (afterParts > 0 ? afterParts * 0.80 + partsCharged : invoice) : 0
                      return (
                        <tr key={String(row.id)} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-1.5 pr-3">
                            <Link href={'/work-orders/' + row.id} className="text-blue-600 hover:underline font-mono text-xs">
                              {String(row.order_number)}
                            </Link>
                          </td>
                          <td className="py-1.5 pr-3 whitespace-nowrap">{String(row.customer_name || '-')}</td>
                          <td className="py-1.5 pr-3 text-gray-500 text-xs whitespace-nowrap">{String(row.equipment_type || '')} {String(row.make || '')} {String(row.model || '')}</td>
                          <td className="py-1.5 pr-3 text-right font-medium">{invoice > 0 ? fmt(invoice) : '-'}</td>
                          <td className="py-1.5 pr-3 text-right text-gray-500">{partsCharged > 0 ? fmt(partsCharged) : '-'}</td>
                          <td className="py-1.5 pr-3 text-right">{invoice > 0 ? fmt(afterParts) : '-'}</td>
                          <td className="py-1.5 pr-3 text-right text-orange-600">{invoice > 0 ? fmt(refCut) : '-'}</td>
                          <td className="py-1.5 pr-3 text-right text-green-700 font-medium">{invoice > 0 ? fmt(wwRcvd) : '-'}</td>
                          <td className="py-1.5 pr-3 text-center">
                            <span className={'text-xs px-2 py-0.5 rounded-full ' + (row.shop_payment_received ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-600')}>
                              {row.shop_payment_received ? 'Settled' : 'Pending'}
                            </span>
                          </td>
                          <td className="py-1.5 pr-3 text-right text-gray-500 text-xs">{row.shop_payment_date ? String(row.shop_payment_date).slice(0,10) : '-'}</td>
                          <td className="py-1.5 pr-3 text-center">
                            {row.shop_payment_received ? (
                              <span className={'text-xs px-2 py-0.5 rounded-full ' + (row.commission_paid ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-600')}>
                                {row.commission_paid ? 'Paid' : 'Owed'}
                              </span>
                            ) : <span className="text-gray-300 text-xs">-</span>}
                          </td>
                          <td className="py-1.5 text-right text-gray-500 text-xs">{row.commission_paid_date ? String(row.commission_paid_date).slice(0,10) : '-'}</td>
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
        </div>
      )}
    </div>
  )
}
