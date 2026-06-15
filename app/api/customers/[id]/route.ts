import { NextResponse } from 'next/server'
import { getPool, toCustomer, toEquipment, toWorkOrder, toPart } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const pool = getPool()

  const [custRes, equipRes, woRes] = await Promise.all([
    pool.query(`SELECT * FROM customers WHERE id = $1`, [id]),
    pool.query(`SELECT * FROM equipment WHERE customer_id = $1 ORDER BY created_at`, [id]),
    pool.query(`SELECT * FROM work_orders WHERE customer_id = $1 ORDER BY created_at DESC`, [id]),
  ])

  if (!custRes.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const workOrderIds = woRes.rows.map(wo => wo.id)
  let parts: Record<string, unknown>[] = []
  if (workOrderIds.length > 0) {
    const partsRes = await pool.query(
      `SELECT p.*, e.type as equip_type, e.make as equip_make, e.model as equip_model
       FROM parts p WHERE p.work_order_id = ANY($1)`,
      [workOrderIds]
    )
    parts = partsRes.rows
  }

  const equipMap = Object.fromEntries(equipRes.rows.map(e => [e.id, e]))

  const workOrders = woRes.rows.map(wo => ({
    ...toWorkOrder(wo),
    equipment: equipMap[wo.equipment_id as string] ? toEquipment(equipMap[wo.equipment_id as string]) : undefined,
    parts: parts.filter(p => p.work_order_id === wo.id).map(toPart),
  }))

  return NextResponse.json({
    customer: toCustomer(custRes.rows[0]),
    equipment: equipRes.rows.map(toEquipment),
    workOrders,
  })
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const pool = getPool()
  const body = await request.json()

  const { rows } = await pool.query(
    `UPDATE customers SET name=$1, phone=$2, email=$3, source=$4, referral_shop=$5, notes=$6
     WHERE id=$7 RETURNING *`,
    [body.name, body.phone, body.email, body.source, body.referralShop, body.notes, id]
  )

  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(toCustomer(rows[0]))
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const pool = getPool()
  await pool.query(`DELETE FROM customers WHERE id = $1`, [id])
  return NextResponse.json({ success: true })
}
