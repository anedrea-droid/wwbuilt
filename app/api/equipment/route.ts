import { NextResponse } from 'next/server'
import { getPool, toEquipment } from '@/lib/db'

export async function GET(request: Request) {
  const pool = getPool()
  const { searchParams } = new URL(request.url)
  const customerId = searchParams.get('customerId')

  const { rows } = customerId
    ? await pool.query(`SELECT * FROM equipment WHERE customer_id = $1 ORDER BY created_at`, [customerId])
    : await pool.query(`SELECT * FROM equipment ORDER BY created_at`)

  return NextResponse.json(rows.map(toEquipment))
}

export async function POST(request: Request) {
  const pool = getPool()
  const body = await request.json()
  const id = crypto.randomUUID()

  const { rows } = await pool.query(
    `INSERT INTO equipment (id, customer_id, type, make, model, serial_number, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [id, body.customerId, body.type || 'Other', body.make || '',
     body.model || '', body.serialNumber || '', body.notes || '']
  )

  return NextResponse.json(toEquipment(rows[0]), { status: 201 })
}
