import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'

export async function GET() {
  const result = await (await getPool()).query(`
    SELECT
      se.id,
      se.work_order_id,
      se.equipment_description,
      se.acquisition_type,
      se.acquired_date,
      se.condition_notes,
      se.status,
      se.asking_price,
      se.sale_price,
      se.sale_date,
      se.created_at,
      wo.date_in,
      wo.id AS wo_number
    FROM shop_equipment se
    LEFT JOIN work_orders wo ON wo.id = se.work_order_id
    ORDER BY se.acquired_date DESC NULLS LAST, se.created_at DESC
  `)
  return NextResponse.json(result.rows)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    work_order_id,
    equipment_description,
    acquisition_type,
    acquired_date,
    condition_notes,
    status,
    asking_price,
    sale_price,
    sale_date
  } = body

  const result = await (await getPool()).query(
    `INSERT INTO shop_equipment
      (work_order_id, equipment_description, acquisition_type, acquired_date, condition_notes, status, asking_price, sale_price, sale_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      work_order_id || null,
      equipment_description || '',
      acquisition_type || 'abandoned',
      acquired_date || null,
      condition_notes || null,
      status || 'available',
      asking_price || null,
      sale_price || null,
      sale_date || null
    ]
  )
  return NextResponse.json(result.rows[0], { status: 201 })
}
