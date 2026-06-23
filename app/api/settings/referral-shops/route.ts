import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'

export async function GET() {
  const pool = getPool()
  try {
    const { rows } = await pool.query(
      'SELECT id, name, is_default FROM referral_shops ORDER BY is_default DESC, name ASC'
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
      'INSERT INTO referral_shops (id, name, is_default) VALUES (gen_random_uuid(), $1, FALSE) RETURNING id, name, is_default',
      [name]
    )
    return NextResponse.json(rows[0])
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
