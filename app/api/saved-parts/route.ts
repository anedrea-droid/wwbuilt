import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'

function toSavedPart(r: Record<string, unknown>) {
  return {
    id: r.id,
    name: r.name,
    partNumber: r.part_number,
    supplier: r.supplier,
    cost: r.cost ?? 0,
    price: r.price ?? 0,
    notes: r.notes,
    createdAt: r.created_at,
  }
}

export async function GET() {
  const pool = getPool()
  try {
    const { rows } = await pool.query('SELECT * FROM saved_parts ORDER BY name ASC')
    return NextResponse.json(rows.map(toSavedPart))
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const pool = getPool()
  try {
    const body = await req.json()
    if (!body.name) return NextResponse.json({ error: 'Name required' }, { status: 400 })
    const id = crypto.randomUUID()
    const { rows } = await pool.query(
      'INSERT INTO saved_parts (id, name, part_number, supplier, cost, price, notes) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [id, body.name, body.partNumber||'', body.supplier||'', body.cost||0, body.price||0, body.notes||'']
    )
    return NextResponse.json(toSavedPart(rows[0]), { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
