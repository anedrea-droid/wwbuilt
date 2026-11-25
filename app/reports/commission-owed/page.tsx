'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { CommissionReport, CommissionRow, ShopGroup } from '@/lib/commission-owed'

const PRINT_STYLES =
  '@media print { nav { display: none !important; } .print\\:hidden { display: none !important; } body { background: white !important; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .shop-section { break-inside: avoid-page; } tr { break-inside: avoid; } }'

function fmt(n: number) {
  return '$' + (Number(n) || 0).toFixed(2)
}
function fmtDate(ymd: string) {
  if (!ymd) return '-'
  const [y, m, d] = ymd.split('-')
  return m + '/' + d + '/' + y
}

interface PayProps {
  onPay: (r: CommissionRow) => void
  busyId: string
}

function OwedRow({ r, onPay, busyId }: { r: CommissionRow } & PayProps) {
  const old = r.daysOwed !== null && r.daysOwed >= 30
  return (
    <tr className={'border-b last:border-0 align-top ' + (r.baseIsEstimate ? 'bg-yellow-50' : '')}>
      <td className="py-2 pr-3 whitespace-nowrap">
        <Link href={'/work-orders/' + r.id} className="text-blue-600 hover:underline font-mono text-xs">{r.orderNumber}</Link>
      </td>
      <td className="py-2 pr-3">
        <div className="font-medium text-gray-800">{r.customerName}</div>
        {r.equipment && <div className="text-[11px] text-gray-500">{r.equipment}</div>}
      </td>
      <td className="py-2 pr-3 whitespace-nowrap text-xs text-gray-500">{fmtDate(r.shopPaidDate)}</td>
      <td className="py-2 pr-3 whitespace-nowrap text-xs text-right">
        {r.daysOwed === null ? '-' : <span className={old ? 'font-semibold text-red-600' : 'text-gray-500'}>{r.daysOwed} day{r.daysOwed === 1 ? '' : 's'}</span>}
      </td>
      <td className="py-2 pr-3 text-right whitespace-nowrap">
        <span className={r.baseIsEstimate ? 'italic text-gray-500' : ''}>{r.base > 0 ? fmt(r.base) : '-'}</span>
        {r.baseIsEstimate && <div className="text-[10px] text-yellow-700 not-italic">no shop payment amount - used {r.baseSource}</div>}
      </td>
      <td className="py-2 pr-3 text-right whitespace-nowrap text-gray-600">{r.partsCharged > 0 ? fmt(r.partsCharged) : <span className="text-gray-300">-</span>}</td>
      <td className="py-2 pr-3 text-right whitespace-nowrap font-semibold text-orange-600">{r.commission > 0 ? fmt(r.commission) : <span className="text-gray-300 font-normal">$0.00</span>}</td>
      <td className="py-2 text-right whitespace-nowrap print:hidden">
        <button onClick={() => onPay(r)} disabled={busyId !== ''}
          className="bg-green-600 text-white text-xs font-semibold px-3 py-1 rounded-lg hover:bg-green-700 disabled:opacity-50">
          {busyId === r.id ? 'Saving...' : 'Mark paid'}
        </button>
      </td>
    </tr>
  )
}

function UpcomingRow({ r }: { r: CommissionRow }) {
  return (
    <tr className="border-b last:border-0 align-top text-gray-600">
      <td className="py-1.5 pr-3 whitespace-nowrap">
        <Link href={'/work-orders/' + r.id} className="text-blue-600 hover:underline font-mono text-xs">{r.orderNumber}</Link>
      </td>
      <td className="py-1.5 pr-3">
        <div>{r.customerName}</div>
        {r.equipment && <div className="text-[11px] text-gray-500">{r.equipment}</div>}
      </td>
      <td className="py-1.5 pr-3 whitespace-nowrap text-xs text-gray-500">{fmtDate(r.returnedDate)}</td>
      <td className="py-1.5 pr-3 text-right whitespace-nowrap">
        <span className={r.baseIsEstimate ? 'italic text-gray-500' : ''}>{r.base > 0 ? fmt(r.base) : '-'}</span>
        {r.baseIsEstimate && <div className="text-[10px] text-gray-400">estimate</div>}
      </td>
      <td className="py-1.5 text-right whitespace-nowrap italic text-gray-500">{r.commission > 0 ? fmt(r.commission) : '-'}</td>
    </tr>
  )
}

