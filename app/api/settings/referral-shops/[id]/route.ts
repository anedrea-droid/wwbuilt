import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const pool = getPool()
  try {
    const { rows } = await pool.query('SELECT is_default FROM referral_shops WHERE id = $1', [id])
    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (rows[0].is_default) {
      return NextResponse.json({ error: 'Cannot delete the default shop' }, { status: 400 })
    }
    await pool.query('DELETE FROM referral_shops WHERE id = $1', [id])
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
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
    if (body.is_default === true) {
      await pool.query('UPDATE referral_shops SET is_default = FALSE')
      await pool.query('UPDATE referral_shops SET is_default = TRUE WHERE id = $1', [id])
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
