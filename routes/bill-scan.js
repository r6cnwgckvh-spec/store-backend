const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../database');

function getSecret() {
  const row = db.prepare('SELECT jwt_secret, id FROM store_settings WHERE user_id = 1').get();
  if (row?.jwt_secret) return row.jwt_secret;
  const crypto = require('crypto');
  const secret = crypto.randomBytes(32).toString('hex');
  if (row?.id) {
    db.prepare('UPDATE store_settings SET jwt_secret = ? WHERE id = ?').run(secret, row.id);
  } else {
    db.prepare('INSERT INTO store_settings (user_id, jwt_secret, store_name, address, phone) VALUES (1, ?, ?, ?, ?)').run(secret, 'Your Store Name', '123 Main Street, City', '+91 98765 43210');
  }
  return secret;
}

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
  try {
    req.user = jwt.verify(header.slice(7), getSecret());
    next();
  } catch { return res.status(401).json({ error: 'Invalid or expired token' }); }
}

router.post('/', auth, (req, res) => {
  const { items } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one item is required' });
  }

  const transaction = db.transaction(() => {
    const results = { purchase_ids: [], created: [], updated: [], skipped: [] };

    for (const item of items) {
      const name = (item.name || '').trim();
      if (!name) { results.skipped.push({ reason: 'no name', item }); continue; }

      const quantity = Math.max(1, parseInt(item.quantity) || 1);
      const cost_price = Math.max(0, parseFloat(item.cost_price) || 0);
      const selling_price = Math.max(0, parseFloat(item.selling_price) || 0);
      const tablets_per_strip = Math.max(1, parseInt(item.tablets_per_strip) || 1);
      const category = (item.category || '').trim();
      const barcode = (item.barcode || '').trim();
      const expiry_date = (item.expiry_date || '').trim();
      const is_medicine = item.is_medicine === true;

      const stock = is_medicine ? quantity * tablets_per_strip : quantity;

      let product = null;
      if (barcode) {
        product = db.prepare('SELECT * FROM products WHERE barcode = ? AND user_id = ?').get(barcode, req.user.userId);
      }

      if (product) {
        const newStock = product.stock + stock;
        const newPrice = selling_price > 0 ? selling_price : product.price;
        db.prepare('UPDATE products SET stock = ?, price = ?, cost_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(newStock, newPrice, cost_price > 0 ? cost_price : product.cost_price, product.id);
        results.updated.push({ id: product.id, name: product.name, stock: newStock });
        const pid = db.prepare(
          'INSERT INTO purchases (product_id, product_name, quantity, cost_price, supplier, notes, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(product.id, product.name, stock, cost_price, '', '', req.user.userId).lastInsertRowid;
        results.purchase_ids.push(pid);
      } else {
        const safeBarcode = barcode || `MANUAL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const existing = db.prepare('SELECT id FROM products WHERE barcode = ? AND user_id = ?').get(safeBarcode, req.user.userId);
        if (existing) {
          results.skipped.push({ reason: 'barcode conflict', item });
          continue;
        }
        const pid = db.prepare(`
          INSERT INTO products (barcode, name, price, stock, cost_price, category, tablets_per_strip, expiry_date, image_url, user_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(safeBarcode, name, selling_price, stock, cost_price, category, tablets_per_strip, expiry_date, '', req.user.userId).lastInsertRowid;
        const purchaseId = db.prepare(
          'INSERT INTO purchases (product_id, product_name, quantity, cost_price, supplier, notes, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(pid, name, stock, cost_price, '', '', req.user.userId).lastInsertRowid;
        results.purchase_ids.push(purchaseId);
        results.created.push({ id: pid, name, barcode: safeBarcode });
      }
    }

    return results;
  });

  try {
    const results = transaction();
    res.status(201).json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
