import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'

export async function GET() {
  const pool = getPool()
  try {
    const { rows } = await pool.query('SELECT key, value FROM settings')
    const settings: Record<string, string> = {}
    rows.forEach((r) => { settings[r.key] = r.value })
    return NextResponse.json(settings)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const pool = getPool()
  try {
    const body = await req.json()
    for (const [key, value] of Object.entries(body)) {
      await pool.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = $2`,
        [key, String(value)]
      )
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
