import { NextResponse } from 'next/server'
import { getPool, toWorkOrder, toCustomer, toEquipment, toPart } from '@/lib/db'

export async function GET(request: Request) {
  const pool = getPool()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const technician = searchParams.get('technician')
  const customerId = searchParams.get('customerId')

  const conditions: string[] = []
  const values: unknown[] = []

  if (status)      { conditions.push(`wo.status = $${values.length + 1}`);       values.push(status) }
  if (technician)  { conditions.push(`wo.technician = $${values.length + 1}`);   values.push(technician) }
  if (customerId)  { conditions.push(`wo.customer_id = $${values.length + 1}`);  values.push(customerId) }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const { rows: woRows } = await pool.query(
    `SELECT wo.*,
       c.id as c_id, c.name as c_name, c.phone as c_phone, c.source as c_source, c.referral_shop as c_referral_shop,
       e.id as e_id, e.type as e_type, e.make as e_make, e.model as e_model, e.serial_number as e_serial_number
     FROM work_orders wo
     LEFT JOIN customers c ON wo.customer_id = c.id
     LEFT JOIN equipment e ON wo.equipment_id = e.id
     ${where}
     ORDER BY wo.created_at DESC`,
    values
  )

  if (!woRows.length) return NextResponse.json([])

  const woIds = woRows.map(r => r.id)
  const { rows: partRows } = await pool.query(
    `SELECT * FROM parts WHERE work_order_id = ANY($1) ORDER BY created_at`,
    [woIds]
  )

  const result = woRows.map(row => ({
    ...toWorkOrder(row),
    customer: row.c_id ? { id: row.c_id, name: row.c_name, phone: row.c_phone, source: row.c_source, referralShop: row.c_referral_shop } : undefined,
    equipment: row.e_id ? { id: row.e_id, type: row.e_type, make: row.e_make, model: row.e_model, serialNumber: row.e_serial_number } : undefined,
    parts: partRows.filter(p => p.work_order_id === row.id).map(toPart),
  }))

  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const pool = getPool()
  const body = await request.json()

  // Increment order counter
  const { rows: [setting] } = await pool.query(
    `UPDATE settings SET value = (value::int + 1)::text WHERE key = 'order_counter' RETURNING value`
  )
  const orderNumber = `WO-${String(setting.value).padStart(4, '0')}`
  const id = crypto.randomUUID()

  const { rows } = await pool.query(
    `INSERT INTO work_orders
       (id, order_number, customer_id, equipment_id, status, technician, complaint,
        diagnosis, work_done, labor_hours, labor_rate, date_in, date_complete,
        date_picked_up, notes, payment_method, amount_charged, amount_paid)
     VALUES ($1,$2,$3,$4,'pending',$5,$6,'','',0,80,$7,'','','','',0,0)
     RETURNING *`,
    [id, orderNumber, body.customerId, body.equipmentId,
     body.technician || 'Wade', body.complaint || '', body.dateIn || new Date().toISOString().split('T')[0]]
  )

  // Fetch joined data
  const { rows: joined } = await pool.query(
    `SELECT wo.*, c.id as c_id, c.name as c_name, c.phone as c_phone, c.source as c_source, c.referral_shop as c_referral_shop,
       e.id as e_id, e.type as e_type, e.make as e_make, e.model as e_model
     FROM work_orders wo
     LEFT JOIN customers c ON wo.customer_id = c.id
     LEFT JOIN equipment e ON wo.equipment_id = e.id
     WHERE wo.id = $1`,
    [id]
  )
  const r = joined[0]

  return NextResponse.json({
    ...toWorkOrder(r),
    customer: r.c_id ? { id: r.c_id, name: r.c_name, phone: r.c_phone, source: r.c_source, referralShop: r.c_referral_shop } : undefined,
    equipment: r.e_id ? { id: r.e_id, type: r.e_type, make: r.e_make, model: r.e_model } : undefined,
    parts: [],
  }, { status: 201 })
}
