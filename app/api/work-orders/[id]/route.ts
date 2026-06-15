import { NextResponse } from 'next/server'
import { getPool, toWorkOrder, toPart } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const pool = getPool()

  const { rows } = await pool.query(
    `SELECT wo.*,
       c.id as c_id, c.name as c_name, c.phone as c_phone, c.source as c_source, c.referral_shop as c_referral_shop,
       e.id as e_id, e.type as e_type, e.make as e_make, e.model as e_model, e.serial_number as e_serial_number
     FROM work_orders wo
     LEFT JOIN customers c ON wo.customer_id = c.id
     LEFT JOIN equipment e ON wo.equipment_id = e.id
     WHERE wo.id = $1`,
    [id]
  )

  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const r = rows[0]

  const { rows: parts } = await pool.query(
    `SELECT * FROM parts WHERE work_order_id = $1 ORDER BY created_at`, [id]
  )

  return NextResponse.json({
    ...toWorkOrder(r),
    customer: r.c_id ? { id: r.c_id, name: r.c_name, phone: r.c_phone, source: r.c_source, referralShop: r.c_referral_shop } : undefined,
    equipment: r.e_id ? { id: r.e_id, type: r.e_type, make: r.e_make, model: r.e_model, serialNumber: r.e_serial_number } : undefined,
    parts: parts.map(toPart),
  })
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const pool = getPool()
  const body = await request.json()

  const fields: string[] = []
  const values: unknown[] = []

  const map: Record<string, string> = {
    status: 'status', technician: 'technician', diagnosis: 'diagnosis',
    workDone: 'work_done', laborHours: 'labor_hours', laborRate: 'labor_rate',
    dateIn: 'date_in', dateComplete: 'date_complete', datePickedUp: 'date_picked_up',
    notes: 'notes', paymentMethod: 'payment_method',
    amountCharged: 'amount_charged', amountPaid: 'amount_paid',
  }

  for (const [key, col] of Object.entries(map)) {
    if (body[key] !== undefined) {
      fields.push(`${col} = $${values.length + 1}`)
      values.push(body[key])
    }
  }
  fields.push(`updated_at = NOW()`)
  values.push(id)

  await pool.query(
    `UPDATE work_orders SET ${fields.join(', ')} WHERE id = $${values.length}`,
    values
  )

  // Return full updated object
  const { rows } = await pool.query(
    `SELECT wo.*,
       c.id as c_id, c.name as c_name, c.phone as c_phone, c.source as c_source, c.referral_shop as c_referral_shop,
       e.id as e_id, e.type as e_type, e.make as e_make, e.model as e_model, e.serial_number as e_serial_number
     FROM work_orders wo
     LEFT JOIN customers c ON wo.customer_id = c.id
     LEFT JOIN equipment e ON wo.equipment_id = e.id
     WHERE wo.id = $1`, [id]
  )
  const r = rows[0]

  const { rows: parts } = await pool.query(
    `SELECT * FROM parts WHERE work_order_id = $1 ORDER BY created_at`, [id]
  )

  return NextResponse.json({
    ...toWorkOrder(r),
    customer: r.c_id ? { id: r.c_id, name: r.c_name, phone: r.c_phone, source: r.c_source, referralShop: r.c_referral_shop } : undefined,
    equipment: r.e_id ? { id: r.e_id, type: r.e_type, make: r.e_make, model: r.e_model, serialNumber: r.e_serial_number } : undefined,
    parts: parts.map(toPart),
  })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const pool = getPool()
  await pool.query(`DELETE FROM parts WHERE work_order_id = $1`, [id])
  await pool.query(`DELETE FROM work_orders WHERE id = $1`, [id])
  return NextResponse.json({ success: true })
}
