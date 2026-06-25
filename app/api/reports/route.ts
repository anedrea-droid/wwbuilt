import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'

export async function GET(req: Request) {
  const pool = getPool()
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const from = searchParams.get('from') || '2020-01-01'
  const to = searchParams.get('to') || '2099-12-31'

  try {
    if (type === 'payouts') {
      const { rows } = await pool.query(
        'SELECT wo.id, wo.order_number, wo.date_complete, wo.amount_charged, wo.labor_hours, wo.labor_rate, ' +
        'wo.shop_payment_amount, ' +
        'c.name as customer_name, c.source as customer_source, c.referral_shop, ' +
        'COALESCE(SUM(p.cost * p.quantity), 0) as parts_cost, ' +
        'COALESCE(SUM(p.price * p.quantity), 0) as parts_charged, ' +
        'wo.commission_paid, wo.commission_paid_date ' +
        'FROM work_orders wo ' +
        'LEFT JOIN customers c ON c.id = wo.customer_id ' +
        'LEFT JOIN parts p ON p.work_order_id = wo.id ' +
        'WHERE wo.date_complete >= $1 AND wo.date_complete <= $2 ' +
        'AND wo.status NOT IN (\'donated\', \'abandoned\') ' +
        'GROUP BY wo.id, c.name, c.source, c.referral_shop ' +
        'ORDER BY wo.date_complete DESC',
        [from, to]
      )
      return NextResponse.json(rows)
    }

    if (type === 'outstanding') {
      const { rows } = await pool.query(
        'SELECT wo.id, wo.order_number, wo.date_in, wo.status, ' +
        'c.name as customer_name, c.phone as customer_phone, c.source as customer_source, c.referral_shop, ' +
        'e.type as equipment_type, e.make, e.model, ' +
        'CASE WHEN c.source = \'referral\' THEN COALESCE(NULLIF(wo.shop_payment_amount,0), wo.amount_charged) ' +
        '     ELSE wo.amount_charged END as amount_charged, ' +
        'CASE WHEN c.source = \'referral\' THEN 0 ' +
        '     ELSE COALESCE(wo.amount_paid, 0) END as amount_paid ' +
        'FROM work_orders wo ' +
        'LEFT JOIN customers c ON c.id = wo.customer_id ' +
        'LEFT JOIN equipment e ON e.id = wo.equipment_id ' +
        'WHERE wo.status NOT IN (\'donated\', \'abandoned\') AND (' +
        '  (' +
        '    (c.source IS NULL OR c.source != \'referral\') ' +
        '    AND wo.amount_charged > 0 ' +
        '    AND (wo.amount_paid IS NULL OR wo.amount_paid < wo.amount_charged) ' +
        '  ) OR (' +
        '    c.source = \'referral\' ' +
        '    AND wo.referral_dropoff_date IS NOT NULL ' +
        '    AND (wo.shop_payment_received = false OR wo.shop_payment_received IS NULL) ' +
        '  )' +
        ') ' +
        'ORDER BY wo.date_in DESC'
      )
      return NextResponse.json(rows)
    }

    if (type === 'revenue') {
      const { rows } = await pool.query(
        'SELECT ' +
        'TO_CHAR(DATE_TRUNC(\'month\', COALESCE(wo.date_complete, wo.referral_dropoff_date, wo.date_in)), \'YYYY-MM\') as month, ' +
        'COUNT(DISTINCT wo.id) as job_count, ' +
        'COALESCE(SUM(' +
        '  CASE ' +
        '    WHEN COALESCE(wo.shop_payment_amount, 0) > 0 THEN wo.shop_payment_amount ' +
        '    WHEN COALESCE(wo.amount_charged, 0) > 0 THEN wo.amount_charged ' +
        '    ELSE COALESCE(wo.labor_hours, 0) * COALESCE(wo.labor_rate, 80) ' +
        '  END' +
        '), 0) as revenue, ' +
        'COALESCE(SUM(p.cost * p.quantity), 0) as parts_cost ' +
        'FROM work_orders wo ' +
        'LEFT JOIN parts p ON p.work_order_id = wo.id ' +
        'WHERE COALESCE(wo.date_complete, wo.referral_dropoff_date, wo.date_in) IS NOT NULL ' +
        'AND wo.status NOT IN (\'donated\', \'abandoned\') ' +
        'GROUP BY DATE_TRUNC(\'month\', COALESCE(wo.date_complete, wo.referral_dropoff_date, wo.date_in)) ' +
        'ORDER BY DATE_TRUNC(\'month\', COALESCE(wo.date_complete, wo.referral_dropoff_date, wo.date_in)) DESC ' +
        'LIMIT 24'
      )
      return NextResponse.json(rows)
    }

    if (type === 'referral-at-shop') {
      const { rows } = await pool.query(
        'SELECT wo.id, wo.order_number, wo.amount_charged, wo.status, ' +
        'wo.referral_pickup_date, wo.referral_dropoff_date, ' +
        'wo.shop_payment_received, wo.shop_payment_amount, wo.shop_payment_date, ' +
        'c.name as customer_name, c.referral_shop, ' +
        'e.type as equipment_type, e.make, e.model, ' +
        'COALESCE(SUM(p.cost * p.quantity), 0) as parts_cost, ' +
        'COALESCE(SUM(p.price * p.quantity), 0) as parts_charged, ' +
        'wo.commission_paid, wo.commission_paid_date ' +
        'FROM work_orders wo ' +
        'LEFT JOIN customers c ON c.id = wo.customer_id ' +
        'LEFT JOIN equipment e ON e.id = wo.equipment_id ' +
        'LEFT JOIN parts p ON p.work_order_id = wo.id ' +
        'WHERE c.source = \'referral\' ' +
        'AND wo.referral_dropoff_date IS NOT NULL ' +
        'AND (wo.shop_payment_received = false OR wo.shop_payment_received IS NULL) ' +
        'AND wo.status NOT IN (\'donated\', \'abandoned\') ' +
        'GROUP BY wo.id, c.name, c.referral_shop, e.type, e.make, e.model ' +
        'ORDER BY wo.referral_dropoff_date ASC'
      )
      return NextResponse.json(rows)
    }

    if (type === 'referral-trip') {
      const tripDate = searchParams.get('date') || new Date().toISOString().slice(0, 10)
      try {
        const baseSelect =
          'SELECT wo.id, wo.order_number, wo.amount_charged, wo.shop_payment_amount, wo.status, ' +
          'wo.referral_dropoff_date, wo.complaint, wo.work_done, wo.notes, ' +
          'wo.shop_payment_received, ' +
          'c.name as customer_name, c.referral_shop, ' +
          'e.type as equipment_type, e.make, e.model, ' +
          'COALESCE(SUM(p.price * p.quantity), 0) as parts_charged ' +
          'FROM work_orders wo ' +
          'LEFT JOIN customers c ON c.id = wo.customer_id ' +
          'LEFT JOIN equipment e ON e.id = wo.equipment_id ' +
          'LEFT JOIN parts p ON p.work_order_id = wo.id ' +
          'WHERE c.source = \'referral\' AND wo.referral_dropoff_date IS NOT NULL ' +
          'AND wo.status NOT IN (\'donated\', \'abandoned\') '
        const thisTrip = await pool.query(
          baseSelect +
          'AND wo.referral_dropoff_date::date = $1 ' +
          'GROUP BY wo.id, c.name, c.referral_shop, e.type, e.make, e.model ' +
          'ORDER BY c.name ASC',
          [tripDate]
        )
        const outstanding = await pool.query(
          baseSelect +
          'AND wo.referral_dropoff_date::date < $1 ' +
          'AND (wo.shop_payment_received = false OR wo.shop_payment_received IS NULL) ' +
          'GROUP BY wo.id, c.name, c.referral_shop, e.type, e.make, e.model ' +
          'ORDER BY wo.referral_dropoff_date ASC',
          [tripDate]
        )
        return NextResponse.json({ thisTrip: thisTrip.rows, outstanding: outstanding.rows, tripDate })
      } catch (tripErr) {
        return NextResponse.json({ thisTrip: [], outstanding: [], tripDate, error: String(tripErr) })
      }
    }

        if (type === 'referral-history') {
      const { rows } = await pool.query(
        'SELECT wo.id, wo.order_number, wo.status, wo.date_complete, wo.amount_charged, ' +
        'wo.referral_pickup_date, wo.referral_dropoff_date, ' +
        'wo.shop_payment_received, wo.shop_payment_amount, wo.shop_payment_date, ' +
        'wo.labor_hours, wo.labor_rate, ' +
        'c.name as customer_name, c.referral_shop, ' +
        'e.type as equipment_type, e.make, e.model, ' +
        'COALESCE(SUM(p.cost * p.quantity), 0) as parts_cost, ' +
        'COALESCE(SUM(p.price * p.quantity), 0) as parts_charged, ' +
        'wo.commission_paid, wo.commission_paid_date ' +
        'FROM work_orders wo ' +
        'LEFT JOIN customers c ON c.id = wo.customer_id ' +
        'LEFT JOIN equipment e ON e.id = wo.equipment_id ' +
        'LEFT JOIN parts p ON p.work_order_id = wo.id ' +
        'WHERE c.source = \'referral\' ' +
        'AND wo.status NOT IN (\'donated\', \'abandoned\') ' +
        'GROUP BY wo.id, c.name, c.referral_shop, e.type, e.make, e.model ' +
        'ORDER BY wo.created_at DESC'
      )
      return NextResponse.json(rows)
    }

    if (type === 'completed') {
      const { rows } = await pool.query(
        'SELECT wo.id, wo.order_number, wo.date_in, wo.date_complete, wo.amount_charged, wo.amount_paid, ' +
        'wo.technician, wo.labor_hours, wo.labor_rate, ' +
        'c.name as customer_name, c.source as customer_source, c.referral_shop, ' +
        'e.type as equipment_type, e.make, e.model, ' +
        'COALESCE(SUM(p.cost * p.quantity), 0) as parts_cost ' +
        'FROM work_orders wo ' +
        'LEFT JOIN customers c ON c.id = wo.customer_id ' +
        'LEFT JOIN equipment e ON e.id = wo.equipment_id ' +
        'LEFT JOIN parts p ON p.work_order_id = wo.id ' +
        'WHERE wo.status IN (\'complete\', \'picked-up\') ' +
        'AND wo.date_complete >= $1 AND wo.date_complete <= $2 ' +
        'GROUP BY wo.id, c.name, c.source, c.referral_shop, e.type, e.make, e.model ' +
        'ORDER BY wo.date_complete DESC',
        [from, to]
      )
      return NextResponse.json(rows)
    }

    if (type === 'parts-pending') {
      const { rows } = await pool.query(
        'SELECT p.id, p.name, p.part_number, p.supplier, p.quantity, p.cost, p.price, p.date_ordered, ' +
        'wo.id as work_order_id, wo.order_number, ' +
        'c.name as customer_name, ' +
        'e.type as equipment_type, e.make, e.model ' +
        'FROM parts p ' +
        'LEFT JOIN work_orders wo ON wo.id = p.work_order_id ' +
        'LEFT JOIN customers c ON c.id = wo.customer_id ' +
        'LEFT JOIN equipment e ON e.id = wo.equipment_id ' +
        'WHERE p.status = \'ordered\' ' +
        'AND (wo.status IS NULL OR wo.status NOT IN (\'donated\', \'abandoned\')) ' +
        'ORDER BY p.date_ordered ASC NULLS LAST'
      )
      return NextResponse.json(rows)
    }

    if (type === 'parts-report') {
      const { rows } = await pool.query(
        'SELECT wo.id, wo.order_number, wo.date_in, wo.date_complete, wo.status, ' +
        'c.name as customer_name, c.source as customer_source, ' +
        'e.type as equipment_type, e.make, e.model, ' +
        'COALESCE(SUM(p.cost * p.quantity), 0) as parts_cost, ' +
        'COALESCE(SUM(p.price * p.quantity), 0) as parts_charged, ' +
        'COUNT(p.id) as parts_count ' +
        'FROM work_orders wo ' +
        'LEFT JOIN customers c ON c.id = wo.customer_id ' +
        'LEFT JOIN equipment e ON e.id = wo.equipment_id ' +
        'INNER JOIN parts p ON p.work_order_id = wo.id ' +
        'WHERE wo.status NOT IN (\'donated\', \'abandoned\') ' +
        'AND wo.date_in >= $1 AND wo.date_in <= $2 ' +
        'GROUP BY wo.id, wo.order_number, wo.date_in, wo.date_complete, wo.status, ' +
        'c.name, c.source, e.type, e.make, e.model ' +
        'ORDER BY wo.date_in DESC',
        [from, to]
      )
      return NextResponse.json(rows)
    }

    return NextResponse.json({ error: 'Unknown report type' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
