import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'

export async function GET() {
  const pool = getPool()
  try {
    const { rows } = await pool.query(
      'SELECT id, name FROM equipment_makes ORDER BY name ASC'
    )
    return NextResponse.json(rows)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const pool = getPool()
  try {
    const body = await req.json()
    if (!body.name || !String(body.name).trim()) {
      return NextResponse.json({ error: 'Name required' }, { status: 400 })
    }
    const name = String(body.name).trim()
    const { rows } = await pool.query(
      'INSERT INTO equipment_makes (id, name) VALUES (gen_random_uuid(), $1) RETURNING id, name',
      [name]
    )
    return NextResponse.json(rows[0])
  } catch (e: unknown) {
    const msg = String(e)
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return NextResponse.json({ error: 'That make already exists' }, { status: 400 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
