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
    quantityOnHand: r.quantity_on_hand ?? 0,
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
    const receivedQty = Number(body.quantityOnHand) || 0

    // If receiving stock for a part that already exists (matched by name + part
    // number), just add to its existing quantity instead of creating a duplicate.
    if (receivedQty > 0) {
      const { rows: existing } = await pool.query(
        'SELECT * FROM saved_parts WHERE LOWER(name) = LOWER($1) AND COALESCE(part_number,\'\') = COALESCE($2,\'\') LIMIT 1',
        [body.name, body.partNumber || '']
      )
      if (existing.length > 0) {
        const { rows } = await pool.query(
          'UPDATE saved_parts SET quantity_on_hand = quantity_on_hand + $1, cost = $2, price = $3, supplier = $4 WHERE id = $5 RETURNING *',
          [receivedQty, body.cost || 0, body.price || 0, body.supplier || existing[0].supplier || '', existing[0].id]
        )
        return NextResponse.json(toSavedPart(rows[0]), { status: 200 })
      }
    }

    const id = crypto.randomUUID()
    const { rows } = await pool.query(
      'INSERT INTO saved_parts (id, name, part_number, supplier, cost, price, quantity_on_hand, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [id, body.name, body.partNumber || '', body.supplier || '', body.cost || 0, body.price || 0, receivedQty, body.notes || '']
    )
    return NextResponse.json(toSavedPart(rows[0]), { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
