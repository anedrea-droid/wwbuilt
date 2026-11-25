// Math for the "Work Orders by Technician" report.
//
// This follows exactly the same rules as the Money Paid Out Summary on the Financial tab, so a
// technician's total here matches that report:
//   * In-house job  = paid once Amount Paid is recorded. Referral job = paid once the shop's payment is received.
//   * Net earned    = amount paid - parts charged - 20% referral-shop cut (the cut is 20% of what is left after parts).
//   * Paid after 2026-07-01: 100% to the assigned tech, 50/50 when the job is marked "Both".
//   * Paid on or before 2026-07-01: the old 60/40 Wade/Wayne split.

export const SPLIT_CUTOVER_DATE = '2026-07-01'
export const SHOP_RATE = 0.2
const DEFAULT_LABOR_RATE = 80

export type PayState = 'paid' | 'at-shop' | 'worked-on' | 'waiting-part' | 'not-returned' | 'not-paid'

export interface TechRow {
  id: string
  orderNumber: string
  customerName: string
  equipment: string
  technician: string
  isReferral: boolean
  referralShop: string
  status: string
  date: string
  state: PayState
  stateLabel: string
  share: number // this tech's portion of the job (1, 0.5, 0.6 or 0.4)
  shareNote: string // '', 'Both - 50%', '60/40 split'
  // Everything below is already this technician's portion
  invoice: number
  invoiceFull: number
  invoiceIsEstimate: boolean
  parts: number
  shop: number
  shopIsProjected: boolean
  paid: number // 0 when payment has not been recorded
  paidFull: number
  earned: number // net to the tech - only meaningful when state === 'paid'
  projectedEarned: number // what the tech would net once it is paid
  balanceDue: number // in-house partial payments only
}

export interface TechGroup {
  tech: string
  rows: TechRow[]
  totals: {
    paidJobs: number
    invoice: number
    parts: number
    shop: number
    paid: number
    earned: number
    pendingJobs: number
    pendingInvoice: number
    pendingEarned: number
    atShop: number
    workedOn: number
    notPaid: number
  }
}

const n = (v: unknown): number => {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}
const day = (v: unknown): string => (v ? String(v).slice(0, 10) : '')

export function shareFor(tech: string, technician: unknown, effDate: string): number {
  if (effDate && effDate <= SPLIT_CUTOVER_DATE) {
    if (tech === 'Wade') return 0.6
    if (tech === 'Wayne') return 0.4
    return 0
  }
  const t = String(technician || '')
  if (t === 'Both') return tech === 'Wade' || tech === 'Wayne' ? 0.5 : 0
  if (tech === 'Unassigned') return t === 'Wade' || t === 'Wayne' ? 0 : 1
  return t === tech ? 1 : 0
}

function describeEquipment(r: Record<string, unknown>): string {
  return [r.make, r.model, r.equipment_type].filter(Boolean).map(String).join(' ')
}

export function classify(r: Record<string, unknown>): { state: PayState; label: string } {
  const status = String(r.status || '')
  const isRef = r.customer_source === 'referral'
  if (status === 'pending' || status === 'in-progress') return { state: 'worked-on', label: 'BEING WORKED ON' }
  if (status === 'waiting-parts') return { state: 'waiting-part', label: 'BEING WORKED ON - WAITING ON PART' }
  const paid = isRef ? r.shop_payment_received === true : n(r.amount_paid) > 0
  if (paid) return { state: 'paid', label: 'PAID' }
  if (isRef) {
    if (status === 'at-shop' || r.referral_dropoff_date) return { state: 'at-shop', label: 'AT REFERRAL SHOP' }
    return { state: 'not-returned', label: 'DONE - NOT BACK TO SHOP YET' }
  }
  return { state: 'not-paid', label: 'DONE - PAYMENT NOT RECORDED' }
}

