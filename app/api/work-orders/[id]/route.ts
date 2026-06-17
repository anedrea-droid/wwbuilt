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
    const allowed = ['status','technician','complaint','diagnosis','work_done','labor_hours','labor_rate','date_in','date_complete','date_picked_up','notes','payment_method','amount_charged','amount_paid']
    for (const key of allowed) {
      if (body[key] !== undefined) { fields.push(`${key} = $${idx++}`); values.push(body[key]) }
    }
    if (fields.length === 0) return NextResponse.json({ error: 'No fields' }, { status: 400 })
    values.push(id)
    const { rows } = await pool.query(`UPDATE work_orders SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values)
    return NextResponse.json(toWorkOrder(rows[0]))
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
