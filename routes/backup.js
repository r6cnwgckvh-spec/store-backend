const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../database');

router.get('/export', (req, res) => {
  const data = {
    products: db.prepare('SELECT * FROM products WHERE user_id = ?').all(req.user.userId),
    customers: db.prepare('SELECT * FROM customers WHERE user_id = ?').all(req.user.userId),
    orders: db.prepare('SELECT * FROM orders WHERE user_id = ?').all(req.user.userId),
    order_items: db.prepare('SELECT oi.* FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE o.user_id = ?').all(req.user.userId),
    purchases: db.prepare('SELECT * FROM purchases WHERE user_id = ?').all(req.user.userId),
    returns: db.prepare('SELECT r.* FROM returns r JOIN orders o ON r.order_id = o.id WHERE o.user_id = ?').all(req.user.userId),
    categories: db.prepare('SELECT * FROM categories WHERE user_id = ?').all(req.user.userId),
    settings: db.prepare('SELECT * FROM store_settings').all(),
    exported_at: new Date().toISOString(),
  };
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=store-backup-${Date.now()}.json`);
  res.json(data);
});

router.post('/import', (req, res) => {
  const { data } = req.body;
  if (!data || typeof data !== 'object') return res.status(400).json({ error: 'Invalid backup data' });
  const transaction = db.transaction(() => {
    const userId = req.user.userId;
    const results = { products: 0, customers: 0, categories: 0, purchases: 0 };
    if (Array.isArray(data.products)) {
      for (const p of data.products) {
        const existing = db.prepare('SELECT id FROM products WHERE barcode = ? AND user_id = ?').get(p.barcode, userId);
        if (existing) {
          db.prepare('UPDATE products SET name=?,price=?,stock=?,cost_price=?,category=?,tablets_per_strip=?,expiry_date=?,min_stock=? WHERE id=? AND user_id=?')
            .run(p.name, p.price, p.stock, p.cost_price||0, p.category||'', p.tablets_per_strip||1, p.expiry_date||'', p.min_stock||0, existing.id, userId);
        } else {
          db.prepare('INSERT INTO products (barcode,name,price,stock,cost_price,category,tablets_per_strip,expiry_date,image_url,min_stock,user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
            .run(p.barcode || `IMP-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, p.name, p.price, p.stock, p.cost_price||0, p.category||'', p.tablets_per_strip||1, p.expiry_date||'', p.image_url||'', p.min_stock||0, userId);
        }
        results.products++;
      }
    }
    if (Array.isArray(data.customers)) {
      for (const c of data.customers) {
        const existing = db.prepare('SELECT id FROM customers WHERE phone=? AND user_id=?').get(c.phone, userId);
        if (existing) {
          db.prepare('UPDATE customers SET name=?,email=?,address=? WHERE id=? AND user_id=?').run(c.name, c.email||'', c.address||'', existing.id, userId);
        } else {
          db.prepare('INSERT INTO customers (name,phone,email,address,user_id) VALUES (?,?,?,?,?)').run(c.name, c.phone||'', c.email||'', c.address||'', userId);
        }
        results.customers++;
      }
    }
    if (Array.isArray(data.categories)) {
      for (const cat of data.categories) {
        const existing = db.prepare('SELECT id FROM categories WHERE name=? AND user_id=?').get(cat.name, userId);
        if (!existing) {
          db.prepare('INSERT INTO categories (name,color,user_id) VALUES (?,?,?)').run(cat.name, cat.color||'#007bff', userId);
          results.categories++;
        }
      }
    }
    return results;
  });
  try { const r = transaction(); res.json({ message: 'Restore complete', ...r }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/stats', (req, res) => {
  const stats = {
    products: db.prepare('SELECT COUNT(*) as c FROM products WHERE user_id = ?').get(req.user.userId).c,
    customers: db.prepare('SELECT COUNT(*) as c FROM customers WHERE user_id = ?').get(req.user.userId).c,
    orders: db.prepare('SELECT COUNT(*) as c FROM orders WHERE user_id = ?').get(req.user.userId).c,
    lowStock: db.prepare('SELECT COUNT(*) as c FROM products WHERE min_stock > 0 AND stock <= min_stock AND user_id = ?').get(req.user.userId).c,
    outOfStock: db.prepare('SELECT COUNT(*) as c FROM products WHERE stock <= 0 AND user_id = ?').get(req.user.userId).c,
    monthlyRevenue: db.prepare("SELECT COALESCE(SUM(total_amount),0) as c FROM orders WHERE user_id = ? AND created_at >= date('now', '-30 days')").get(req.user.userId).c,
  };
  res.json(stats);
});

module.exports = router;
