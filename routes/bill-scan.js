const express = require('express');
const router = express.Router();
const db = require('../database');

router.post('/', (req, res) => {
  const { items, notes, image_data } = req.body;
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

      let product = null;
      if (barcode) {
        product = db.prepare('SELECT * FROM products WHERE barcode = ? AND user_id = ?').get(barcode, req.user.userId);
      }

      if (product) {
        const newStock = product.stock + quantity;
        const newPrice = selling_price > 0 ? selling_price : product.price;
        db.prepare('UPDATE products SET stock = ?, price = ?, cost_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(newStock, newPrice, cost_price > 0 ? cost_price : product.cost_price, product.id);
        results.updated.push({ id: product.id, name: product.name, stock: newStock });
        const pid = db.prepare(
          'INSERT INTO purchases (product_id, product_name, quantity, cost_price, supplier, notes, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(product.id, product.name, quantity, cost_price, notes || '', '', req.user.userId).lastInsertRowid;
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
        `).run(safeBarcode, name, selling_price, quantity, cost_price, category, tablets_per_strip, expiry_date, image_data || '', req.user.userId).lastInsertRowid;
        const purchaseId = db.prepare(
          'INSERT INTO purchases (product_id, product_name, quantity, cost_price, supplier, notes, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(pid, name, quantity, cost_price, notes || '', '', req.user.userId).lastInsertRowid;
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
