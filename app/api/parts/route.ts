import { NextResponse } from 'next/server'
import { getPool, toPart } from '@/lib/db'

export async function GET(request: Request) {
  const pool = getPool()
  const { searchParams } = new URL(request.url)
  const workOrderId = searchParams.get('workOrderId')

  const { rows } = workOrderId
    ? await pool.query(`SELECT * FROM parts WHERE work_order_id = $1 ORDER BY created_at`, [workOrderId])
    : await pool.query(`SELECT * FROM parts ORDER BY created_at`)

  return NextResponse.json(rows.map(toPart))
}

export async function POST(request: Request) {
  const pool = getPool()
  const body = await request.json()
  const id = crypto.randomUUID()

  const { rows } = await pool.query(
    `INSERT INTO parts (id, work_order_id, name, part_number, supplier, unit_cost, quantity, status, date_ordered, date_received)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [id, body.workOrderId, body.name || '', body.partNumber || '', body.supplier || '',
     Number(body.unitCost) || 0, Number(body.quantity) || 1,
     body.status || 'ordered',
     body.dateOrdered || new Date().toISOString().split('T')[0],
     body.dateReceived || '']
  )

  return NextResponse.json(toPart(rows[0]), { status: 201 })
}
