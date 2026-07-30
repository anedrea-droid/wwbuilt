import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'

export async function GET(request: Request) {
  const pool = getPool()
  const { searchParams } = new URL(request.url)
  const workOrderId = searchParams.get('workOrderId')
  const customerId = searchParams.get('customerId')

  const conditions: string[] = []
  const values: unknown[] = []
  if (workOrderId) { conditions.push('work_order_id = $' + (values.length + 1)); values.push(workOrderId) }
  if (customerId) { conditions.push('customer_id = $' + (values.length + 1)); values.push(customerId) }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''

  try {
    const { rows } = await pool.query(
      'SELECT * FROM contact_log ' + where + ' ORDER BY created_at DESC',
      values
    )
    return NextResponse.json(rows.map(r => ({
      id: r.id,
      workOrderId: r.work_order_id,
      customerId: r.customer_id,
      type: r.type,
      createdAt: r.created_at,
    })))
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const pool = getPool()
  try {
    const body = await request.json()
    const id = crypto.randomUUID()
    const { rows } = await pool.query(
      'INSERT INTO contact_log (id, work_order_id, customer_id, type) VALUES ($1,$2,$3,$4) RETURNING *',
      [id, body.workOrderId || null, body.customerId || null, body.type || 'call']
    )
    const r = rows[0]
    return NextResponse.json({
      id: r.id, workOrderId: r.work_order_id, customerId: r.customer_id, type: r.type, createdAt: r.created_at,
    }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
