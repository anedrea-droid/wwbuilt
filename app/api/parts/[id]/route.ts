import { NextResponse } from 'next/server'
import { getPool, toPart } from '@/lib/db'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const pool = getPool()
  const body = await request.json()

  const fields: string[] = []
  const values: unknown[] = []
  const map: Record<string, string> = {
    status: 'status', dateReceived: 'date_received', name: 'name',
    unitCost: 'unit_cost', quantity: 'quantity', supplier: 'supplier', partNumber: 'part_number'
  }
  for (const [key, col] of Object.entries(map)) {
    if (body[key] !== undefined) {
      fields.push(`${col} = $${values.length + 1}`)
      values.push(body[key])
    }
  }
  values.push(id)

  const { rows } = await pool.query(
    `UPDATE parts SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
    values
  )

  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(toPart(rows[0]))
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const pool = getPool()
  await pool.query(`DELETE FROM parts WHERE id = $1`, [id])
  return NextResponse.json({ success: true })
}
