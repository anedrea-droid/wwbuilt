import { NextResponse } from 'next/server'
import { getPool, toPart } from '@/lib/db'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const pool = getPool()
  try {
    const body = await req.json()
    const fields: string[] = []
    const values: unknown[] = []
    let idx = 1

    const allowed = ['name','part_number','supplier','quantity','status','date_ordered','date_received','cost','price','notes']

    for (const key of allowed) {
      if (body[key] !== undefined) {
        fields.push(`${key} = $${idx++}`)
        values.push(body[key])
      }
    }

    if (fields.length === 0)
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

    values.push(id)
    const { rows } = await pool.query(
      `UPDATE parts SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    )
    if (rows.length === 0)
      return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json(toPart(rows[0]))
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
    await pool.query('DELETE FROM parts WHERE id = $1', [id])
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
