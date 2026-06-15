-- Run this in your Supabase SQL Editor (one time only)

CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  source TEXT DEFAULT 'own',
  referral_shop TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE equipment (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'Other',
  make TEXT DEFAULT '',
  model TEXT DEFAULT '',
  serial_number TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE work_orders (
  id TEXT PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  customer_id TEXT REFERENCES customers(id),
  equipment_id TEXT REFERENCES equipment(id),
  status TEXT DEFAULT 'pending',
  technician TEXT DEFAULT 'Wade',
  complaint TEXT DEFAULT '',
  diagnosis TEXT DEFAULT '',
  work_done TEXT DEFAULT '',
  labor_hours NUMERIC DEFAULT 0,
  labor_rate NUMERIC DEFAULT 65,
  date_in TEXT DEFAULT '',
  date_complete TEXT DEFAULT '',
  date_picked_up TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  payment_method TEXT DEFAULT '',
  amount_charged NUMERIC DEFAULT 0,
  amount_paid NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE parts (
  id TEXT PRIMARY KEY,
  work_order_id TEXT REFERENCES work_orders(id) ON DELETE CASCADE,
  name TEXT DEFAULT '',
  part_number TEXT DEFAULT '',
  supplier TEXT DEFAULT '',
  unit_cost NUMERIC DEFAULT 0,
  quantity INTEGER DEFAULT 1,
  status TEXT DEFAULT 'ordered',
  date_ordered TEXT DEFAULT '',
  date_received TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO settings (key, value) VALUES ('order_counter', '0');