function ShopSection({ g, onPay, busyId }: { g: ShopGroup } & PayProps) {
  return (
    <section className="shop-section bg-white rounded-xl shadow p-4 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-3">
        <div>
          <h2 className="text-lg font-bold text-gray-800">{g.shop}</h2>
          <p className="text-xs text-gray-500">
            {g.owed.length} job{g.owed.length === 1 ? '' : 's'} owed now
            {g.upcoming.length > 0 ? ' · ' + g.upcoming.length + ' more waiting on the shop to pay' : ''}
          </p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2 text-right">
          <div className="text-xs text-orange-700">WW owes {g.shop}</div>
          <div className="text-2xl font-bold text-orange-600">{fmt(g.owedTotal)}</div>
        </div>
      </div>

      {g.owed.length === 0 ? (
        <p className="text-sm text-green-600 text-center py-3">Nothing owed to {g.shop} right now</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b text-xs uppercase">
                <th className="pb-2 pr-3">WO#</th>
                <th className="pb-2 pr-3">Customer</th>
                <th className="pb-2 pr-3">Shop Paid WW</th>
                <th className="pb-2 pr-3 text-right">Owed For</th>
                <th className="pb-2 pr-3 text-right">Shop Payment</th>
                <th className="pb-2 pr-3 text-right">Parts Chg</th>
                <th className="pb-2 pr-3 text-right text-orange-600">Commission (20%)</th>
                <th className="pb-2 print:hidden"></th>
              </tr>
            </thead>
            <tbody>
              {g.owed.map(r => <OwedRow key={r.id} r={r} onPay={onPay} busyId={busyId} />)}
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-semibold">
                <td className="pt-2 text-gray-600" colSpan={6}>{g.shop} - total owed</td>
                <td className="pt-2 pr-3 text-right text-orange-600">{fmt(g.owedTotal)}</td>
                <td className="print:hidden"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {g.upcoming.length > 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3">
          <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Coming up - not owed yet</h3>
          <p className="text-[11px] text-gray-500 mb-2">Back at {g.shop}, waiting for the shop to pay WW. The commission becomes due once the shop&apos;s payment is recorded.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b text-[11px] uppercase">
                  <th className="pb-1 pr-3">WO#</th>
                  <th className="pb-1 pr-3">Customer</th>
                  <th className="pb-1 pr-3">Returned</th>
                  <th className="pb-1 pr-3 text-right">Invoice</th>
                  <th className="pb-1 text-right">Commission if paid</th>
                </tr>
              </thead>
              <tbody>
                {g.upcoming.map(r => <UpcomingRow key={r.id} r={r} />)}
              </tbody>
              <tfoot>
                <tr className="border-t font-semibold text-gray-600">
                  <td className="pt-1.5" colSpan={4}>Coming up total (not included in the amount owed above)</td>
                  <td className="pt-1.5 text-right italic">{fmt(g.upcomingTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}

export default function CommissionOwedPage() {
  const [data, setData] = useState<CommissionReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [shop, setShop] = useState('all')
  const [paidOn, setPaidOn] = useState('')
  const [busyId, setBusyId] = useState('')
  const [notice, setNotice] = useState<{ id: string; orderNumber: string; amount: number; shop: string; error?: string } | null>(null)

  // Save the commission as paid (or unpaid again) on the work order itself, the same fields the work order page uses.
  async function setPaid(id: string, paid: boolean, date: string) {
    const res = await fetch('/api/work-orders/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commission_paid: paid, commission_paid_date: paid ? date : '' }),
    })
    if (!res.ok) {
      let msg = 'Could not save (error ' + res.status + ')'
      try { const j = await res.json(); if (j.error) msg = String(j.error) } catch { /* keep default message */ }
      throw new Error(msg)
    }
  }

  async function markPaid(r: CommissionRow) {
    const date = paidOn || data?.asOf || ''
    setBusyId(r.id)
    try {
      await setPaid(r.id, true, date)
      setNotice({ id: r.id, orderNumber: r.orderNumber, amount: r.commission, shop: r.shop })
      load(false)
    } catch (e) {
      setNotice({ id: r.id, orderNumber: r.orderNumber, amount: r.commission, shop: r.shop, error: e instanceof Error ? e.message : String(e) })
    }
    setBusyId('')
  }

  async function undo() {
    if (!notice || notice.error) return
    setBusyId(notice.id)
    try {
      await setPaid(notice.id, false, '')
      setNotice(null)
      load(false)
    } catch (e) {
      setNotice({ ...notice, error: 'Undo failed: ' + (e instanceof Error ? e.message : String(e)) })
    }
    setBusyId('')
  }

  function load(showSpinner = true) {
    if (showSpinner) setLoading(true)
    setError('')
    fetch('/api/reports/commission-owed', { cache: 'no-store' })
      .then(res => res.json().then(json => ({ ok: res.ok, json })))
      .then(({ ok, json }) => {
        if (!ok) throw new Error(json.error || 'Report failed to load')
        setData(json)
      })
      .catch(e => {
        setData(null)
        setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const shops = (data?.shops || []).filter(g => shop === 'all' || g.shop === shop)
  const t = data?.totals

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Shop Commission Owed</h1>
          <Link href="/reports" className="text-xs text-blue-600 hover:underline">&larr; Back to Reports</Link>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load()} className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50">Refresh</button>
          <button onClick={() => window.print()} className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50">Print / Save PDF</button>
        </div>
      </div>

      <div className="hidden print:block">
        <h1 className="text-xl font-bold text-gray-800">Cavin&apos;s Small Engine Repair - Shop Commission Owed</h1>
        {data && <p className="text-xs text-gray-500">As of {fmtDate(data.asOf)}{shop !== 'all' ? ' · ' + shop : ''}</p>}
      </div>

      {loading && <p className="text-sm text-gray-500 text-center py-10">Loading...</p>}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          Could not load the report: {error}
        </div>
      )}

      {data && t && (
        <>
          <div className="bg-white rounded-xl shadow p-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs text-gray-500">Total commission WW owes the referral shops{shop !== 'all' ? ' (' + shop + ' only)' : ''}</div>
              <div className="text-3xl font-bold text-orange-600">
                {fmt(shops.reduce((s, g) => s + g.owedTotal, 0))}
              </div>
              <div className="text-xs text-gray-500">
                {shops.reduce((s, g) => s + g.owed.length, 0)} job{shops.reduce((s, g) => s + g.owed.length, 0) === 1 ? '' : 's'} where the shop has paid WW and the 20% is not marked paid
                {t.oldestShopPaidDate && shop === 'all' ? ' · oldest shop payment ' + fmtDate(t.oldestShopPaidDate) : ''}
              </div>
            </div>
            <div className="text-right text-xs text-gray-500">
              <div>Coming up once shops pay: <span className="font-semibold text-gray-700">{fmt(shops.reduce((s, g) => s + g.upcomingTotal, 0))}</span></div>
              <div>({shops.reduce((s, g) => s + g.upcoming.length, 0)} job{shops.reduce((s, g) => s + g.upcoming.length, 0) === 1 ? '' : 's'} still waiting on the shop)</div>
              <div className="mt-1">As of {fmtDate(data.asOf)}</div>
            </div>
          </div>

          {t.estimatedJobs > 0 && (
            <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-lg p-3 text-sm">
              {t.estimatedJobs} job{t.estimatedJobs === 1 ? ' is' : 's are'} marked as paid by the shop but {t.estimatedJobs === 1 ? 'has' : 'have'} no shop payment amount recorded, so the
              commission uses the invoice or an estimate instead (highlighted yellow below). Open the work order and fill in the Referral Shop payment amount to make it exact.
            </div>
          )}

          <div className="bg-white rounded-xl shadow p-3 flex flex-wrap items-center gap-2 text-sm print:hidden">
            <label className="text-gray-500">Date paid to the shop</label>
            <input type="date" value={paidOn || data.asOf} onChange={e => setPaidOn(e.target.value)} className="border rounded px-2 py-1 text-sm" />
            <span className="text-xs text-gray-400">Used when you tap &quot;Mark paid&quot; on a row. Change it if you paid the shop on another day.</span>
          </div>

          {notice && (
            <div className={'rounded-lg p-3 text-sm flex flex-wrap items-center justify-between gap-2 print:hidden ' + (notice.error ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-800')}>
              <span>
                {notice.error
                  ? 'Not saved for ' + notice.orderNumber + ': ' + notice.error
                  : notice.orderNumber + ' marked paid - ' + fmt(notice.amount) + ' to ' + notice.shop + '.'}
              </span>
              <span className="flex items-center gap-3">
                {!notice.error && <button onClick={undo} disabled={busyId !== ''} className="font-semibold underline disabled:opacity-50">Undo</button>}
                <button onClick={() => setNotice(null)} className="text-xs text-gray-500 hover:underline">Dismiss</button>
              </span>
            </div>
          )}

          {data.shops.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 text-sm print:hidden">
              <span className="text-gray-500">Show</span>
              {['all', ...data.shops.map(g => g.shop)].map(s => (
                <button key={s} onClick={() => setShop(s)}
                  className={'px-3 py-1 rounded-lg text-sm ' + (shop === s ? 'bg-orange-500 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50')}>
                  {s === 'all' ? 'All shops' : s}
                </button>
              ))}
            </div>
          )}

          {data.shops.length === 0 ? (
            <p className="text-sm text-green-600 text-center py-10">No commission is owed to any referral shop right now.</p>
          ) : (
            shops.map(g => <ShopSection key={g.shop} g={g} onPay={markPaid} busyId={busyId} />)
          )}

          <p className="text-[11px] text-gray-400 print:hidden">
            Commission = 20% of (shop payment minus parts charged). Tap &quot;Mark paid&quot; on a row once you have paid the shop; it saves the date on the work order
            (the same &quot;20% Commission to Shop&quot; box) and the job drops off this report. Use Undo right after if you tapped the wrong one. Not included: donated or abandoned equipment, Never Paid jobs, and no-charge jobs.
          </p>
        </>
      )}
    </div>
  )
}
