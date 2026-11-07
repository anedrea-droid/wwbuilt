import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'

// Finished jobs that never got an invoice amount, and what we would fill in:
//   - referral job with a shop payment amount -> that amount
//   - direct job with an amount already paid  -> the amount paid
//   - otherwise                               -> the labor + parts-charged estimate
// Skips No Charge, donated, abandoned, denied-service and no-payment-recorded jobs.
const CANDIDATES = `
  WITH base AS (
    SELECT wo.id, wo.order_number, wo.status,
      COALESCE(wo.amount_paid, 0) AS amount_paid,
      COALESCE(wo.shop_payment_amount, 0) AS shop_payment_amount,
      c.name AS customer_name,
      COALESCE(NULLIF(COALESCE(wo.source, c.source), ''), 'own') AS customer_source,
      ROUND((COALESCE(wo.labor_hours, 0) * COALESCE(wo.labor_rate, 80) +
        COALESCE((SELECT SUM(p.price * p.quantity) FROM parts p WHERE p.work_order_id = wo.id), 0))::numeric, 2) AS estimate
    FROM work_orders wo
    LEFT JOIN customers c ON c.id = wo.customer_id
    WHERE (wo.amount_charged IS NULL OR wo.amount_charged = 0)
      AND wo.status NOT IN ('donated', 'abandoned')
      AND COALESCE(wo.never_paid, false) = false
      AND COALESCE(wo.service_denied, false) = false
      AND COALESCE(wo.payment_method, '') <> 'no charge'
      AND (
        (COALESCE(NULLIF(COALESCE(wo.source, c.source), ''), 'own') <> 'referral' AND wo.status IN ('complete', 'picked-up'))
        OR (COALESCE(NULLIF(COALESCE(wo.source, c.source), ''), 'own') = 'referral'
            AND NULLIF(wo.referral_dropoff_date::text, '') IS NOT NULL
            AND wo.status IN ('at-shop', 'complete', 'picked-up'))
      )
  ), proposed AS (
    SELECT base.*,
      CASE
        WHEN customer_source = 'referral' AND shop_payment_amount > 0 THEN shop_payment_amount
        WHEN customer_source <> 'referral' AND amount_paid > 0 THEN amount_paid
        ELSE estimate
      END AS proposed,
      CASE
        WHEN customer_source = 'referral' AND shop_payment_amount > 0 THEN 'shop payment amount'
        WHEN customer_source <> 'referral' AND amount_paid > 0 THEN 'amount already paid'
        ELSE 'labor + parts estimate'
      END AS based_on
    FROM base
  )
  SELECT id, order_number, status, customer_name, customer_source, estimate, amount_paid, proposed, based_on
  FROM proposed WHERE proposed > 0
`

export async function GET() {
  const pool = getPool()
  try {
    const { rows } = await pool.query(CANDIDATES + ' ORDER BY order_number')
    let backupCount = 0
    try {
      const b = await pool.query('SELECT COUNT(*)::int AS n FROM invoice_backfill_backup')
      backupCount = b.rows[0].n
    } catch { backupCount = 0 }
    return NextResponse.json({ rows, backupCount })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST() {
  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      'CREATE TABLE IF NOT EXISTS invoice_backfill_backup (' +
      'work_order_id TEXT PRIMARY KEY, old_amount_charged NUMERIC, new_amount_charged NUMERIC, filled_at TIMESTAMPTZ DEFAULT NOW())'
    )
    await client.query(
      'INSERT INTO invoice_backfill_backup (work_order_id, old_amount_charged, new_amount_charged) ' +
      'SELECT x.id::text, wo.amount_charged, x.proposed FROM (' + CANDIDATES + ') x JOIN work_orders wo ON wo.id = x.id ' +
      'ON CONFLICT (work_order_id) DO UPDATE SET new_amount_charged = EXCLUDED.new_amount_charged, filled_at = NOW()'
    )
    const res = await client.query(
      'UPDATE work_orders wo SET amount_charged = x.proposed FROM (' + CANDIDATES + ') x WHERE wo.id = x.id'
    )
    await client.query('COMMIT')
    return NextResponse.json({ updated: res.rowCount })
  } catch (e) {
    await client.query('ROLLBACK')
    return NextResponse.json({ error: String(e) }, { status: 500 })
  } finally {
    client.release()
  }
}

// Undo: put back the old (empty) invoice amounts, but only where nobody has changed the invoice since.
export async function DELETE() {
  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const res = await client.query(
      'UPDATE work_orders wo SET amount_charged = b.old_amount_charged FROM invoice_backfill_backup b ' +
      'WHERE wo.id::text = b.work_order_id AND wo.amount_charged = b.new_amount_charged'
    )
    await client.query('DELETE FROM invoice_backfill_backup')
    await client.query('COMMIT')
    return NextResponse.json({ restored: res.rowCount })
  } catch (e) {
    await client.query('ROLLBACK')
    return NextResponse.json({ error: String(e) }, { status: 500 })
  } finally {
    client.release()
  }
}
