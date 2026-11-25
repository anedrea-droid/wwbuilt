import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { buildReport } from '@/lib/commission-owed'

export const dynamic = 'force-dynamic'

// Today's date in Central time (YYYY-MM-DD), the same clock the Thursday reports use.
function todayCentral(): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const get = (t: string) => parts.find(x => x.type === t)?.value || ''
  return get('year') + '-' + get('month') + '-' + get('day')
}

export async function GET() {
  try {
    const pool = getPool()
    // Referral jobs whose 20% commission has not been marked paid, and that either:
    //   - the shop has already paid WW for (commission is owed now), or
    //   - are back at the shop waiting for the shop to pay (commission comes due later).
    // Left out on purpose: donated / abandoned, Never Paid, and no-charge jobs (no commission applies).
    const { rows } = await pool.query(
      'SELECT wo.id, wo.order_number, wo.status, ' +
        "TO_CHAR(wo.referral_dropoff_date::date, 'YYYY-MM-DD') as returned_date, " +
        "TO_CHAR(wo.shop_payment_date::date, 'YYYY-MM-DD') as shop_paid_date, " +
        'wo.shop_payment_received, wo.shop_payment_amount, wo.amount_charged, wo.labor_hours, wo.labor_rate, ' +
        'c.name as customer_name, COALESCE(wo.referral_shop, c.referral_shop) as referral_shop, ' +
        'e.type as equipment_type, e.make, e.model, ' +
        'COALESCE(SUM(p.price * p.quantity), 0) as parts_charged ' +
        'FROM work_orders wo ' +
        'LEFT JOIN customers c ON c.id = wo.customer_id ' +
        'LEFT JOIN equipment e ON e.id = wo.equipment_id ' +
        'LEFT JOIN parts p ON p.work_order_id = wo.id ' +
        "WHERE COALESCE(wo.source, c.source) = 'referral' " +
        "AND COALESCE(wo.status, '') NOT IN ('donated', 'abandoned') " +
        'AND COALESCE(wo.never_paid, false) = false ' +
        "AND COALESCE(wo.payment_method, '') <> 'no charge' " +
        'AND COALESCE(wo.commission_paid, false) = false ' +
        'AND (wo.shop_payment_received = true OR wo.referral_dropoff_date IS NOT NULL) ' +
        'GROUP BY wo.id, c.name, c.referral_shop, e.type, e.make, e.model'
    )
    return NextResponse.json(buildReport(rows, todayCentral()))
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
