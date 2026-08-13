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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const pool = getPool()
  try {
    const body = await req.json()

    // Relative adjustment - used when pulling a part into a work order to
    // decrement stock (negative) without needing to know the current count.
    if (body.adjustQuantityBy !== undefined) {
      const { rows } = await pool.query(
        'UPDATE saved_parts SET quantity_on_hand = GREATEST(0, quantity_on_hand + $1) WHERE id = $2 RETURNING *',
        [Number(body.adjustQuantityBy) || 0, id]
      )
      if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json(toSavedPart(rows[0]))
    }

    const fields: string[] = []
    const values: unknown[] = []
    let idx = 1
    const map: Record<string, string> = {
      name: 'name', partNumber: 'part_number', supplier: 'supplier',
      cost: 'cost', price: 'price', quantityOnHand: 'quantity_on_hand', notes: 'notes',
    }
    for (const key of Object.keys(map)) {
      if (body[key] !== undefined) {
        fields.push(map[key] + ' = $' + idx++)
        values.push(body[key])
      }
    }
    if (fields.length === 0) return NextResponse.json({ error: 'No fields' }, { status: 400 })
    values.push(id)
    const { rows } = await pool.query(
      'UPDATE saved_parts SET ' + fields.join(', ') + ' WHERE id = $' + idx + ' RETURNING *',
      values
    )
    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(toSavedPart(rows[0]))
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const pool = getPool()
  try {
    await pool.query('DELETE FROM saved_parts WHERE id = $1', [id])
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
