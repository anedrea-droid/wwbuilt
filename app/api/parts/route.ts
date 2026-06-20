import { NextResponse } from 'next/server'
import { getPool, toPart } from '@/lib/db'

export async function GET(req: Request) {
  const pool = getPool()
  const { searchParams } = new URL(req.url)
  const workOrderId = searchParams.get('workOrderId')
  try {
    const { rows } = workOrderId
      ? await pool.query('SELECT * FROM parts WHERE work_order_id = $1 ORDER BY created_at', [workOrderId])
      : await pool.query("SELECT * FROM parts WHERE status = 'ordered' ORDER BY created_at")
    return NextResponse.json(rows.map(toPart))
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const pool = getPool()
  try {
    const body = await req.json()
    const id = crypto.randomUUID()
    const partStatus = body.status === 'received' ? 'received' : 'ordered'
    const dateReceived = body.status === 'received' ? (body.date_received || new Date().toISOString().split('T')[0]) : ''
    const sql = 'INSERT INTO parts (id, work_order_id, name, part_number, supplier, quantity, cost, price, status, date_ordered, date_received, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,\'\') RETURNING *'
    const vals = [id, body.workOrderId, body.name || '', body.partNumber || '', body.supplier || '', body.quantity || 1, body.cost || 0, body.price || 0, partStatus, body.dateOrdered || new Date().toISOString().split('T')[0], dateReceived]
    const { rows } = await pool.query(sql, vals)

    // Auto-update work order status to waiting-parts only if part is on order (not from shop stock)
    if (body.workOrderId && body.status !== 'received') {
      await pool.query(
        "UPDATE work_orders SET status = 'waiting-parts' WHERE id = $1 AND status NOT IN ('complete', 'at-shop', 'picked-up')",
        [body.workOrderId]
      )
    }

    return NextResponse.json(toPart(rows[0]))
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
