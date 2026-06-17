import { NextResponse } from 'next/server'
import { getPool, toCustomer, toEquipment, toWorkOrder } from '@/lib/db'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const pool = getPool()
  try {
    const { rows: custRows } = await pool.query('SELECT * FROM customers WHERE id = $1', [id])
    if (custRows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const { rows: equipRows } = await pool.query('SELECT * FROM equipment WHERE customer_id = $1 ORDER BY created_at', [id])
    const { rows: woRows } = await pool.query(
      'SELECT wo.*, e.type as eq_type, e.make as eq_make, e.model as eq_model FROM work_orders wo LEFT JOIN equipment e ON wo.equipment_id = e.id WHERE wo.customer_id = $1 ORDER BY wo.created_at DESC',
      [id]
    )
    const workOrders = woRows.map(r => ({
      ...toWorkOrder(r),
      equipment: r.eq_type ? { type: r.eq_type, make: r.eq_make, model: r.eq_model } : null
    }))
    return NextResponse.json({
      customer: toCustomer(custRows[0]),
      equipment: equipRows.map(toEquipment),
      workOrders,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const pool = getPool()
  try {
    const body = await req.json()
    const { rows } = await pool.query(
      'UPDATE customers SET name=$1, phone=$2, email=$3, source=$4, referral_shop=$5, notes=$6 WHERE id=$7 RETURNING *',
      [body.name||'', body.phone||'', body.email||'', body.source||'own', body.referralShop||'', body.notes||'', id]
    )
    return NextResponse.json(toCustomer(rows[0]))
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
    const allowed = ['name','phone','email','source','referral_shop','notes']
    for (const key of allowed) {
      if (body[key] !== undefined) { fields.push(`${key} = $${idx++}`); values.push(body[key]) }
    }
    if (fields.length === 0) return NextResponse.json({ error: 'No fields' }, { status: 400 })
    values.push(id)
    const { rows } = await pool.query(`UPDATE customers SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values)
    return NextResponse.json(toCustomer(rows[0]))
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
    await pool.query('DELETE FROM customers WHERE id = $1', [id])
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
