'use client'
import { useRef, useState } from 'react'
import Link from 'next/link'
import type { TechGroup, TechRow, PayState } from '@/lib/by-technician'

function fmt(n: number) {
  return '$' + (Number(n) || 0).toFixed(2)
}
function ymd(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return d.getFullYear() + '-' + m + '-' + day
}
function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
type Preset = 'this-week' | 'last-week' | 'this-month' | 'last-month'
function presetRange(id: Preset): [string, string] {
  const now = new Date()
  if (id === 'this-week' || id === 'last-week') {
    const mondayOffset = (now.getDay() + 6) % 7
    const monday = addDays(now, -mondayOffset - (id === 'last-week' ? 7 : 0))
    return [ymd(monday), ymd(addDays(monday, 6))]
  }
  const first = new Date(now.getFullYear(), now.getMonth() + (id === 'last-month' ? -1 : 0), 1)
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0)
  return [ymd(first), ymd(last)]
}

// Print only the report: hide everything else on the page while the print dialog is open.
function printOnly(el: HTMLElement | null) {
  if (!el) return
  const hidden: Element[] = []
  let node: HTMLElement | null = el
  while (node && node !== document.body) {
    const parent: HTMLElement | null = node.parentElement
    if (!parent) break
    Array.from(parent.children).forEach(sib => {
      if (sib !== node && sib.tagName !== 'STYLE') {
        sib.setAttribute('data-print-hide', '1')
        hidden.push(sib)
      }
    })
    node = parent
  }
  const restore = () => {
    hidden.forEach(h => h.removeAttribute('data-print-hide'))
    window.removeEventListener('afterprint', restore)
  }
  window.addEventListener('afterprint', restore)
  window.print()
}

const PRINT_CSS =
  '@media print { [data-print-hide] { display: none !important; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } tr { break-inside: avoid; } }'

// Full class strings so Tailwind keeps them
const STATE_STYLE: Record<PayState, { row: string; pill: string }> = {
  'paid':         { row: '',               pill: '' },
  'at-shop':      { row: 'bg-purple-50',   pill: 'bg-purple-600 text-white' },
  'worked-on':    { row: 'bg-sky-50',      pill: 'bg-sky-600 text-white' },
  'waiting-part': { row: 'bg-orange-50',   pill: 'bg-orange-500 text-white' },
  'not-returned': { row: 'bg-yellow-50',   pill: 'bg-yellow-500 text-white' },
  'not-paid':     { row: 'bg-red-50',      pill: 'bg-red-600 text-white' },
}

interface Report {
  from: string
  to: string
  excluded: number
  groups: TechGroup[]
}

function Row({ r }: { r: TechRow }) {
  const st = STATE_STYLE[r.state]
  const partial = r.share !== 1
  const dash = <span className="text-gray-300">-</span>
  return (
    <tr className={'border-b last:border-0 align-top ' + st.row}>
      <td className="py-2 pr-3 whitespace-nowrap">
        <Link href={'/work-orders/' + r.id} className="text-blue-600 hover:underline font-mono text-xs">
          {r.orderNumber}
        </Link>
      </td>
      <td className="py-2 pr-3">
        <div className="font-medium text-gray-800">{r.customerName}</div>
        {(r.equipment || r.isReferral) && (
          <div className="text-[11px] text-gray-500">
            {r.equipment}
            {r.isReferral && <span className="ml-1 text-purple-700">{r.equipment ? '· ' : ''}Referral{r.referralShop ? ' - ' + r.referralShop : ''}</span>}
          </div>
        )}
      </td>
      <td className="py-2 pr-3 whitespace-nowrap text-xs text-gray-500">
        {r.date || '-'}
        {r.shareNote && <div className="text-[10px] font-semibold text-indigo-600">{r.shareNote}</div>}
      </td>
      <td className="py-2 pr-3 text-right whitespace-nowrap">
        {r.invoiceFull > 0 ? (
          <>
            <span className={r.invoiceIsEstimate ? 'italic text-gray-500' : ''}>{fmt(r.invoice)}</span>
            {r.invoiceIsEstimate && <div className="text-[10px] text-gray-400">estimate</div>}
            {partial && <div className="text-[10px] text-gray-400">of {fmt(r.invoiceFull)}</div>}
          </>
        ) : dash}
      </td>
      <td className="py-2 pr-3 text-right whitespace-nowrap text-gray-600">{r.parts > 0 ? fmt(r.parts) : dash}</td>
      <td className="py-2 pr-3 text-right whitespace-nowrap">
        {r.isReferral && r.shop > 0 ? (
          <span className={r.shopIsProjected ? 'italic text-gray-400' : 'text-orange-600'}>
            {fmt(r.shop)}
            {r.shopIsProjected && <div className="text-[10px] not-italic">if paid</div>}
          </span>
        ) : dash}
      </td>
      <td className="py-2 pr-3 text-right whitespace-nowrap">
        {r.state === 'paid' ? (
          <>
            <span className="font-medium">{fmt(r.paid)}</span>
            {partial && <div className="text-[10px] text-gray-400">of {fmt(r.paidFull)}</div>}
            {r.balanceDue > 0.005 && <div className="text-[10px] text-red-600 font-semibold">balance due {fmt(r.balanceDue)}</div>}
          </>
        ) : (
          <span className={'inline-block text-[10px] leading-tight font-bold px-2 py-1 rounded text-center ' + st.pill}>{r.stateLabel}</span>
        )}
      </td>
      <td className="py-2 text-right whitespace-nowrap font-semibold">
        {r.state === 'paid' ? fmt(r.earned) : <span className="text-gray-300 font-normal">pending</span>}
      </td>
    </tr>
  )
}

