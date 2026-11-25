// Math for the "Shop Commission Owed" report.
//
// Same rules the rest of the app uses:
//   * Commission = 20% of (what the shop paid WW - parts charged to the customer).
//   * A work order shows OWED once the shop's payment to WW is recorded, and stays owed until
//     "Mark as Paid" is checked under "20% Commission to Shop" on the work order.
//   * Never Paid, donated and abandoned jobs, and "no charge" jobs, never carry a commission.
//
// Two buckets:
//   owed     - the shop has paid WW and the commission has not been paid back yet (this is the money owed today)
//   upcoming - the equipment is back at the shop but the shop has not paid WW yet (commission becomes due once it does)

export const SHOP_RATE = 0.2
const DEFAULT_LABOR_RATE = 80

export type Bucket = 'owed' | 'upcoming'

export interface CommissionRow {
  id: string
  orderNumber: string
  customerName: string
  equipment: string
  shop: string
  bucket: Bucket
  returnedDate: string // date the equipment went back to the shop
  shopPaidDate: string // date the shop paid WW ('' when not paid yet)
  daysOwed: number | null // days since the shop paid WW (owed bucket only)
  base: number // shop payment (or invoice / estimate when none is recorded)
  baseIsEstimate: boolean // true when no real amount was recorded and the invoice or labor+parts estimate was used
  baseSource: 'shop payment' | 'invoice' | 'estimate'
  partsCharged: number
  commission: number
}

export interface ShopGroup {
  shop: string
  owed: CommissionRow[]
  upcoming: CommissionRow[]
  owedTotal: number
  upcomingTotal: number
}

export interface CommissionReport {
  asOf: string
  shops: ShopGroup[]
  totals: {
    owed: number
    owedJobs: number
    upcoming: number
    upcomingJobs: number
    estimatedJobs: number
    oldestShopPaidDate: string
  }
}

const n = (v: unknown): number => {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}
const day = (v: unknown): string => (v ? String(v).slice(0, 10) : '')

// Round to whole cents so the total always equals the sum of the rows on screen.
export const cents = (x: number): number => Math.round((x + Number.EPSILON) * 100) / 100

function daysBetween(fromYmd: string, toYmd: string): number | null {
  if (!fromYmd || !toYmd) return null
  const a = Date.parse(fromYmd + 'T00:00:00Z')
  const b = Date.parse(toYmd + 'T00:00:00Z')
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return Math.max(0, Math.round((b - a) / 86400000))
}

function describeEquipment(r: Record<string, unknown>): string {
  return [r.make, r.model, r.equipment_type].filter(Boolean).map(String).join(' ')
}

export function buildRow(r: Record<string, unknown>, today: string): CommissionRow {
  const shopPaid = r.shop_payment_received === true
  const partsCharged = n(r.parts_charged)

  // Best available number for what the job was worth: the shop's payment, else the invoice, else labor + parts.
  let base = 0
  let baseSource: CommissionRow['baseSource'] = 'estimate'
  if (n(r.shop_payment_amount) > 0) {
    base = n(r.shop_payment_amount)
    baseSource = 'shop payment'
  } else if (n(r.amount_charged) > 0) {
    base = n(r.amount_charged)
    baseSource = 'invoice'
  } else {
    base = n(r.labor_hours) * (n(r.labor_rate) || DEFAULT_LABOR_RATE) + partsCharged
    baseSource = 'estimate'
  }

  // For a job the shop has already paid, only a recorded shop payment is a real number; an invoice or estimate is a stand-in.
  const baseIsEstimate = shopPaid ? baseSource !== 'shop payment' : baseSource === 'estimate'

  const afterParts = base - partsCharged
  const commission = afterParts > 0 ? cents(afterParts * SHOP_RATE) : 0
  const shopPaidDate = shopPaid ? day(r.shop_paid_date) : ''

  return {
    id: String(r.id),
    orderNumber: String(r.order_number || ''),
    customerName: String(r.customer_name || '-'),
    equipment: describeEquipment(r),
    shop: String(r.referral_shop || 'Other Shop'),
    bucket: shopPaid ? 'owed' : 'upcoming',
    returnedDate: day(r.returned_date),
    shopPaidDate,
    daysOwed: shopPaid ? daysBetween(shopPaidDate, today) : null,
    base: cents(base),
    baseIsEstimate,
    baseSource,
    partsCharged: cents(partsCharged),
    commission,
  }
}

export function buildReport(rows: Record<string, unknown>[], today: string): CommissionReport {
  const built = rows.map(r => buildRow(r, today))
  const names = Array.from(new Set(built.map(r => r.shop))).sort((a, b) => a.localeCompare(b))
  const sum = (arr: CommissionRow[]) => cents(arr.reduce((s, x) => s + x.commission, 0))

  const shops: ShopGroup[] = names.map(shop => {
    const mine = built.filter(r => r.shop === shop)
    const owed = mine
      .filter(r => r.bucket === 'owed')
      .sort((a, b) => (a.shopPaidDate || '9999').localeCompare(b.shopPaidDate || '9999') || a.orderNumber.localeCompare(b.orderNumber))
    const upcoming = mine
      .filter(r => r.bucket === 'upcoming')
      .sort((a, b) => (a.returnedDate || '9999').localeCompare(b.returnedDate || '9999') || a.orderNumber.localeCompare(b.orderNumber))
    return { shop, owed, upcoming, owedTotal: sum(owed), upcomingTotal: sum(upcoming) }
  })

  const allOwed = built.filter(r => r.bucket === 'owed')
  const allUpcoming = built.filter(r => r.bucket === 'upcoming')
  const dated = allOwed.map(r => r.shopPaidDate).filter(Boolean).sort()

  return {
    asOf: today,
    shops,
    totals: {
      owed: sum(allOwed),
      owedJobs: allOwed.length,
      upcoming: sum(allUpcoming),
      upcomingJobs: allUpcoming.length,
      estimatedJobs: allOwed.filter(r => r.baseIsEstimate).length,
      oldestShopPaidDate: dated[0] || '',
    },
  }
}
