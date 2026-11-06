import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'

// The most recent Thursday strictly before today, in Central time (YYYY-MM-DD).
// If today is Thursday this is last week's Thursday.
function lastThursdayCutoff(): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(new Date())
  const get = (t: string) => parts.find(x => x.type === t)?.value || ''
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'))
  const daysBack = ((dow - 4 + 7) % 7) || 7
  const todayUtc = Date.UTC(Number(get('year')), Number(get('month')) - 1, Number(get('day')))
  return new Date(todayUtc - daysBack * 86400000).toISOString().slice(0, 10)
}

export async function GET(req: Request) {
  const pool = getPool()
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const from = searchParams.get('from') || '2020-01-01'
  const to = searchParams.get('to') || '2099-12-31'

  try {
    if (type === 'payouts') {
      const { rows } = await pool.query(
        'SELECT wo.id, wo.order_number, wo.date_complete, wo.referral_dropoff_date, wo.date_in, ' +
        'COALESCE(NULLIF(wo.payment_date::text,\'\'), NULLIF(wo.date_complete::text,\'\'), NULLIF(wo.referral_dropoff_date::text,\'\'), NULLIF(wo.date_in::text,\'\'))::date as effective_date, ' +
        'wo.amount_charged, wo.amount_paid, wo.labor_hours, wo.labor_rate, wo.technician, ' +
        'wo.shop_payment_amount, wo.shop_payment_received, wo.status, ' +
        'c.name as customer_name, COALESCE(wo.source, c.source) as customer_source, COALESCE(wo.referral_shop, c.referral_shop) as referral_shop, ' +
        'COALESCE(SUM(p.cost * p.quantity), 0) as parts_cost, ' +
        'COALESCE(SUM(p.price * p.quantity), 0) as parts_charged, ' +
        'wo.commission_paid, wo.commission_paid_date ' +
        'FROM work_orders wo ' +
        'LEFT JOIN customers c ON c.id = wo.customer_id ' +
        'LEFT JOIN parts p ON p.work_order_id = wo.id ' +
        'WHERE COALESCE(NULLIF(wo.payment_date::text,\'\'), NULLIF(wo.date_complete::text,\'\'), NULLIF(wo.referral_dropoff_date::text,\'\'), NULLIF(wo.date_in::text,\'\'))::date >= $1 ' +
        'AND COALESCE(NULLIF(wo.payment_date::text,\'\'), NULLIF(wo.date_complete::text,\'\'), NULLIF(wo.referral_dropoff_date::text,\'\'), NULLIF(wo.date_in::text,\'\'))::date <= $2 ' +
        'AND wo.status NOT IN (\'donated\', \'abandoned\') AND COALESCE(wo.never_paid, false) = false ' +
        'AND (' +
        '  ((COALESCE(wo.source, c.source) IS NULL OR COALESCE(wo.source, c.source) != \'referral\') AND wo.status IN (\'complete\', \'picked-up\'))' +
        '  OR (COALESCE(wo.source, c.source) = \'referral\' AND wo.status IN (\'at-shop\', \'complete\', \'picked-up\'))' +
        ') ' +
        'GROUP BY wo.id, c.name, c.source, c.referral_shop ' +
        'ORDER BY effective_date DESC',
        [from, to]
      )
      return NextResponse.json(rows)
    }

    if (type === 'outstanding') {
      const { rows } = await pool.query(
        'SELECT wo.id, wo.order_number, wo.date_in, wo.status, ' +
        'wo.date_complete, wo.referral_dropoff_date, ' +
        'c.name as customer_name, c.phone as customer_phone, COALESCE(wo.source, c.source) as customer_source, COALESCE(wo.referral_shop, c.referral_shop) as referral_shop, ' +
        'e.type as equipment_type, e.make, e.model, ' +
        'CASE WHEN COALESCE(wo.source, c.source) = \'referral\' THEN COALESCE(NULLIF(wo.shop_payment_amount,0), wo.amount_charged) ' +
        '     ELSE wo.amount_charged END as amount_charged, ' +
        'CASE WHEN COALESCE(wo.source, c.source) = \'referral\' THEN 0 ' +
        '     ELSE COALESCE(wo.amount_paid, 0) END as amount_paid ' +
        'FROM work_orders wo ' +
        'LEFT JOIN customers c ON c.id = wo.customer_id ' +
        'LEFT JOIN equipment e ON e.id = wo.equipment_id ' +
        'WHERE wo.status NOT IN (\'donated\', \'abandoned\') AND COALESCE(wo.never_paid, false) = false ' +
        'AND COALESCE(wo.payment_method, \'\') != \'no charge\' ' +
        'AND (' +
        '  (' +
        '    (COALESCE(wo.source, c.source) IS NULL OR COALESCE(wo.source, c.source) != \'referral\') ' +
        '    AND wo.status IN (\'complete\', \'picked-up\') ' +
        '    AND NOT (wo.amount_charged > 0 AND COALESCE(wo.amount_paid, 0) >= wo.amount_charged) ' +
        '  ) OR (' +
        '    COALESCE(wo.source, c.source) = \'referral\' ' +
        '    AND wo.referral_dropoff_date IS NOT NULL ' +
        '    AND (wo.shop_payment_received = false OR wo.shop_payment_received IS NULL) ' +
        '  )' +
        ') ' +
        'ORDER BY wo.date_in DESC'
      )
      return NextResponse.json(rows)
    }

    if (type === 'needs-reminder') {
      // "Newly ready - not texted yet": unpaid jobs that became ready on or after the most
      // recent Thursday and haven't had a pickup text since they became ready. Equipment
      // that has been ready longer is handled by the 'thursday-check' report.
      // Only jobs where the equipment should still be here (ready for pickup / at the
      // referral shop) and the customer has a phone number you could text.
      const cutoff = lastThursdayCutoff()
      const { rows } = await pool.query(
        'SELECT wo.id, wo.order_number, wo.date_in, wo.status, ' +
        'wo.date_complete, wo.referral_dropoff_date, ' +
        'c.name as customer_name, c.phone as customer_phone, COALESCE(wo.source, c.source) as customer_source, COALESCE(wo.referral_shop, c.referral_shop) as referral_shop, ' +
        'e.type as equipment_type, e.make, e.model, ' +
        'CASE WHEN COALESCE(wo.source, c.source) = \'referral\' THEN COALESCE(NULLIF(wo.shop_payment_amount,0), wo.amount_charged) ' +
        '     ELSE wo.amount_charged END as amount_charged, ' +
        'CASE WHEN COALESCE(wo.source, c.source) = \'referral\' THEN 0 ' +
        '     ELSE COALESCE(wo.amount_paid, 0) END as amount_paid, ' +
        'lastText.last_text_at ' +
        'FROM work_orders wo ' +
        'LEFT JOIN customers c ON c.id = wo.customer_id ' +
        'LEFT JOIN equipment e ON e.id = wo.equipment_id ' +
        'LEFT JOIN LATERAL (' +
        '  SELECT MAX(cl.created_at) as last_text_at FROM contact_log cl ' +
        '  WHERE cl.work_order_id = wo.id AND cl.type = \'text\'' +
        ') lastText ON true ' +
        'WHERE wo.status IN (\'complete\', \'at-shop\') AND COALESCE(wo.never_paid, false) = false ' +
        'AND COALESCE(wo.payment_method, \'\') != \'no charge\' ' +
        'AND c.phone IS NOT NULL AND TRIM(c.phone) <> \'\' ' +
        'AND (' +
        '  (' +
        '    (COALESCE(wo.source, c.source) IS NULL OR COALESCE(wo.source, c.source) != \'referral\') ' +
        '    AND wo.status = \'complete\' ' +
        '    AND NOT (wo.amount_charged > 0 AND COALESCE(wo.amount_paid, 0) >= wo.amount_charged) ' +
        '  ) OR (' +
        '    COALESCE(wo.source, c.source) = \'referral\' ' +
        '    AND wo.referral_dropoff_date IS NOT NULL ' +
        '    AND (wo.shop_payment_received = false OR wo.shop_payment_received IS NULL) ' +
        '  )' +
        ') ' +
        'AND COALESCE(NULLIF(wo.referral_dropoff_date::text,\'\'), NULLIF(wo.date_complete::text,\'\'), NULLIF(wo.date_in::text,\'\'))::date >= $1::date ' +
        'AND (lastText.last_text_at IS NULL OR lastText.last_text_at < (COALESCE(NULLIF(wo.referral_dropoff_date::text,\'\'), NULLIF(wo.date_complete::text,\'\'), NULLIF(wo.date_in::text,\'\'))::date)::timestamp AT TIME ZONE \'America/Chicago\') ' +
        'ORDER BY wo.date_in ASC',
        [cutoff]
      )
      return NextResponse.json(rows)
    }

    if (type === 'denied-service') {
      const { rows } = await pool.query(
        'SELECT wo.id, wo.order_number, wo.date_in, wo.date_complete, wo.status, wo.technician, ' +
        'wo.amount_charged, wo.amount_paid, wo.payment_method, ' +
        'COALESCE(wo.referral_shop, c.referral_shop) as referral_shop, ' +
        'c.name as customer_name, c.phone as customer_phone, ' +
        'e.type as equipment_type, e.make, e.model ' +
        'FROM work_orders wo ' +
        'LEFT JOIN customers c ON c.id = wo.customer_id ' +
        'LEFT JOIN equipment e ON e.id = wo.equipment_id ' +
        'WHERE wo.service_denied = true ' +
        'ORDER BY wo.date_in DESC'
      )
      return NextResponse.json(rows)
    }

    if (type === 'revenue') {
      const { rows } = await pool.query(
        'SELECT ' +
        'TO_CHAR(DATE_TRUNC(\'month\', COALESCE(NULLIF(wo.date_complete::text,\'\'), NULLIF(wo.referral_dropoff_date::text,\'\'), NULLIF(wo.date_in::text,\'\'))::date), \'YYYY-MM\') as month, ' +
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
        'WHERE COALESCE(NULLIF(wo.date_complete::text,\'\'), NULLIF(wo.referral_dropoff_date::text,\'\'), NULLIF(wo.date_in::text,\'\'))::date IS NOT NULL ' +
        'AND wo.status NOT IN (\'donated\', \'abandoned\') AND COALESCE(wo.never_paid, false) = false ' +
        'GROUP BY DATE_TRUNC(\'month\', COALESCE(NULLIF(wo.date_complete::text,\'\'), NULLIF(wo.referral_dropoff_date::text,\'\'), NULLIF(wo.date_in::text,\'\'))::date) ' +
        'ORDER BY DATE_TRUNC(\'month\', COALESCE(NULLIF(wo.date_complete::text,\'\'), NULLIF(wo.referral_dropoff_date::text,\'\'), NULLIF(wo.date_in::text,\'\'))::date) DESC ' +
        'LIMIT 24'
      )
      return NextResponse.json(rows)
    }

    if (type === 'referral-at-shop') {
      const { rows } = await pool.query(
        'SELECT wo.id, wo.order_number, wo.amount_charged, wo.status, ' +
        'wo.referral_pickup_date, wo.referral_dropoff_date, ' +
        'wo.shop_payment_received, wo.shop_payment_amount, wo.shop_payment_date, ' +
        'c.name as customer_name, COALESCE(wo.referral_shop, c.referral_shop) as referral_shop, ' +
        'e.type as equipment_type, e.make, e.model, ' +
        'COALESCE(SUM(p.cost * p.quantity), 0) as parts_cost, ' +
        'COALESCE(SUM(p.price * p.quantity), 0) as parts_charged, ' +
        'wo.commission_paid, wo.commission_paid_date ' +
        'FROM work_orders wo ' +
        'LEFT JOIN customers c ON c.id = wo.customer_id ' +
        'LEFT JOIN equipment e ON e.id = wo.equipment_id ' +
        'LEFT JOIN parts p ON p.work_order_id = wo.id ' +
        'WHERE COALESCE(wo.source, c.source) = \'referral\' ' +
        'AND wo.referral_dropoff_date IS NOT NULL ' +
        'AND (wo.shop_payment_received = false OR wo.shop_payment_received IS NULL) ' +
        'AND wo.status NOT IN (\'donated\', \'abandoned\') AND COALESCE(wo.never_paid, false) = false ' +
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
          'wo.labor_hours, wo.labor_rate, ' +
          'COALESCE(wo.labor_hours, 0) * COALESCE(wo.labor_rate, 80) * 0.20 AS owes_amount, ' +
          'wo.referral_dropoff_date, wo.complaint, wo.work_done, wo.notes, ' +
          'wo.shop_payment_received, ' +
          'c.name as customer_name, COALESCE(wo.referral_shop, c.referral_shop) as referral_shop, ' +
          'e.type as equipment_type, e.make, e.model, ' +
          'COALESCE(SUM(p.price * p.quantity), 0) as parts_charged ' +
          'FROM work_orders wo ' +
          'LEFT JOIN customers c ON c.id = wo.customer_id ' +
          'LEFT JOIN equipment e ON e.id = wo.equipment_id ' +
          'LEFT JOIN parts p ON p.work_order_id = wo.id ' +
          'WHERE COALESCE(wo.source, c.source) = \'referral\' AND wo.referral_dropoff_date IS NOT NULL ' +
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
          'AND COALESCE(wo.never_paid, false) = false ' +
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

    if (type === 'shop-settlement') {
      const settleDate = searchParams.get('date') || new Date().toISOString().slice(0, 10)
      const { rows } = await pool.query(
        'SELECT wo.id, wo.order_number, wo.shop_payment_amount, wo.shop_payment_date, wo.amount_charged, ' +
        'wo.labor_hours, wo.labor_rate, wo.technician, wo.date_complete, wo.referral_dropoff_date, wo.date_in, ' +
        'c.name as customer_name, COALESCE(wo.referral_shop, c.referral_shop) as referral_shop, ' +
        'e.type as equipment_type, e.make, e.model, ' +
        'COALESCE(SUM(p.price * p.quantity), 0) as parts_charged, ' +
        'COALESCE(SUM(p.cost * p.quantity), 0) as parts_cost ' +
        'FROM work_orders wo ' +
        'LEFT JOIN customers c ON c.id = wo.customer_id ' +
        'LEFT JOIN equipment e ON e.id = wo.equipment_id ' +
        'LEFT JOIN parts p ON p.work_order_id = wo.id ' +
        'WHERE COALESCE(wo.source, c.source) = \'referral\' ' +
        'AND wo.shop_payment_received = true ' +
        'AND wo.shop_payment_date::date = $1 ' +
        'GROUP BY wo.id, c.name, c.referral_shop, e.type, e.make, e.model ' +
        'ORDER BY c.name ASC',
        [settleDate]
      )
      return NextResponse.json({ rows, settleDate })
    }

        if (type === 'referral-history') {
      const { rows } = await pool.query(
        'SELECT wo.id, wo.order_number, wo.status, wo.date_complete, wo.amount_charged, ' +
        'wo.referral_pickup_date, wo.referral_dropoff_date, ' +
        'wo.shop_payment_received, wo.shop_payment_amount, wo.shop_payment_date, ' +
        'wo.never_paid, wo.never_paid_date, ' +
        'wo.labor_hours, wo.labor_rate, ' +
        'c.name as customer_name, COALESCE(wo.referral_shop, c.referral_shop) as referral_shop, ' +
        'e.type as equipment_type, e.make, e.model, ' +
        'COALESCE(SUM(p.cost * p.quantity), 0) as parts_cost, ' +
        'COALESCE(SUM(p.price * p.quantity), 0) as parts_charged, ' +
        'wo.commission_paid, wo.commission_paid_date ' +
        'FROM work_orders wo ' +
        'LEFT JOIN customers c ON c.id = wo.customer_id ' +
        'LEFT JOIN equipment e ON e.id = wo.equipment_id ' +
        'LEFT JOIN parts p ON p.work_order_id = wo.id ' +
        'WHERE COALESCE(wo.source, c.source) = \'referral\' ' +
        'AND wo.status NOT IN (\'donated\', \'abandoned\') ' +
        'GROUP BY wo.id, c.name, c.referral_shop, e.type, e.make, e.model ' +
        'ORDER BY wo.created_at DESC'
      )
      return NextResponse.json(rows)
    }

    if (type === 'completed') {
      const { rows } = await pool.query(
        'SELECT wo.id, wo.order_number, wo.date_in, wo.date_complete, wo.amount_charged, wo.amount_paid, ' +
        'COALESCE(NULLIF(wo.date_complete::text,\'\'), NULLIF(wo.referral_dropoff_date::text,\'\'), NULLIF(wo.date_in::text,\'\'))::date as effective_date, ' +
        'wo.technician, wo.labor_hours, wo.labor_rate, ' +
        'c.name as customer_name, COALESCE(wo.source, c.source) as customer_source, COALESCE(wo.referral_shop, c.referral_shop) as referral_shop, ' +
        'e.type as equipment_type, e.make, e.model, ' +
        'COALESCE(SUM(p.cost * p.quantity), 0) as parts_cost ' +
        'FROM work_orders wo ' +
        'LEFT JOIN customers c ON c.id = wo.customer_id ' +
        'LEFT JOIN equipment e ON e.id = wo.equipment_id ' +
        'LEFT JOIN parts p ON p.work_order_id = wo.id ' +
        'WHERE wo.status IN (\'complete\', \'picked-up\') ' +
        'AND COALESCE(NULLIF(wo.date_complete::text,\'\'), NULLIF(wo.referral_dropoff_date::text,\'\'), NULLIF(wo.date_in::text,\'\'))::date >= $1 ' +
        'AND COALESCE(NULLIF(wo.date_complete::text,\'\'), NULLIF(wo.referral_dropoff_date::text,\'\'), NULLIF(wo.date_in::text,\'\'))::date <= $2 ' +
        'GROUP BY wo.id, c.name, c.source, c.referral_shop, e.type, e.make, e.model ' +
        'ORDER BY effective_date DESC',
        [from, to]
      )
      return NextResponse.json(rows)
    }

    if (type === 'open') {
      const { rows } = await pool.query(
        'SELECT wo.id, wo.order_number, wo.date_in, wo.status, wo.technician, ' +
        'c.name as customer_name, COALESCE(wo.source, c.source) as customer_source, COALESCE(wo.referral_shop, c.referral_shop) as referral_shop, ' +
        'e.type as equipment_type, e.make, e.model ' +
        'FROM work_orders wo ' +
        'LEFT JOIN customers c ON c.id = wo.customer_id ' +
        'LEFT JOIN equipment e ON e.id = wo.equipment_id ' +
        'WHERE wo.status NOT IN (\'complete\', \'picked-up\', \'donated\', \'abandoned\', \'at-shop\') ' +
        'ORDER BY wo.date_in ASC'
      )
      return NextResponse.json(rows)
    }

    if (type === 'donated-abandoned') {
      const { rows } = await pool.query(
        'SELECT wo.id, wo.order_number, wo.date_in, wo.status, wo.complaint, ' +
        'c.name as customer_name, COALESCE(wo.source, c.source) as customer_source, COALESCE(wo.referral_shop, c.referral_shop) as referral_shop, ' +
        'e.type as equipment_type, e.make, e.model, e.serial_number, ' +
        'se.status as shop_status, se.asking_price, se.sale_price, se.sale_date, se.condition_notes ' +
        'FROM work_orders wo ' +
        'LEFT JOIN customers c ON c.id = wo.customer_id ' +
        'LEFT JOIN equipment e ON e.id = wo.equipment_id ' +
        'LEFT JOIN shop_equipment se ON se.work_order_id = wo.id ' +
        'WHERE wo.status IN (\'donated\', \'abandoned\') ' +
        'ORDER BY wo.date_in DESC'
      )
      return NextResponse.json(rows)
    }

    if (type === 'never-paid') {
      // Every work order Cavin's did NOT get paid for, one way or another:
      //   never-paid  - flagged on the work order (e.g. returned to a referral shop, never paid)
      //   donated / abandoned - equipment became WW property
      //   no-charge   - deliberately done for free
      const { rows } = await pool.query(
        'SELECT wo.id, wo.order_number, wo.date_in, wo.date_complete, wo.status, wo.technician, ' +
        'wo.referral_dropoff_date, wo.never_paid_date, wo.never_paid_note, ' +
        'wo.amount_charged, wo.amount_paid, wo.shop_payment_amount, wo.labor_hours, wo.labor_rate, wo.payment_method, ' +
        'CASE ' +
        '  WHEN wo.never_paid = true THEN \'never-paid\' ' +
        '  WHEN wo.status = \'donated\' THEN \'donated\' ' +
        '  WHEN wo.status = \'abandoned\' THEN \'abandoned\' ' +
        '  ELSE \'no-charge\' ' +
        'END as reason, ' +
        'c.name as customer_name, c.phone as customer_phone, ' +
        'COALESCE(wo.source, c.source) as customer_source, COALESCE(wo.referral_shop, c.referral_shop) as referral_shop, ' +
        'e.type as equipment_type, e.make, e.model, ' +
        'COALESCE(SUM(p.cost * p.quantity), 0) as parts_cost, ' +
        'COALESCE(SUM(p.price * p.quantity), 0) as parts_charged ' +
        'FROM work_orders wo ' +
        'LEFT JOIN customers c ON c.id = wo.customer_id ' +
        'LEFT JOIN equipment e ON e.id = wo.equipment_id ' +
        'LEFT JOIN parts p ON p.work_order_id = wo.id ' +
        'WHERE (wo.never_paid = true OR wo.status IN (\'donated\', \'abandoned\') OR wo.payment_method = \'no charge\') ' +
        'GROUP BY wo.id, c.name, c.phone, c.source, c.referral_shop, e.type, e.make, e.model ' +
        'ORDER BY COALESCE(wo.never_paid_date::text, NULLIF(wo.referral_dropoff_date::text, \'\'), NULLIF(wo.date_complete::text, \'\'), NULLIF(wo.date_in::text, \'\')) DESC NULLS LAST'
      )
      return NextResponse.json(rows)
    }

    if (type === 'thursday-check') {
      // Equipment you would have texted about last Thursday, but didn't:
      // still unpaid, ready (or returned to a referral shop) BEFORE last Thursday, and no
      // pickup-reminder text logged since then. Since you only skip the text when the
      // customer has no phone or the equipment isn't there, these are the "equipment is
      // probably gone, nothing recorded as paid" jobs.
      const cutoff = lastThursdayCutoff()
      const { rows } = await pool.query(
        'SELECT wo.id, wo.order_number, wo.date_in, wo.status, wo.date_complete, wo.referral_dropoff_date, ' +
        'c.name as customer_name, c.phone as customer_phone, ' +
        '(c.phone IS NOT NULL AND TRIM(c.phone) <> \'\') as has_phone, ' +
        'COALESCE(wo.source, c.source) as customer_source, COALESCE(wo.referral_shop, c.referral_shop) as referral_shop, ' +
        'e.type as equipment_type, e.make, e.model, ' +
        'CASE WHEN COALESCE(wo.source, c.source) = \'referral\' THEN COALESCE(NULLIF(wo.shop_payment_amount,0), wo.amount_charged) ' +
        '     ELSE wo.amount_charged END as amount_charged, ' +
        'CASE WHEN COALESCE(wo.source, c.source) = \'referral\' THEN 0 ' +
        '     ELSE COALESCE(wo.amount_paid, 0) END as amount_paid, ' +
        'lastText.last_text_at ' +
        'FROM work_orders wo ' +
        'LEFT JOIN customers c ON c.id = wo.customer_id ' +
        'LEFT JOIN equipment e ON e.id = wo.equipment_id ' +
        'LEFT JOIN LATERAL (' +
        '  SELECT MAX(cl.created_at) as last_text_at FROM contact_log cl ' +
        '  WHERE cl.work_order_id = wo.id AND cl.type = \'text\'' +
        ') lastText ON true ' +
        'WHERE wo.status NOT IN (\'donated\', \'abandoned\') AND COALESCE(wo.never_paid, false) = false ' +
        'AND COALESCE(wo.payment_method, \'\') != \'no charge\' ' +
        'AND (' +
        '  (' +
        '    (COALESCE(wo.source, c.source) IS NULL OR COALESCE(wo.source, c.source) != \'referral\') ' +
        '    AND wo.status IN (\'complete\', \'picked-up\') ' +
        '    AND NOT (wo.amount_charged > 0 AND COALESCE(wo.amount_paid, 0) >= wo.amount_charged) ' +
        '  ) OR (' +
        '    COALESCE(wo.source, c.source) = \'referral\' ' +
        '    AND wo.referral_dropoff_date IS NOT NULL ' +
        '    AND (wo.shop_payment_received = false OR wo.shop_payment_received IS NULL) ' +
        '  )' +
        ') ' +
        'AND COALESCE(NULLIF(wo.referral_dropoff_date::text,\'\'), NULLIF(wo.date_complete::text,\'\'), NULLIF(wo.date_in::text,\'\'))::date < $1::date ' +
        'AND (lastText.last_text_at IS NULL OR lastText.last_text_at < ($1::date)::timestamp AT TIME ZONE \'America/Chicago\') ' +
        'ORDER BY wo.date_in ASC',
        [cutoff]
      )
      return NextResponse.json({ rows, cutoff })
    }

    if (type === 'no-charge') {
      const { rows } = await pool.query(
        'SELECT wo.id, wo.order_number, wo.date_in, wo.date_complete, wo.status, wo.complaint, ' +
        'c.name as customer_name, COALESCE(wo.source, c.source) as customer_source, COALESCE(wo.referral_shop, c.referral_shop) as referral_shop, ' +
        'e.type as equipment_type, e.make, e.model, ' +
        'COALESCE(SUM(p.cost * p.quantity), 0) as parts_cost ' +
        'FROM work_orders wo ' +
        'LEFT JOIN customers c ON c.id = wo.customer_id ' +
        'LEFT JOIN equipment e ON e.id = wo.equipment_id ' +
        'LEFT JOIN parts p ON p.work_order_id = wo.id ' +
        'WHERE wo.payment_method = \'no charge\' ' +
        'GROUP BY wo.id, c.name, c.source, c.referral_shop, e.type, e.make, e.model ' +
        'ORDER BY wo.date_in DESC'
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
        'c.name as customer_name, COALESCE(wo.source, c.source) as customer_source, ' +
        'e.type as equipment_type, e.make, e.model, ' +
        'COALESCE(SUM(p.cost * p.quantity), 0) as parts_cost, ' +
        'COALESCE(SUM(p.price * p.quantity), 0) as parts_charged, ' +
        'COUNT(p.id) as parts_count, ' +
        'STRING_AGG(p.name || CASE WHEN p.quantity > 1 THEN \'  (x\' || p.quantity || \')\'  ELSE \'\' END, \', \' ORDER BY p.name) as part_names ' +
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
