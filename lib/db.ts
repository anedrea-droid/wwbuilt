import { Pool } from 'pg'

let _pool: Pool | null = null

export function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.DATABASE_URL?.includes('railway') ||
        process.env.NODE_ENV === 'production'
          ? { rejectUnauthorized: false }
          : false,
    })
  }
  return _pool
}

export function toCustomer(r: Record<string, unknown>) {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    email: r.email,
    source: r.source,
    referralShop: r.referral_shop,
    notes: r.notes,
    createdAt: r.created_at,
  }
}

export function toEquipment(r: Record<string, unknown>) {
  return {
    id: r.id,
    customerId: r.customer_id,
    type: r.type,
    make: r.make,
    model: r.model,
    year: r.year,
    serialNumber: r.serial_number,
    color: r.color,
    notes: r.notes,
    createdAt: r.created_at,
  }
}

export function toWorkOrder(r: Record<string, unknown>) {
  return {
    id: r.id,
    orderNumber: r.order_number,
    customerId: r.customer_id,
    equipmentId: r.equipment_id,
    status: r.status,
    technician: r.technician,
    complaint: r.complaint,
    diagnosis: r.diagnosis,
    workDone: r.work_done,
    laborHours: r.labor_hours,
    laborRate: r.labor_rate,
    dateIn: r.date_in,
    dateComplete: r.date_complete,
    datePickedUp: r.date_picked_up,
    notes: r.notes,
    paymentMethod: r.payment_method,
    amountCharged: r.amount_charged,
    amountPaid: r.amount_paid,
    createdAt: r.created_at,
  }
}

export function toPart(r: Record<string, unknown>) {
  return {
    id: r.id,
    workOrderId: r.work_order_id,
    name: r.name,
    partNumber: r.part_number,
    supplier: r.supplier,
    quantity: r.quantity,
    cost: r.cost ?? 0,
    price: r.price ?? 0,
    status: r.status,
    dateOrdered: r.date_ordered,
    dateReceived: r.date_received,
    notes: r.notes,
    createdAt: r.created_at,
  }
}