export function buildRow(r: Record<string, unknown>, tech: string): TechRow | null {
  const date = day(r.effective_date)
  const share = shareFor(tech, r.technician, date)
  if (share === 0) return null

  const isRef = r.customer_source === 'referral'
  const { state, label } = classify(r)
  const partsFull = n(r.parts_charged)

  // Invoice amount, falling back to the shop payment, then to an estimate (labor + parts)
  let invoiceFull = 0
  let invoiceIsEstimate = false
  if (n(r.amount_charged) > 0) invoiceFull = n(r.amount_charged)
  else if (n(r.shop_payment_amount) > 0) invoiceFull = n(r.shop_payment_amount)
  else {
    invoiceFull = n(r.labor_hours) * (n(r.labor_rate) || DEFAULT_LABOR_RATE) + partsFull
    invoiceIsEstimate = invoiceFull > 0
  }

  const isPaid = state === 'paid'
  const paidFull = isPaid ? (isRef ? n(r.shop_payment_amount) : n(r.amount_paid)) : 0

  // Same order of operations as the Financial report
  const base = isPaid ? paidFull : invoiceFull
  const afterParts = base - partsFull
  const shopFull = isRef && afterParts > 0 ? afterParts * SHOP_RATE : 0
  const netFull = afterParts - shopFull

  const partial = !isRef && isPaid && n(r.amount_charged) > 0 && paidFull < n(r.amount_charged)
  const t = String(r.technician || '')

  return {
    id: String(r.id),
    orderNumber: String(r.order_number || ''),
    customerName: String(r.customer_name || '-'),
    equipment: describeEquipment(r),
    technician: t || 'Unassigned',
    isReferral: isRef,
    referralShop: String(r.referral_shop || ''),
    status: String(r.status || ''),
    date,
    state,
    stateLabel: label,
    share,
    shareNote:
      date && date <= SPLIT_CUTOVER_DATE
        ? '60/40 split'
        : t === 'Both'
        ? 'Both - 50%'
        : '',
    invoice: invoiceFull * share,
    invoiceFull,
    invoiceIsEstimate,
    parts: partsFull * share,
    shop: shopFull * share,
    shopIsProjected: !isPaid,
    paid: paidFull * share,
    paidFull,
    earned: isPaid ? netFull * share : 0,
    projectedEarned: netFull * share,
    balanceDue: partial ? (n(r.amount_charged) - paidFull) * share : 0,
  }
}

export function buildGroups(rows: Record<string, unknown>[]): TechGroup[] {
  const names = ['Wade', 'Wayne']
  const hasUnassigned = rows.some(r => shareFor('Unassigned', r.technician, day(r.effective_date)) > 0 && !names.includes(String(r.technician || '')) && String(r.technician || '') !== 'Both')
  if (hasUnassigned) names.push('Unassigned')

  return names.map(tech => {
    const list: TechRow[] = []
    for (const r of rows) {
      const row = buildRow(r, tech)
      if (row) list.push(row)
    }
    const paidRows = list.filter(x => x.state === 'paid')
    const pending = list.filter(x => x.state !== 'paid')
    const sum = (arr: TechRow[], f: (x: TechRow) => number) => arr.reduce((s, x) => s + f(x), 0)
    return {
      tech,
      rows: list,
      totals: {
        paidJobs: paidRows.length,
        invoice: sum(paidRows, x => x.invoice),
        parts: sum(paidRows, x => x.parts),
        shop: sum(paidRows, x => x.shop),
        paid: sum(paidRows, x => x.paid),
        earned: sum(paidRows, x => x.earned),
        pendingJobs: pending.length,
        pendingInvoice: sum(pending, x => x.invoice),
        pendingEarned: sum(pending, x => x.projectedEarned),
        atShop: pending.filter(x => x.state === 'at-shop').length,
        workedOn: pending.filter(x => x.state === 'worked-on' || x.state === 'waiting-part').length,
        notPaid: pending.filter(x => x.state === 'not-paid' || x.state === 'not-returned').length,
      },
    }
  })
}
