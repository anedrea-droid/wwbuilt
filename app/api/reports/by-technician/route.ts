import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { buildGroups } from '@/lib/by-technician'

// Same "effective date" the Money Paid Out Summary uses: payment date, else completed, else dropped at shop, else date in.
const EFF =
  "COALESCE(NULLIF(wo.payment_date::text,''), NULLIF(wo.date_complete::text,''), NULLIF(wo.referral_dropoff_date::text,''), NULLIF(wo.date_in::text,''))::date"

const EXCLUDED =
  "(COALESCE(wo.status, '') IN ('donated', 'abandoned') OR COALESCE(wo.never_paid, false) = true OR COALESCE(wo.payment_method, '') = 'no charge')"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''
  const includeOpen = searchParams.get('includeOpen') === '1'
  const iso = /^\d{4}-\d{2}-\d{2}$/
  if (!iso.test(from) || !iso.test(to)) {
    return NextResponse.json({ error: 'Pick a From and To date.' }, { status: 400 })
  }

  try {
    const pool = getPool()
    const { rows } = await pool.query(
      'SELECT wo.id, wo.order_number, wo.status, wo.technician, wo.date_in, wo.date_complete, wo.referral_dropoff_date, wo.payment_date, ' +
        "TO_CHAR(" + EFF + ", 'YYYY-MM-DD') as effective_date, " +
        'wo.amount_charged, wo.amount_paid, wo.labor_hours, wo.labor_rate, ' +
        'wo.shop_payment_amount, wo.shop_payment_received, ' +
        'c.name as customer_name, COALESCE(wo.source, c.source) as customer_source, COALESCE(wo.referral_shop, c.referral_shop) as referral_shop, ' +
        'e.type as equipment_type, e.make, e.model, ' +
        'COALESCE(SUM(p.price * p.quantity), 0) as parts_charged ' +
        'FROM work_orders wo ' +
        'LEFT JOIN customers c ON c.id = wo.customer_id ' +
        'LEFT JOIN equipment e ON e.id = wo.equipment_id ' +
        'LEFT JOIN parts p ON p.work_order_id = wo.id ' +
        'WHERE NOT ' + EXCLUDED + ' ' +
        'AND (' +
        '  (' + EFF + ' >= $1::date AND ' + EFF + ' <= $2::date)' +
        '  OR ($3::boolean AND (CASE WHEN COALESCE(wo.source, c.source) = \'referral\' ' +
        '       THEN COALESCE(wo.shop_payment_received, false) = false ' +
        '       ELSE COALESCE(wo.amount_paid, 0) <= 0 END))' +
        ') ' +
        'GROUP BY wo.id, c.name, c.source, c.referral_shop, e.type, e.make, e.model ' +
        'ORDER BY effective_date ASC NULLS LAST, wo.order_number ASC',
      [from, to, includeOpen]
    )

    // Jobs in the date range that are left off on purpose (donated/abandoned, never paid, no charge)
    const ex = await pool.query(
      'SELECT COUNT(*)::int as n FROM work_orders wo WHERE ' + EXCLUDED + ' ' +
        'AND ' + EFF + ' >= $1::date AND ' + EFF + ' <= $2::date',
      [from, to]
    )

    return NextResponse.json({
      from,
      to,
      includeOpen,
      excluded: ex.rows[0]?.n ?? 0,
      groups: buildGroups(rows),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
