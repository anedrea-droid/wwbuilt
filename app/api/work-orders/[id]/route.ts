import { NextResponse } from 'next/server'
import { getPool, toWorkOrder } from '@/lib/db'

// Estimate = labor (hours x rate) + parts charged to the customer. Used to fill an empty invoice.
const ESTIMATE_FILL_SQL =
  'UPDATE work_orders wo SET amount_charged = est.total FROM (' +
  'SELECT w.id, ROUND((COALESCE(w.labor_hours, 0) * COALESCE(w.labor_rate, 80) + ' +
  'COALESCE((SELECT SUM(p.price * p.quantity) FROM parts p WHERE p.work_order_id = w.id), 0))::numeric, 2) AS total ' +
  'FROM work_orders w WHERE w.id = $1) est ' +
  'WHERE wo.id = est.id AND est.total > 0 AND (wo.amount_charged IS NULL OR wo.amount_charged = 0)'

const TODAY_CT = "(NOW() AT TIME ZONE 'America/Chicago')::date"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const pool = getPool()
  try {
    const { rows } = await pool.query('SELECT * FROM work_orders WHERE id = $1', [id])
    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(toWorkOrder(rows[0]))
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const pool = getPool()
  try {
    const body = await req.json()
    const { rows: beforeRows } = await pool.query('SELECT * FROM work_orders WHERE id = $1', [id])
    const before = (beforeRows[0] || {}) as Record<string, unknown>
    const fields: string[] = []
    const values: unknown[] = []
    let idx = 1
    const allowed = [
      'status', 'technician', 'complaint', 'diagnosis', 'work_done',
      'labor_hours', 'labor_rate', 'date_in', 'date_complete', 'date_picked_up',
      'notes', 'payment_method', 'amount_charged', 'amount_paid',
      'referral_pickup_date', 'referral_dropoff_date',
      'shop_payment_amount', 'shop_payment_date', 'shop_payment_received',
      'commission_paid', 'commission_paid_date',
      'source', 'referral_shop', 'service_denied',
      'never_paid', 'never_paid_date', 'never_paid_note', 'payment_date',
    ]
    const dateFields = ['date_in','date_complete','date_picked_up','referral_pickup_date','referral_dropoff_date','shop_payment_date','commission_paid_date','never_paid_date','payment_date']
    const numericFields = ['labor_hours','labor_rate','amount_charged','amount_paid','shop_payment_amount']
    for (const key of allowed) {
      if (body[key] !== undefined) {
        let val = body[key]
        if (dateFields.includes(key) && val === '') val = null
        if (numericFields.includes(key) && (val === '' || val === null)) val = null
        fields.push(key + ' = $' + idx++)
        values.push(val)
      }
    }
    if (fields.length === 0) return NextResponse.json({ error: 'No fields' }, { status: 400 })
    values.push(id)
    await pool.query(
      'UPDATE work_orders SET ' + fields.join(', ') + ' WHERE id = $' + idx + ' RETURNING *',
      values
    )

    // Auto-status logic - runs after the main update
    if (body.shop_payment_received === true || body.shop_payment_received === 'true') {
      await pool.query(
        "UPDATE work_orders SET status = 'picked-up' WHERE id = $1 AND status NOT IN ('donated', 'abandoned')",
        [id]
      )
    } else if (body.referral_dropoff_date) {
      await pool.query(
        "UPDATE work_orders SET status = 'at-shop' WHERE id = $1 AND status NOT IN ('picked-up', 'donated', 'abandoned')",
        [id]
      )
    } else if (body.date_picked_up) {
      await pool.query(
        "UPDATE work_orders SET status = 'picked-up' WHERE id = $1 AND status NOT IN ('donated', 'abandoned')",
        [id]
      )
    } else if (body.date_complete) {
      await pool.query(
        "UPDATE work_orders SET status = 'complete' WHERE id = $1 AND status NOT IN ('at-shop', 'picked-up', 'donated', 'abandoned')",
        [id]
      )
    }

    // ---- Invoice + payment smoothing ------------------------------------------
    const { rows: afterRows } = await pool.query('SELECT * FROM work_orders WHERE id = $1', [id])
    const after = (afterRows[0] || {}) as Record<string, unknown>
    const has = (v: unknown) => v !== null && v !== undefined && String(v) !== ''
    const isDone = (r: Record<string, unknown>) =>
      ['complete', 'at-shop', 'picked-up'].includes(String(r.status)) || has(r.date_complete) || has(r.referral_dropoff_date)

    // 1) The moment a job becomes done (marked complete, or returned to the referral shop),
    //    fill an empty invoice from the estimate so reports and receipts always have a number.
    if (!isDone(before) && isDone(after)
        && !(Number(after.amount_charged) > 0)
        && after.payment_method !== 'no charge'
        && !after.service_denied
        && !['donated', 'abandoned'].includes(String(after.status))) {
      await pool.query(ESTIMATE_FILL_SQL, [id])
    }

    // 1b) Equipment becomes WW property (abandoned / donated): the job is closed, so stamp a completion date.
    if (['donated', 'abandoned'].includes(String(after.status)) && !['donated', 'abandoned'].includes(String(before.status)) && !has(after.date_complete)) {
      await pool.query('UPDATE work_orders SET date_complete = ' + TODAY_CT + ' WHERE id = $1', [id])
    }

    // 2) Shop payment marked received: default the amount to the invoice and the date to today.
    if (body.shop_payment_received === true || body.shop_payment_received === 'true') {
      await pool.query(
        'UPDATE work_orders SET shop_payment_amount = amount_charged WHERE id = $1 AND (shop_payment_amount IS NULL OR shop_payment_amount = 0) AND amount_charged > 0',
        [id]
      )
      await pool.query(
        'UPDATE work_orders SET shop_payment_date = ' + TODAY_CT + ' WHERE id = $1 AND (shop_payment_date IS NULL OR shop_payment_date::text = \'\')',
        [id]
      )
    }

    // 3) Customer payment entered: stamp the date paid if none was given; clear it if the payment is removed.
    const paidNow = Number(after.amount_paid) || 0
    const paidBefore = Number(before.amount_paid) || 0
    if (paidNow > paidBefore && !has(after.payment_date)) {
      await pool.query('UPDATE work_orders SET payment_date = ' + TODAY_CT + ' WHERE id = $1', [id])
    } else if (paidNow === 0 && has(after.payment_date)) {
      await pool.query('UPDATE work_orders SET payment_date = NULL WHERE id = $1', [id])
    }

    // Auto-fill standard fields from referral equivalents so reports and
    // payout calculations work correctly for referral work orders.
    //
    // Rule 1: referral_dropoff_date => date_complete (returned to shop = work complete)
    //   Only fills if date_complete is currently null/empty.
    if (body.referral_dropoff_date) {
      await pool.query(
        'UPDATE work_orders SET date_complete = $1 WHERE id = $2 AND (date_complete IS NULL OR date_complete = \'\')',
        [body.referral_dropoff_date, id]
      )
    }

    // Rule 2: shop_payment_amount => amount_charged (shop payment = invoice amount)
    //   Only fills if amount_charged is currently null or 0.
    if (body.shop_payment_amount !== undefined && body.shop_payment_amount !== null && body.shop_payment_amount !== '' && Number(body.shop_payment_amount) > 0) {
      await pool.query(
        'UPDATE work_orders SET amount_charged = $1 WHERE id = $2 AND (amount_charged IS NULL OR amount_charged = 0)',
        [body.shop_payment_amount, id]
      )
    }

    // Rule 3: shop_payment_received + shop_payment_date => date_picked_up + amount_paid + payment_method
    //   Marks when the customer paid the shop and WW was settled.
    if (body.shop_payment_received === true || body.shop_payment_received === 'true') {
      const payDate = body.shop_payment_date || null
      // date_picked_up: use shop_payment_date if available, otherwise today
      const pickupDate = payDate || new Date().toISOString().slice(0, 10)
      await pool.query(
        'UPDATE work_orders SET date_picked_up = $1 WHERE id = $2 AND (date_picked_up IS NULL OR date_picked_up = \'\')',
        [pickupDate, id]
      )
      // amount_paid: fill from shop_payment_amount
      await pool.query(
        'UPDATE work_orders SET amount_paid = shop_payment_amount WHERE id = $1 AND (amount_paid IS NULL OR amount_paid = 0) AND shop_payment_amount IS NOT NULL',
        [id]
      )
      // payment_method: mark as referral shop payment
      await pool.query(
        "UPDATE work_orders SET payment_method = 'Referral Shop' WHERE id = $1 AND (payment_method IS NULL OR payment_method = '')",
        [id]
      )
    }

    // Never-paid write-off (equipment went back and we never got paid).
    //   Flagged:   stamp today's date if none was given, and if the job was still
    //              showing 'at-shop' or 'complete' (ready for pickup), close it out as
    //              gone (picked-up) - the equipment is no longer here.
    //   Un-flagged: clear the date and note so it can be re-marked cleanly later.
    if (body.never_paid === true || body.never_paid === 'true') {
      await pool.query(
        'UPDATE work_orders SET never_paid_date = CURRENT_DATE WHERE id = $1 AND never_paid_date IS NULL',
        [id]
      )
      await pool.query(
        "UPDATE work_orders SET status = 'picked-up' WHERE id = $1 AND status IN ('at-shop', 'complete')",
        [id]
      )
    } else if (body.never_paid === false || body.never_paid === 'false') {
      await pool.query(
        'UPDATE work_orders SET never_paid_date = NULL, never_paid_note = NULL WHERE id = $1',
        [id]
      )
    }

    // Re-fetch final state after all updates
    const { rows: final } = await pool.query('SELECT * FROM work_orders WHERE id = $1', [id])
    return NextResponse.json(toWorkOrder(final[0]))
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const pool = getPool()
  try {
    await pool.query('DELETE FROM work_orders WHERE id = $1', [id])
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
