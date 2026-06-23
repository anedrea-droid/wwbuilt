import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const body = await req.json()
  const allowed = [
    'equipment_description','acquisition_type','acquired_date','condition_notes',
    'status','asking_price','sale_price','sale_date'
  ]
  const dateFields = ['acquired_date','sale_date']
  const numericFields = ['asking_price','sale_price']
  const fields: string[] = []
  const values: unknown[] = []
  let idx = 1
  for (const key of allowed) {
    if (body[key] !== undefined) {
      let val = body[key]
      if (dateFields.includes(key) && val === '') val = null
      if (numericFields.includes(key) && (val === '' || val === null)) val = null
      fields.push(key + ' = $' + idx++)
      values.push(val)
    }
  }
  if (!fields.length) return NextResponse.json({ error: 'no fields' }, { status: 400 })
  values.push(id)
  await (await getPool()).query(
    'UPDATE shop_equipment SET ' + fields.join(', ') + ' WHERE id = $' + idx,
    values
  )
  const result = await (await getPool()).query('SELECT * FROM shop_equipment WHERE id = $1', [id])
  return NextResponse.json(result.rows[0])
}

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  await (await getPool()).query('DELETE FROM shop_equipment WHERE id = $1', [id])
  return NextResponse.json({ ok: true })
}