function Result({ g, data, unassigned }: { g: TechGroup; data: Report; unassigned: number }) {
  const t = g.totals
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-3">
        <div>
          <h3 className="text-lg font-bold text-gray-800">{g.tech}</h3>
          <p className="text-xs text-gray-500">{data.from} to {data.to} &middot; {g.rows.length} work order{g.rows.length === 1 ? '' : 's'}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-right">
          <div className="text-xs text-green-700">Total paid to {g.tech} in this period</div>
          <div className="text-2xl font-bold text-green-700">{fmt(t.earned)}</div>
          <div className="text-[10px] text-gray-500">{t.paidJobs} paid job{t.paidJobs === 1 ? '' : 's'}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="text-gray-400">Highlights:</span>
        <span className="px-2 py-0.5 rounded bg-purple-600 text-white font-bold">AT REFERRAL SHOP</span>
        <span className="px-2 py-0.5 rounded bg-sky-600 text-white font-bold">BEING WORKED ON</span>
        <span className="px-2 py-0.5 rounded bg-orange-500 text-white font-bold">WAITING ON PART</span>
        <span className="px-2 py-0.5 rounded bg-yellow-500 text-white font-bold">NOT BACK TO SHOP YET</span>
        <span className="px-2 py-0.5 rounded bg-red-600 text-white font-bold">PAYMENT NOT RECORDED</span>
      </div>

      {g.rows.length === 0 ? (
        <p className="text-sm text-gray-400 italic py-4 text-center">No work orders for {g.tech} in this date range</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b text-xs uppercase">
                <th className="pb-2 pr-3">WO#</th>
                <th className="pb-2 pr-3">Customer</th>
                <th className="pb-2 pr-3">Date</th>
                <th className="pb-2 pr-3 text-right">Invoice</th>
                <th className="pb-2 pr-3 text-right">Parts Chg</th>
                <th className="pb-2 pr-3 text-right">Referral Shop 20%</th>
                <th className="pb-2 pr-3 text-right">Amount Paid</th>
                <th className="pb-2 text-right">{g.tech} Earned</th>
              </tr>
            </thead>
            <tbody>
              {g.rows.map(r => <Row key={r.id} r={r} />)}
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-semibold">
                <td className="pt-2 text-gray-600" colSpan={3}>Paid jobs total</td>
                <td className="pt-2 pr-3 text-right">{fmt(t.invoice)}</td>
                <td className="pt-2 pr-3 text-right text-gray-600">{fmt(t.parts)}</td>
                <td className="pt-2 pr-3 text-right text-orange-600">{fmt(t.shop)}</td>
                <td className="pt-2 pr-3 text-right">{fmt(t.paid)}</td>
                <td className="pt-2 text-right text-green-700">{fmt(t.earned)}</td>
              </tr>
              {t.pendingJobs > 0 && (
                <tr className="text-xs text-gray-500">
                  <td className="pt-2" colSpan={3}>
                    Not paid yet: {t.pendingJobs} job{t.pendingJobs === 1 ? '' : 's'}
                    {' ('}
                    {[
                      t.atShop > 0 ? t.atShop + ' at referral shop' : '',
                      t.workedOn > 0 ? t.workedOn + ' being worked on' : '',
                      t.notPaid > 0 ? t.notPaid + ' done, no payment recorded' : '',
                    ].filter(Boolean).join(', ')}
                    {')'}
                  </td>
                  <td className="pt-2 pr-3 text-right">{fmt(t.pendingInvoice)}</td>
                  <td colSpan={3} className="pt-2 pr-3 text-right italic">not counted in the total above</td>
                  <td className="pt-2 text-right italic">about {fmt(t.pendingEarned)}</td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      )}

      <div className="text-xs text-gray-500 space-y-1">
        <p>
          Jobs paid after 2026-07-01 go 100% to the assigned technician; jobs marked <b>Both</b> are split 50/50 and show each person&apos;s half
          (the full amount is in small gray text). Jobs paid on or before 2026-07-01 show the old 60/40 Wade/Wayne split.
          Earned = amount paid &minus; parts charged &minus; the 20% referral-shop cut (20% of what is left after parts).
        </p>
        <p>
          Dates use the payment date, or the date completed / dropped at the shop / date in when nothing is recorded yet.
          &quot;Estimate&quot; invoices are labor hours &times; rate plus parts, used only when no invoice amount has been entered.
        </p>
        {data.excluded > 0 && (
          <p>{data.excluded} work order{data.excluded === 1 ? '' : 's'} in this date range {data.excluded === 1 ? 'was' : 'were'} left off: donated, abandoned, never paid or no charge.</p>
        )}
        {unassigned > 0 && (
          <p className="text-red-600 font-medium">
            {unassigned} work order{unassigned === 1 ? '' : 's'} in this date range {unassigned === 1 ? 'has' : 'have'} no technician assigned, so {unassigned === 1 ? 'it is' : 'they are'} not in Wade&apos;s or Wayne&apos;s report.
          </p>
        )}
      </div>
    </div>
  )
}

export default function ByTechnicianReport() {
  const initial = presetRange('this-week')
  const [from, setFrom] = useState(initial[0])
  const [to, setTo] = useState(initial[1])
  const [tech, setTech] = useState<'' | 'Wade' | 'Wayne'>('')
  const [includeOpen, setIncludeOpen] = useState(false)
  const [data, setData] = useState<Report | null>(null)
  const [shownTech, setShownTech] = useState<'Wade' | 'Wayne' | ''>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const reportRef = useRef<HTMLDivElement | null>(null)

  async function run() {
    if (!tech) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/reports/by-technician?from=' + from + '&to=' + to + (includeOpen ? '&includeOpen=1' : ''), { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Report failed to load')
      setData(json)
      setShownTech(tech)
    } catch (e) {
      setData(null)
      setError(e instanceof Error ? e.message : String(e))
    }
    setLoading(false)
  }

  const group = data?.groups.find(g => g.tech === shownTech)
  const unassigned = data?.groups.find(g => g.tech === 'Unassigned')?.rows.length ?? 0

  return (
    <div className="bg-white rounded-xl shadow p-4 space-y-4">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div className="print:hidden space-y-3">
        <div>
          <h2 className="font-semibold text-gray-800 text-base">Work Orders by Technician</h2>
          <p className="text-xs text-gray-400">Pick a date range and a technician, then press Show Report.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-500 font-medium">1. Dates</span>
          <label className="text-gray-500">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border rounded px-2 py-1 text-sm" />
          <label className="text-gray-500">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border rounded px-2 py-1 text-sm" />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-gray-400">Quick pick:</span>
          {([['this-week', 'This week'], ['last-week', 'Last week'], ['this-month', 'This month'], ['last-month', 'Last month']] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => { const [f, t] = presetRange(id); setFrom(f); setTo(t) }}
              className="px-2.5 py-1 rounded-full border bg-gray-50 hover:bg-gray-100 text-gray-600">{label}</button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-500 font-medium">2. Technician</span>
          {(['Wade', 'Wayne'] as const).map(w => (
            <button key={w} type="button" onClick={() => setTech(w)}
              className={'px-5 py-1.5 rounded-lg text-sm font-medium ' + (tech === w ? 'bg-orange-500 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50')}>
              {w}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={includeOpen} onChange={e => setIncludeOpen(e.target.checked)} />
          Also list every job still unpaid or in progress, whatever its date
        </label>

        <div className="flex items-center gap-3">
          <button type="button" onClick={run} disabled={!tech || !from || !to || loading}
            className="bg-orange-500 text-white px-5 py-1.5 rounded-lg text-sm hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed">
            {loading ? 'Loading...' : 'Show Report'}
          </button>
          {!tech && <span className="text-xs text-gray-400">Choose Wade or Wayne first</span>}
          {group && (
            <>
              <button type="button" onClick={() => printOnly(reportRef.current)}
                className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50">
                Print / Save PDF
              </button>
              <button type="button" onClick={() => { setData(null); setShownTech('') }}
                className="text-xs text-gray-500 hover:underline">Clear</button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 print:hidden">
          <p className="font-semibold">The report could not load.</p>
          <p className="text-xs mt-1 break-words">{error}</p>
        </div>
      )}

      {data && group && (
        <div ref={reportRef} className="border-t pt-4">
          {/* Print-only header */}
          <div className="hidden print:flex items-center gap-3 pb-3 mb-3 border-b">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/logo.png" alt="" className="h-12 w-12" />
            <div>
              <div className="text-xl font-bold text-gray-900">Cavin&apos;s Small Engine Repair - Work Orders by Technician</div>
              <div className="text-sm text-gray-500">{group.tech} &middot; {data.from} to {data.to}</div>
            </div>
          </div>
          <Result g={group} data={data} unassigned={unassigned} />
        </div>
      )}
    </div>
  )
}
