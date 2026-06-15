import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ customers: [], workOrders: [], equipment: [] })

  const pool = getPool()
  const pattern = `%${q}%`

  const [custRes, woRes, equipRes] = await Promise.all([
    pool.query(
      `SELECT * FROM customers WHERE name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1 ORDER BY name`,
      [pattern]
    ),
    pool.query(
      `SELECT wo.*, c.name as c_name, e.type as e_type, e.make as e_make, e.model as e_model
       FROM work_orders wo
       LEFT JOIN customers c ON wo.customer_id = c.id
       LEFT JOIN equipment e ON wo.equipment_id = e.id
       WHERE wo.order_number ILIKE $1 OR wo.complaint ILIKE $1 OR wo.diagnosis ILIKE $1 OR wo.work_done ILIKE $1
       ORDER BY wo.created_at DESC`,
      [pattern]
    ),
    pool.query(
      `SELECT e.*, c.id as c_id, c.name as c_name
       FROM equipment e LEFT JOIN customers c ON e.customer_id = c.id
       WHERE e.make ILIKE $1 OR e.model ILIKE $1 OR e.type ILIKE $1 OR e.serial_number ILIKE $1`,
      [pattern]
    ),
  ])

  return NextResponse.json({
    customers: custRes.rows.map((c: Record<string, unknown>) => ({
      id: c.id, name: c.name, phone: c.phone, source: c.source, referralShop: c.referral_shop
    })),
    workOrders: woRes.rows.map((wo: Record<string, unknown>) => ({
      id: wo.id, orderNumber: wo.order_number, status: wo.status, technician: wo.technician,
      complaint: wo.complaint, dateIn: wo.date_in,
      customer: wo.c_name ? { name: wo.c_name } : undefined,
      equipment: wo.e_type ? { type: wo.e_type, make: wo.e_make, model: wo.e_model } : undefined,
    })),
    equipment: equipRes.rows.map((e: Record<string, unknown>) => ({
      id: e.id, type: e.type, make: e.make, model: e.model, serialNumber: e.serial_number,
      customer: e.c_id ? { id: e.c_id, name: e.c_name } : undefined,
    })),
  })
}
