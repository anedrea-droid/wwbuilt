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
    // shop_payment_received = true -> picked-up (job fully settled)
    if (body.shop_payment_received === true || body.shop_payment_received === 'true') {
      await pool.query(
        "UPDATE work_orders SET status = 'picked-up' WHERE id = $1 AND status = 'at-shop'",
        [id]
      )
    // referral_dropoff_date set -> at-shop (WW returned it, waiting for shop payment)
    } else if (body.referral_dropoff_date) {
      await pool.query(
        "UPDATE work_orders SET status = 'at-shop' WHERE id = $1",
        [id]
      )
    }
    // date_picked_up set -> picked-up (highest priority for non-referral)
    else if (body.date_picked_up) {
      await pool.query(
        "UPDATE work_orders SET status = 'picked-up' WHERE id = $1",
        [id]
      )
    }
    // date_complete set -> complete (only if not already at-shop or picked-up)
    else if (body.date_complete) {
      await pool.query(
        "UPDATE work_orders SET status = 'complete' WHERE id = $1 AND status NOT IN ('at-shop', 'picked-up')",
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
