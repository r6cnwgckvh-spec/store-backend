const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'store.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barcode TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    price REAL NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    description TEXT DEFAULT '',
    category TEXT DEFAULT '',
    size TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    min_stock INTEGER DEFAULT 0,
    cost_price REAL DEFAULT 0,
    expiry_date TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    tablets_per_strip INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    old_price REAL NOT NULL,
    new_price REAL NOT NULL,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    address TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    customer_name TEXT DEFAULT '',
    customer_phone TEXT DEFAULT '',
    total_amount REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    payment_method TEXT DEFAULT 'Cash',
    notes TEXT DEFAULT '',
    items_count INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    product_barcode TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    price REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS store_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    store_name TEXT DEFAULT 'Your Store Name',
    address TEXT DEFAULT '123 Main Street, City',
    phone TEXT DEFAULT '+91 98765 43210',
    email TEXT DEFAULT '',
    tax_id TEXT DEFAULT ''
  );

  INSERT OR IGNORE INTO store_settings (id, store_name, address, phone, email, tax_id)
  VALUES (1, 'Your Store Name', '123 Main Street, City', '+91 98765 43210', '', '');

  CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    cost_price REAL NOT NULL DEFAULT 0,
    supplier TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    reason TEXT DEFAULT '',
    refund_amount REAL NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    google_id TEXT DEFAULT '',
    pin_hash TEXT DEFAULT '',
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
    role TEXT DEFAULT 'user' CHECK(role IN ('user','admin')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration: Add columns if missing
function addColumnIfMissing(table, column, def) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
    console.log(`Migration: Added ${table}.${column}`);
  } catch (e) {
    if (e.message.includes('duplicate column')) {
      console.log(`Migration: ${table}.${column} already exists`);
    } else {
      console.error(`Migration error (${table}.${column}): ${e.message}`);
    }
  }
}

addColumnIfMissing('orders', 'discount', 'REAL NOT NULL DEFAULT 0');
addColumnIfMissing('orders', 'payment_method', "TEXT DEFAULT 'Cash'");
addColumnIfMissing('orders', 'notes', "TEXT DEFAULT ''");

addColumnIfMissing('products', 'min_stock', 'INTEGER DEFAULT 0');
addColumnIfMissing('products', 'cost_price', 'REAL DEFAULT 0');
addColumnIfMissing('products', 'expiry_date', "TEXT DEFAULT ''");
addColumnIfMissing('products', 'image_url', "TEXT DEFAULT ''");
addColumnIfMissing('products', 'tablets_per_strip', 'INTEGER DEFAULT 1');

addColumnIfMissing('store_settings', 'currency_symbol', "TEXT DEFAULT '\u20B9'");
addColumnIfMissing('store_settings', 'currency_code', "TEXT DEFAULT 'INR'");
addColumnIfMissing('store_settings', 'auth_pin', "TEXT DEFAULT ''");
addColumnIfMissing('store_settings', 'jwt_secret', "TEXT DEFAULT ''");

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    color TEXT DEFAULT '#007bff',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS product_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

module.exports = db;
