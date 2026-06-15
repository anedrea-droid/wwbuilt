import { NextResponse } from 'next/server'
import { getPool, toCustomer } from '@/lib/db'

export async function GET(request: Request) {
  const pool = getPool()
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')

  const { rows } = q
    ? await pool.query(
        `SELECT * FROM customers WHERE name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1 ORDER BY name`,
        [`%${q}%`]
      )
    : await pool.query(`SELECT * FROM customers ORDER BY name`)

  return NextResponse.json(rows.map(toCustomer))
}

export async function POST(request: Request) {
  const pool = getPool()
  const body = await request.json()
  const id = crypto.randomUUID()

  const { rows } = await pool.query(
    `INSERT INTO customers (id, name, phone, email, source, referral_shop, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [id, body.name || '', body.phone || '', body.email || '',
     body.source || 'own', body.referralShop || '', body.notes || '']
  )

  return NextResponse.json(toCustomer(rows[0]), { status: 201 })
}
