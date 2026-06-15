import { NextResponse } from 'next/server'
import { getPool, toEquipment } from '@/lib/db'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const pool = getPool()
  const body = await request.json()

  const { rows } = await pool.query(
    `UPDATE equipment SET type=$1, make=$2, model=$3, serial_number=$4, notes=$5
     WHERE id=$6 RETURNING *`,
    [body.type, body.make, body.model, body.serialNumber, body.notes, id]
  )

  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(toEquipment(rows[0]))
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const pool = getPool()
  await pool.query(`DELETE FROM equipment WHERE id = $1`, [id])
  return NextResponse.json({ success: true })
}
