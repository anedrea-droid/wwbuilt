import { NextResponse } from 'next/server'
import { getPool, toWorkOrder } from '@/lib/db'

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
    ]
    const dateFields = ['date_in','date_complete','date_picked_up','referral_pickup_date','referral_dropoff_date','shop_payment_date','commission_paid_date']
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
        "UPDATE work_orders SET status = 'picked-up' WHERE id = $1",
        [id]
      )
    } else if (body.referral_dropoff_date) {
      await pool.query(
        "UPDATE work_orders SET status = 'at-shop' WHERE id = $1 AND status NOT IN ('picked-up')",
        [id]
      )
    } else if (body.date_picked_up) {
      await pool.query(
        "UPDATE work_orders SET status = 'picked-up' WHERE id = $1",
        [id]
      )
    } else if (body.date_complete) {
      await pool.query(
        "UPDATE work_orders SET status = 'complete' WHERE id = $1 AND status NOT IN ('at-shop', 'picked-up')",
        [id]
      )
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
