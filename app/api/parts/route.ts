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
    const { rows } = await pool.query(
      `INSERT INTO parts
         (id, work_order_id, name, part_number, supplier, quantity,
          cost, price, status, date_ordered, date_received, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'ordered',$9,'','')
       RETURNING *`,
      [
        id,
        body.workOrderId,
        body.name || '',
        body.partNumber || '',
        body.supplier || '',
        body.quantity || 1,
        body.cost || 0,
        body.price || 0,
        body.dateOrdered || new Date().toISOString().split('T')[0],
      ]
    )
    return NextResponse.json(toPart(rows[0]))
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
