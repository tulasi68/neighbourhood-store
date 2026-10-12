-- Neighbourhood Store - D1 Schema
-- Run with: wrangler d1 execute neighbourhood-store --file=./schema.sql

PRAGMA foreign_keys = ON;

-- Users / Roles
-- role: 'admin' | 'shopkeeper' | 'buyer'
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mobile TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'buyer', -- admin, shopkeeper, buyer
  store_id INTEGER,                  -- only for shopkeeper
  pin_hash TEXT,                     -- for admin / shopkeeper login
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- Stores
CREATE TABLE IF NOT EXISTS stores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,                        -- can be comma-separated
  payment_options TEXT DEFAULT '[{"type":"gpay","label":"GPay / UPI","enabled":true,"details":""},{"type":"cash","label":"Cash on Delivery / Pickup","enabled":true,"details":""},{"type":"qr","label":"Scan QR Code","enabled":false,"details":""},{"type":"link","label":"Payment Link","enabled":false,"details":""}]',
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL,
  category TEXT,
  name TEXT NOT NULL,
  weight TEXT,
  volume TEXT,
  mrp REAL,
  selling_price REAL NOT NULL,
  stock INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_ref TEXT NOT NULL UNIQUE,
  store_id INTEGER NOT NULL,
  buyer_mobile TEXT NOT NULL,
  buyer_name TEXT,
  payment_method TEXT,               -- gpay, cash, qr, link
  payment_status TEXT DEFAULT 'pending', -- pending, paid, failed
  status TEXT DEFAULT 'placed',      -- placed, accepted, preparing, ready, completed, cancelled
  total_amount REAL NOT NULL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER,
  product_name TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  line_total REAL NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- OTP store (for buyer login)
CREATE TABLE IF NOT EXISTS otps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mobile TEXT NOT NULL,
  otp TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_store ON orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_mobile);
CREATE INDEX IF NOT EXISTS idx_otps_mobile ON otps(mobile);
